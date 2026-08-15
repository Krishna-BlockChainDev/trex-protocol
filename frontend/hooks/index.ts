/**
 * Hooks barrel export.
 *
 * Import from here in pages and components instead of importing individual
 * hook modules:
 *
 *   import { useWallet, useContracts, useTransaction, useToken } from '@/hooks';
 */

export { useWallet } from './useWallet';
export type { WalletState, ConnectionStatus } from './useWallet';

export { useContracts } from './useContracts';
export type { ContractInstances } from './useContracts';

export { useTransaction } from './useTransaction';
export type {
  TxStatus,
  TransactionState,
  UseTransactionReturn,
} from './useTransaction';

export { useToken } from './useToken';
export type { TokenInfo, TokenActions, UseTokenReturn } from './useToken';

export { useDeployedAddresses } from './useDeployedAddresses';
export type { ContractAddresses } from './useDeployedAddresses';

export { useIdentity } from './useIdentity';
export type { UseIdentityReturn } from './useIdentity';

export { useAgents } from './useAgents';
export type { UseAgentsReturn, AgentActions } from './useAgents';

export { useComplianceModules } from './useComplianceModules';
export type {
  UseComplianceModulesReturn,
  ComplianceModuleActions,
  ModuleStatus,
  MaxBalanceState,
  SupplyLimitState,
} from './useComplianceModules';

export { useCountryList, countryLabel, COUNTRY_NAMES } from './useCountryList';
export type { UseCountryListReturn } from './useCountryList';

export { useTokenRegistry } from './useTokenRegistry';
export type {
  DeployedTokenEcosystem,
  TokenEcosystemMode,
  TokenRegistryContextValue,
} from './useTokenRegistry';

export { useDeploymentWizard } from './useDeploymentWizard';
export type {
  TokenDeployParams,
  DeployStepId,
  DeployStepStatus,
  DeployStep,
  DeployWIPState,
  WIPAddresses,
  WizardPhase,
  UseDeploymentWizardReturn,
} from './useDeploymentWizard';
