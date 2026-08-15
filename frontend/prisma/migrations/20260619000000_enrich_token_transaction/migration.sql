-- Migration: enrich_token_transaction
-- Adds on-chain execution detail columns to token_transaction:
--   txStatus     – 'success' | 'failed' | 'pending'  (from receipt.status)
--   gasUsed      – gas units consumed                  (from receipt.gasUsed)
--   gasPrice     – gas price in wei                    (from tx.gasPrice)
--   txFee        – total fee in wei (gasUsed * gasPrice)
--   nonce        – sender nonce at execution           (from tx.nonce)
--   txIndex      – tx position within block            (from tx.transactionIndex)
--   senderAddress – actual on-chain msg.sender         (from tx.from)

ALTER TABLE "token_transaction"
  ADD COLUMN IF NOT EXISTS "txStatus"      TEXT,
  ADD COLUMN IF NOT EXISTS "gasUsed"       BIGINT,
  ADD COLUMN IF NOT EXISTS "gasPrice"      TEXT,
  ADD COLUMN IF NOT EXISTS "txFee"         TEXT,
  ADD COLUMN IF NOT EXISTS "nonce"         INTEGER,
  ADD COLUMN IF NOT EXISTS "txIndex"       INTEGER,
  ADD COLUMN IF NOT EXISTS "senderAddress" TEXT;
