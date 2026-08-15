/**
 * GET    /api/ecosystems/:id  → get one ecosystem
 * PUT    /api/ecosystems/:id  → update name / token addresses
 * DELETE /api/ecosystems/:id  → delete ecosystem (cascades identities + rules)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';

/**
 * Serialize a TokenEcosystem row (or nested object) for JSON transport.
 * Converts BigInt fields (lastSyncedBlock) to strings so JSON.stringify
 * does not throw "Do not know how to serialize a BigInt".
 */
function serializeEcosystem(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      if (typeof v === 'bigint') return [k, v.toString()];
      // Recursively handle nested objects (identities, complianceRules arrays)
      if (Array.isArray(v))
        return [
          k,
          v.map((item) =>
            typeof item === 'object' && item !== null
              ? serializeEcosystem(item as Record<string, unknown>)
              : item,
          ),
        ];
      return [k, v];
    }),
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const id = req.query.id as string;

  if (req.method === 'GET') {
    const ecosystem = await db.tokenEcosystem.findUnique({
      where: { id },
      include: { identities: true, complianceRules: true },
    });
    if (!ecosystem) return res.status(404).json({ error: 'Not found' });
    return res
      .status(200)
      .json(
        serializeEcosystem(ecosystem as unknown as Record<string, unknown>),
      );
  }

  if (req.method === 'PUT') {
    const {
      name,
      tokenProxy,
      identityRegistryProxy,
      identityRegistryStorageProxy,
      trustedIssuersRegistryProxy,
      claimTopicsRegistryProxy,
      modularComplianceProxy,
      tokenOnchainID,
      claimIssuer,
    } = req.body as {
      name?: string;
      tokenProxy?: string;
      identityRegistryProxy?: string;
      identityRegistryStorageProxy?: string;
      trustedIssuersRegistryProxy?: string;
      claimTopicsRegistryProxy?: string;
      modularComplianceProxy?: string;
      tokenOnchainID?: string;
      claimIssuer?: string;
    };

    const ecosystem = await db.tokenEcosystem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(tokenProxy !== undefined && { tokenProxy }),
        ...(identityRegistryProxy !== undefined && { identityRegistryProxy }),
        ...(identityRegistryStorageProxy !== undefined && {
          identityRegistryStorageProxy,
        }),
        ...(trustedIssuersRegistryProxy !== undefined && {
          trustedIssuersRegistryProxy,
        }),
        ...(claimTopicsRegistryProxy !== undefined && {
          claimTopicsRegistryProxy,
        }),
        ...(modularComplianceProxy !== undefined && { modularComplianceProxy }),
        ...(tokenOnchainID !== undefined && { tokenOnchainID }),
        ...(claimIssuer !== undefined && { claimIssuer }),
      },
    });
    return res
      .status(200)
      .json(
        serializeEcosystem(ecosystem as unknown as Record<string, unknown>),
      );
  }

  if (req.method === 'DELETE') {
    await db.tokenEcosystem.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
