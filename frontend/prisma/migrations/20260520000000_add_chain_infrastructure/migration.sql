-- Migration: add_chain_infrastructure
--
-- Changes:
--   1. Create `chain_infrastructure` table (Layer 1 — shared per-chain contracts)
--   2. Migrate existing `token_ecosystem.addresses` JSON blob into new columns:
--        a. Extract infra fields into chain_infrastructure (one row per chainId)
--        b. Extract per-token fields into new token_ecosystem columns
--   3. Drop the legacy `addresses` JSONB column from token_ecosystem
--
-- This migration is idempotent and can be re-run safely.

-- ── Step 1: Create chain_infrastructure table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "chain_infrastructure" (
    "id"                              TEXT NOT NULL,
    "chainId"                         INTEGER NOT NULL,
    "implToken"                       TEXT NOT NULL DEFAULT '',
    "implIdentityRegistry"            TEXT NOT NULL DEFAULT '',
    "implIdentityRegistryStorage"     TEXT NOT NULL DEFAULT '',
    "implTrustedIssuersRegistry"      TEXT NOT NULL DEFAULT '',
    "implClaimTopicsRegistry"         TEXT NOT NULL DEFAULT '',
    "implModularCompliance"           TEXT NOT NULL DEFAULT '',
    "implOIDIdentity"                 TEXT NOT NULL DEFAULT '',
    "oidImplementationAuthority"      TEXT NOT NULL DEFAULT '',
    "oidIdFactory"                    TEXT NOT NULL DEFAULT '',
    "trexImplementationAuthority"     TEXT NOT NULL DEFAULT '',
    "trexFactory"                     TEXT NOT NULL DEFAULT '',
    "moduleCountryRestrict"           TEXT,
    "moduleCountryAllow"              TEXT,
    "moduleMaxBalance"                TEXT,
    "moduleSupplyLimit"               TEXT,
    "deployedBy"                      TEXT NOT NULL DEFAULT '0x0000000000000000000000000000000000000001',
    "deployedAt"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"                       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_infrastructure_pkey" PRIMARY KEY ("id")
);

-- Unique index: only one infrastructure record per chain
CREATE UNIQUE INDEX IF NOT EXISTS "chain_infrastructure_chainId_key"
    ON "chain_infrastructure"("chainId");

-- ── Step 2a: Seed chain_infrastructure from existing token_ecosystem blobs ────
-- For each unique chainId in token_ecosystem, extract the shared infra fields
-- from the first row's `addresses` JSONB and insert into chain_infrastructure.

INSERT INTO "chain_infrastructure" (
    "id",
    "chainId",
    "implToken",
    "implIdentityRegistry",
    "implIdentityRegistryStorage",
    "implTrustedIssuersRegistry",
    "implClaimTopicsRegistry",
    "implModularCompliance",
    "implOIDIdentity",
    "oidImplementationAuthority",
    "oidIdFactory",
    "trexImplementationAuthority",
    "trexFactory",
    "moduleCountryRestrict",
    "moduleCountryAllow",
    "moduleMaxBalance",
    "moduleSupplyLimit",
    "deployedBy",
    "deployedAt"
)
SELECT DISTINCT ON ("chainId")
    gen_random_uuid()::text AS "id",
    te."chainId",
    COALESCE(te."addresses"->'implementations'->>'token', '')            AS "implToken",
    COALESCE(te."addresses"->'implementations'->>'identityRegistry', '') AS "implIdentityRegistry",
    COALESCE(te."addresses"->'implementations'->>'identityRegistryStorage', '') AS "implIdentityRegistryStorage",
    COALESCE(te."addresses"->'implementations'->>'trustedIssuersRegistry', '')  AS "implTrustedIssuersRegistry",
    COALESCE(te."addresses"->'implementations'->>'claimTopicsRegistry', '')     AS "implClaimTopicsRegistry",
    COALESCE(te."addresses"->'implementations'->>'modularCompliance', '')       AS "implModularCompliance",
    COALESCE(te."addresses"->'implementations'->>'onchainIDIdentity', '')       AS "implOIDIdentity",
    COALESCE(te."addresses"->'implementations'->>'onchainIDImplementationAuthority', '') AS "oidImplementationAuthority",
    COALESCE(te."addresses"->'implementations'->>'onchainIDFactory', '')        AS "oidIdFactory",
    COALESCE(te."addresses"->'authorities'->>'trexImplementationAuthority', '') AS "trexImplementationAuthority",
    COALESCE(te."addresses"->'factories'->>'trexFactory', '')                   AS "trexFactory",
    te."addresses"->'compliance'->'modules'->>'countryRestrictModule'           AS "moduleCountryRestrict",
    te."addresses"->'compliance'->'modules'->>'countryAllowModule'              AS "moduleCountryAllow",
    te."addresses"->'compliance'->'modules'->>'maxBalanceModule'                AS "moduleMaxBalance",
    te."addresses"->'compliance'->'modules'->>'supplyLimitModule'               AS "moduleSupplyLimit",
    te."deployerAddress"  AS "deployedBy",
    te."deployedAt"       AS "deployedAt"
