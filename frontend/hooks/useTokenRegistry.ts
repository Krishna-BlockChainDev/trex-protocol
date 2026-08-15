/**
 * useTokenRegistry
 *
 * Primary hook for interacting with the token registry.
 * Re-exports the context accessor and all associated types so consumers
 * can import everything from '@/hooks' without touching the context module.
 */
export { useTokenRegistryContext as useTokenRegistry } from '@/contexts/TokenRegistryContext';
export type {
  DeployedTokenEcosystem,
  TokenEcosystemMode,
  TokenRegistryContextValue,
} from '@/types/tokenRegistry';
