/**
 * backfill-all-txs.ts
 *
 * Resets the fromBlock for all ecosystems and re-syncs from block 0.
 * This picks up ALL transaction types: token, identity, compliance, system.
 *
 * Run from frontend/:
 *   DATABASE_URL="..." node_modules/.bin/tsx scripts/backfill-all-txs.ts
 */

import { db } from '../lib/db';
import { syncTransactionsFromExplorer } from '../lib/explorer';

async function main() {
  console.log(
    '[backfill] Starting full backfill of all transaction types...\n',
  );

  // Load all ecosystems
  const ecosystems = await db.tokenEcosystem.findMany();
  console.log(`[backfill] Found ${ecosystems.length} ecosystem(s)\n`);

  for (const eco of ecosystems) {
    console.log(`[backfill] ── Ecosystem: ${eco.name} (${eco.symbol}) ──`);
    console.log(`[backfill]    chainId:    ${eco.chainId}`);
    console.log(`[backfill]    tokenProxy: ${eco.tokenProxy}`);
    console.log(`[backfill]    id:         ${eco.id}\n`);

    // Reset all existing tx rows to blockNumber=0 so sync fetches from genesis
    const resetResult = await db.tokenTransaction.updateMany({
      where: { ecosystemId: eco.id },
      data: { blockNumber: BigInt(0) },
    });
    console.log(
      `[backfill]    Reset ${resetResult.count} existing rows to blockNumber=0`,
    );

    // Sync from block 0 with all ecosystem contract addresses
    const contracts = {
      tokenProxy: eco.tokenProxy,
      identityRegistryProxy: eco.identityRegistryProxy,
      identityRegistryStorageProxy: eco.identityRegistryStorageProxy,
      trustedIssuersRegistryProxy: eco.trustedIssuersRegistryProxy,
      claimTopicsRegistryProxy: eco.claimTopicsRegistryProxy,
      modularComplianceProxy: eco.modularComplianceProxy,
    };

    console.log(
      '[backfill]    Syncing from block 0 across all contract addresses...',
    );
    const result = await syncTransactionsFromExplorer(
      eco.chainId,
      eco.tokenProxy,
      eco.id,
      contracts,
    );
    console.log(`[backfill]    ✓ Upserted ${result.count} rows\n`);
  }

  // Print summary
  const totals = await db.tokenTransaction.groupBy({
    by: ['category'],
    _count: { id: true },
  });
  console.log('[backfill] ── Final row counts by category ──');
  for (const row of totals) {
    console.log(`[backfill]   ${row.category}: ${row._count.id}`);
  }

  const totalCount = await db.tokenTransaction.count();
  console.log(`[backfill]   TOTAL: ${totalCount}\n`);

  // Compute total fee
  const feeRows = await db.tokenTransaction.findMany({
    select: { txFee: true, category: true },
  });

  const feeByCategory: Record<string, bigint> = {};
  let grandTotal = BigInt(0);
  for (const row of feeRows) {
    if (row.txFee) {
      try {
        const fee = BigInt(row.txFee);
        feeByCategory[row.category] =
          (feeByCategory[row.category] ?? BigInt(0)) + fee;
        grandTotal += fee;
      } catch {
        /* skip */
      }
    }
  }

  console.log('[backfill] ── Total fees by category (wei) ──');
  for (const [cat, fee] of Object.entries(feeByCategory)) {
    const eth = Number(fee) / 1e18;
    console.log(
      `[backfill]   ${cat}: ${fee.toString()} wei (${eth.toFixed(8)} ETH)`,
    );
  }
  const grandEth = Number(grandTotal) / 1e18;
  console.log(
    `[backfill]   GRAND TOTAL: ${grandTotal.toString()} wei (${grandEth.toFixed(8)} ETH)\n`,
  );

  // Sample rows from each category
  for (const cat of ['Token', 'Identity', 'Compliance', 'System']) {
    const sample = await db.tokenTransaction.findFirst({
      where: { category: cat },
      orderBy: { blockNumber: 'desc' },
    });
    if (sample) {
      const serialized = Object.fromEntries(
        Object.entries(sample).map(([k, v]) => [
          k,
          typeof v === 'bigint' ? v.toString() : v,
        ]),
      );
      console.log(
        `[backfill] Sample ${cat} row:\n`,
        JSON.stringify(serialized, null, 2),
      );
    } else {
      console.log(`[backfill] No ${cat} rows found`);
    }
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error('[backfill] FATAL:', err);
  process.exit(1);
});