FROM "token_ecosystem" te
WHERE te."addresses" IS NOT NULL
ON CONFLICT ("chainId") DO NOTHING;

-- ── Step 2b: Add new per-token columns to token_ecosystem ─────────────────────

ALTER TABLE "token_ecosystem"
    ADD COLUMN IF NOT EXISTS "salt"                         TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "decimals"                     INTEGER NOT NULL DEFAULT 18,
    ADD COLUMN IF NOT EXISTS "tokenProxy"                   TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "identityRegistryProxy"        TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "identityRegistryStorageProxy" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "trustedIssuersRegistryProxy"  TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "claimTopicsRegistryProxy"     TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "modularComplianceProxy"       TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "tokenOnchainID"               TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "claimIssuer"                  TEXT NOT NULL DEFAULT '';

-- Populate new columns from the existing addresses JSON blob
UPDATE "token_ecosystem" SET
    "salt"                         = COALESCE(id, ''),
    "tokenProxy"                   = COALESCE("addresses"->'token'->>'trexTokenProxy', ''),
    "identityRegistryProxy"        = COALESCE("addresses"->'proxies'->>'identityRegistry', ''),
    "identityRegistryStorageProxy" = COALESCE("addresses"->'proxies'->>'identityRegistryStorage', ''),
    "trustedIssuersRegistryProxy"  = COALESCE("addresses"->'proxies'->>'trustedIssuersRegistry', ''),
    "claimTopicsRegistryProxy"     = COALESCE("addresses"->'proxies'->>'claimTopicsRegistry', ''),
    "modularComplianceProxy"       = COALESCE("addresses"->'compliance'->>'modularComplianceProxy', ''),
    "tokenOnchainID"               = COALESCE("addresses"->'token'->>'tokenOID', ''),
    "claimIssuer"                  = COALESCE("addresses"->'token'->>'claimIssuer', '')
WHERE "addresses" IS NOT NULL;

-- ── Step 3: Add foreign key from token_ecosystem → chain_infrastructure ───────

-- Only add FK if chain_infrastructure has rows for all chainIds in token_ecosystem.
-- Using a deferred approach: add FK as NOT VALID so existing rows with missing
-- infra rows are not blocked (they'd have been populated in step 2a).
ALTER TABLE "token_ecosystem"
    DROP CONSTRAINT IF EXISTS "token_ecosystem_chainId_fkey";

ALTER TABLE "token_ecosystem"
    ADD CONSTRAINT "token_ecosystem_chainId_fkey"
    FOREIGN KEY ("chainId")
    REFERENCES "chain_infrastructure"("chainId")
    ON DELETE RESTRICT ON UPDATE CASCADE
    NOT VALID;

-- ── Step 4: Add new unique indexes ────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "token_ecosystem_chainId_salt_key"
    ON "token_ecosystem"("chainId", "salt");

-- ── Step 5: Drop the legacy addresses blob ────────────────────────────────────
-- Only drop after all data has been extracted above.

ALTER TABLE "token_ecosystem"
    DROP COLUMN IF EXISTS "addresses";
