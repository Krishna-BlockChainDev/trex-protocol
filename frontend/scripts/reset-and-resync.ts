/**
 * reset-and-resync.ts
 *
 * Wipes all TokenTransaction rows, resets lastSyncedBlock/lastSyncedAt on every
 * ecosystem, then performs a full re-sync from block 0 for every ecosystem in
 * the DB (including trexFactory + oidIdFactory from ChainInfrastructure).
 *
 * Usage (from the frontend/ directory):
 *   npx tsx scripts/reset-and-resync.ts
 *
 * What this fixes:
 *   1. Mis-classified rows (e.g. AddAgent as System instead of Token)
 *   2. Missing deployTREXSuite rows (because factory wasn't scanned before)
 *   3. blockNumber precision bug (parseInt → BigInt direct conversion)
 *   4. Ensures all factory + proxy addresses are scanned
 */

import { db } from '../lib/db';
import {
  syncTransactionsFromExplorer,
  type EcosystemContracts,
} from '../lib/explorer';

async function main() {
  console.log('\n========= Reset + Full Re-Sync =========\n');

  // ── Step 1: Wipe all existing transaction rows ────────────────────────────
  console.log('Step 1: Deleting all TokenTransaction rows...');
  const deleted = await db.tokenTransaction.deleteMany({});
  console.log(`  ✓ Deleted ${deleted.count} rows\n`);

  // ── Step 2: Reset lastSyncedAt + lastSyncedBlock on all ecosystems ─────────
  console.log('Step 2: Resetting sync state on all ecosystems...');
  const reset = await db.tokenEcosystem.updateMany({
    data: {
      lastSyncedAt: null,
      lastSyncedBlock: BigInt(0),
    },
  });
  console.log(`  ✓ Reset ${reset.count} ecosystems\n`);

  // ── Step 3: Load all ecosystems with their infrastructure ─────────────────
  console.log('Step 3: Loading ecosystems from DB...');
  const ecosystems = await db.tokenEcosystem.findMany({
    select: {
      id: true,
      name: true,
      symbol: true,
      chainId: true,
      tokenProxy: true,
      identityRegistryProxy: true,
      identityRegistryStorageProxy: true,
      trustedIssuersRegistryProxy: true,
      claimTopicsRegistryProxy: true,
      modularComplianceProxy: true,
      infrastructure: {
        select: {
          trexFactory: true,
          oidIdFactory: true,
        },
      },
    },
  });

  if (ecosystems.length === 0) {
    console.log('  ⚠ No ecosystems found in DB. Nothing to sync.\n');
    await db.$disconnect();
    return;
  }

  console.log(`  Found ${ecosystems.length} ecosystem(s):`);
  for (const eco of ecosystems) {
    console.log(
      `    • ${eco.symbol} (${eco.name}) — chainId=${eco.chainId} — ${eco.tokenProxy.slice(0, 12)}…`,
    );
    if (eco.infrastructure?.trexFactory) {
      console.log(
        `      trexFactory:  ${eco.infrastructure.trexFactory.slice(0, 12)}…`,
      );
    }
    if (eco.infrastructure?.oidIdFactory) {
      console.log(
        `      oidIdFactory: ${eco.infrastructure.oidIdFactory.slice(0, 12)}…`,
      );
    }
  }
  console.log();

  // ── Step 4: Full sync for each ecosystem from block 0 ────────────────────
  let totalUpserted = 0;

  for (const eco of ecosystems) {
    console.log(`Step 4: Syncing ${eco.symbol} (${eco.name}) from block 0...`);

    const contracts: EcosystemContracts = {
      tokenProxy: eco.tokenProxy,
      identityRegistryProxy: eco.identityRegistryProxy,
      identityRegistryStorageProxy: eco.identityRegistryStorageProxy,
      trustedIssuersRegistryProxy: eco.trustedIssuersRegistryProxy,
      claimTopicsRegistryProxy: eco.claimTopicsRegistryProxy,
      modularComplianceProxy: eco.modularComplianceProxy,
      trexFactory: eco.infrastructure?.trexFactory ?? undefined,
      oidIdFactory: eco.infrastructure?.oidIdFactory ?? undefined,
    };

    try {
      const result = await syncTransactionsFromExplorer(
        eco.chainId,
        eco.tokenProxy,
        eco.id,
        contracts,
        0, // fromBlock = 0 → full history
      );
      console.log(
        `  ✓ ${eco.symbol}: ${result.count} rows upserted, highestBlock=${result.highestBlock}\n`,
      );
      totalUpserted += result.count;
    } catch (err) {
      console.error(
        `  ✗ ${eco.symbol}: sync failed — ${err instanceof Error ? err.message : err}\n`,
      );
    }
  }

  // ── Step 5: Print summary breakdown ───────────────────────────────────────
  console.log('========= Summary =========');
  console.log(`Total rows upserted: ${totalUpserted}\n`);

  const byCategory = await db.$queryRaw<{ category: string; count: bigint }[]>`
    SELECT category, COUNT(*) as count
    FROM token_transaction
    GROUP BY category
    ORDER BY count DESC
  `;
  console.log('Breakdown by category:');
  for (const r of byCategory) {
    console.log(`  ${r.category}: ${r.count}`);
  }

  const byEvent = await db.$queryRaw<
    { category: string; eventType: string; count: bigint }[]
  >`
    SELECT category, "eventType", COUNT(*) as count
    FROM token_transaction
    GROUP BY category, "eventType"
    ORDER BY count DESC
    LIMIT 20
  `;
  console.log('\nTop event types:');
  for (const r of byEvent) {
    console.log(`  ${r.category}/${r.eventType}: ${r.count}`);
  }

  console.log('\n========================================\n');
  await db.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
