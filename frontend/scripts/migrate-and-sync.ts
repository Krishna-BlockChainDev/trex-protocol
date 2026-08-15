/**
 * migrate-and-sync.ts
 *
 * One-shot script:
 *  1. Add new enrichment columns to token_transaction (idempotent)
 *  2. Register the migration in _prisma_migrations
 *  3. Re-sync ecosystem transactions from Etherscan with enrichment
 *  4. Print a sample row to verify data
 */

import { db } from '../lib/db';
import { syncTransactionsFromExplorer } from '../lib/explorer';

async function main() {
  // ── Step 1: Apply schema changes ────────────────────────────────────────────
  console.log('Step 1: Adding enrichment columns...');
  await db.$executeRawUnsafe(`
    ALTER TABLE token_transaction
      ADD COLUMN IF NOT EXISTS "txStatus"      TEXT,
      ADD COLUMN IF NOT EXISTS "gasUsed"       BIGINT,
      ADD COLUMN IF NOT EXISTS "gasPrice"      TEXT,
      ADD COLUMN IF NOT EXISTS "txFee"         TEXT,
      ADD COLUMN IF NOT EXISTS "nonce"         INTEGER,
      ADD COLUMN IF NOT EXISTS "txIndex"       INTEGER,
      ADD COLUMN IF NOT EXISTS "senderAddress" TEXT
  `);
  console.log('✓ Columns added (or already existed)');

  // ── Step 2: Verify columns ───────────────────────────────────────────────────
  console.log('\nStep 2: Verifying columns...');
  const cols = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'token_transaction'
       AND column_name IN ('txStatus','gasUsed','gasPrice','txFee','nonce','txIndex','senderAddress')
     ORDER BY column_name`,
  );
  console.log('Columns found:', cols.map((c) => c.column_name).join(', '));

  if (cols.length !== 7) {
    throw new Error(`Expected 7 columns, found ${cols.length}`);
  }

  // ── Step 3: Register migration in Prisma table ───────────────────────────────
  console.log('\nStep 3: Registering migration in _prisma_migrations...');
  const migrationName = '20260619000000_enrich_token_transaction';
  const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM _prisma_migrations WHERE migration_name = $1`,
    migrationName,
  );
  if (existing.length === 0) {
    const migrationSql = `ALTER TABLE token_transaction ADD COLUMN IF NOT EXISTS "txStatus" TEXT, ADD COLUMN IF NOT EXISTS "gasUsed" BIGINT, ADD COLUMN IF NOT EXISTS "gasPrice" TEXT, ADD COLUMN IF NOT EXISTS "txFee" TEXT, ADD COLUMN IF NOT EXISTS "nonce" INTEGER, ADD COLUMN IF NOT EXISTS "txIndex" INTEGER, ADD COLUMN IF NOT EXISTS "senderAddress" TEXT;`;
    await db.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid(), 'manual', NOW(), $1, NULL, NULL, NOW(), 1)`,
      migrationName,
    );
    console.log('✓ Migration registered');
  } else {
    console.log('✓ Migration already registered');
  }

  // ── Step 4: Re-sync ecosystem ────────────────────────────────────────────────
  console.log('\nStep 4: Re-syncing transactions with enrichment...');
  const eco = await db.tokenEcosystem.findFirst({
    where: { id: '00000000-3643-0001-0000-000011155111' },
  });
  if (!eco) {
    console.log('Ecosystem not found');
    process.exit(1);
  }
  console.log('Ecosystem:', eco.name, '| chainId:', eco.chainId);

  const result = await syncTransactionsFromExplorer(
    eco.chainId,
    eco.tokenProxy,
    eco.id,
  );
  console.log('✓ Upserted:', result.count, 'transactions');

  const total = await db.tokenTransaction.count({
    where: { ecosystemId: eco.id },
  });
  console.log('Total in DB:', total);

  // ── Step 5: Sample row ───────────────────────────────────────────────────────
  console.log('\nStep 5: Sample row with enrichment:');
  const sample = await db.tokenTransaction.findFirst({
    where: { ecosystemId: eco.id, txStatus: { not: null } },
    orderBy: { timestamp: 'desc' },
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
    },
  });
  console.log(JSON.stringify(sample, null, 2));

  await db.$disconnect();
  console.log('\n✅ All done!');
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
