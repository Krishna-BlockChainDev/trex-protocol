/**
 * GET  /api/ecosystems/:id/identities   → list identities for a specific ecosystem
 * POST /api/ecosystems/:id/identities   → upsert identity (walletAddress → identityAddress)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const ecosystemId = req.query.id as string;

  if (req.method === 'GET') {
    const identities = await db.identity.findMany({
      where: { ecosystemId },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(identities);
  }

  if (req.method === 'POST') {
    const { walletAddress, identityAddress, countryCode, claimTopics } =
      req.body as {
        walletAddress: string;
        identityAddress: string;
        countryCode?: number;
        claimTopics?: number[];
      };

    if (!walletAddress || !identityAddress) {
      return res
        .status(400)
        .json({ error: 'walletAddress and identityAddress are required' });
    }

    const identity = await db.identity.upsert({
      where: {
        ecosystemId_walletAddress: {
          ecosystemId,
          walletAddress: walletAddress.toLowerCase(),
        },
      },
      create: {
        ecosystemId,
        walletAddress: walletAddress.toLowerCase(),
        identityAddress,
        countryCode: countryCode ?? 0,
        claimTopics: claimTopics ?? [],
      },
      update: {
        identityAddress,
        ...(countryCode !== undefined && { countryCode }),
        ...(claimTopics !== undefined && { claimTopics }),
      },
    });

    return res.status(201).json(identity);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
