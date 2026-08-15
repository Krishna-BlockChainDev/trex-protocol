/**
 * Client-side API helpers for /api/transactions and /api/transactions/record
 *
 * Covers:
 *   fetchTransactions()   – GET  /api/transactions         (paginated, from DB/explorer)
 *   syncTransactions()    – POST /api/transactions          (force full explorer re-sync)
 *   pollSync()            – GET  /api/transactions/sync     (incremental poll, rate-limited)
 *   recordTransaction()   – POST /api/transactions/record   (save a UI-triggered tx)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single transaction row as returned by the API.
 * Matches the extended `token_transaction` DB table.
 */
export interface DbTransaction {
  id: string;
  txHash: string;
  /** BigInt serialised as string from Prisma */
  blockNumber: string;
  /** ISO-8601 timestamp string */
  timestamp: string;
  /**
   * High-level category:
   *   Token      – mint / burn / transfer / freeze / pause / recovery
   *   Identity   – createIdentity / registerIdentity / addClaim / removeClaim
   *   Compliance – addModule / removeModule / setMaxBalance / setCountries
   *   System     – deployment, agent management, unknown contract calls
   */
  category: string;
  /**
   * ERC-3643 event type:
   *   Token      – Transfer | Mint | Burn | ForcedTransfer | TokensFrozen | TokensUnfrozen | AddressFrozen | AddressUnfrozen | Paused | Unpaused | Recovery
   *   Identity   – RegisterIdentity | DeleteIdentity | UpdateIdentity | UpdateCountry | AddClaim | RemoveClaim | AddKey | RemoveKey | ExecuteClaim
   *   Compliance – AddModule | RemoveModule | SetMaxBalance | SetSupplyLimit | SetCountryRestrict | SetCountryAllow
   *   System     – Deploy | AddAgent | RemoveAgent | ContractCall | Transfer
   */
  eventType: string;
  fromAddress: string;
  toAddress: string;
  /** Raw token amount as string (divide by 10**decimals for display) */
  amount: string;
  operatorAddress: string | null;
  /** Freeform JSON string for extra context */
  metadata: string | null;

  // ── On-chain execution details (populated from Etherscan enrichment) ─────
  /** Transaction status: 'success' | 'failed' | 'pending' | null */
  txStatus: string | null;
  /** Gas units consumed — BigInt serialised as string */
  gasUsed: string | null;
  /** Gas price in wei as decimal string */
  gasPrice: string | null;
  /** Total tx fee in wei as decimal string (gasUsed × gasPrice) */
  txFee: string | null;
  /** Sender nonce at time of tx */
  nonce: number | null;
  /** Transaction index within the block */
  txIndex: number | null;
  /** Actual on-chain sender address (msg.sender of the tx) */
  senderAddress: string | null;

  ecosystemId: string;
  createdAt: string;
  updatedAt: string;
}

/** Paginated response envelope from GET /api/transactions */
export interface TransactionsPage {
  transactions: DbTransaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  /**
   * Sum of all txFee values (in wei) across ALL transactions in the ecosystem.
   * This is ecosystem-wide — not filtered by the current page/eventType/category.
   * String because it is a serialised BigInt.
   */
  totalFeeWei: string;
}

/** Query options for fetchTransactions */
export interface FetchTransactionsOptions {
  page?: number;
  limit?: number;
  /** Filter by event type, e.g. 'Transfer', 'Mint', or 'all' */
  eventType?: string;
  /** Filter by category: 'Token' | 'Identity' | 'Compliance' | 'System' | 'all' */
  category?: string;
  /** Filter by wallet address (matches fromAddress OR toAddress) */
  address?: string;
}

/**
 * Input for recordTransaction().
 * All fields mirror the POST /api/transactions/record body.
 */
export interface RecordTransactionInput {
  ecosystemId: string;
  txHash: string;
  blockNumber?: number | string;
  /** ISO-8601 string; defaults to now() on the server */
  timestamp?: string;
  /** Token | Identity | Compliance | System */
  category: string;
  eventType: string;
  fromAddress?: string;
  toAddress?: string;
  /** Raw wei amount as string */
  amount?: string;
  operatorAddress?: string;
  /** Freeform JSON string (stringify before passing) */
  metadata?: string;
}

/** Response from GET /api/transactions/sync (incremental poll) */
export interface SyncPollResult {
  /** Number of rows upserted in this incremental sync */
  synced: number;
  /** true if at least one new row was written */
  hasNew: boolean;
  /** ISO-8601 string of when the sync ran (or the cached timestamp) */
  lastSyncedAt: string;
  /** Highest block number seen (stringified for BigInt safety) */
  highestBlock: string;
  /** true if sync was skipped because the cooldown hasn't elapsed yet */
  skipped?: boolean;
}

// ── API calls ─────────────────────────────────────────────────────────────────

const BASE = '/api/transactions';

/**
 * Fetch paginated transactions for a given ecosystem from the DB.
 * Automatically triggers a sync from the explorer on first call (server-side).
 */
export async function fetchTransactions(
  ecosystemId: string,
  opts: FetchTransactionsOptions = {},
): Promise<TransactionsPage> {
  const params = new URLSearchParams({ ecosystemId });
  if (opts.page) params.set('page', opts.page.toString());
  if (opts.limit) params.set('limit', opts.limit.toString());
  if (opts.eventType && opts.eventType !== 'all')
    params.set('eventType', opts.eventType);
  if (opts.category && opts.category !== 'all')
    params.set('category', opts.category);
  if (opts.address) params.set('address', opts.address);

  const res = await fetch(`${BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as TransactionsPage;
}

/**
 * Force a re-sync from the blockchain explorer for a given ecosystem.
 * Returns the number of new/updated transactions upserted.
 */
export async function syncTransactions(
  ecosystemId: string,
): Promise<{ synced: number }> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ecosystemId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { synced: number };
}

/**
 * Lightweight incremental poll — called automatically every 30 s by
 * useTransactionHistory. Uses GET /api/transactions/sync which:
 *   - Skips if synced < 25 s ago (rate-limit guard, returns skipped: true)
 *   - Fetches only blocks AFTER lastSyncedBlock (incremental, fast)
 *   - Upserts any new rows found
 *
 * Returns the sync result; never throws (errors are swallowed and logged).
 */
export async function pollSync(ecosystemId: string): Promise<SyncPollResult> {
  try {
    const params = new URLSearchParams({ ecosystemId });
    const res = await fetch(`${BASE}/sync?${params.toString()}`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[pollSync] server error:', res.status, text);
      // Return a no-op result so the hook doesn't crash
      return {
        synced: 0,
        hasNew: false,
        lastSyncedAt: new Date().toISOString(),
        highestBlock: '0',
        skipped: true,
      };
    }
    return (await res.json()) as SyncPollResult;
  } catch (err) {
    console.warn('[pollSync] fetch error:', err);
    return {
      synced: 0,
      hasNew: false,
      lastSyncedAt: new Date().toISOString(),
      highestBlock: '0',
      skipped: true,
    };
  }
}

/**
 * Record a single UI-triggered transaction in the DB immediately after it succeeds.
 * Uses upsert on (ecosystemId, txHash, eventType) — idempotent.
 *
 * @example
 * await recordTransaction({
 *   ecosystemId: activeToken.id,
 *   txHash: hash,
 *   category: 'Token',
 *   eventType: 'Mint',
 *   toAddress: to,
 *   amount: amount.toString(),
 * });
 */
export async function recordTransaction(
  input: RecordTransactionInput,
): Promise<DbTransaction> {
  const res = await fetch(`${BASE}/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as DbTransaction;
}
