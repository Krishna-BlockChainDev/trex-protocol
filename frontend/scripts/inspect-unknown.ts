/**
 * inspect-unknown.ts
 * Show all ContractCall (unknown selector) rows so we can add their selectors
 * to the METHOD_SELECTORS map in lib/explorer.ts.
 */
import { db } from '../lib/db';

async function main() {
  const rows = await db.tokenTransaction.findMany({
    where: { eventType: 'ContractCall' },
    select: {
      txHash: true,
      toAddress: true,
      fromAddress: true,
      metadata: true,
      blockNumber: true,
      ecosystemId: true,
    },
    orderBy: { blockNumber: 'asc' },
  });

  console.log(`\nUnknown ContractCall rows: ${rows.length}\n`);
  for (const r of rows) {
    const meta = r.metadata ? JSON.parse(r.metadata as string) : {};
    console.log(
      `  block=${r.blockNumber} to=${r.toAddress.slice(0, 14)}… fn="${meta.functionName ?? ''}" sel=${meta.input ?? 'none'}`,
    );
  }

  // Also show the selector frequency
  const sels: Record<string, number> = {};
  for (const r of rows) {
    const meta = r.metadata ? JSON.parse(r.metadata as string) : {};
    const sel = meta.input ?? 'none';
    sels[sel] = (sels[sel] ?? 0) + 1;
  }
  console.log('\nSelector frequency:');
  for (const [sel, cnt] of Object.entries(sels).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sel}: ${cnt}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
