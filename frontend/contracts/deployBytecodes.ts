/**
 * Deploy Artifacts
 *
 * Exports the ABI + bytecode for every contract needed by the TREX
 * deployment wizard.  These are imported directly from the compiled Hardhat
 * artifacts so they always stay in sync with the smart-contracts package.
 *
 * This file is intentionally only imported by the deploy-wizard page
 * (pages/deploy/index.tsx) — Next.js / webpack will code-split it into a
 * separate chunk that is never fetched during normal dashboard usage.
 *
 * Hardhat artifacts are JSON objects with shape:
 *   { contractName, abi, bytecode, deployedBytecode, ... }
 *
 * viem deployContract requires:
 *   { abi: Abi, bytecode: `0x${string}`, args?: [...] }
 */

// ── TREX registry implementations ────────────────────────────────────────────
import ClaimTopicsRegistryJson from '../../smart-contracts/artifacts/contracts/registry/implementation/ClaimTopicsRegistry.sol/ClaimTopicsRegistry.json';
import TrustedIssuersRegistryJson from '../../smart-contracts/artifacts/contracts/registry/implementation/TrustedIssuersRegistry.sol/TrustedIssuersRegistry.json';
import IdentityRegistryStorageJson from '../../smart-contracts/artifacts/contracts/registry/implementation/IdentityRegistryStorage.sol/IdentityRegistryStorage.json';
import IdentityRegistryJson from '../../smart-contracts/artifacts/contracts/registry/implementation/IdentityRegistry.sol/IdentityRegistry.json';

// ── TREX compliance / token implementations ───────────────────────────────────
import ModularComplianceJson from '../../smart-contracts/artifacts/contracts/compliance/modular/ModularCompliance.sol/ModularCompliance.json';
import TokenJson from '../../smart-contracts/artifacts/contracts/token/Token.sol/Token.json';

// ── TREX authority & factory ──────────────────────────────────────────────────
import TREXImplementationAuthorityJson from '../../smart-contracts/artifacts/contracts/proxy/authority/TREXImplementationAuthority.sol/TREXImplementationAuthority.json';
import TREXFactoryJson from '../../smart-contracts/artifacts/contracts/factory/TREXFactory.sol/TREXFactory.json';

// ── TREX proxies ──────────────────────────────────────────────────────────────
import ClaimTopicsRegistryProxyJson from '../../smart-contracts/artifacts/contracts/proxy/ClaimTopicsRegistryProxy.sol/ClaimTopicsRegistryProxy.json';
import TrustedIssuersRegistryProxyJson from '../../smart-contracts/artifacts/contracts/proxy/TrustedIssuersRegistryProxy.sol/TrustedIssuersRegistryProxy.json';
import IdentityRegistryStorageProxyJson from '../../smart-contracts/artifacts/contracts/proxy/IdentityRegistryStorageProxy.sol/IdentityRegistryStorageProxy.json';
import IdentityRegistryProxyJson from '../../smart-contracts/artifacts/contracts/proxy/IdentityRegistryProxy.sol/IdentityRegistryProxy.json';
import ModularComplianceProxyJson from '../../smart-contracts/artifacts/contracts/proxy/ModularComplianceProxy.sol/ModularComplianceProxy.json';
import TokenProxyJson from '../../smart-contracts/artifacts/contracts/proxy/TokenProxy.sol/TokenProxy.json';

// ── Compliance modules ────────────────────────────────────────────────────────
import CountryRestrictModuleJson from '../../smart-contracts/artifacts/contracts/compliance/modular/modules/CountryRestrictModule.sol/CountryRestrictModule.json';
import CountryAllowModuleJson from '../../smart-contracts/artifacts/contracts/compliance/modular/modules/CountryAllowModule.sol/CountryAllowModule.json';
import MaxBalanceModuleJson from '../../smart-contracts/artifacts/contracts/compliance/modular/modules/MaxBalanceModule.sol/MaxBalanceModule.json';
import SupplyLimitModuleJson from '../../smart-contracts/artifacts/contracts/compliance/modular/modules/SupplyLimitModule.sol/SupplyLimitModule.json';

// ── OnchainID contracts ───────────────────────────────────────────────────────
import OIDIdentityJson from '../../smart-contracts/node_modules/@onchain-id/solidity/artifacts/contracts/Identity.sol/Identity.json';
import OIDImplementationAuthorityJson from '../../smart-contracts/node_modules/@onchain-id/solidity/artifacts/contracts/proxy/ImplementationAuthority.sol/ImplementationAuthority.json';
import OIDIdFactoryJson from '../../smart-contracts/node_modules/@onchain-id/solidity/artifacts/contracts/factory/IdFactory.sol/IdFactory.json';
import OIDIdentityProxyJson from '../../smart-contracts/node_modules/@onchain-id/solidity/artifacts/contracts/proxy/IdentityProxy.sol/IdentityProxy.json';
import OIDClaimIssuerJson from '../../smart-contracts/node_modules/@onchain-id/solidity/artifacts/contracts/ClaimIssuer.sol/ClaimIssuer.json';

