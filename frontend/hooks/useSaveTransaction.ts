/**
 * useSaveTransaction
 *
 * Lightweight hook for recording a completed on-chain transaction to the DB
 * via POST /api/transactions/record.
 *
 * Usage (inside any component that already calls useDeployedAddresses):
 *
 *   const { save } = useSaveTransaction();
 *
 *   const hash = await txState.execute(() => mintTokens(...));
 *   if (hash) {
 *     save({
 *       txHash: hash,
 *       category: 'Token',
 *       eventType: 'Mint',
 *       toAddress: recipientAddress,
 *       amount: amountWei.toString(),
 *     });
 *   }
 *
 * The save() call is fire-and-forget — it does not block the UI.
 * Errors are swallowed with a console.warn so they never break the UX.
 */

import { useCallback } from 'react';
import { useDeployedAddresses } from './useDeployedAddresses';
import {
  recordTransaction,
  type RecordTransactionInput,
} from '@/lib/api/transactions';

// ── Types ─────────────────────────────────────────────────────────────────────

/** All fields except ecosystemId (injected from the active ecosystem). */
export type SaveTransactionInput = Omit<RecordTransactionInput, 'ecosystemId'>;

export interface UseSaveTransactionReturn {
  /**
   * Fire-and-forget: records the transaction in the DB.
   * Silently fails if no ecosystem is active or the API call errors.
   */
  save: (input: SaveTransactionInput) => void;

  /** ecosystemId of the currently active token (null if none selected). */
  ecosystemId: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSaveTransaction(): UseSaveTransactionReturn {
  const { activeToken } = useDeployedAddresses();
  const ecosystemId = activeToken?.id ?? null;

  const save = useCallback(
    (input: SaveTransactionInput) => {
      if (!ecosystemId) {
        // No active ecosystem — nothing to save to.
        return;
      }

      recordTransaction({ ...input, ecosystemId }).catch((err: unknown) => {
        console.warn('[useSaveTransaction] failed to record tx:', err);
      });
    },
    [ecosystemId],
  );

  return { save, ecosystemId };
}
