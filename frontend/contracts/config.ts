/**
 * Contract address configuration.
 *
 * Resolves the correct deployed address for each contract based on the
 * connected chain ID and the currently active TokenEcosystem.
 *
 * Two-layer architecture:
 *   Layer 1 (ChainInfrastructure): shared contracts deployed once per chain.
 *     - getInfraContractAddresses(infrastructure) → impl contracts + factory + modules
 *   Layer 2 (TokenAddresses / DeployedTokenEcosystem): per-token proxies.
 *     - ecosystemToContractAddresses(ecosystem) → all 6 proxy addresses + OID + issuer
 *
 * Chain IDs:
 *   Sepolia     → 11155111
 *   BSC Testnet → 97
 *   Hardhat     → 31337
 */

import type { ChainInfrastructure } from '@/config';
import type {
  DeployedTokenEcosystem,
  DeployedChainInfrastructure,
} from '@/types/tokenRegistry';

// ── Compliance module address map ─────────────────────────────────────────────

export type ModuleAddresses = {
  /** CountryRestrictModule — blacklists countries */
  countryRestrictModule: string;
  /** CountryAllowModule — whitelists countries */
  countryAllowModule: string;
  /** MaxBalanceModule — caps per-investor balance */
  maxBalanceModule: string;
  /** SupplyLimitModule — caps total token supply */
  supplyLimitModule: string;
};

// ── Per-token contract addresses (Layer 2) ────────────────────────────────────

export type ContractAddresses = {
  /** ERC-3643 Token proxy */
  token: string;
  /** Identity Registry proxy */
  identityRegistry: string;
  /** Identity Registry Storage proxy */
  identityRegistryStorage: string;
  /** Trusted Issuers Registry proxy */
  trustedIssuersRegistry: string;
  /** Claim Topics Registry proxy */
  claimTopicsRegistry: string;
  /** Modular Compliance proxy */
  compliance: string;
  /** Token OnchainID (IERC734 / IERC735 identity of the token itself) */
  tokenIdentity: string;
  /** Claim Issuer address */
  claimIssuer: string;
  /** Compliance module addresses (from chain infrastructure) */
  modules: ModuleAddresses;
};

// ── Converters ────────────────────────────────────────────────────────────────

/**
 * Convert a DeployedTokenEcosystem (DB row / wizard result) + chain infrastructure
 * into the flat ContractAddresses shape used throughout the hooks layer.
 *
 * This is the single source of truth for address extraction — both the static
 * config path and the dynamic (DB-selected ecosystem) path go through here.
 */
export function ecosystemToContractAddresses(
  ecosystem: DeployedTokenEcosystem | null | undefined,
  infra: DeployedChainInfrastructure | ChainInfrastructure | null | undefined,
): ContractAddresses | null {
  if (!ecosystem) return null;
  if (!ecosystem.tokenProxy || !ecosystem.identityRegistryProxy) return null;

  // Extract module addresses from either shape
  const modules = extractModules(infra);

  return {
    token: ecosystem.tokenProxy,
    identityRegistry: ecosystem.identityRegistryProxy,
    identityRegistryStorage: ecosystem.identityRegistryStorageProxy,
    trustedIssuersRegistry: ecosystem.trustedIssuersRegistryProxy,
    claimTopicsRegistry: ecosystem.claimTopicsRegistryProxy,
    compliance: ecosystem.modularComplianceProxy,
    tokenIdentity: ecosystem.tokenOnchainID,
    claimIssuer: ecosystem.claimIssuer,
    modules,
  };
}

/** Extract module addresses from either DB infra or static config infra shape. */
function extractModules(
  infra: DeployedChainInfrastructure | ChainInfrastructure | null | undefined,
): ModuleAddresses {
  if (!infra) {
    return emptyModules();
  }

  // DeployedChainInfrastructure shape (from DB / context)
  if ('moduleCountryRestrict' in infra) {
    return {
      countryRestrictModule: infra.moduleCountryRestrict ?? '',
      countryAllowModule: infra.moduleCountryAllow ?? '',
      maxBalanceModule: infra.moduleMaxBalance ?? '',
      supplyLimitModule: infra.moduleSupplyLimit ?? '',
    };
  }

  // ChainInfrastructure shape (from static config)
  if ('modules' in infra) {
    const m = infra.modules;
    return {
      countryRestrictModule: m.countryRestrictModule ?? '',
      countryAllowModule: m.countryAllowModule ?? '',
      maxBalanceModule: m.maxBalanceModule ?? '',
      supplyLimitModule: m.supplyLimitModule ?? '',
    };
  }

  return emptyModules();
}

function emptyModules(): ModuleAddresses {
  return {
    countryRestrictModule: '',
    countryAllowModule: '',
    maxBalanceModule: '',
    supplyLimitModule: '',
  };
}

// ── Legacy shim (kept for backward compatibility) ─────────────────────────────

/** @deprecated Use ecosystemToContractAddresses(ecosystem, infrastructure) instead. */
export type AddressGroup = {
  implementations: Record<string, string>;
  authorities: Record<string, string>;
  proxies: Record<string, string>;
  factories: Record<string, string>;
  token: Record<string, string>;
  compliance: {
    modularComplianceProxy?: string;
    modules?: Partial<ModuleAddresses>;
    [key: string]: string | Partial<ModuleAddresses> | undefined;
  };
};

/**
 * @deprecated Use ecosystemToContractAddresses(ecosystem, infrastructure) instead.
 * Kept to avoid breaking existing callers during migration.
 */
export function addressGroupToContractAddresses(
  ag: AddressGroup | null | undefined,
): ContractAddresses | null {
  if (!ag) return null;

  const token = ag.token?.trexTokenProxy;
  const identityRegistry = ag.proxies?.identityRegistry;
  if (!token || !identityRegistry) return null;

  const mods = ag.compliance?.modules;

  return {
    token,
    identityRegistry,
    identityRegistryStorage: ag.proxies?.identityRegistryStorage ?? '',
    trustedIssuersRegistry: ag.proxies?.trustedIssuersRegistry ?? '',
    claimTopicsRegistry: ag.proxies?.claimTopicsRegistry ?? '',
    compliance: ag.compliance?.modularComplianceProxy ?? '',
    tokenIdentity: ag.token?.tokenOID ?? '',
    claimIssuer: ag.token?.claimIssuer ?? '',
    modules: {
      countryRestrictModule: mods?.countryRestrictModule ?? '',
      countryAllowModule: mods?.countryAllowModule ?? '',
      maxBalanceModule: mods?.maxBalanceModule ?? '',
      supplyLimitModule: mods?.supplyLimitModule ?? '',
    },
  };
}
