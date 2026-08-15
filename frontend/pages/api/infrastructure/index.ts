/**
 * /api/infrastructure
 *
 * GET  ?chainId=<number>  → fetch ChainInfrastructure for a chain
 * POST                    → upsert ChainInfrastructure (idempotent by chainId)
 *
 * Used by:
 *   - deploy-infrastructure.ts script (POST after deploying shared contracts)
 *   - TokenRegistryContext / useDeploymentWizard (GET to load infra before deploying a token)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // ── GET /api/infrastructure?chainId=<n> ─────────────────────────────────────
  if (req.method === 'GET') {
    const chainIdRaw = req.query['chainId'];
    if (!chainIdRaw) {
      return res.status(400).json({ error: 'chainId query param required' });
    }

    const chainId = parseInt(chainIdRaw as string, 10);
    if (isNaN(chainId)) {
      return res.status(400).json({ error: 'chainId must be a number' });
    }

    const row = await db.chainInfrastructure.findUnique({
      where: { chainId },
    });

    if (!row) {
      return res
        .status(404)
        .json({ error: `No infrastructure for chainId ${chainId}` });
    }

    return res.status(200).json(row);
  }

  // ── POST /api/infrastructure ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      chainId,
      implToken,
      implIdentityRegistry,
      implIdentityRegistryStorage,
      implTrustedIssuersRegistry,
      implClaimTopicsRegistry,
      implModularCompliance,
      implOIDIdentity,
      oidImplementationAuthority,
      oidIdFactory,
      trexImplementationAuthority,
      trexFactory,
      moduleCountryRestrict,
      moduleCountryAllow,
      moduleMaxBalance,
      moduleSupplyLimit,
      deployedBy,
      deployedAt,
    } = req.body as {
      chainId: number;
      implToken: string;
      implIdentityRegistry: string;
      implIdentityRegistryStorage: string;
      implTrustedIssuersRegistry: string;
      implClaimTopicsRegistry: string;
      implModularCompliance: string;
      implOIDIdentity: string;
      oidImplementationAuthority: string;
      oidIdFactory: string;
      trexImplementationAuthority: string;
      trexFactory: string;
      moduleCountryRestrict?: string;
      moduleCountryAllow?: string;
      moduleMaxBalance?: string;
      moduleSupplyLimit?: string;
      deployedBy: string;
      deployedAt: string; // ISO-8601
    };

    // Validate required fields
    const required = {
      chainId,
      implToken,
      implIdentityRegistry,
      implIdentityRegistryStorage,
      implTrustedIssuersRegistry,
      implClaimTopicsRegistry,
      implModularCompliance,
      implOIDIdentity,
      oidImplementationAuthority,
      oidIdFactory,
      trexImplementationAuthority,
      trexFactory,
      deployedBy,
      deployedAt,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => v === undefined || v === null || v === '')
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const deployedAtDate = new Date(deployedAt);
    if (isNaN(deployedAtDate.getTime())) {
      return res
        .status(400)
        .json({ error: 'deployedAt must be a valid ISO-8601 date' });
    }

    const data = {
      implToken,
      implIdentityRegistry,
      implIdentityRegistryStorage,
      implTrustedIssuersRegistry,
      implClaimTopicsRegistry,
      implModularCompliance,
      implOIDIdentity,
      oidImplementationAuthority,
      oidIdFactory,
      trexImplementationAuthority,
      trexFactory,
      moduleCountryRestrict: moduleCountryRestrict ?? null,
      moduleCountryAllow: moduleCountryAllow ?? null,
      moduleMaxBalance: moduleMaxBalance ?? null,
      moduleSupplyLimit: moduleSupplyLimit ?? null,
      deployedBy,
      deployedAt: deployedAtDate,
    };

    const row = await db.chainInfrastructure.upsert({
      where: { chainId },
      create: { chainId, ...data },
      update: data,
    });

    return res.status(201).json(row);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
