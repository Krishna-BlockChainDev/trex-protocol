-- Add sync tracking fields to token_ecosystem
-- lastSyncedAt: timestamp of last Etherscan poll (NULL = never synced)
-- lastSyncedBlock: highest block number synced (0 = not synced)

ALTER TABLE "token_ecosystem"
  ADD COLUMN IF NOT EXISTS "lastSyncedAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastSyncedBlock" BIGINT NOT NULL DEFAULT 0;
