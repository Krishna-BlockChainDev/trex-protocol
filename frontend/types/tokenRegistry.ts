import type { ChainInfrastructure, TokenAddresses } from '@/config';

// ── Per-token ecosystem (DB row shape) ────────────────────────────────────────

/**
 * Represents a fully deployed TREX token ecosystem stored in PostgreSQL.
 *
 * Two-layer architecture:
 *   - Shared infra (implementations, factory, modules) lives in ChainInfrastructure
 *   - Per-token proxy addresses are stored directly here (tokenProxy, IRProxy, etc.)
 */
export interface DeployedTokenEcosystem {
  /** Unique identifier (UUID) generated at deployment time */
  id: string;
  /** Human-readable token name, e.g. "Acme Security Token" */
  name: string;
  /** ERC-20 token symbol */
  symbol: string;
  /** ERC-20 token decimals */
  decimals: number;
  /** Chain this ecosystem was deployed on */
  chainId: number;
  /** CREATE2 salt used in TREXFactory.deployTREXSuite() */
  salt: string;
  /** Wallet address that deployed the ecosystem */
  deployerAddress: `0x${string}`;
  /** Unix timestamp (ms) when the ecosystem was registered */
  deployedAt: number;

  // ── Per-token proxy addresses ──────────────────────────────────────────────
  /** ERC-3643 Token proxy */
  tokenProxy: string;
  /** Identity Registry proxy */
  identityRegistryProxy: string;
  /** Identity Registry Storage proxy */
  identityRegistryStorageProxy: string;
  /** Trusted Issuers Registry proxy */
  trustedIssuersRegistryProxy: string;
  /** Claim Topics Registry proxy */
  claimTopicsRegistryProxy: string;
  /** Modular Compliance proxy */
  modularComplianceProxy: string;

  // ── Token-specific contracts ────────────────────────────────────────────────
  /** Token OnchainID (IERC734/IERC735) */
  tokenOnchainID: string;
  /** ClaimIssuer contract address */
  claimIssuer: string;
}

/**
 * Chain-level infrastructure stored in PostgreSQL — one row per chain.
 * Maps 1-to-1 to the `chain_infrastructure` table.
 */
export interface DeployedChainInfrastructure {
  /** UUID primary key */
  id: string;
  /** EVM chain ID */
  chainId: number;

  // ── TREX implementation contracts ──────────────────────────────────────────
  implToken: string;
  implIdentityRegistry: string;
  implIdentityRegistryStorage: string;
  implTrustedIssuersRegistry: string;
  implClaimTopicsRegistry: string;
  implModularCompliance: string;

  // ── OnchainID implementations ──────────────────────────────────────────────
  implOIDIdentity: string;
  oidImplementationAuthority: string;
  oidIdFactory: string;

  // ── Authority & factory ────────────────────────────────────────────────────
  trexImplementationAuthority: string;
  trexFactory: string;

  // ── Stateless compliance modules ───────────────────────────────────────────
  moduleCountryRestrict?: string | null;
  moduleCountryAllow?: string | null;
  moduleMaxBalance?: string | null;
  moduleSupplyLimit?: string | null;

  deployedBy: string;
  deployedAt: number; // ms timestamp
}

// ── Context types ─────────────────────────────────────────────────────────────

/**
 * Controls which ecosystem the dashboard reads from.
 *
 * UI-only preference — stored in localStorage.
 * Both modes now read from the PostgreSQL DB; there is no static JSON fallback.
 *
 * 'platform' → no specific custom ecosystem selected (addresses = null)
 * 'custom'   → a specific deployed ecosystem is active
 */
export type TokenEcosystemMode = 'platform' | 'custom';

/** React context value exposed by TokenRegistryProvider */
export interface TokenRegistryContextValue {
  /** True while the initial DB fetch for the current chain is in progress */
  isLoading: boolean;

  /** Current operating mode (UI preference, stored in localStorage) */
  mode: TokenEcosystemMode;
  /** Switch between modes */
  setMode: (mode: TokenEcosystemMode) => void;

  /** All registered ecosystems for the currently connected chain (from DB) */
  tokens: DeployedTokenEcosystem[];

  /**
   * The currently selected ecosystem.
   * null when mode === 'platform' OR no token is selected.
   */
  activeToken: DeployedTokenEcosystem | null;
  /** ID of the currently active ecosystem */
  activeTokenId: string | null;
  /** Select the active ecosystem by id */
  setActiveTokenId: (id: string | null) => void;

  /**
   * Chain infrastructure for the currently connected chain.
   * Loaded from DB or static config. null while loading or unsupported chain.
   */
  infrastructure: DeployedChainInfrastructure | null;
  /** True while infrastructure is loading */
  isInfraLoading: boolean;

  /** Re-fetch chain infrastructure from DB (call after deploying infra from UI) */
  refreshInfrastructure: () => Promise<void>;

  /** Register a newly deployed ecosystem (persisted to DB) */
  addToken: (token: DeployedTokenEcosystem) => Promise<void>;
  /** Remove a registered ecosystem by id (deleted from DB) */
  removeToken: (id: string) => Promise<void>;
  /** Partially update a registered ecosystem (saved to DB) */
  updateToken: (
    id: string,
    updates: Partial<DeployedTokenEcosystem>,
  ) => Promise<void>;
}

// ── Helper converters ─────────────────────────────────────────────────────────

/**
 * Convert a DeployedChainInfrastructure (DB row shape) into the static-config
 * ChainInfrastructure shape used by frontend/config/index.ts helpers.
 */
export function infraToChainConfig(
  row: DeployedChainInfrastructure,
): ChainInfrastructure {
  return {
    implementations: {
      token: row.implToken,
      identityRegistry: row.implIdentityRegistry,
      identityRegistryStorage: row.implIdentityRegistryStorage,
      trustedIssuersRegistry: row.implTrustedIssuersRegistry,
      claimTopicsRegistry: row.implClaimTopicsRegistry,
      modularCompliance: row.implModularCompliance,
      onchainIDIdentity: row.implOIDIdentity,
      onchainIDImplementationAuthority: row.oidImplementationAuthority,
      onchainIDFactory: row.oidIdFactory,
    },
    authority: {
      trexImplementationAuthority: row.trexImplementationAuthority,
      trexFactory: row.trexFactory,
    },
    modules: {
      countryRestrictModule: row.moduleCountryRestrict ?? undefined,
      countryAllowModule: row.moduleCountryAllow ?? undefined,
      maxBalanceModule: row.moduleMaxBalance ?? undefined,
      supplyLimitModule: row.moduleSupplyLimit ?? undefined,
    },
  };
}

/**
 * Convert a DeployedTokenEcosystem into the per-token TokenAddresses shape.
 */
export function ecosystemToTokenAddresses(
  eco: DeployedTokenEcosystem,
): TokenAddresses {
  return {
    salt: eco.salt,
    tokenProxy: eco.tokenProxy,
    identityRegistryProxy: eco.identityRegistryProxy,
    identityRegistryStorageProxy: eco.identityRegistryStorageProxy,
    trustedIssuersRegistryProxy: eco.trustedIssuersRegistryProxy,
    claimTopicsRegistryProxy: eco.claimTopicsRegistryProxy,
    modularComplianceProxy: eco.modularComplianceProxy,
    tokenOnchainID: eco.tokenOnchainID,
    claimIssuer: eco.claimIssuer,
  };
}
