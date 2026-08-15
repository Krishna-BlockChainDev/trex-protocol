/**
 * GET    /api/identities/:id  → get one identity
 * PUT    /api/identities/:id  → update country code, claim topics
 * DELETE /api/identities/:id  → remove identity
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const id = req.query.id as string;

  if (req.method === 'GET') {
    const identity = await db.identity.findUnique({ where: { id } });
    if (!identity) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(identity);
  }

  if (req.method === 'PUT') {
    const { identityAddress, countryCode, claimTopics } = req.body as {
      identityAddress?: string;
      countryCode?: number;
      claimTopics?: number[];
    };
    const identity = await db.identity.update({
      where: { id },
      data: {
        ...(identityAddress !== undefined && {
          identityAddress: identityAddress.toLowerCase(),
        }),
        ...(countryCode !== undefined && { countryCode }),
        ...(claimTopics !== undefined && { claimTopics }),
      },
    });
    return res.status(200).json(identity);
  }

  if (req.method === 'DELETE') {
    await db.identity.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
