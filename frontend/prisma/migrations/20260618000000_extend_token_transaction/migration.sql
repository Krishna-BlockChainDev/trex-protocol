-- Migration: extend token_transaction table
-- Adds: category, metadata columns
-- Changes: blockNumber default 0, fromAddress/toAddress default zero address
-- Changes: unique constraint from (ecosystemId, txHash, eventType, fromAddress, toAddress)
--          to (ecosystemId, txHash, eventType)
-- Adds: index on category

-- 1. Drop old unique constraint
ALTER TABLE "token_transaction" DROP CONSTRAINT IF EXISTS "token_transaction_ecosystemId_txHash_eventType_fromAddress_toAddress_key";

-- 2. Add new columns with defaults
ALTER TABLE "token_transaction"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Token',
  ADD COLUMN IF NOT EXISTS "metadata" TEXT;

-- 3. Set column defaults for existing nullable fields
ALTER TABLE "token_transaction"
  ALTER COLUMN "blockNumber" SET DEFAULT 0,
  ALTER COLUMN "fromAddress" SET DEFAULT '0x0000000000000000000000000000000000000000',
  ALTER COLUMN "toAddress" SET DEFAULT '0x0000000000000000000000000000000000000000';

-- 4. Add new unique constraint
ALTER TABLE "token_transaction"
  ADD CONSTRAINT "token_transaction_ecosystemId_txHash_eventType_key"
  UNIQUE ("ecosystemId", "txHash", "eventType");

-- 5. Add index on category
CREATE INDEX IF NOT EXISTS "token_transaction_category_idx" ON "token_transaction"("category");
