/**
 * useTransactionHistory
 *
 * Fetches paginated on-chain transactions for the currently active token
 * ecosystem from the /api/transactions endpoint (DB-backed, auto-synced
 * from Etherscan/Sepolia/BscScan on first load).
 *
 * Covers ALL transaction categories:
 *   Token      – mint / burn / transfer / freeze / pause / recovery
 *   Identity   – registerIdentity / addClaim / deleteIdentity / etc.
 *   Compliance – addModule / setMaxBalance / setCountries / etc.
 *   System     – deployment, agent management, unknown contract calls
 *
 * Auto-polling:
 *   Every AUTO_POLL_INTERVAL_MS (30 s) the hook calls GET /api/transactions/sync
 *   which performs an incremental Etherscan fetch for new blocks only.
 *   The server-side rate-limit guard (25 s cooldown) prevents stampede from
 *   multiple tabs. When new rows are found, the transaction list refreshes.
 *
 * Follows the same pattern as useIdentity: all setState calls happen
 * inside .then() / .catch() callbacks, never synchronously in the effect body.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDeployedAddresses } from '@/hooks/useDeployedAddresses';
import {
  fetchTransactions,
  syncTransactions,
  pollSync,
  type DbTransaction,
  type TransactionsPage,
  type SyncPollResult,
} from '@/lib/api/transactions';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransactionFilters {
  /** 'all' or a specific event type: Transfer | Mint | Burn | etc. */
  eventType: string;
  /** 'all' or a category: Token | Identity | Compliance | System */
  category: string;
  /** Filter by wallet address — matches fromAddress OR toAddress */
  address: string;
}

export interface UseTransactionHistoryReturn {
  transactions: DbTransaction[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  /**
   * Sum of all txFee values (in wei, as string) across ALL transactions
   * in the ecosystem — ecosystem-wide, not affected by current filter.
   */
  totalFeeWei: string;
  isLoading: boolean;
  isSyncing: boolean;
  isError: boolean;
  errorMessage: string | null;
  filters: TransactionFilters;
  setFilters: (filters: Partial<TransactionFilters>) => void;
  setPage: (page: number) => void;
  /** Force a full re-sync from the blockchain explorer then reload */
  refresh: () => void;
  /** Ecosystem ID being queried (null if no active ecosystem) */
  ecosystemId: string | null;
  /**
   * ISO-8601 timestamp of the last successful background sync.
   * null if no sync has happened yet.
   */
  lastSyncedAt: string | null;
  /**
   * Status of the background auto-poll:
   *   'idle'    – no poll in flight
   *   'polling' – poll request is in flight
   *   'ok'      – last poll completed successfully
   *   'error'   – last poll failed
   */
  syncStatus: 'idle' | 'polling' | 'ok' | 'error';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: TransactionFilters = {
  eventType: 'all',
  category: 'all',
  address: '',
};

const EMPTY_PAGE: TransactionsPage = {
  transactions: [],
  total: 0,
  page: 1,
  limit: 20,
  pages: 0,
  totalFeeWei: '0',
};

const PAGE_SIZE = 20;

/** How often the hook auto-polls for new transactions (ms) */
const AUTO_POLL_INTERVAL_MS = 30_000;

// ── Shared loading state type ─────────────────────────────────────────────────

interface LoadState {
  data: TransactionsPage;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
}

const LOADING_STATE: LoadState = {
  data: EMPTY_PAGE,
  isLoading: true,
  isError: false,
  errorMessage: null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTransactionHistory(): UseTransactionHistoryReturn {
  const { activeToken } = useDeployedAddresses();
  const ecosystemId = activeToken?.id ?? null;

  const [state, setState] = useState<LoadState>({
    data: EMPTY_PAGE,
    isLoading: false,
    isError: false,
    errorMessage: null,
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFiltersState] =
    useState<TransactionFilters>(DEFAULT_FILTERS);
  // Bumping syncKey triggers a re-fetch after a sync operation
  const [syncKey, setSyncKey] = useState(0);

  // ── Live sync state ────────────────────────────────────────────────────────
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'polling' | 'ok' | 'error'
  >('idle');

  // Ref to track if a poll is already in flight (prevents overlapping polls)
  const pollInFlightRef = useRef(false);

  // ── Load transactions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ecosystemId) return;
    let isActive = true;

    // Signal loading state via a single object update (one render)
    Promise.resolve().then(() => {
      if (isActive) setState(LOADING_STATE);
    });

    fetchTransactions(ecosystemId, {
      page,
      limit: PAGE_SIZE,
      eventType: filters.eventType !== 'all' ? filters.eventType : undefined,
      category: filters.category !== 'all' ? filters.category : undefined,
      address: filters.address.trim() || undefined,
    })
      .then((result) => {
        if (!isActive) return;
        setState({
          data: result,
          isLoading: false,
          isError: false,
          errorMessage: null,
        });
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        setState({
          data: EMPTY_PAGE,
          isLoading: false,
          isError: true,
          errorMessage:
            err instanceof Error ? err.message : 'Failed to load transactions',
        });
      });

    return () => {
      isActive = false;
    };
    // syncKey intentionally triggers re-fetch after a sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecosystemId, page, filters, syncKey]);

  // ── Auto-poll every 30 s ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ecosystemId) return;

    const runPoll = () => {
      if (pollInFlightRef.current) return; // already in flight
      pollInFlightRef.current = true;
      setSyncStatus('polling');

      pollSync(ecosystemId)
        .then((result: SyncPollResult) => {
          pollInFlightRef.current = false;
          setSyncStatus('ok');
          if (result.lastSyncedAt) {
            setLastSyncedAt(result.lastSyncedAt);
          }
          // If the server found new rows, re-fetch the transaction list
          if (result.hasNew) {
            setSyncKey((k) => k + 1);
          }
        })
        .catch(() => {
          pollInFlightRef.current = false;
          setSyncStatus('error');
        });
    };

    // Run an immediate poll on mount so the page is fresh on first load
    // (the server-side rate-limit guard prevents duplicate work if another
    //  tab already synced recently)
    runPoll();

    const intervalId = setInterval(runPoll, AUTO_POLL_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
      pollInFlightRef.current = false;
    };
  }, [ecosystemId]);

  // ── Public setters ─────────────────────────────────────────────────────────
  const setFilters = useCallback((updates: Partial<TransactionFilters>) => {
    setPage(1);
    setFiltersState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setPageAndReset = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // ── Refresh (force full re-sync from explorer) ─────────────────────────────
  const refresh = useCallback(() => {
    if (!ecosystemId) return;
    setIsSyncing(true);

    syncTransactions(ecosystemId)
      .then(() => {
        setSyncKey((k) => k + 1);
        setLastSyncedAt(new Date().toISOString());
        setSyncStatus('ok');
      })
      .catch((err: unknown) => {
        setState((prev) => ({
          ...prev,
          isError: true,
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Failed to sync from blockchain explorer',
        }));
        setSyncStatus('error');
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, [ecosystemId]);

  return {
    transactions: ecosystemId ? state.data.transactions : [],
    total: ecosystemId ? state.data.total : 0,
    page: ecosystemId ? state.data.page : 1,
    pages: ecosystemId ? state.data.pages : 0,
    limit: state.data.limit,
    totalFeeWei: ecosystemId ? (state.data.totalFeeWei ?? '0') : '0',
    isLoading: state.isLoading,
    isSyncing,
    isError: state.isError,
    errorMessage: state.errorMessage,
    filters,
    setFilters,
    setPage: setPageAndReset,
    refresh,
    ecosystemId,
    lastSyncedAt,
    syncStatus,
  };
}
