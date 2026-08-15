/**
 * GET /api/transactions/sync?ecosystemId=<id>
 *
 * Lightweight incremental sync endpoint — called by the client every 30 s.
 *
 * Behaviour:
 *   1. Load the ecosystem row (+ its ChainInfrastructure) to get chainId,
 *      all proxy addresses, trexFactory, oidIdFactory, and lastSyncedAt.
 *   2. Rate-limit guard: if the ecosystem was synced less than SYNC_COOLDOWN_MS
 *      ago, skip the Etherscan call and return { skipped: true }.
 *   3. Compute fromBlock = lastSyncedBlock + 1 (only fetch NEW blocks).
 *   4. Call syncTransactionsFromExplorer with the fromBlock override so we
 *      don't re-fetch the entire history on every poll.
 *   5. Write lastSyncedAt + lastSyncedBlock back to the ecosystem row
 *      (done inside syncTransactionsFromExplorer itself).
 *   6. Return { synced, hasNew, lastSyncedAt, highestBlock }.
 *
 * Contract coverage:
 *   Pass the full EcosystemContracts bag including trexFactory and oidIdFactory
 *   so that the deployTREXSuite and createIdentity transactions are captured.
 *
 * This endpoint is intentionally GET (idempotent, cacheable) and is designed
 * to be safe to call from multiple browser tabs simultaneously — the
 * rate-limit guard prevents stampede.
 *
 * Rate limit: SYNC_COOLDOWN_MS = 25 000 ms (25 s). The client polls every
 * 30 s, so there is always at least a 5 s buffer between server-side API calls.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';
import {
  syncTransactionsFromExplorer,
  type EcosystemContracts,
} from '@/lib/explorer';

/** Minimum milliseconds between Etherscan calls for the same ecosystem */
const SYNC_COOLDOWN_MS = 25_000;

export interface SyncResult {
  /** Number of rows upserted in this incremental sync */
  synced: number;
  /** true if at least one new row was written */
  hasNew: boolean;
  /** ISO-8601 string of when the sync ran */
  lastSyncedAt: string;
  /** Highest block number seen (stringified for BigInt safety) */
  highestBlock: string;
  /** true if sync was skipped due to rate-limiting */
  skipped?: boolean;
  /** When the skipped-guard was last run (only present when skipped=true) */
  cachedSince?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SyncResult | { error: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { ecosystemId } = req.query as { ecosystemId?: string };

  if (!ecosystemId) {
    return res.status(400).json({ error: 'ecosystemId query param required' });
  }

  // ── Load ecosystem + ChainInfrastructure ────────────────────────────────────
  // We include `infrastructure` so we can pass trexFactory + oidIdFactory to
  // the sync engine, ensuring the deployTREXSuite and createIdentity txs are
  // fetched from those contract addresses.
  const ecosystem = await db.tokenEcosystem.findUnique({
    where: { id: ecosystemId },
    select: {
      id: true,
      chainId: true,
      tokenProxy: true,
      identityRegistryProxy: true,
      identityRegistryStorageProxy: true,
      trustedIssuersRegistryProxy: true,
      claimTopicsRegistryProxy: true,
      modularComplianceProxy: true,
      lastSyncedAt: true,
      lastSyncedBlock: true,
      // Pull the infra row so we can include factory addresses
      infrastructure: {
        select: {
          trexFactory: true,
          oidIdFactory: true,
        },
      },
    },
  });

  if (!ecosystem) {
    return res.status(404).json({ error: 'Ecosystem not found' });
  }

  // ── Rate-limit guard ───────────────────────────────────────────────────────
  // If the ecosystem was synced less than SYNC_COOLDOWN_MS ago, skip.
  // This prevents multiple browser tabs or rapid re-renders from hammering
  // the Etherscan API.
  if (ecosystem.lastSyncedAt) {
    const msSinceSync = Date.now() - ecosystem.lastSyncedAt.getTime();
    if (msSinceSync < SYNC_COOLDOWN_MS) {
      console.log(
        `[sync] skipping – synced ${Math.round(msSinceSync / 1000)}s ago (cooldown ${SYNC_COOLDOWN_MS / 1000}s)`,
      );
      return res.status(200).json({
        synced: 0,
        hasNew: false,
        lastSyncedAt: ecosystem.lastSyncedAt.toISOString(),
        highestBlock: ecosystem.lastSyncedBlock
          ? ecosystem.lastSyncedBlock.toString()
          : '0',
        skipped: true,
        cachedSince: ecosystem.lastSyncedAt.toISOString(),
      });
    }
  }

  // ── Incremental sync ───────────────────────────────────────────────────────
  // Start from lastSyncedBlock + 1 so we only fetch new blocks.
  const fromBlock = ecosystem.lastSyncedBlock
    ? Number(ecosystem.lastSyncedBlock) + 1
    : 0;

  // Build the full contracts bag, including factory addresses from infra
  const contracts: EcosystemContracts = {
    tokenProxy: ecosystem.tokenProxy,
    identityRegistryProxy: ecosystem.identityRegistryProxy,
    identityRegistryStorageProxy: ecosystem.identityRegistryStorageProxy,
    trustedIssuersRegistryProxy: ecosystem.trustedIssuersRegistryProxy,
    claimTopicsRegistryProxy: ecosystem.claimTopicsRegistryProxy,
    modularComplianceProxy: ecosystem.modularComplianceProxy,
    // Factory contracts — ensures deployTREXSuite + createIdentity txs are captured
    trexFactory: ecosystem.infrastructure?.trexFactory ?? undefined,
    oidIdFactory: ecosystem.infrastructure?.oidIdFactory ?? undefined,
  };

  const countBefore = await db.tokenTransaction.count({
    where: { ecosystemId },
  });

  try {
    const result = await syncTransactionsFromExplorer(
      ecosystem.chainId,
      ecosystem.tokenProxy,
      ecosystemId,
      contracts,
      fromBlock,
    );

    const countAfter = await db.tokenTransaction.count({
      where: { ecosystemId },
    });
    const hasNew = countAfter > countBefore;

    // Re-read lastSyncedAt from DB (updated inside syncTransactionsFromExplorer)
    const updated = await db.tokenEcosystem.findUnique({
      where: { id: ecosystemId },
      select: { lastSyncedAt: true, lastSyncedBlock: true },
    });

    return res.status(200).json({
      synced: result.count,
      hasNew,
      lastSyncedAt: (updated?.lastSyncedAt ?? new Date()).toISOString(),
      highestBlock: result.highestBlock.toString(),
    });
  } catch (err) {
    console.error('[sync] incremental sync error:', err);
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Sync failed',
    } as { error: string });
  }
}
