/**
 * GET  /api/compliance?ecosystemId=<id>  → list all compliance rules for an ecosystem
 * POST /api/compliance                   → create or upsert a compliance rule
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    const { ecosystemId } = req.query;

    if (!ecosystemId) {
      return res
        .status(400)
        .json({ error: 'ecosystemId query param required' });
    }

    const rules = await db.complianceRule.findMany({
      where: { ecosystemId: ecosystemId as string },
      orderBy: { module: 'asc' },
    });

    return res.status(200).json(rules);
  }

  if (req.method === 'POST') {
    const { id, ecosystemId, module, isActive, params } = req.body as {
      id?: string;
      ecosystemId: string;
      module: string;
      isActive?: boolean;
      params: unknown;
    };

    if (!ecosystemId || !module || params === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const jsonParams = params as Prisma.InputJsonValue;

    const rule = await db.complianceRule.upsert({
      where: {
        ecosystemId_module: { ecosystemId, module },
      },
      create: {
        ...(id && { id }),
        ecosystemId,
        module,
        isActive: isActive ?? true,
        params: jsonParams,
      },
      update: {
        isActive: isActive ?? true,
        params: jsonParams,
      },
    });

    return res.status(201).json(rule);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
