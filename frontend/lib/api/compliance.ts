/**
 * Client-side API helpers for /api/compliance
 */

const BASE = '/api/compliance';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DbComplianceRule {
  id: string;
  ecosystemId: string;
  module: string;
  isActive: boolean;
  params: unknown;
  createdAt: string;
  updatedAt: string;
}

export type ComplianceModule =
  | 'countryRestrict'
  | 'countryAllow'
  | 'maxBalance'
  | 'supplyLimit';

export interface SaveComplianceRuleParams {
  ecosystemId: string;
  module: ComplianceModule;
  isActive?: boolean;
  params: unknown;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Fetch all compliance rules for an ecosystem. */
export async function fetchComplianceRules(
  ecosystemId: string,
): Promise<DbComplianceRule[]> {
  try {
    const res = await fetch(`${BASE}?ecosystemId=${ecosystemId}`);
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbComplianceRule[];
  } catch (err) {
    console.error('[db] fetchComplianceRules error:', err);
    return [];
  }
}

/** Save (upsert) a compliance rule — one rule per module per ecosystem. */
export async function saveComplianceRule(
  params: SaveComplianceRuleParams,
): Promise<DbComplianceRule | null> {
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbComplianceRule;
  } catch (err) {
    console.error('[db] saveComplianceRule error:', err);
    return null;
  }
}

/** Update a compliance rule's params or active state. */
export async function updateComplianceRule(
  id: string,
  updates: { isActive?: boolean; params?: unknown },
): Promise<DbComplianceRule | null> {
  try {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DbComplianceRule;
  } catch (err) {
    console.error('[db] updateComplianceRule error:', err);
    return null;
  }
}

/** Remove a compliance rule. */
export async function deleteComplianceRule(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
    return res.ok || res.status === 204;
  } catch (err) {
    console.error('[db] deleteComplianceRule error:', err);
    return false;
  }
}
