/**
 * useDeployedAddresses
 *
 * Returns the deployed contract addresses for the currently active ecosystem.
 *
 * Address resolution (DB-only — no static JSON fallback):
 *   - Custom mode + active ecosystem selected → ecosystemToContractAddresses(activeToken, infrastructure)
 *   - No custom ecosystem selected → null
 *
 * Both infrastructure and token ecosystems are loaded exclusively from the DB.
 * Static config JSON files are NOT used as a fallback anywhere in the app.
 */

import { useAccount } from 'wagmi';
import { getNetworkLabel } from '@/config';
import { useTokenRegistryContext } from '@/contexts/TokenRegistryContext';
import type { DeployedTokenEcosystem } from '@/types/tokenRegistry';
import {
  ecosystemToContractAddresses,
  type ContractAddresses,
} from '@/contracts/config';

export type { ContractAddresses };

export function useDeployedAddresses(): {
  /** Resolved ContractAddresses for the active ecosystem, or null if none selected / no infra */
  addresses: ContractAddresses | null;
  networkLabel: string;
  chainId: number | undefined;
  /** true when addresses !== null (custom ecosystem selected AND infra is in DB) */
  isSupported: boolean;
  isLoading: boolean;
  /**
   * The actively selected custom ecosystem (null when none selected).
   * Use this to read ecosystem-level metadata: name, symbol, deployerAddress, deployedAt.
   */
  activeToken: DeployedTokenEcosystem | null;
} {
  const { chain } = useAccount();
  const chainId = chain?.id;
  const { activeToken, infrastructure, isLoading } = useTokenRegistryContext();

  const networkLabel = getNetworkLabel(chainId);

  // DB-only: resolve addresses only if an active ecosystem is selected
  let addresses: ContractAddresses | null = null;
  if (activeToken) {
    addresses = ecosystemToContractAddresses(activeToken, infrastructure);
  }

  return {
    addresses,
    networkLabel,
    chainId,
    isSupported: addresses !== null,
    isLoading,
    activeToken,
  };
}
