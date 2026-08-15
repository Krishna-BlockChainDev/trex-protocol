/**
 * Prisma seed script — seeds the Sepolia platform infrastructure + token ecosystem.
 *
 * Run via:
 *   cd frontend && npm run db:seed
 *
 * Or via Prisma directly:
 *   cd frontend && npx prisma db seed
 *
 * Both upserts are keyed on deterministic IDs / unique constraints so repeated
 * runs are idempotent — rows are created on first run and updated on subsequent runs.
 *
 * Environment variables (all optional):
 *   DATABASE_URL       — Postgres connection string (read from .env / .env.local)
 *   SEED_TOKEN_NAME    — override default name  ("T-REX Sepolia Platform")
 *   SEED_TOKEN_SYMBOL  — override default symbol ("TREX")
 *   SEED_DEPLOYER      — override deployer address (default: 0x000…0001)
 */

import { PrismaClient } from '@prisma/client';
import { sepoliaInfrastructure, sepoliaEcosystem } from './seed.data';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const prisma = new PrismaClient({
  log: ['query', 'warn', 'error'],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🌱  ERC-3643 T-REX — Prisma Seed\n');

  // ── Step 1: Upsert ChainInfrastructure ──────────────────────────────────────
  const SEPOLIA_CHAIN_ID = sepoliaInfrastructure.chainId;

  console.log('Step 1: ChainInfrastructure (Sepolia)');
  console.log('  Chain    :', SEPOLIA_CHAIN_ID, '(Sepolia)');
  console.log('  ID       :', sepoliaInfrastructure.id);
  console.log('  Factory  :', shortAddr(sepoliaInfrastructure.trexFactory));

  const infraData = {
    implToken: sepoliaInfrastructure.implToken,
    implIdentityRegistry: sepoliaInfrastructure.implIdentityRegistry,
    implIdentityRegistryStorage:
      sepoliaInfrastructure.implIdentityRegistryStorage,
    implTrustedIssuersRegistry:
      sepoliaInfrastructure.implTrustedIssuersRegistry,
    implClaimTopicsRegistry: sepoliaInfrastructure.implClaimTopicsRegistry,
    implModularCompliance: sepoliaInfrastructure.implModularCompliance,
    implOIDIdentity: sepoliaInfrastructure.implOIDIdentity,
    oidImplementationAuthority:
      sepoliaInfrastructure.oidImplementationAuthority,
    oidIdFactory: sepoliaInfrastructure.oidIdFactory,
    trexImplementationAuthority:
      sepoliaInfrastructure.trexImplementationAuthority,
    trexFactory: sepoliaInfrastructure.trexFactory,
    moduleCountryRestrict: sepoliaInfrastructure.moduleCountryRestrict,
    moduleCountryAllow: sepoliaInfrastructure.moduleCountryAllow,
    moduleMaxBalance: sepoliaInfrastructure.moduleMaxBalance,
    moduleSupplyLimit: sepoliaInfrastructure.moduleSupplyLimit,
    deployedBy: sepoliaInfrastructure.deployedBy,
    deployedAt: new Date(sepoliaInfrastructure.deployedAt),
  };

  const infraRecord = await prisma.chainInfrastructure.upsert({
    where: { chainId: SEPOLIA_CHAIN_ID },
    update: infraData,
    create: {
      id: sepoliaInfrastructure.id,
      chainId: SEPOLIA_CHAIN_ID,
      ...infraData,
    },
  });

  console.log('  ✅ Upserted infrastructure:', infraRecord.id);
  console.log('');

  // ── Step 2: Upsert TokenEcosystem ────────────────────────────────────────────
  console.log('Step 2: TokenEcosystem (Sepolia platform token)');
  console.log('  Name     :', sepoliaEcosystem.name);
  console.log('  Symbol   :', sepoliaEcosystem.symbol);
  console.log('  Deployer :', shortAddr(sepoliaEcosystem.deployerAddress));
  console.log('  ID       :', sepoliaEcosystem.id);

  const ecosystemData = {
    name: sepoliaEcosystem.name,
    symbol: sepoliaEcosystem.symbol,
    decimals: sepoliaEcosystem.decimals,
    chainId: SEPOLIA_CHAIN_ID,
    salt: sepoliaEcosystem.salt,
    deployerAddress: sepoliaEcosystem.deployerAddress,
    deployedAt: new Date(sepoliaEcosystem.deployedAt),
    tokenProxy: sepoliaEcosystem.tokenProxy,
    identityRegistryProxy: sepoliaEcosystem.identityRegistryProxy,
    identityRegistryStorageProxy: sepoliaEcosystem.identityRegistryStorageProxy,
    trustedIssuersRegistryProxy: sepoliaEcosystem.trustedIssuersRegistryProxy,
    claimTopicsRegistryProxy: sepoliaEcosystem.claimTopicsRegistryProxy,
    modularComplianceProxy: sepoliaEcosystem.modularComplianceProxy,
    tokenOnchainID: sepoliaEcosystem.tokenOnchainID,
    claimIssuer: sepoliaEcosystem.claimIssuer,
  };

  const ecosystemRecord = await prisma.tokenEcosystem.upsert({
    where: {
      chainId_symbol_deployerAddress: {
        chainId: SEPOLIA_CHAIN_ID,
        symbol: sepoliaEcosystem.symbol,
        deployerAddress: sepoliaEcosystem.deployerAddress,
      },
    },
    update: {
      name: ecosystemData.name,
      tokenProxy: ecosystemData.tokenProxy,
      identityRegistryProxy: ecosystemData.identityRegistryProxy,
      identityRegistryStorageProxy: ecosystemData.identityRegistryStorageProxy,
      trustedIssuersRegistryProxy: ecosystemData.trustedIssuersRegistryProxy,
      claimTopicsRegistryProxy: ecosystemData.claimTopicsRegistryProxy,
      modularComplianceProxy: ecosystemData.modularComplianceProxy,
      tokenOnchainID: ecosystemData.tokenOnchainID,
      claimIssuer: ecosystemData.claimIssuer,
    },
    create: {
      id: sepoliaEcosystem.id,
      ...ecosystemData,
    },
  });

  console.log('  ✅ Upserted ecosystem:', ecosystemRecord.id);
  console.log('     name       :', ecosystemRecord.name);
  console.log('     symbol     :', ecosystemRecord.symbol);
  console.log('     chainId    :', ecosystemRecord.chainId);
  console.log('     deployer   :', shortAddr(ecosystemRecord.deployerAddress));
  console.log('     deployedAt :', ecosystemRecord.deployedAt.toISOString());
  console.log('     tokenProxy :', shortAddr(ecosystemRecord.tokenProxy));
  console.log('');
  console.log('🎉  Seed complete.\n');
}

// ── Teardown ──────────────────────────────────────────────────────────────────

main()
  .catch((err) => {
    console.error('\n❌  Seed failed:\n', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
