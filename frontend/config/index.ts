/**
 * Deployed contract addresses per network — two-layer architecture.
 *
 * Layer 1 (ChainInfrastructure): shared contracts deployed once per chain.
 *   - Implementation contracts (Token, IR, IRS, TIR, CTR, MC)
 *   - OnchainID implementations (Identity, ImplementationAuthority, IdFactory)
 *   - TREXImplementationAuthority + TREXFactory
 *   - Stateless compliance modules (shared across all tokens)
 *
 * Layer 2 (TokenAddresses): per-token proxy suite deployed via TREXFactory.deployTREXSuite().
 *   - TokenProxy, IdentityRegistryProxy, IRS Proxy, TIR Proxy, CTR Proxy, MC Proxy
 *   - Token OnchainID, ClaimIssuer
 *
 * Chain IDs:
 *   Sepolia     → 11155111
 *   BSC Testnet → 97
 *   Hardhat     → 31337
 */

import sepoliaAddresses from './deployed-addresses.sepolia.json';
import hardhatAddresses from './deployed-addresses.hardhat.json';
import bscTestnetAddresses from './deployed-addresses.bscTestnet.json';

// ── Layer 1: Chain-level shared infrastructure ────────────────────────────────

export type ComplianceModules = {
  countryRestrictModule?: string;
  countryAllowModule?: string;
  maxBalanceModule?: string;
  supplyLimitModule?: string;
};

export type ChainInfrastructure = {
  /** TREX implementation contracts — reused by all proxies via IA */
  implementations: {
    token: string;
    identityRegistry: string;
    identityRegistryStorage: string;
    trustedIssuersRegistry: string;
    claimTopicsRegistry: string;
    modularCompliance: string;
    /** OnchainID identity implementation */
    onchainIDIdentity: string;
    /** OnchainID ImplementationAuthority */
    onchainIDImplementationAuthority: string;
    /** OnchainID IdFactory */
    onchainIDFactory: string;
    [key: string]: string;
  };
  /** Chain-level authority + factory */
  authority: {
    trexImplementationAuthority: string;
    trexFactory: string;
  };
  /** Stateless compliance modules — shared across all tokens on this chain */
  modules: ComplianceModules;
};

// ── Layer 2: Per-token addresses deployed via TREXFactory.deployTREXSuite() ───

export type TokenAddresses = {
  /** CREATE2 salt used to deploy this token via TREXFactory */
  salt: string;
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
  /** Token's OnchainID (IERC734/IERC735 identity) */
  tokenOnchainID: string;
  /** ClaimIssuer contract for this token */
  claimIssuer: string;
};

// ── Legacy AddressGroup (kept for backward compatibility during migration) ────
// Existing static JSON configs use this shape. New code should use
// ChainInfrastructure + TokenAddresses.

/** @deprecated Use ChainInfrastructure + TokenAddresses instead */
export type ComplianceGroup = {
  modularComplianceProxy?: string;
  modules?: ComplianceModules;
  [key: string]: string | ComplianceModules | undefined;
};

/** @deprecated Use ChainInfrastructure + TokenAddresses instead */
export type AddressGroup = {
  implementations: Record<string, string>;
  authorities: Record<string, string>;
  proxies: Record<string, string>;
  factories: Record<string, string>;
  token: Record<string, string>;
  compliance: ComplianceGroup;
};

// ── Static infrastructure config (loaded from JSON files) ────────────────────

/**
 * Per-chain infrastructure addresses (Layer 1).
 * These are the addresses for the shared contracts that were deployed once per chain.
 * New tokens deployed via TREXFactory will reference these.
 */
