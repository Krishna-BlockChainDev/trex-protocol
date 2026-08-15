/**
 * POST /api/transactions/record
 *
 * Records a single on-chain transaction immediately after a UI action
 * completes (mint, burn, transfer, register identity, add module, etc.)
 *
 * Body:
 * {
 *   ecosystemId:      string;            // required — FK to token_ecosystem
 *   txHash:           string;            // required — on-chain tx hash
 *   blockNumber?:     number | string;   // optional — block number (0 if pending)
 *   timestamp?:       string;            // optional — ISO-8601; defaults to now()
 *   category:         string;            // Token | Identity | Compliance | System
 *   eventType:        string;            // Transfer | Mint | Burn | RegisterIdentity | AddModule …
 *   fromAddress?:     string;            // initiator / from wallet
 *   toAddress?:       string;            // recipient / affected wallet
 *   amount?:          string;            // raw wei amount as string
 *   operatorAddress?: string;            // agent / operator address
 *   metadata?:        string;            // freeform JSON string for extra context
 * }
 *
 * Returns the upserted TokenTransaction row on success (200 / 201).
 * Uses upsert on (ecosystemId, txHash, eventType) so re-posting the same
 * event is idempotent.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const {
    ecosystemId,
    txHash,
    blockNumber,
    timestamp,
    category,
    eventType,
    fromAddress,
    toAddress,
    amount,
    operatorAddress,
    metadata,
  } = req.body as {
    ecosystemId?: string;
    txHash?: string;
    blockNumber?: number | string;
    timestamp?: string;
    category?: string;
    eventType?: string;
    fromAddress?: string;
    toAddress?: string;
    amount?: string;
    operatorAddress?: string;
    metadata?: string;
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!ecosystemId || typeof ecosystemId !== 'string') {
    return res.status(400).json({ error: 'ecosystemId is required' });
  }
  if (!txHash || typeof txHash !== 'string') {
    return res.status(400).json({ error: 'txHash is required' });
  }
  if (!category || typeof category !== 'string') {
    return res.status(400).json({
      error: 'category is required (Token | Identity | Compliance | System)',
    });
  }
  if (!eventType || typeof eventType !== 'string') {
    return res.status(400).json({ error: 'eventType is required' });
  }

  // ── Verify ecosystem exists ─────────────────────────────────────────────────
  const ecosystem = await db.tokenEcosystem.findUnique({
    where: { id: ecosystemId },
    select: { id: true },
  });
  if (!ecosystem) {
    return res
      .status(404)
      .json({ error: `Ecosystem not found: ${ecosystemId}` });
  }

  // ── Upsert transaction record ───────────────────────────────────────────────
  try {
    const ts = timestamp ? new Date(timestamp) : new Date();
    const bn = blockNumber !== undefined ? BigInt(blockNumber) : BigInt(0);

    const tx = await db.tokenTransaction.upsert({
      where: {
        ecosystemId_txHash_eventType: {
          ecosystemId,
          txHash,
          eventType,
        },
      },
      create: {
        ecosystemId,
        txHash,
        blockNumber: bn,
        timestamp: ts,
        category,
        eventType,
        fromAddress: fromAddress ?? ZERO_ADDR,
        toAddress: toAddress ?? ZERO_ADDR,
        amount: amount ?? '0',
        operatorAddress: operatorAddress ?? null,
        metadata: metadata ?? null,
      },
      update: {
        blockNumber: bn,
        timestamp: ts,
        category,
        fromAddress: fromAddress ?? ZERO_ADDR,
        toAddress: toAddress ?? ZERO_ADDR,
        amount: amount ?? '0',
        operatorAddress: operatorAddress ?? null,
        metadata: metadata ?? null,
      },
    });

    // Serialize BigInt fields (blockNumber, gasUsed) before JSON response
    const serialized = Object.fromEntries(
      Object.entries(tx).map(([k, v]) => [
        k,
        typeof v === 'bigint' ? v.toString() : v,
      ]),
    );
    return res.status(200).json(serialized);
  } catch (err) {
    console.error('[transactions/record] error:', err);
    return res.status(500).json({
      error: 'Failed to record transaction',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
