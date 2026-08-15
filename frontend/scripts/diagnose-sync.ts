/**
 * diagnose-sync.ts
 * Comprehensive diagnostic for transaction sync issues.
 * Run: cd frontend && DATABASE_URL="..." node_modules/.bin/tsx scripts/diagnose-sync.ts
 */

import { db } from '../lib/db';

async function main() {
  console.log('\n========= ERC-3643 Sync Diagnostic =========\n');

  // 1. Check DB migrations applied
  console.log('--- Applied Migrations ---');
  try {
    const migrations = await db.$queryRaw<
      { migration_name: string; finished_at: Date | null }[]
    >`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10
    `;
    for (const m of migrations) {
      console.log(
        `  ${m.finished_at ? '✓' : '✗ (pending)'} ${m.migration_name}`,
      );
    }
  } catch (e) {
    console.error('  ERROR reading migrations:', (e as Error).message);
  }

  // 2. Check token_transaction columns exist
  console.log('\n--- token_transaction columns ---');
  try {
    const cols = await db.$queryRaw<
      { column_name: string; data_type: string }[]
    >`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'token_transaction'
      ORDER BY ordinal_position
    `;
    for (const c of cols) {
      console.log(`  ${c.column_name} (${c.data_type})`);
    }
  } catch (e) {
    console.error('  ERROR reading columns:', (e as Error).message);
  }

  // 3. Check ecosystem data
  console.log('\n--- TokenEcosystems in DB ---');
  try {
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
      },
    });
    if (ecosystems.length === 0) {
      console.log(
        '  ⚠ NO ECOSYSTEMS FOUND — cannot sync without an ecosystem in DB',
      );
    }
    for (const eco of ecosystems) {
      console.log(`\n  Ecosystem: ${eco.symbol} (${eco.name})`);
      console.log(`    id:       ${eco.id}`);
      console.log(`    chainId:  ${eco.chainId}`);
      console.log(`    tokenProxy:                   ${eco.tokenProxy}`);
      console.log(
        `    identityRegistryProxy:        ${eco.identityRegistryProxy}`,
      );
      console.log(
        `    identityRegistryStorageProxy: ${eco.identityRegistryStorageProxy}`,
      );
      console.log(
        `    trustedIssuersRegistryProxy:  ${eco.trustedIssuersRegistryProxy}`,
      );
      console.log(
        `    claimTopicsRegistryProxy:     ${eco.claimTopicsRegistryProxy}`,
      );
      console.log(
        `    modularComplianceProxy:       ${eco.modularComplianceProxy}`,
      );
    }
  } catch (e) {
    console.error('  ERROR reading ecosystems:', (e as Error).message);
  }

  // 4. Check existing transaction rows
  console.log('\n--- Transaction Counts in DB ---');
  try {
    const total = await db.tokenTransaction.count();
    console.log(`  Total rows: ${total}`);

    if (total > 0) {
      const byCategory = await db.$queryRaw<
        { category: string; count: bigint }[]
      >`
        SELECT category, COUNT(*) as count FROM token_transaction GROUP BY category ORDER BY count DESC
      `;
      for (const r of byCategory) {
        console.log(`    ${r.category}: ${r.count}`);
      }

      const latest = await db.tokenTransaction.findFirst({
        orderBy: { timestamp: 'desc' },
        select: {
          txHash: true,
          timestamp: true,
          blockNumber: true,
          category: true,
          eventType: true,
        },
      });
      console.log(
        `  Latest tx: ${latest?.txHash?.slice(0, 20)}… at block ${latest?.blockNumber} (${latest?.category}/${latest?.eventType})`,
      );
    }
  } catch (e) {
    console.error('  ERROR reading transactions:', (e as Error).message);
  }

  // 5. Check ETHERSCAN_API_KEY env var
  console.log('\n--- Environment Variables ---');
  const ethKey = process.env.ETHERSCAN_API_KEY;
  const bscKey = process.env.BSCSCAN_API_KEY;
  console.log(
    `  ETHERSCAN_API_KEY: ${ethKey ? `"${ethKey.slice(0, 8)}…" (length=${ethKey.length})` : '⚠ NOT SET'}`,
  );
  console.log(
    `  BSCSCAN_API_KEY:   ${bscKey ? `"${bscKey.slice(0, 8)}…" (length=${bscKey.length})` : 'not set'}`,
  );

  // 6. Test Etherscan API key directly
  if (ethKey) {
    console.log('\n--- Etherscan API Key Test (Sepolia, V2) ---');
    try {
      const testUrl = `https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=balance&address=0x0000000000000000000000000000000000000001&tag=latest&apikey=${ethKey}`;
      const resp = await fetch(testUrl, {
        headers: { 'User-Agent': 'ERC-3643-Dashboard/1.0' },
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await resp.json()) as {
        status: string;
        message: string;
        result: string;
      };
      if (json.status === '1') {
        console.log(
          `  ✓ API key valid — balance of 0x0000…0001: ${json.result} wei`,
        );
      } else {
        console.log(
          `  ✗ API key REJECTED: status=${json.status} message="${json.message}" result="${json.result}"`,
        );
      }
    } catch (e) {
      console.error('  ERROR testing API key:', (e as Error).message);
    }
  }

  // 7. Test txlist for token proxy if we have an ecosystem
  const ecosystems = await db.tokenEcosystem.findMany({
    select: { tokenProxy: true, chainId: true, symbol: true },
  });
  if (ethKey && ecosystems.length > 0) {
    const eco = ecosystems[0];
    console.log(
      `\n--- Etherscan txlist Test (${eco.symbol}, ${eco.tokenProxy.slice(0, 12)}…) ---`,
    );
    try {
      const url = `https://api.etherscan.io/v2/api?chainid=${eco.chainId}&module=account&action=txlist&address=${eco.tokenProxy}&startblock=0&endblock=99999999&page=1&offset=5&sort=asc&apikey=${ethKey}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'ERC-3643-Dashboard/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await resp.json()) as {
        status: string;
        message: string;
        result: unknown[] | string;
      };
      if (json.status === '1' && Array.isArray(json.result)) {
        console.log(
          `  ✓ txlist returned ${json.result.length} rows (showing first)`,
        );
        if (json.result.length > 0) {
          const tx = json.result[0] as Record<string, string>;
          console.log(`    hash: ${tx.hash}`);
          console.log(`    from: ${tx.from}`);
          console.log(`    functionName: "${tx.functionName}"`);
          console.log(`    blockNumber: ${tx.blockNumber}`);
        }
      } else {
        console.log(
          `  ✗ txlist failed: status=${json.status} message="${json.message}" result="${json.result}"`,
        );
      }
    } catch (e) {
      console.error('  ERROR testing txlist:', (e as Error).message);
    }
  }

  console.log('\n========================================\n');
  await db.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
