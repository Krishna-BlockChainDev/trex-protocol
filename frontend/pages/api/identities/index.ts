/**
 * GET  /api/identities?ecosystemId=<id>  → list identities for one ecosystem
 * GET  /api/identities?chainId=<n>       → list ALL identities across all ecosystems on a chain
 * POST /api/identities                   → register a new identity
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    const { ecosystemId, chainId, walletAddress } = req.query;

    // ── Chain-wide query (cross-ecosystem) ─────────────────────────────────
    if (chainId && !ecosystemId) {
      const chainIdNum = parseInt(chainId as string, 10);
      if (isNaN(chainIdNum)) {
        return res.status(400).json({ error: 'chainId must be a number' });
      }

      // Join through TokenEcosystem to filter by chainId
      const identities = await db.identity.findMany({
        where: {
          ecosystem: { chainId: chainIdNum },
          ...(walletAddress && {
            walletAddress: (walletAddress as string).toLowerCase(),
          }),
        },
        include: {
          ecosystem: {
            select: { id: true, name: true, symbol: true, chainId: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return res.status(200).json(identities);
    }

    // ── Ecosystem-scoped query ──────────────────────────────────────────────
    if (!ecosystemId) {
      return res
        .status(400)
        .json({ error: 'ecosystemId or chainId query param required' });
    }

    const identities = await db.identity.findMany({
      where: {
        ecosystemId: ecosystemId as string,
        ...(walletAddress && {
          walletAddress: (walletAddress as string).toLowerCase(),
        }),
      },
      include: {
        ecosystem: {
          select: { id: true, name: true, symbol: true, chainId: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json(identities);
  }

  if (req.method === 'POST') {
    const {
      id,
      ecosystemId,
      walletAddress,
      identityAddress,
      countryCode,
      claimTopics,
    } = req.body as {
      id?: string;
      ecosystemId: string;
      walletAddress: string;
      identityAddress: string;
      countryCode?: number;
      claimTopics?: number[];
    };

    if (!ecosystemId || !walletAddress || !identityAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const identity = await db.identity.upsert({
      where: {
        ecosystemId_walletAddress: {
          ecosystemId,
          walletAddress: walletAddress.toLowerCase(),
        },
      },
      create: {
        ...(id && { id }),
        ecosystemId,
        walletAddress: walletAddress.toLowerCase(),
        identityAddress: identityAddress.toLowerCase(),
        countryCode: countryCode ?? 0,
        claimTopics: claimTopics ?? [],
      },
      update: {
        identityAddress: identityAddress.toLowerCase(),
        countryCode: countryCode ?? 0,
        claimTopics: claimTopics ?? [],
      },
    });

    return res.status(201).json(identity);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
