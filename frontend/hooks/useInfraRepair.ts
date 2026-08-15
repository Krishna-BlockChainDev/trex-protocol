/**
 * useInfraRepair
 *
 * Repairs existing chain infrastructure that was deployed WITHOUT the
 * OIDIdFactory.addTokenFactory(trexFactory) call.
 *
 * Symptoms of broken infra:
 *   TREXFactory.deployTREXSuite → reverts with
 *   "only Factory or owner can call" (thrown by OIDIdFactory.createTokenIdentity)
 *
 * Root cause:
 *   The OIDIdFactory requires TREXFactory to be registered as a token factory
 *   via addTokenFactory() before it can call createTokenIdentity().
 *   Old infra deployed before this fix was missing that call.
 *
 * Fix:
 *   Call OIDIdFactory.addTokenFactory(trexFactory) using the infra deployer wallet.
 *   Only the OIDIdFactory owner (= the infra deployer) can call this.
 */

import { useState } from 'react';
import { useWalletClient, usePublicClient, useAccount } from 'wagmi';
import type { Abi, WalletClient, PublicClient } from 'viem';
import type { DeployedChainInfrastructure } from '@/types/tokenRegistry';

// ── Minimal ABI for OIDIdFactory.addTokenFactory ────────────────────────────

const OID_ID_FACTORY_ABI: Abi = [
  {
    name: 'addTokenFactory',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_factory', type: 'address' }],
    outputs: [],
  },
  {
    name: 'isTokenFactory',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_factory', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
];

export type RepairStatus =
  | 'idle'
  | 'checking'
  | 'needed'
  | 'not_needed'
  | 'repairing'
  | 'done'
  | 'error';

export interface UseInfraRepairReturn {
  repairStatus: RepairStatus;
  repairError: string | null;
  checkIfRepairNeeded: (infra: DeployedChainInfrastructure) => Promise<void>;
  repairInfra: (infra: DeployedChainInfrastructure) => Promise<void>;
}

export function useInfraRepair(): UseInfraRepairReturn {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address: account } = useAccount();

  const [repairStatus, setRepairStatus] = useState<RepairStatus>('idle');
  const [repairError, setRepairError] = useState<string | null>(null);

  /**
   * Reads OIDIdFactory.isTokenFactory(trexFactory) on-chain.
   * If false → repair is needed.
   */
  async function checkIfRepairNeeded(
    infra: DeployedChainInfrastructure,
  ): Promise<void> {
    if (!publicClient) return;

    setRepairStatus('checking');
    setRepairError(null);

    try {
       
      const pc = publicClient as unknown as PublicClient;
      const isRegistered = await pc.readContract({
        address: infra.oidIdFactory as `0x${string}`,
        abi: OID_ID_FACTORY_ABI,
        functionName: 'isTokenFactory',
        args: [infra.trexFactory as `0x${string}`],
      });

      setRepairStatus(isRegistered ? 'not_needed' : 'needed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRepairError(msg);
      setRepairStatus('error');
    }
  }

  /**
   * Calls OIDIdFactory.addTokenFactory(trexFactory) with the connected wallet.
   * The connected wallet must be the OIDIdFactory owner (= infra deployer).
   */
  async function repairInfra(
    infra: DeployedChainInfrastructure,
  ): Promise<void> {
    if (!walletClient || !publicClient || !account) {
      throw new Error('Wallet not connected');
    }

    setRepairStatus('repairing');
    setRepairError(null);

    try {
       
      const wc = walletClient as unknown as WalletClient;
       
      const pc = publicClient as unknown as PublicClient;

      const hash = await wc.writeContract({
        address: infra.oidIdFactory as `0x${string}`,
        abi: OID_ID_FACTORY_ABI,
        functionName: 'addTokenFactory',
        args: [infra.trexFactory as `0x${string}`],
        account,
        chain: null,
      });

      await pc.waitForTransactionReceipt({ hash });
      setRepairStatus('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRepairError(msg);
      setRepairStatus('error');
    }
  }

  return {
    repairStatus,
    repairError,
    checkIfRepairNeeded,
    repairInfra,
  };
}
