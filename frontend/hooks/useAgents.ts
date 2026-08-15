/**
 * useAgents – hook for managing agents on the Token and IdentityRegistry contracts.
 *
 * Only the contract owner can add or remove agents.
 * Agents can perform restricted operations:
 *   - Token: mint, burn, pause, unpause, forcedTransfer, setAddressFrozen, etc.
 *   - IdentityRegistry: registerIdentity, deleteIdentity, updateIdentity, updateCountry, etc.
 *
 * Usage:
 *   const { token, identityRegistry } = useAgents();
 *   await token.addAgent('0xAgent…');
 *   const isAgent = await identityRegistry.checkIsAgent('0xWallet…');
 */

import { useCallback } from 'react';
import { useWalletClient, usePublicClient, useReadContract } from 'wagmi';
import { type Address, isAddress } from 'viem';
import { useDeployedAddresses } from './useDeployedAddresses';
import { useTransaction, type UseTransactionReturn } from './useTransaction';
import { TokenABI } from '@/contracts/token';
import { IdentityRegistryABI } from '@/contracts/identityRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentActions = {
  /**
   * Adds `agentAddress` as an agent.  Caller must be the contract owner.
   * Returns the tx hash on success, or `undefined` on error.
   */
  addAgent: (agentAddress: Address) => Promise<string | undefined>;

  /**
   * Removes `agentAddress` from the agent role.  Caller must be the contract owner.
   * Returns the tx hash on success, or `undefined` on error.
   */
  removeAgent: (agentAddress: Address) => Promise<string | undefined>;
};

export type UseAgentsReturn = {
  /** Actions and tx state scoped to the Token contract. */
  token: AgentActions & { txState: UseTransactionReturn };
  /** Actions and tx state scoped to the IdentityRegistry contract. */
  identityRegistry: AgentActions & { txState: UseTransactionReturn };

  /**
   * Check if an address is an agent on the Token contract.
   * Pass `addressToCheck` to read. Returns `undefined` while loading.
   */
  checkIsTokenAgent: (agentAddress: Address) => Promise<boolean | undefined>;

  /**
   * Check if an address is an agent on the IdentityRegistry contract.
   * Pass `addressToCheck` to read. Returns `undefined` while loading.
   */
  checkIsIRAgent: (agentAddress: Address) => Promise<boolean | undefined>;

  /**
   * `true` when the hook has all the data it needs to make contract calls.
   * Gate write actions behind this flag.
   */
  isReady: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgents(): UseAgentsReturn {
  const { addresses } = useDeployedAddresses();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const tokenAddress = addresses?.token as Address | undefined;
  const irAddress = addresses?.identityRegistry as Address | undefined;

  // Separate tx state instances for Token and IdentityRegistry
  const tokenTx = useTransaction();
  const irTx = useTransaction();

  const isReady = Boolean(
    publicClient && walletClient && tokenAddress && irAddress,
  );

  // ── Token agent actions ─────────────────────────────────────────────────────

  const addTokenAgent = useCallback(
    async (agentAddress: Address) => {
      if (!tokenAddress || !walletClient || !publicClient) return undefined;
      if (!isAddress(agentAddress)) return undefined;
      return tokenTx.execute(async () => {
        const hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: TokenABI,
          functionName: 'addAgent',
          args: [agentAddress],
          account: walletClient.account!,
          chain: walletClient.chain,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        return hash;
      });
    },
    [tokenAddress, walletClient, publicClient, tokenTx],
  );

  const removeTokenAgent = useCallback(
    async (agentAddress: Address) => {
      if (!tokenAddress || !walletClient || !publicClient) return undefined;
      if (!isAddress(agentAddress)) return undefined;
      return tokenTx.execute(async () => {
        const hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: TokenABI,
          functionName: 'removeAgent',
          args: [agentAddress],
          account: walletClient.account!,
          chain: walletClient.chain,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        return hash;
      });
    },
    [tokenAddress, walletClient, publicClient, tokenTx],
  );

  const checkIsTokenAgent = useCallback(
    async (agentAddress: Address): Promise<boolean | undefined> => {
      if (!tokenAddress || !publicClient || !isAddress(agentAddress))
        return undefined;
      try {
        return (await publicClient.readContract({
          address: tokenAddress,
          abi: TokenABI,
          functionName: 'isAgent',
          args: [agentAddress],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)) as boolean;
      } catch {
        return undefined;
      }
    },
    [tokenAddress, publicClient],
  );

  // ── IdentityRegistry agent actions ─────────────────────────────────────────

  const addIRAgent = useCallback(
    async (agentAddress: Address) => {
      if (!irAddress || !walletClient || !publicClient) return undefined;
      if (!isAddress(agentAddress)) return undefined;
      return irTx.execute(async () => {
        const hash = await walletClient.writeContract({
          address: irAddress,
          abi: IdentityRegistryABI,
          functionName: 'addAgent',
          args: [agentAddress],
          account: walletClient.account!,
          chain: walletClient.chain,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        return hash;
      });
    },
    [irAddress, walletClient, publicClient, irTx],
  );

  const removeIRAgent = useCallback(
    async (agentAddress: Address) => {
      if (!irAddress || !walletClient || !publicClient) return undefined;
      if (!isAddress(agentAddress)) return undefined;
      return irTx.execute(async () => {
        const hash = await walletClient.writeContract({
          address: irAddress,
          abi: IdentityRegistryABI,
          functionName: 'removeAgent',
          args: [agentAddress],
          account: walletClient.account!,
          chain: walletClient.chain,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        return hash;
      });
    },
    [irAddress, walletClient, publicClient, irTx],
  );

  const checkIsIRAgent = useCallback(
    async (agentAddress: Address): Promise<boolean | undefined> => {
      if (!irAddress || !publicClient || !isAddress(agentAddress))
        return undefined;
      try {
        return (await publicClient.readContract({
          address: irAddress,
          abi: IdentityRegistryABI,
          functionName: 'isAgent',
          args: [agentAddress],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)) as boolean;
      } catch {
        return undefined;
      }
    },
    [irAddress, publicClient],
  );

  return {
    token: {
      addAgent: addTokenAgent,
      removeAgent: removeTokenAgent,
      txState: tokenTx,
    },
    identityRegistry: {
      addAgent: addIRAgent,
      removeAgent: removeIRAgent,
      txState: irTx,
    },
    checkIsTokenAgent,
    checkIsIRAgent,
    isReady,
  };
}
