/**
 * GET    /api/compliance/:id  → get one compliance rule
 * PUT    /api/compliance/:id  → update isActive flag and/or params
 * DELETE /api/compliance/:id  → remove rule
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const id = req.query.id as string;

  if (req.method === 'GET') {
    const rule = await db.complianceRule.findUnique({ where: { id } });
    if (!rule) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(rule);
  }

  if (req.method === 'PUT') {
    const { isActive, params } = req.body as {
      isActive?: boolean;
      params?: unknown;
    };
    const rule = await db.complianceRule.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(params !== undefined && {
          params: params as Prisma.InputJsonValue,
        }),
      },
    });
    return res.status(200).json(rule);
  }

  if (req.method === 'DELETE') {
    await db.complianceRule.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
