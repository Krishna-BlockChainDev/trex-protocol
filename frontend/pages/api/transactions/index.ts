/**
 * GET  /api/transactions?ecosystemId=<id>&page=<n>&limit=<n>&eventType=<type>&category=<cat>
 *      → Returns cached transactions from DB for the given ecosystem.
 *        If the DB is empty for this ecosystem, triggers a fresh sync from the
 *        blockchain explorer before responding.
 *        Response includes `totalFeeWei` — sum of all txFee values for the ecosystem.
 *
 * POST /api/transactions { ecosystemId }
 *      → Forces a re-sync from the blockchain explorer for the given ecosystem.
 *        Upserts all discovered events (token + identity + compliance + system)
 *        into DB and returns the count.
 *
 * Explorer API priority (server-side, API key never exposed to client):
 *   chainId 1        → Etherscan mainnet   (ETHERSCAN_API_KEY)
 *   chainId 11155111 → Etherscan Sepolia   (ETHERSCAN_API_KEY)
 *   chainId 56       → BscScan mainnet     (BSCSCAN_API_KEY)
 *   chainId 97       → BscScan testnet     (BSCSCAN_API_KEY)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';
import {
  syncTransactionsFromExplorer,
  type EcosystemContracts,
} from '@/lib/explorer';

/**
 * Serialize Prisma rows for JSON — converts BigInt fields to strings.
 * Prisma returns blockNumber and gasUsed as BigInt; JSON.stringify cannot handle them.
 */
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === 'bigint' ? v.toString() : v,
    ]),
  );
}

/**
 * Build EcosystemContracts from a TokenEcosystem DB row for multi-contract sync.
 */
function buildContracts(ecosystem: {
  tokenProxy: string;
  identityRegistryProxy: string;
  identityRegistryStorageProxy: string;
  trustedIssuersRegistryProxy: string;
  claimTopicsRegistryProxy: string;
  modularComplianceProxy: string;
}): EcosystemContracts {
  return {
    tokenProxy: ecosystem.tokenProxy,
    identityRegistryProxy: ecosystem.identityRegistryProxy,
    identityRegistryStorageProxy: ecosystem.identityRegistryStorageProxy,
    trustedIssuersRegistryProxy: ecosystem.trustedIssuersRegistryProxy,
    claimTopicsRegistryProxy: ecosystem.claimTopicsRegistryProxy,
    modularComplianceProxy: ecosystem.modularComplianceProxy,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // ── GET — read from DB (with optional auto-sync on first call) ──────────────
  if (req.method === 'GET') {
    const { ecosystemId, page, limit, eventType, category, address } =
      req.query as {
        ecosystemId?: string;
        page?: string;
        limit?: string;
        eventType?: string;
        category?: string;
        address?: string;
      };

    if (!ecosystemId) {
      return res
        .status(400)
        .json({ error: 'ecosystemId query param required' });
    }

    const take = Math.min(parseInt(limit ?? '50', 10), 200);
    const skip = (parseInt(page ?? '1', 10) - 1) * take;

    // Build dynamic filter
    const where: Record<string, unknown> = { ecosystemId };
    if (eventType && eventType !== 'all') where.eventType = eventType;
    if (category && category !== 'all') where.category = category;
    if (address) {
      const addr = (address as string).toLowerCase();
      where.OR = [{ fromAddress: addr }, { toAddress: addr }];
    }

    // Count existing rows
    const existingCount = await db.tokenTransaction.count({
      where: { ecosystemId },
    });

    // Auto-sync on first load (DB empty for this ecosystem)
    if (existingCount === 0) {
      try {
        const ecosystem = await db.tokenEcosystem.findUnique({
          where: { id: ecosystemId },
        });
        if (ecosystem) {
          const result = await syncTransactionsFromExplorer(
            ecosystem.chainId,
            ecosystem.tokenProxy,
            ecosystemId,
            buildContracts(ecosystem),
          );
          console.log(
            `[transactions] auto-sync complete: ${result.count} upserted, highestBlock=${result.highestBlock}`,
          );
        }
      } catch (syncErr) {
        // Non-fatal: return empty list if explorer is unreachable
        console.warn('[transactions] auto-sync failed:', syncErr);
      }
    }

    // Fetch paginated rows + total count for this filter
    const [transactions, total] = await Promise.all([
      db.tokenTransaction.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take,
        skip,
      }),
      db.tokenTransaction.count({ where }),
    ]);

    // Compute total operation cost across ALL transactions in the ecosystem
    // (not affected by current filter — shows the ecosystem-wide cost)
    const feeAgg = await db.tokenTransaction.findMany({
      where: { ecosystemId },
      select: { txFee: true },
    });

    let totalFeeWei = BigInt(0);
    for (const row of feeAgg) {
      if (row.txFee) {
        try {
          totalFeeWei += BigInt(row.txFee);
        } catch {
          // Skip malformed values
        }
      }
    }

    // Serialize BigInt fields (blockNumber, gasUsed) to strings for JSON transport
    const serialized = transactions.map((tx) =>
      serializeRow(tx as unknown as Record<string, unknown>),
    );

    return res.status(200).json({
      transactions: serialized,
      total,
      page: parseInt(page ?? '1', 10),
      limit: take,
      pages: Math.ceil(total / take),
      totalFeeWei: totalFeeWei.toString(),
    });
  }

  // ── POST — force re-sync from explorer ─────────────────────────────────────
  if (req.method === 'POST') {
    const { ecosystemId } = req.body as { ecosystemId?: string };

    if (!ecosystemId) {
      return res.status(400).json({ error: 'ecosystemId required in body' });
    }

    const ecosystem = await db.tokenEcosystem.findUnique({
      where: { id: ecosystemId },
    });

    if (!ecosystem) {
      return res.status(404).json({ error: 'Ecosystem not found' });
    }

    try {
      const result = await syncTransactionsFromExplorer(
        ecosystem.chainId,
        ecosystem.tokenProxy,
        ecosystemId,
        buildContracts(ecosystem),
      );
      return res
        .status(200)
        .json({ synced: result.count, highestBlock: result.highestBlock });
    } catch (err) {
      console.error('[transactions] sync error:', err);
      return res.status(502).json({
        error: 'Failed to sync from explorer',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
