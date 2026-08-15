/**
 * useTransaction – generic transaction lifecycle hook.
 *
 * Wraps any write operation (a function that resolves to a transaction hash)
 * in a clean state machine:
 *
 *   idle ──► pending ──► success
 *                   ╰──► error
 *
 * The `execute` method accepts an async function that returns a `Hash`.
 * Internally it:
 *   1. Sets status to `'pending'`.
 *   2. Awaits the supplied function (wallet prompt + tx submission).
 *   3. Sets `txHash` as soon as the wallet confirms submission.
 *   4. Waits for the on-chain receipt via `publicClient.waitForTransactionReceipt`.
 *   5. Transitions to `'success'` (or `'error'` if the receipt shows a revert).
 *
 * Usage with a viem contract instance (from useContracts):
 *   const { execute, isPending, txHash, errorMessage } = useTransaction();
 *   await execute(() => token.write.pause());
 *
 * Usage with the lower-level viem helpers from @/contracts:
 *   await execute(() => pauseToken(addresses.token, walletClient, publicClient));
 */

import { useState, useCallback } from 'react';
import { type Hash, type TransactionReceipt } from 'viem';
import { usePublicClient } from 'wagmi';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Lifecycle status of a single transaction. */
export type TxStatus = 'idle' | 'pending' | 'success' | 'error';

export type TransactionState = {
  /** Current lifecycle status. */
  status: TxStatus;

  // Convenience boolean flags (derived from `status`)
  /** `true` while the tx is being submitted or waiting for on-chain confirmation. */
  isPending: boolean;
  /** `true` when the tx was mined successfully. */
  isSuccess: boolean;
  /** `true` when an error occurred at any stage. */
  isError: boolean;
  /** `true` before `execute` is called or after `reset`. */
  isIdle: boolean;

  /** Raw error object; `null` when no error has occurred. */
  error: Error | null;
  /**
   * User-friendly error string parsed from the raw error.
   * Common cases – user rejection, insufficient funds, Solidity revert reasons,
   * and custom errors – are extracted automatically.
   * `null` when no error has occurred.
   */
  errorMessage: string | null;

  /**
   * Transaction hash set immediately after the user confirms in their wallet
   * (before on-chain confirmation).  Useful for showing a block-explorer link
   * while waiting for the receipt.
   */
  txHash: Hash | undefined;

  /**
   * Full on-chain receipt.  Available only after `'success'`.
   * Contains `status`, `blockNumber`, `gasUsed`, and decoded `logs`.
   */
  receipt: TransactionReceipt | undefined;
};

export type UseTransactionReturn = TransactionState & {
  /**
   * Execute any async write operation.
   *
   * @param fn  An async function that submits the transaction and resolves
   *            with the resulting `Hash`.  Throw inside `fn` to signal failure.
   * @returns   The transaction hash on success, or `undefined` on error.
   *
   * @example
   * const hash = await execute(() => token.write.transfer([to, amount]));
   */
  execute: (fn: () => Promise<Hash>) => Promise<Hash | undefined>;

  /**
   * Reset state back to `idle`.
   * Call this before re-using the hook for a new transaction, e.g. to clear a
   * previously displayed error or success banner.
   */
  reset: () => void;
};

// ─── Error parser ─────────────────────────────────────────────────────────────

/**
 * Extracts a human-readable message from a raw contract / wallet error.
 *
 * Covers the most common Web3 failure modes:
 *   - User rejected the transaction in their wallet
 *   - Insufficient native-token balance for gas
 *   - Solidity `require` / `revert` reason strings
 *   - Solidity custom errors (4-byte selector)
 *   - Gas estimation failures (the tx would revert)
 *   - Network / RPC timeout or chain-mismatch
 */
