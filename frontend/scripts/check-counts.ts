import { db } from '../lib/db';
async function main() {
  const counts = await db.$queryRaw<
    { symbol: string; id: string; tx_count: bigint }[]
  >`
    SELECT e.symbol, e.id, COUNT(t.id) as tx_count
    FROM token_ecosystem e
    LEFT JOIN token_transaction t ON t."ecosystemId" = e.id
    GROUP BY e.id, e.symbol
    ORDER BY e.symbol
  `;
  for (const r of counts) {
    console.log(`${r.symbol} (${r.id.slice(0, 8)}…): ${r.tx_count} txs`);
  }
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