export const chainInfrastructure: Record<number, ChainInfrastructure> = {
  /** Sepolia (Ethereum testnet) */
  11155111: {
    implementations: {
      token: sepoliaAddresses.implementations.token,
      identityRegistry: sepoliaAddresses.implementations.identityRegistry,
      identityRegistryStorage:
        sepoliaAddresses.implementations.identityRegistryStorage,
      trustedIssuersRegistry:
        sepoliaAddresses.implementations.trustedIssuersRegistry,
      claimTopicsRegistry: sepoliaAddresses.implementations.claimTopicsRegistry,
      modularCompliance: sepoliaAddresses.implementations.modularCompliance,
      onchainIDIdentity: sepoliaAddresses.implementations.onchainIDIdentity,
      onchainIDImplementationAuthority:
        sepoliaAddresses.implementations.onchainIDImplementationAuthority,
      onchainIDFactory: sepoliaAddresses.implementations.onchainIDFactory,
    },
    authority: {
      trexImplementationAuthority:
        sepoliaAddresses.authority.trexImplementationAuthority,
      trexFactory: sepoliaAddresses.authority.trexFactory,
    },
    modules: sepoliaAddresses.modules as ComplianceModules,
  },
  /** BSC Testnet */
  97: {
    implementations: {
      token: bscTestnetAddresses.implementations.token,
      identityRegistry: bscTestnetAddresses.implementations.identityRegistry,
      identityRegistryStorage:
        bscTestnetAddresses.implementations.identityRegistryStorage,
      trustedIssuersRegistry:
        bscTestnetAddresses.implementations.trustedIssuersRegistry,
      claimTopicsRegistry:
        bscTestnetAddresses.implementations.claimTopicsRegistry,
      modularCompliance: bscTestnetAddresses.implementations.modularCompliance,
      onchainIDIdentity: bscTestnetAddresses.implementations.onchainIDIdentity,
      onchainIDImplementationAuthority:
        bscTestnetAddresses.implementations.onchainIDImplementationAuthority,
      onchainIDFactory: bscTestnetAddresses.implementations.onchainIDFactory,
    },
    authority: {
      trexImplementationAuthority:
        bscTestnetAddresses.authority.trexImplementationAuthority,
      trexFactory: bscTestnetAddresses.authority.trexFactory,
    },
    modules: bscTestnetAddresses.modules as ComplianceModules,
  },
  /** Local Hardhat node */
  31337: {
    implementations: {
      token: hardhatAddresses.implementations.token,
      identityRegistry: hardhatAddresses.implementations.identityRegistry,
      identityRegistryStorage:
        hardhatAddresses.implementations.identityRegistryStorage,
      trustedIssuersRegistry:
        hardhatAddresses.implementations.trustedIssuersRegistry,
      claimTopicsRegistry: hardhatAddresses.implementations.claimTopicsRegistry,
      modularCompliance: hardhatAddresses.implementations.modularCompliance,
      onchainIDIdentity: hardhatAddresses.implementations.onchainIDIdentity,
      onchainIDImplementationAuthority:
        hardhatAddresses.implementations.onchainIDImplementationAuthority,
      onchainIDFactory: hardhatAddresses.implementations.onchainIDFactory,
    },
    authority: {
      trexImplementationAuthority:
        hardhatAddresses.authority.trexImplementationAuthority,
      trexFactory: hardhatAddresses.authority.trexFactory,
    },
    modules: hardhatAddresses.modules as ComplianceModules,
  },
};

/**
 * Returns the chain infrastructure for the given chainId,
 * or `null` when the network is unsupported / not yet deployed.
 */
export function getChainInfrastructure(
  chainId: number | undefined,
): ChainInfrastructure | null {
  if (chainId === undefined) return null;
  return chainInfrastructure[chainId] ?? null;
}

// ── Legacy helpers (kept for backward compatibility) ──────────────────────────

/**
 * @deprecated Use chainInfrastructure[chainId] instead.
 * Kept to avoid breaking existing callers during migration.
 */
export const deployedAddresses: Record<number, AddressGroup> = {
  11155111: sepoliaAddresses as unknown as AddressGroup,
  97: bscTestnetAddresses as unknown as AddressGroup,
  31337: hardhatAddresses as unknown as AddressGroup,
};

/**
 * @deprecated Use getChainInfrastructure(chainId) instead.
 */
export function getDeployedAddresses(
  chainId: number | undefined,
): AddressGroup | null {
  if (chainId === undefined) return null;
  return deployedAddresses[chainId] ?? null;
}

/** Human-readable network label for display purposes. */
export function getNetworkLabel(chainId: number | undefined): string {
  switch (chainId) {
    case 11155111:
      return 'Sepolia';
    case 97:
      return 'BSC Testnet';
    case 31337:
      return 'Hardhat (Local)';
    default:
      return 'Unsupported Network';
  }
}
