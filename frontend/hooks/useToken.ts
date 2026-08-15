/**
 * useToken – reactive ERC-3643 token data hook.
 *
 * Fetches token metadata and the connected wallet's balance using wagmi's
 * `useReadContracts` (React Query under the hood) so values stay fresh
 * without manual polling loops.
 *
 * Also exposes action helpers (pause, unpause, mint, burn, etc.) pre-wired
 * to `useTransaction` so every write already has loading / error state.
 *
 * Usage:
 *   const { info, balance, isFrozen, actions, txState } = useToken();
 */

import { useReadContracts, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, type Abi, type Address, type Hash } from 'viem';
import type { PublicClient, WalletClient } from 'viem';
import { useContracts } from './useContracts';
import { useWallet } from './useWallet';
import { useTransaction, type UseTransactionReturn } from './useTransaction';
import {
  TokenABI,
  pauseToken,
  unpauseToken,
  mintTokens,
  burnTokens,
  forcedTransfer as forcedTransferFn,
  setAddressFrozen as setAddressFrozenFn,
  type TokenInfo,
} from '@/contracts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { TokenInfo };

export type TokenActions = {
  /** Pause all token transfers.  Caller must be owner / agent. */
  pause: () => Promise<Hash | undefined>;
  /** Unpause token transfers.  Caller must be owner / agent. */
  unpause: () => Promise<Hash | undefined>;
  /**
   * Mint `amount` (wei) tokens to `to`.
   * Caller must be a token agent.
   */
  mint: (to: Address, amount: bigint) => Promise<Hash | undefined>;
  /**
   * Burn `amount` (wei) tokens from `from`.
   * Caller must be a token agent.
   */
  burn: (from: Address, amount: bigint) => Promise<Hash | undefined>;
  /**
   * Force a transfer of `amount` tokens from `from` to `to`.
   * Caller must be a token agent.
   */
  forcedTransfer: (
    from: Address,
    to: Address,
    amount: bigint,
  ) => Promise<Hash | undefined>;
  /**
   * Freeze or unfreeze a wallet address on this token.
   * Caller must be a token agent.
   */
  setAddressFrozen: (
    wallet: Address,
    frozen: boolean,
  ) => Promise<Hash | undefined>;
};

export type UseTokenReturn = {
  // ── Token metadata ────────────────────────────────────────────────────────
  /** Core token metadata (name, symbol, decimals, totalSupply, …). */
  info: TokenInfo | undefined;
  /** `true` while the initial metadata fetch is in progress. */
  isLoading: boolean;
  /** `true` when the metadata fetch failed. */
  isError: boolean;
  /** Manually re-fetch all token metadata + balances. */
  refetch: () => void;

  // ── Connected wallet ──────────────────────────────────────────────────────
  /** Raw token balance (wei) for the connected wallet; `undefined` when disconnected. */
  balance: bigint | undefined;
  /**
   * Human-readable token balance string.
   * Respects the token's `decimals` (e.g. "1234.5678").
   * Falls back to "0.0000" when balance or decimals are unavailable.
   */
  formattedTokenBalance: string;
  /** `true` when the connected wallet address is frozen on this token. */
  isFrozen: boolean;
  /**
   * `true` when the connected wallet holds the Agent role on this token.
   * `undefined` while loading or when no wallet is connected.
   */
  isAgent: boolean | undefined;
  /** `true` while the agent role check is in-flight. */
  isAgentLoading: boolean;

  // ── Write actions ─────────────────────────────────────────────────────────
  /** Pre-wired action helpers – each call drives `txState` below. */
  actions: TokenActions;
  /**
   * Transaction lifecycle state shared by all `actions`.
   * Use `txState.isPending`, `txState.errorMessage`, `txState.txHash`, etc.
   * to render loading spinners, toast messages, and block-explorer links.
   */
  txState: UseTransactionReturn;
};

