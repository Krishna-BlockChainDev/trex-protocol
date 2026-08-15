/**
 * Contract layer barrel export.
 *
 * Import from here in pages / hooks instead of importing individual modules:
 *
 *   import { getTokenContract, getTokenInfo, TokenABI } from '@/contracts';
 *   import { isVerified, IdentityRegistryABI }          from '@/contracts';
 *   import { canTransfer, ComplianceABI }               from '@/contracts';
 *   import { getClaim, IdentityABI }                    from '@/contracts';
 *   import { getContractAddresses }                     from '@/contracts';
 */

// ── Config (address resolver) ─────────────────────────────────────────────────
export type { ContractAddresses, ModuleAddresses } from './config';
export {
  ecosystemToContractAddresses,
  addressGroupToContractAddresses,
} from './config';

// ── Token (IToken / ERC-3643) ─────────────────────────────────────────────────
export type { TokenInfo } from './token';
export {
  TokenABI,
  getTokenContract,
  getTokenInfo,
  getTokenBalance,
  isAddressFrozen,
  pauseToken,
  unpauseToken,
  setAddressFrozen,
  mintTokens,
  burnTokens,
  forcedTransfer,
  checkIsAgent,
} from './token';

// ── Identity Registry ─────────────────────────────────────────────────────────
export {
  IdentityRegistryABI,
  isVerified,
  contains,
  getIdentityAddress,
  getInvestorCountry,
  getIdentityRegistryStorage,
  getTrustedIssuersRegistry,
  getClaimTopicsRegistry,
  registerIdentity,
  updateIdentity,
  updateCountry,
  deleteIdentity,
  batchRegisterIdentity,
} from './identityRegistry';

// ── OnchainID Identity (IERC734 / IERC735) ────────────────────────────────────
export type { IdentityKey, Claim } from './identity';
export {
  IdentityABI,
  KEY_PURPOSES,
  KEY_TYPES,
  getKey,
  getKeysByPurpose,
  keyHasPurpose,
  getClaim,
  getClaimIdsByTopic,
  addKey,
  removeKey,
  addClaim,
  removeClaim,
} from './identity';

// ── OnchainID IdFactory ───────────────────────────────────────────────────────
export {
  IdFactoryABI,
  getIdentityByWallet,
  isSaltTaken,
  createIdentity as createIdentityViaFactory,
  buildSalt,
  hasIdentity,
} from './idFactory';

// ── Modular Compliance ────────────────────────────────────────────────────────
export {
  ComplianceABI,
  canTransfer,
  getModules,
  isModuleBound,
  getBoundToken,
  addModule,
  removeModule,
  bindToken,
  unbindToken,
} from './compliance';

// ── Compliance Modules ────────────────────────────────────────────────────────
export {
  CountryRestrictModuleABI,
  CountryAllowModuleABI,
  MaxBalanceModuleABI,
  SupplyLimitModuleABI,
  restrictCountry,
  unrestrictCountry,
  batchRestrictCountries,
  batchUnrestrictCountries,
  isCountryRestricted,
  allowCountry,
  disallowCountry,
  batchAllowCountries,
  batchDisallowCountries,
  isCountryAllowed,
  setMaxBalance,
  getMaxBalance,
  setSupplyLimit,
  getSupplyLimit,
  addModuleToCompliance,
  removeModuleFromCompliance,
} from './complianceModules';
