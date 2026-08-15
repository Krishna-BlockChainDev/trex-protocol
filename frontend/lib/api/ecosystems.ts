/**
 * Client-side API helpers for /api/ecosystems
 *
 * Two-layer architecture:
 *   - Token proxy addresses are now flat columns on TokenEcosystem (not a JSON blob).
 *   - Shared infra lives in ChainInfrastructure — fetched separately via /api/infrastructure.
 */

import type { DeployedTokenEcosystem } from '@/types/tokenRegistry';

const BASE = '/api/ecosystems';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Raw DB row shape returned by /api/ecosystems.
 * All dates are ISO-8601 strings over the wire.
 */
export interface DbEcosystem {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  salt: string;
  deployerAddress: string;
  deployedAt: string; // ISO string from DB
  // Per-token proxy addresses
  tokenProxy: string;
  identityRegistryProxy: string;
  identityRegistryStorageProxy: string;
  trustedIssuersRegistryProxy: string;
  claimTopicsRegistryProxy: string;
  modularComplianceProxy: string;
  tokenOnchainID: string;
  claimIssuer: string;
  createdAt: string;
  updatedAt: string;
}

// ── Converters ────────────────────────────────────────────────────────────────

/** Convert a DB row into the browser-side DeployedTokenEcosystem shape. */
export function dbRowToEcosystem(row: DbEcosystem): DeployedTokenEcosystem {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    decimals: row.decimals,
    chainId: row.chainId,
    salt: row.salt,
    deployerAddress: row.deployerAddress as `0x${string}`,
    deployedAt: new Date(row.deployedAt).getTime(),
    tokenProxy: row.tokenProxy,
    identityRegistryProxy: row.identityRegistryProxy,
    identityRegistryStorageProxy: row.identityRegistryStorageProxy,
    trustedIssuersRegistryProxy: row.trustedIssuersRegistryProxy,
    claimTopicsRegistryProxy: row.claimTopicsRegistryProxy,
    modularComplianceProxy: row.modularComplianceProxy,
    tokenOnchainID: row.tokenOnchainID,
    claimIssuer: row.claimIssuer,
  };
}

/** Convert a browser DeployedTokenEcosystem to the POST body wire format. */
function toPayload(eco: DeployedTokenEcosystem) {
  return {
    id: eco.id,
    name: eco.name,
    symbol: eco.symbol,
    decimals: eco.decimals,
    chainId: eco.chainId,
    salt: eco.salt,
    deployerAddress: eco.deployerAddress,
    deployedAt: eco.deployedAt, // Unix ms — API converts to DateTime
    tokenProxy: eco.tokenProxy,
    identityRegistryProxy: eco.identityRegistryProxy,
    identityRegistryStorageProxy: eco.identityRegistryStorageProxy,
    trustedIssuersRegistryProxy: eco.trustedIssuersRegistryProxy,
    claimTopicsRegistryProxy: eco.claimTopicsRegistryProxy,
    modularComplianceProxy: eco.modularComplianceProxy,
    tokenOnchainID: eco.tokenOnchainID,
    claimIssuer: eco.claimIssuer,
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Fetch all ecosystems for a given chain from the database. */
export async function fetchEcosystems(chainId: number): Promise<DbEcosystem[]> {
  try {
    const res = await fetch(`${BASE}?chainId=${chainId}`);
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbEcosystem[];
  } catch (err) {
    console.error('[db] fetchEcosystems error:', err);
    return [];
  }
}

/** Persist a newly deployed ecosystem to the database (upsert by id). */
export async function saveEcosystem(
  eco: DeployedTokenEcosystem,
): Promise<DbEcosystem | null> {
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(eco)),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbEcosystem;
  } catch (err) {
    console.error('[db] saveEcosystem error:', err);
    return null;
  }
}

/** Delete an ecosystem by id (cascades identities + compliance rules). */
export async function deleteEcosystem(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch (err) {
    console.error('[db] deleteEcosystem error:', err);
    return false;
  }
}

/** Update mutable fields of an ecosystem. */
export async function updateEcosystem(
  id: string,
  updates: Partial<
    Omit<
      DeployedTokenEcosystem,
      'id' | 'chainId' | 'deployerAddress' | 'deployedAt' | 'salt'
    >
  >,
): Promise<DbEcosystem | null> {
  try {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbEcosystem;
  } catch (err) {
    console.error('[db] updateEcosystem error:', err);
    return null;
  }
}
