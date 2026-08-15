/**
 * useContracts – pre-initialised viem contract instances hook.
 *
 * Resolves the correct deployment addresses for the connected chain and
 * returns memoised viem contract instances for every ERC-3643 contract.
 * Components can call `.read.*` and `.write.*` directly on the returned
 * instances, or pass the exported ABIs and addresses to wagmi hooks.
 *
 * Returns `null` instances (and `isReady: false`) when:
 *   - The wallet is disconnected.
 *   - The connected chain has no deployment entry.
 *   - The viem PublicClient is not yet available (SSR / initial hydration).
 *
 * Usage:
 *   const { token, identityRegistry, compliance, isReady } = useContracts();
 *   if (!isReady) return <Spinner />;
 *   const name = await token.read.name();
 */

import { useMemo, useCallback } from 'react';
import { getContract, type Address } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { useDeployedAddresses } from './useDeployedAddresses';
import {
  type ContractAddresses,
  TokenABI,
  IdentityRegistryABI,
  ComplianceABI,
  IdentityABI,
} from '@/contracts';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Opaque contract handle returned by viem's `getContract`.
 *
 * We intentionally use `any` here because `GetContractReturnType<abi, client>`
 * is heavily parameterised by the concrete ABI and client types, making it
 * impossible to express a single shared alias without fighting TypeScript's
 * generic constraints.  Callers that need stronger typing should call
 * `getContract` directly with the specific ABI they care about.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractHandle = any;

export type ContractInstances = {
  /**
   * Resolved addresses for the currently connected chain.
   * `null` when chain is unsupported or wallet is disconnected.
   */
  addresses: ContractAddresses | null;

  // ── Ready-to-use contract instances ───────────────────────────────────────

  /**
   * ERC-3643 token proxy contract.
   * Supports `.read.*` (always) and `.write.*` (when walletClient is present).
   * @example await token.read.name()
   * @example await token.write.transfer([to, amount])
   */
  token: ContractHandle | null;

  /**
   * Identity Registry proxy contract.
   * Manages which wallet addresses have verified on-chain identities.
   * @example await identityRegistry.read.isVerified([investorAddress])
   */
  identityRegistry: ContractHandle | null;

  /**
   * Modular Compliance proxy contract.
   * Governs transfer-rule modules (country restrictions, max balance, etc.).
   * @example await compliance.read.canTransfer([from, to, amount])
   */
  compliance: ContractHandle | null;

  // ── Factory for per-investor identity contracts ───────────────────────────

  /**
   * Returns a viem contract instance for an arbitrary OnchainID identity
   * contract address.  Each investor (and the token itself) has their own
   * identity contract, so this is a factory rather than a singleton.
   *
   * Returns `null` when the public client is not yet available.
   *
   * @example
   * const id = getIdentityContract('0xAbc…');
   * const claimIds = await id.read.getClaimIdsByTopic([topic]);
   */
  getIdentityContract: ((identityAddress: Address) => ContractHandle) | null;

  // ── ABIs (pass directly to wagmi's useReadContract / useWriteContract) ────

  /** Token contract ABI – use with wagmi hooks for reactive reads. */
  tokenABI: typeof TokenABI;
  /** Identity Registry contract ABI. */
  identityRegistryABI: typeof IdentityRegistryABI;
  /** Modular Compliance contract ABI. */
  complianceABI: typeof ComplianceABI;
  /** OnchainID Identity contract ABI. */
  identityABI: typeof IdentityABI;

  // ── Status ─────────────────────────────────────────────────────────────────

  /**
   * `true` when all critical contract instances are initialised and ready.
   * Gate write actions and data fetches behind this flag.
   */
  isReady: boolean;
  /**
   * `true` when a wallet is connected but the chain has no known deployment.
   * Use this to show a "wrong network" warning.
   */
  isWrongNetwork: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns memoised viem contract instances for the connected chain's
 * ERC-3643 deployment.
 *
 * Instances are rebuilt only when the public client, wallet client, or
 * chain ID changes – preventing unnecessary re-renders in consumers.
 *
 * @example
 * const { token, isReady, addresses, tokenABI } = useContracts();
 * if (!isReady) return null;
 *
 * // Direct viem call (imperative, e.g. in an onClick handler)
 * const totalSupply = await token.read.totalSupply();
 *
 * // Wagmi hook for reactive / cached reads
 * const { data } = useReadContract({
 *   address: addresses.token,
 *   abi: tokenABI,
 *   functionName: 'name',
 * });
 */
export function useContracts(): ContractInstances {
  // useDeployedAddresses now returns ContractAddresses directly (flat shape)
  const { addresses, chainId, isSupported } = useDeployedAddresses();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Extract individual address strings before useMemo so React Compiler can
  // track them as primitive (string) deps instead of object property accesses.
  const tokenAddress = addresses?.token;
  const irAddress = addresses?.identityRegistry;
  const complianceAddr = addresses?.compliance;

  // Build the viem client argument.
  // Passing both public + wallet enables reads AND writes from one instance.
  // We deliberately avoid memoising this as an object literal; the individual
  // client references are already stable between renders (wagmi manages them).
  const viemClient = useMemo(() => {
    if (!publicClient) return null;
    if (walletClient) return { public: publicClient, wallet: walletClient };
    return publicClient;
  }, [publicClient, walletClient]);

  // ── Token contract ─────────────────────────────────────────────────────────
  const token = useMemo(() => {
    if (!viemClient || !tokenAddress) return null;
    return getContract({
      address: tokenAddress as Address,
      abi: TokenABI,
      client: viemClient,
    });
  }, [viemClient, tokenAddress]);

  // ── Identity Registry contract ─────────────────────────────────────────────
  const identityRegistry = useMemo(() => {
    if (!viemClient || !irAddress) return null;
    return getContract({
      address: irAddress as Address,
      abi: IdentityRegistryABI,
      client: viemClient,
    });
  }, [viemClient, irAddress]);

  // ── Compliance contract ────────────────────────────────────────────────────
  const compliance = useMemo(() => {
    if (!viemClient || !complianceAddr) return null;
    return getContract({
      address: complianceAddr as Address,
      abi: ComplianceABI,
      client: viemClient,
    });
  }, [viemClient, complianceAddr]);

  // ── Per-investor identity factory ──────────────────────────────────────────
  // Each investor has their own OnchainID contract, so we expose a factory
  // rather than a singleton.  The factory itself is memoised; calling it
  // with a specific address is cheap.
  const getIdentityContract = useCallback(
    (identityAddress: Address) => {
      if (!viemClient) {
        throw new Error(
          'useContracts: publicClient is not available. ' +
            'Ensure the component is rendered inside WagmiProvider.',
        );
      }
      return getContract({
        address: identityAddress,
        abi: IdentityABI,
        client: viemClient,
      });
    },
    [viemClient],
  );

  const isReady = Boolean(
    publicClient && addresses && token && identityRegistry,
  );
  const isWrongNetwork = Boolean(publicClient && !isSupported);

  return {
    addresses,
    token,
    identityRegistry,
    compliance,
    getIdentityContract: viemClient ? getIdentityContract : null,
    tokenABI: TokenABI,
    identityRegistryABI: IdentityRegistryABI,
    complianceABI: ComplianceABI,
    identityABI: IdentityABI,
    isReady,
    isWrongNetwork,
  };
}