// ─── Typed ABI reference ──────────────────────────────────────────────────────
// TokenABI is imported from JSON so TypeScript types it as a plain array.
// Casting to `Abi` satisfies wagmi's useReadContracts type constraints.
const TOKEN_ABI = TokenABI as Abi;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToken(): UseTokenReturn {
  const { addresses } = useContracts();
  const { address: walletAddress } = useWallet();
  const txState = useTransaction();

  // Obtain viem clients directly from wagmi for correct generic resolution.
  // Casting to the base viem types that the @/contracts helper functions expect.
  const rawPublicClient = usePublicClient();
  const { data: rawWalletClient } = useWalletClient();
  const publicClient = rawPublicClient as PublicClient | undefined;
  const walletClient = rawWalletClient as WalletClient | undefined;

  const tokenAddress = addresses?.token as Address | undefined;

  // ── Batch-read all static token metadata in one RPC round-trip ────────────
  // Conditionally include balance + freeze state when a wallet is connected.
  const baseContract = tokenAddress
    ? { address: tokenAddress, abi: TOKEN_ABI }
    : null;

  const contracts = baseContract
    ? [
        { ...baseContract, functionName: 'name' },
        { ...baseContract, functionName: 'symbol' },
        { ...baseContract, functionName: 'decimals' },
        { ...baseContract, functionName: 'totalSupply' },
        { ...baseContract, functionName: 'paused' },
        { ...baseContract, functionName: 'identityRegistry' },
        { ...baseContract, functionName: 'compliance' },
        ...(walletAddress
          ? [
              {
                ...baseContract,
                functionName: 'balanceOf',
                args: [walletAddress],
              },
              {
                ...baseContract,
                functionName: 'isFrozen',
                args: [walletAddress],
              },
              {
                ...baseContract,
                functionName: 'isAgent',
                args: [walletAddress],
              },
            ]
          : []),
      ]
    : [];

  const {
    data: results,
    isLoading,
    isError,
    refetch,
  } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: {
      enabled: Boolean(tokenAddress),
      // Re-fetch every ~15 s so balance / paused state stay current.
      refetchInterval: 15_000,
    },
    allowFailure: true,
  });

  // ── Derive typed values from raw multicall results ─────────────────────────

  const name = (results?.[0]?.result as string | undefined) ?? '';
  const symbol = (results?.[1]?.result as string | undefined) ?? '';
  const decimals = (results?.[2]?.result as number | undefined) ?? 18;
  const totalSupply = (results?.[3]?.result as bigint | undefined) ?? BigInt(0);
  const paused = (results?.[4]?.result as boolean | undefined) ?? false;
  const identityRegistry = (results?.[5]?.result as string | undefined) ?? '';
  const compliance = (results?.[6]?.result as string | undefined) ?? '';

  const info: TokenInfo | undefined = tokenAddress
    ? {
        name,
        symbol,
        decimals,
        totalSupply,
        paused,
        owner: '',
        identityRegistry,
        compliance,
      }
    : undefined;

  // Balance and freeze state occupy slots 7 and 8 only when walletAddress is set.
  const balance = walletAddress
    ? (results?.[7]?.result as bigint | undefined)
    : undefined;

  const formattedTokenBalance =
    balance !== undefined
      ? parseFloat(formatUnits(balance, decimals)).toFixed(4)
      : '0.0000';

  const isFrozen = walletAddress ? Boolean(results?.[8]?.result) : false;

  // isAgent occupies slot 9 (only when walletAddress is set)
  const isAgent = walletAddress
    ? (results?.[9]?.result as boolean | undefined)
    : undefined;
  // isAgentLoading is true while the read is in-flight and wallet is connected
  const isAgentLoading = Boolean(walletAddress && tokenAddress && isLoading);

  // ── Client guard helper ────────────────────────────────────────────────────
  // Throws a descriptive error when attempting a write without the requisite
  // clients, ensuring the thrown error surfaces cleanly in txState.errorMessage.
  function requireClients(): {
    wc: WalletClient;
    pc: PublicClient;
    addr: Address;
  } {
    if (!walletClient || !publicClient) {
      throw new Error(
        'Wallet not connected. Please connect your wallet first.',
      );
    }
    if (!tokenAddress) {
      throw new Error(
        'Token address is not available for the current network. ' +
          'Ensure your wallet is connected to a supported chain.',
      );
    }
    return {
      wc: walletClient,
      pc: publicClient,
      addr: tokenAddress,
    };
  }

  // ── Write actions ─────────────────────────────────────────────────────────

  const actions: TokenActions = {
    pause: () =>
      txState.execute(() => {
        const { wc, pc, addr } = requireClients();
        return pauseToken(addr, wc, pc);
      }),

    unpause: () =>
      txState.execute(() => {
        const { wc, pc, addr } = requireClients();
        return unpauseToken(addr, wc, pc);
      }),

    mint: (to, amount) =>
      txState.execute(() => {
        const { wc, pc, addr } = requireClients();
        return mintTokens(addr, to, amount, wc, pc);
      }),

    burn: (from, amount) =>
      txState.execute(() => {
        const { wc, pc, addr } = requireClients();
        return burnTokens(addr, from, amount, wc, pc);
      }),

    forcedTransfer: (from, to, amount) =>
      txState.execute(() => {
        const { wc, pc, addr } = requireClients();
        return forcedTransferFn(addr, from, to, amount, wc, pc);
      }),

    setAddressFrozen: (wallet, frozen) =>
      txState.execute(() => {
        const { wc, pc, addr } = requireClients();
        return setAddressFrozenFn(addr, wallet, frozen, wc, pc);
      }),
  };

  return {
    info,
    isLoading,
    isError,
    refetch,
    balance,
    formattedTokenBalance,
    isFrozen,
    isAgent,
    isAgentLoading,
    actions,
    txState,
  };
}
