/**
 * backfill-enrichment.ts
 *
 * Resets blockNumber=0 on all existing rows so the sync starts from block 0,
 * then calls syncTransactionsFromExplorer to backfill txStatus, gasUsed,
 * gasPrice, txFee, nonce, txIndex, senderAddress on all existing rows.
 *
 * Safe to run multiple times (upsert is idempotent).
 */
import { db } from '../lib/db';
import { syncTransactionsFromExplorer } from '../lib/explorer';

const ECOSYSTEM_ID = '00000000-3643-0001-0000-000011155111';

async function main() {
  const eco = await db.tokenEcosystem.findFirst({
    where: { id: ECOSYSTEM_ID },
  });
  if (!eco) {
    console.error('Ecosystem not found:', ECOSYSTEM_ID);
    process.exit(1);
  }
  console.log(
    'Ecosystem:',
    eco.name,
    '| chain:',
    eco.chainId,
    '| token:',
    eco.tokenProxy,
  );

  // Reset blockNumber so syncTransactionsFromExplorer starts from block 0
  const reset = await db.tokenTransaction.updateMany({
    where: { ecosystemId: ECOSYSTEM_ID },
    data: { blockNumber: BigInt(0) },
  });
  console.log(`Reset ${reset.count} rows to blockNumber=0`);

  // Re-sync from block 0 — upserts enrichment into existing rows
  const result = await syncTransactionsFromExplorer(
    eco.chainId,
    eco.tokenProxy,
    eco.id,
  );
  console.log('Upserted:', result.count, 'transactions');

  const total = await db.tokenTransaction.count({
    where: { ecosystemId: ECOSYSTEM_ID },
  });
  const enriched = await db.tokenTransaction.count({
    where: { ecosystemId: ECOSYSTEM_ID, txStatus: { not: null } },
  });
  console.log(`Rows: ${total} total, ${enriched} enriched`);

  const sample = await db.tokenTransaction.findFirst({
    where: { ecosystemId: ECOSYSTEM_ID },
    orderBy: { blockNumber: 'desc' },
    select: {
      txHash: true,
      eventType: true,
      txStatus: true,
      gasUsed: true,
      gasPrice: true,
      txFee: true,
      nonce: true,
      txIndex: true,
      senderAddress: true,
      blockNumber: true,
      timestamp: true,
    },
  });

  console.log('\nSample row:');
  console.log(
    JSON.stringify(
      sample,
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    ),
  );

  await db.$disconnect();
  console.log('\n✅ Done!');
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
