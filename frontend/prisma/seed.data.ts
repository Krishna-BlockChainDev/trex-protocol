/**
 * Seed data for the Sepolia platform ecosystem.
 *
 * This file contains NO @/ path aliases — it runs outside Next.js via `tsx`.
 * Addresses are copied verbatim from:
 *   frontend/config/deployed-addresses.sepolia.json
 *
 * Two-layer architecture:
 *   1. ChainInfrastructure (sepoliaInfrastructure) — shared contracts, seeded once per chain
 *   2. TokenEcosystem (sepoliaEcosystem) — the platform's genesis token deployment on Sepolia
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Deterministic UUIDs used as primary keys for seed records. */
export const SEPOLIA_INFRA_ID = '00000000-3643-0000-0000-000011155111';
export const SEPOLIA_SEED_ID = '00000000-3643-0001-0000-000011155111';

/** Ethereum Sepolia chain ID */
export const SEPOLIA_CHAIN_ID = 11155111;

// ── ChainInfrastructure seed data ─────────────────────────────────────────────

export interface SeedInfrastructure {
  id: string;
  chainId: number;
  implToken: string;
  implIdentityRegistry: string;
  implIdentityRegistryStorage: string;
  implTrustedIssuersRegistry: string;
  implClaimTopicsRegistry: string;
  implModularCompliance: string;
  implOIDIdentity: string;
  oidImplementationAuthority: string;
  oidIdFactory: string;
  trexImplementationAuthority: string;
  trexFactory: string;
  moduleCountryRestrict: string;
  moduleCountryAllow: string;
  moduleMaxBalance: string;
  moduleSupplyLimit: string;
  deployedBy: string;
  deployedAt: string; // ISO-8601
}

export const sepoliaInfrastructure: SeedInfrastructure = {
  id: SEPOLIA_INFRA_ID,
  chainId: SEPOLIA_CHAIN_ID,

  // T-REX implementation contracts
  implToken: '0x9b165d9f2FEf2d738D6BaDCdDe96F94800b8ad33',
  implIdentityRegistry: '0x735553eaD8213fa28fD4cA83Fc07447a627ba585',
  implIdentityRegistryStorage: '0x5ED53edDEC8Ae121063Cf40D44A8EE67D724916E',
  implTrustedIssuersRegistry: '0xCA46b540e2909d1984D1f5F2369baFD7715D2F35',
  implClaimTopicsRegistry: '0xFdb1fA08A5D9A10aEdF00052B671b053a584293e',
  implModularCompliance: '0xCEe6F99F82fB6Af54FA106aeEbb4878cb34B253c',

  // OnchainID implementations
  implOIDIdentity: '0x21225C16634ade0487a242eFDF2eB7161f116E55',
  oidImplementationAuthority: '0x67E236dF1aFEf96Af58421f042e8B452452F4e58',
  oidIdFactory: '0x81EbD2D986fE122768da84b47877a65677550902',

  // Authority + factory
  trexImplementationAuthority: '0xB76049621fF12613796a90a8CaF5ddff5f9Fd06A',
  trexFactory: '0x092f80ceE87e83eF048A03824De8a7e7532577B3',

  // Compliance modules
  moduleCountryRestrict: '0x8568b3D5b2118015a7479d83C47885Bba0716005',
  moduleCountryAllow: '0x0f807c280EeD161a873D454eC6B10E3d47183474',
  moduleMaxBalance: '0xe61fa093aBb5c1371D44dA673A7628A5b5662089',
  moduleSupplyLimit: '0xEb85b8D4D2834168812EA3197F78A978359d87DC',

  deployedBy: '0xf982a6039FBe5c50258C5B1513912DECe6afE5BE',
  deployedAt: '2024-01-01T00:00:00.000Z',
};

// ── TokenEcosystem seed data ───────────────────────────────────────────────────

export interface SeedEcosystem {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  salt: string;
  deployerAddress: string;
  deployedAt: string; // ISO-8601
  // Per-token proxy addresses
  tokenProxy: string;
  identityRegistryProxy: string;
  identityRegistryStorageProxy: string;
  trustedIssuersRegistryProxy: string;
  claimTopicsRegistryProxy: string;
  modularComplianceProxy: string;
  tokenOnchainID: string;
  claimIssuer: string;
}

export const sepoliaEcosystem: SeedEcosystem = {
  id: SEPOLIA_SEED_ID,
  name: process.env['SEED_TOKEN_NAME'] ?? 'T-REX Sepolia Platform',
  symbol: process.env['SEED_TOKEN_SYMBOL'] ?? 'TREX',
  decimals: 18,
  chainId: SEPOLIA_CHAIN_ID,
  // Salt derived from seed ID to be deterministic and reproducible
  salt: `platform-seed-${SEPOLIA_CHAIN_ID}`,
  // Zero address signals "platform genesis" — not tied to a specific deployer wallet.
  deployerAddress:
    process.env['SEED_DEPLOYER'] ??
    '0xf982a6039FBe5c50258C5B1513912DECe6afE5BE',
  // Fixed date so re-runs remain idempotent
  deployedAt: '2024-01-01T00:00:00.000Z',

  // Per-token proxy addresses from the initial Sepolia platform deployment
  tokenProxy: '0x39a3A1B06456c59939703EcdF58b40598212f27E',
  identityRegistryProxy: '0xb09E8eBB57EF32601E11BBEe53A885D23218fd12',
  identityRegistryStorageProxy: '0x8F037e54Fdd6Fb7627fC0eAFCF932691DcA86d0E',
  trustedIssuersRegistryProxy: '0x31cdFBB6Df7559a2b2A2751a1FAf2fe8dD84C63c',
  claimTopicsRegistryProxy: '0x7449DB4d9A615Ce4818b19e863622B3b4E58440D',
  modularComplianceProxy: '0xCB566ede79C06Bc23042cA04c6808D71Fac11200',
  tokenOnchainID: '0x5ebBaF3a0D147e4e14B1c89d4fd92f7E9B10D778',
  claimIssuer: '0xBF5AEcB0B6F69968D7e565E304714aD236Dc160a',
};