// ── Type helper ───────────────────────────────────────────────────────────────
type Artifact = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any[];
  bytecode: `0x${string}`;
};

function artifact(json: { abi: unknown[]; bytecode: string }): Artifact {
  return {
    abi: json.abi,
    bytecode: json.bytecode as `0x${string}`,
  };
}

// ── Exported artifacts ────────────────────────────────────────────────────────

/** ClaimTopicsRegistry implementation — constructor: () */
export const ClaimTopicsRegistry = artifact(ClaimTopicsRegistryJson);

/** TrustedIssuersRegistry implementation — constructor: () */
export const TrustedIssuersRegistry = artifact(TrustedIssuersRegistryJson);

/** IdentityRegistryStorage implementation — constructor: () */
export const IdentityRegistryStorage = artifact(IdentityRegistryStorageJson);

/** IdentityRegistry implementation — constructor: () */
export const IdentityRegistry = artifact(IdentityRegistryJson);

/** ModularCompliance implementation — constructor: () */
export const ModularCompliance = artifact(ModularComplianceJson);

/** Token implementation — constructor: () */
export const Token = artifact(TokenJson);

/**
 * TREXImplementationAuthority
 * constructor: (bool _referenceStatus, address _trexFactory, address _iaFactory)
 *   → pass (true, zeroAddress, zeroAddress) for a standalone authority
 */
export const TREXImplementationAuthority = artifact(
  TREXImplementationAuthorityJson,
);

/**
 * TREXFactory
 * constructor: (address _implementationAuthority, address _idFactory)
 */
export const TREXFactory = artifact(TREXFactoryJson);

/**
 * ClaimTopicsRegistryProxy
 * constructor: (address implementationAuthority)
 */
export const ClaimTopicsRegistryProxy = artifact(ClaimTopicsRegistryProxyJson);

/**
 * TrustedIssuersRegistryProxy
 * constructor: (address implementationAuthority)
 */
export const TrustedIssuersRegistryProxy = artifact(
  TrustedIssuersRegistryProxyJson,
);

/**
 * IdentityRegistryStorageProxy
 * constructor: (address implementationAuthority)
 */
export const IdentityRegistryStorageProxy = artifact(
  IdentityRegistryStorageProxyJson,
);

/**
 * IdentityRegistryProxy
 * constructor: (address ia, address tir, address ctr, address irs)
 */
export const IdentityRegistryProxy = artifact(IdentityRegistryProxyJson);

/**
 * ModularComplianceProxy
 * constructor: (address implementationAuthority)
 */
export const ModularComplianceProxy = artifact(ModularComplianceProxyJson);

/**
 * TokenProxy
 * constructor: (address ia, address ir, address mc,
 *               string name, string symbol, uint8 decimals, address onchainID)
 */
export const TokenProxy = artifact(TokenProxyJson);

/** CountryRestrictModule — constructor: () */
export const CountryRestrictModule = artifact(CountryRestrictModuleJson);

/** CountryAllowModule — constructor: () */
export const CountryAllowModule = artifact(CountryAllowModuleJson);

/** MaxBalanceModule — constructor: () */
export const MaxBalanceModule = artifact(MaxBalanceModuleJson);

/** SupplyLimitModule — constructor: () */
export const SupplyLimitModule = artifact(SupplyLimitModuleJson);

/**
 * OnchainID Identity implementation
 * constructor: (address initialManagementKey, bool _isLibrary)
 *   → pass (deployer, true) for the implementation (library mode)
 */
export const OIDIdentity = artifact(OIDIdentityJson);

/**
 * OnchainID ImplementationAuthority
 * constructor: (address implementationAddress)
 */
export const OIDImplementationAuthority = artifact(
  OIDImplementationAuthorityJson,
);

/**
 * OnchainID IdFactory
 * constructor: (address _implementationAuthority)
 */
export const OIDIdFactory = artifact(OIDIdFactoryJson);

/**
 * OnchainID IdentityProxy
 * constructor: (address implementationAuthority, address managementKey)
 */
export const OIDIdentityProxy = artifact(OIDIdentityProxyJson);

/**
 * OnchainID ClaimIssuer
 * constructor: (address initialManagementKey)
 */
export const OIDClaimIssuer = artifact(OIDClaimIssuerJson);

// ── Convenience re-export for bulk iteration ──────────────────────────────────

export const ALL_ARTIFACTS = {
  // implementations
  ClaimTopicsRegistry,
  TrustedIssuersRegistry,
  IdentityRegistryStorage,
  IdentityRegistry,
  ModularCompliance,
  Token,
  OIDIdentity,
  OIDImplementationAuthority,
  OIDIdFactory,
  // authority + factory
  TREXImplementationAuthority,
  TREXFactory,
  // proxies
  ClaimTopicsRegistryProxy,
  TrustedIssuersRegistryProxy,
  IdentityRegistryStorageProxy,
  IdentityRegistryProxy,
  ModularComplianceProxy,
  TokenProxy,
  // OID
  OIDIdentityProxy,
  OIDClaimIssuer,
  // compliance modules
  CountryRestrictModule,
  CountryAllowModule,
  MaxBalanceModule,
  SupplyLimitModule,
} as const;
