/**
 * useWallet – unified wallet state hook.
 *
 * Aggregates wagmi's account, balance, and client hooks into a single,
 * stable object so components never need to import from wagmi directly
 * for basic wallet state.
 *
 * Usage:
 *   const { address, isConnected, networkLabel, formattedBalance } = useWallet();
 */

import {
  useAccount,
  useBalance,
  usePublicClient,
  useWalletClient,
} from 'wagmi';
import { type Address, type PublicClient } from 'viem';
import { useDeployedAddresses } from './useDeployedAddresses';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Connection lifecycle status mirrored from wagmi's useAccount. */
export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected';

export type WalletState = {
  // ── Identity ───────────────────────────────────────────────────────────────
  /** Connected wallet address; `undefined` when disconnected. */
  address: Address | undefined;
  /** EIP-155 chain ID of the connected network; `undefined` when disconnected. */
  chainId: number | undefined;

  // ── Status flags ───────────────────────────────────────────────────────────
  /** `true` when a wallet is fully connected and an address is available. */
  isConnected: boolean;
  /** `true` while the wallet is in the process of connecting for the first time. */
  isConnecting: boolean;
  /** `true` during the silent auto-reconnect on page load. */
  isReconnecting: boolean;
  /** `true` when no wallet is connected. */
  isDisconnected: boolean;
  /** Granular connection lifecycle value. */
  status: ConnectionStatus;

  // ── Network ────────────────────────────────────────────────────────────────
  /** Human-readable label for the connected network (e.g. "Sepolia"). */
  networkLabel: string;
  /**
   * `true` when the connected chain has a known contract deployment.
   * Components should gate write actions behind this flag.
   */
  isSupported: boolean;

  // ── Balance ────────────────────────────────────────────────────────────────
  /** Native token balance in wei; `undefined` before first fetch. */
  nativeBalance: bigint | undefined;
  /** Native token symbol for the connected chain (e.g. "ETH", "BNB"). */
  nativeSymbol: string;
  /**
   * Human-readable native balance string with 4 decimal places
   * (e.g. "1.2345").  Defaults to "0.0000" when balance is unavailable.
   */
  formattedBalance: string;
  /** Trigger a manual re-fetch of the native balance. */
  refetchBalance: () => void;

  // ── Viem clients ──────────────────────────────────────────────────────────
  /**
   * Viem `PublicClient` for the connected chain – use for all read calls and
   * `waitForTransactionReceipt`.  May be `undefined` during SSR.
   */
  publicClient: PublicClient | undefined;
  /**
   * Viem `WalletClient` (signer) – use for `writeContract` / `sendTransaction`.
   * `undefined` when the wallet is not connected or the client is loading.
   */
  walletClient: ReturnType<typeof useWalletClient>['data'];
  /** `true` while the wallet client is being initialised after connection. */
  isWalletClientLoading: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns a stable snapshot of the connected wallet's state.
 *
 * All fields are `undefined` / `false` / `""` when the wallet is
 * disconnected – components can safely destructure without null-guards.
 *
 * @example
 * const { address, isConnected, isSupported, publicClient } = useWallet();
 */
export function useWallet(): WalletState {
  const {
    address,
    chain,
    chainId,
    isConnected,
    isConnecting,
    isReconnecting,
    isDisconnected,
    status,
  } = useAccount();

  const { networkLabel, isSupported } = useDeployedAddresses();

  const publicClient = usePublicClient() as PublicClient | undefined;
  const { data: walletClient, isLoading: isWalletClientLoading } =
    useWalletClient();

  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
      // Refetch every ~15 s (roughly one Ethereum block)
      refetchInterval: 15_000,
    },
  });

  // Derive the native symbol from balance data first, then chain metadata,
  // then fall back to "ETH" so the UI always shows something sensible.
  const nativeSymbol =
    balanceData?.symbol ?? chain?.nativeCurrency?.symbol ?? 'ETH';

  // Format to 4 decimal places; trim trailing zeros to keep it readable.
  const formattedBalance = balanceData
    ? parseFloat(balanceData.formatted).toFixed(4)
    : '0.0000';

  return {
    // Identity
    address,
    chainId,

    // Status flags
    isConnected,
    isConnecting,
    isReconnecting,
    isDisconnected,
    status: status as ConnectionStatus,

    // Network
    networkLabel,
    isSupported,

    // Balance
    nativeBalance: balanceData?.value,
    nativeSymbol,
    formattedBalance,
    refetchBalance,

    // Viem clients
    publicClient,
    walletClient,
    isWalletClientLoading,
  };
}
