/**
 * Client-side fetch helpers for /api/infrastructure
 *
 * These functions are used by:
 *   - useDeploymentWizard — to load chain infrastructure before deploying a token
 *   - TokenRegistryContext — to expose infrastructure to the dashboard
 *   - deploy-infrastructure script (server-side POST after deploying shared contracts)
 */

import type { DeployedChainInfrastructure } from '@/types/tokenRegistry';

// ── DB row shape returned by the API ─────────────────────────────────────────

/**
 * Raw API response shape for a ChainInfrastructure row.
 * Mirrors the Prisma model exactly (dates are ISO-8601 strings over the wire).
 */
export interface DbInfrastructure {
  id: string;
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
  moduleCountryRestrict: string | null;
  moduleCountryAllow: string | null;
  moduleMaxBalance: string | null;
  moduleSupplyLimit: string | null;
  deployedBy: string;
  deployedAt: string; // ISO-8601
  createdAt: string;
  updatedAt: string;
}

// ── Converter: API row → browser type ────────────────────────────────────────

export function dbRowToInfrastructure(
  row: DbInfrastructure,
): DeployedChainInfrastructure {
  return {
    id: row.id,
    chainId: row.chainId,
    implToken: row.implToken,
    implIdentityRegistry: row.implIdentityRegistry,
    implIdentityRegistryStorage: row.implIdentityRegistryStorage,
    implTrustedIssuersRegistry: row.implTrustedIssuersRegistry,
    implClaimTopicsRegistry: row.implClaimTopicsRegistry,
    implModularCompliance: row.implModularCompliance,
    implOIDIdentity: row.implOIDIdentity,
    oidImplementationAuthority: row.oidImplementationAuthority,
    oidIdFactory: row.oidIdFactory,
    trexImplementationAuthority: row.trexImplementationAuthority,
    trexFactory: row.trexFactory,
    moduleCountryRestrict: row.moduleCountryRestrict,
    moduleCountryAllow: row.moduleCountryAllow,
    moduleMaxBalance: row.moduleMaxBalance,
    moduleSupplyLimit: row.moduleSupplyLimit,
    deployedBy: row.deployedBy,
    deployedAt: new Date(row.deployedAt).getTime(),
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Fetch the chain infrastructure for a given chainId from the DB.
 * Returns null when no infrastructure has been deployed for that chain yet.
 */
export async function fetchInfrastructure(
  chainId: number,
): Promise<DeployedChainInfrastructure | null> {
  try {
    const res = await fetch(`/api/infrastructure?chainId=${chainId}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        `fetchInfrastructure(${chainId}): ${body.error ?? res.statusText}`,
      );
    }
    const row = (await res.json()) as DbInfrastructure;
    return dbRowToInfrastructure(row);
  } catch (err) {
    // Network errors — fall back to null so the UI can degrade gracefully.
    console.warn('[infrastructure] fetchInfrastructure failed:', err);
    return null;
  }
}

/**
 * Persist a newly deployed chain infrastructure to the DB.
 * Idempotent — upserts by chainId.
 */
export async function saveInfrastructure(
  data: Omit<DeployedChainInfrastructure, 'id'> & { deployedAt: number },
): Promise<DeployedChainInfrastructure> {
  const res = await fetch('/api/infrastructure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      // Convert ms timestamp → ISO-8601 string for the API
      deployedAt: new Date(data.deployedAt).toISOString(),
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      `saveInfrastructure(chainId=${data.chainId}): ${body.error ?? res.statusText}`,
    );
  }

  const row = (await res.json()) as DbInfrastructure;
  return dbRowToInfrastructure(row);
}
