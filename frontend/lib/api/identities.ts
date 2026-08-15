/**
 * Client-side API helpers for /api/identities
 *
 * Thin wrappers around fetch so hooks don't need to know about URL
 * construction.  Errors are logged and swallowed so a DB outage
 * degrades gracefully.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DbIdentity {
  id: string;
  ecosystemId: string;
  walletAddress: string;
  identityAddress: string;
  countryCode: number;
  claimTopics: number[];
  createdAt: string;
  updatedAt: string;
  /** Included when fetching with ?chainId= (cross-ecosystem query) */
  ecosystem?: {
    id: string;
    name: string;
    symbol: string;
    chainId: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ecosystemBase(ecosystemId: string) {
  return `/api/ecosystems/${ecosystemId}/identities`;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Fetch all identities for a given ecosystem from the database. */
export async function fetchIdentities(
  ecosystemId: string,
): Promise<DbIdentity[]> {
  try {
    const res = await fetch(ecosystemBase(ecosystemId));
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbIdentity[];
  } catch (err) {
    console.error('[db] fetchIdentities error:', err);
    return [];
  }
}

/**
 * Fetch ALL identities across all ecosystems on a given chain.
 * Used for the "Created Identities" history table so it is not filtered
 * by the active ecosystem — every identity on this chain is shown.
 */
export async function fetchAllIdentitiesByChain(
  chainId: number,
): Promise<DbIdentity[]> {
  try {
    const res = await fetch(`/api/identities?chainId=${chainId}`);
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbIdentity[];
  } catch (err) {
    console.error('[db] fetchAllIdentitiesByChain error:', err);
    return [];
  }
}

/** Upsert an identity record for a given ecosystem (wallet → identity address). */
export async function saveIdentity(
  ecosystemId: string,
  walletAddress: string,
  identityAddress: string,
  opts?: { countryCode?: number; claimTopics?: number[] },
): Promise<DbIdentity | null> {
  try {
    const res = await fetch(ecosystemBase(ecosystemId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, identityAddress, ...opts }),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbIdentity;
  } catch (err) {
    console.error('[db] saveIdentity error:', err);
    return null;
  }
}