function parseContractError(error: Error): string {
  const msg = error.message ?? '';

  // ── User rejection ─────────────────────────────────────────────────────────
  if (
    msg.includes('User rejected') ||
    msg.includes('user rejected') ||
    msg.includes('ACTION_REJECTED') ||
    msg.includes('User denied') ||
    msg.includes('rejected the request') ||
    msg.includes('user rejected transaction')
  ) {
    return 'Transaction was rejected in your wallet.';
  }

  // ── Insufficient funds ─────────────────────────────────────────────────────
  if (
    msg.includes('insufficient funds') ||
    msg.includes('InsufficientFunds') ||
    msg.includes('exceeds balance')
  ) {
    return 'Insufficient funds to pay for gas.';
  }

  // ── Solidity revert with reason string ─────────────────────────────────────
  // e.g. "reverted with reason string 'Only agent'"
  const revertWithReason = msg.match(
    /reverted with reason string[:\s]*['"](.+?)['"]/,
  );
  if (revertWithReason?.[1]) return revertWithReason[1].trim();

  // e.g. "execution reverted: TokenIsFrozen"
  const execReverted = msg.match(/execution reverted:\s*(.+?)(?:\n|$)/);
  if (execReverted?.[1]) return execReverted[1].trim();

  // ── Solidity custom error ──────────────────────────────────────────────────
  const customError = msg.match(/reverted with custom error\s+'(.+?)'/);
  if (customError?.[1]) return `Contract error: ${customError[1].trim()}`;

  // ── Generic execution revert (no reason extracted) ─────────────────────────
  if (msg.includes('execution reverted')) {
    return 'Transaction was reverted by the contract.';
  }

  // ── Gas estimation failure ─────────────────────────────────────────────────
  if (
    msg.includes('gas required exceeds') ||
    msg.includes('cannot estimate gas') ||
    msg.includes('gas estimation failed')
  ) {
    return 'Gas estimation failed – the transaction would revert.';
  }

  // ── Network / RPC ──────────────────────────────────────────────────────────
  if (msg.includes('network changed') || msg.includes('chain mismatch')) {
    return 'Network changed during the transaction. Please try again.';
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return 'Network request timed out. Check your connection and try again.';
  }
  if (msg.includes('nonce too low') || msg.includes('nonce has already been used')) {
    return 'Transaction nonce conflict. Please reset your wallet activity or try again.';
  }

  // ── Fallback: use the first sentence for readability ──────────────────────
  const firstSentence = msg.split(/[.\n]/)[0];
  return firstSentence?.trim() || 'An unknown error occurred.';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Generic transaction lifecycle hook.
 *
 * Manages status, txHash, receipt, and error state for a single in-flight
 * transaction.  Call `reset()` between transactions when reusing the same
 * hook instance (e.g. before a second mint after a successful first one).
 *
 * @example
 * function PauseButton() {
 *   const { token, isReady } = useContracts();
 *   const { execute, isPending, isSuccess, errorMessage } = useTransaction();
 *
 *   return (
 *     <>
 *       <button
 *         onClick={() => execute(() => token.write.pause())}
 *         disabled={isPending || !isReady}
 *       >
 *         {isPending ? 'Pausing…' : 'Pause Token'}
 *       </button>
 *       {isSuccess && <p>Token paused ✓</p>}
 *       {errorMessage && <p className="error">{errorMessage}</p>}
 *     </>
 *   );
 * }
 */
export function useTransaction(): UseTransactionReturn {
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<TxStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<Hash | undefined>(undefined);
  const [receipt, setReceipt] = useState<TransactionReceipt | undefined>(
    undefined,
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(undefined);
    setReceipt(undefined);
  }, []);

  const execute = useCallback(
    async (fn: () => Promise<Hash>): Promise<Hash | undefined> => {
      // Guard: a PublicClient is required to wait for receipts.
      if (!publicClient) {
        const err = new Error(
          'useTransaction: publicClient is unavailable. ' +
            'Ensure the component is rendered inside WagmiProvider and ' +
            'the wallet is connected to a supported network.',
        );
        setError(err);
        setStatus('error');
        return undefined;
      }

      // Reset any previous result before starting.
      setStatus('pending');
      setError(null);
      setTxHash(undefined);
      setReceipt(undefined);

      try {
        // ── Phase 1: wallet prompt + broadcast ─────────────────────────────
        const hash = await fn();
        setTxHash(hash);

        // ── Phase 2: wait for on-chain confirmation ─────────────────────────
        const txReceipt = await publicClient.waitForTransactionReceipt({
          hash,
          // 2-minute timeout; most networks confirm well within this window.
          timeout: 120_000,
        });

        // A receipt with status "reverted" is a chain-level failure even if
        // no JS exception was thrown (e.g. low-level call that doesn't bubble).
        if (txReceipt.status === 'reverted') {
          const revertErr = new Error(
            `Transaction was reverted on-chain. Hash: ${hash}`,
          );
          setError(revertErr);
          setStatus('error');
          return undefined;
        }

        setReceipt(txReceipt);
        setStatus('success');
        return hash;
      } catch (err: unknown) {
        const normalised =
          err instanceof Error ? err : new Error(String(err));
        setError(normalised);
        setStatus('error');
        return undefined;
      }
    },
    [publicClient],
  );

  return {
    // State
    status,
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error',
    isIdle: status === 'idle',

    // Error
    error,
    errorMessage: error ? parseContractError(error) : null,

    // Transaction data
    txHash,
    receipt,

    // Actions
    execute,
    reset,
  };
}
