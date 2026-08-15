/**
 * GET  /api/ecosystems?chainId=<n>   → list all ecosystems for a chain
 * POST /api/ecosystems               → create / upsert an ecosystem
 *
 * New schema (two-layer architecture):
 *   - Shared infra lives in chain_infrastructure (referenced by chainId FK)
 *   - Token-specific proxy addresses are flat columns on token_ecosystem
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';

/**
 * Serialize a TokenEcosystem row for JSON transport.
 * Converts BigInt fields (lastSyncedBlock) to strings so JSON.stringify
 * does not throw "Do not know how to serialize a BigInt".
 */
function serializeEcosystem(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === 'bigint' ? v.toString() : v,
    ]),
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    // ── List ────────────────────────────────────────────────────────────────
    const chainId = req.query.chainId
      ? parseInt(req.query.chainId as string, 10)
      : undefined;

    const ecosystems = await db.tokenEcosystem.findMany({
      where: chainId !== undefined ? { chainId } : undefined,
      orderBy: { deployedAt: 'desc' },
    });

    return res
      .status(200)
      .json(
        ecosystems.map((e) =>
          serializeEcosystem(e as unknown as Record<string, unknown>),
        ),
      );
  }

  if (req.method === 'POST') {
    // ── Create / upsert ─────────────────────────────────────────────────────
    const {
      id,
      name,
      symbol,
      decimals,
      chainId,
      salt,
      deployerAddress,
      deployedAt,
      // Per-token proxy addresses
      tokenProxy,
      identityRegistryProxy,
      identityRegistryStorageProxy,
      trustedIssuersRegistryProxy,
      claimTopicsRegistryProxy,
      modularComplianceProxy,
      tokenOnchainID,
      claimIssuer,
    } = req.body as {
      id: string;
      name: string;
      symbol: string;
      decimals?: number;
      chainId: number;
      salt: string;
      deployerAddress: string;
      deployedAt: number; // Unix ms from browser
      tokenProxy: string;
      identityRegistryProxy: string;
      identityRegistryStorageProxy: string;
      trustedIssuersRegistryProxy: string;
      claimTopicsRegistryProxy: string;
      modularComplianceProxy: string;
      tokenOnchainID: string;
      claimIssuer: string;
    };

    if (
      !id ||
      !name ||
      !symbol ||
      !chainId ||
      !deployerAddress ||
      !salt ||
      !tokenProxy
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ecosystem = await db.tokenEcosystem.upsert({
      where: { id },
      create: {
        id,
        name,
        symbol,
        decimals: decimals ?? 18,
        chainId,
        salt,
        deployerAddress: deployerAddress.toLowerCase(),
        deployedAt: new Date(deployedAt),
        tokenProxy,
        identityRegistryProxy,
        identityRegistryStorageProxy,
        trustedIssuersRegistryProxy,
        claimTopicsRegistryProxy,
        modularComplianceProxy,
        tokenOnchainID,
        claimIssuer,
      },
      update: {
        name,
        symbol,
        tokenProxy,
        identityRegistryProxy,
        identityRegistryStorageProxy,
        trustedIssuersRegistryProxy,
        claimTopicsRegistryProxy,
        modularComplianceProxy,
        tokenOnchainID,
        claimIssuer,
      },
    });

    return res
      .status(201)
      .json(
        serializeEcosystem(ecosystem as unknown as Record<string, unknown>),
      );
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
