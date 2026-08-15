/**
 * useCountryList – reactive localStorage-backed country code list.
 *
 * Stores an ordered, deduplicated array of ISO 3166-1 numeric country codes
 * under a given localStorage key.  Reads are reactive via useSyncExternalStore
 * so any add/remove is immediately reflected in every consumer on the same page.
 *
 * Usage:
 *   const list = useCountryList('trex_restricted_sepolia');
 *   list.add([356, 840]);
 *   list.remove([356]);
 *   list.codes // [840]
 */

import { useState, useEffect, useCallback } from 'react';

// ─── ISO 3166-1 numeric → country name lookup ────────────────────────────────
export const COUNTRY_NAMES: Record<number, string> = {
  4: 'Afghanistan',
  8: 'Albania',
  12: 'Algeria',
  36: 'Australia',
  40: 'Austria',
  50: 'Bangladesh',
  56: 'Belgium',
  76: 'Brazil',
  100: 'Bulgaria',
  104: 'Myanmar',
  112: 'Belarus',
  116: 'Cambodia',
  124: 'Canada',
  144: 'Sri Lanka',
  156: 'China',
  170: 'Colombia',
  191: 'Croatia',
  192: 'Cuba',
  196: 'Cyprus',
  203: 'Czech Republic',
  208: 'Denmark',
  218: 'Ecuador',
  818: 'Egypt',
  233: 'Estonia',
  246: 'Finland',
  250: 'France',
  276: 'Germany',
  300: 'Greece',
  344: 'Hong Kong',
  348: 'Hungary',
  356: 'India',
  360: 'Indonesia',
  364: 'Iran',
  368: 'Iraq',
  372: 'Ireland',
  376: 'Israel',
  380: 'Italy',
  392: 'Japan',
  400: 'Jordan',
  398: 'Kazakhstan',
  404: 'Kenya',
  408: 'North Korea',
  410: 'South Korea',
  422: 'Lebanon',
  458: 'Malaysia',
  484: 'Mexico',
  504: 'Morocco',
  528: 'Netherlands',
  554: 'New Zealand',
  566: 'Nigeria',
  578: 'Norway',
  586: 'Pakistan',
  604: 'Peru',
  608: 'Philippines',
  616: 'Poland',
  620: 'Portugal',
  634: 'Qatar',
  642: 'Romania',
  643: 'Russia',
  682: 'Saudi Arabia',
  694: 'Sierra Leone',
  703: 'Slovakia',
  705: 'Slovenia',
  710: 'South Africa',
  724: 'Spain',
  752: 'Sweden',
  756: 'Switzerland',
  760: 'Syria',
  764: 'Thailand',
  788: 'Tunisia',
  792: 'Turkey',
  784: 'UAE',
  804: 'Ukraine',
  826: 'UK',
  840: 'USA',
  858: 'Uruguay',
  862: 'Venezuela',
  704: 'Vietnam',
  887: 'Yemen',
  716: 'Zimbabwe',
};

/** Returns a human-readable label for a country code. */
export function countryLabel(code: number): string {
  return COUNTRY_NAMES[code] ? `${COUNTRY_NAMES[code]} (${code})` : `#${code}`;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function readCodes(key: string): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function writeCodes(key: string, codes: number[]): void {
  const sorted = [...new Set(codes)].sort((a, b) => a - b);
  localStorage.setItem(key, JSON.stringify(sorted));
  // Notify all useSyncExternalStore subscribers on this page (storage event
  // only fires in *other* tabs by default).
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

// ─── API helpers ──────────────────────────────────────────────────────────────

import { fetchComplianceRules, saveComplianceRule } from '@/lib/api/compliance';
import type { ComplianceModule } from '@/lib/api/compliance';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type UseCountryListReturn = {
  /** Current list of stored country codes (sorted, deduplicated). */
  codes: number[];
  /** Add one or more codes to the list. */
  add: (nums: number[]) => Promise<void>;
  /** Remove one or more codes from the list. */
  remove: (nums: number[]) => Promise<void>;
  /** Remove all codes. */
  clear: () => Promise<void>;
};

export function useCountryList(
  ecosystemId: string | undefined | null,
  moduleType: ComplianceModule,
  fallbackKey: string,
): UseCountryListReturn {
  // We use fallbackKey when ecosystemId is null (Platform mode)
  const [codes, setCodes] = useState<number[]>(() => readCodes(fallbackKey));

  // Load from DB if ecosystemId exists, else use localStorage
  useEffect(() => {
    let active = true;

    async function load() {
      if (ecosystemId) {
        try {
          const rules = await fetchComplianceRules(ecosystemId);
          if (!active) return;
          const rule = rules.find((r) => r.module === moduleType);
          if (rule && Array.isArray(rule.params)) {
            setCodes(rule.params as number[]);
          } else {
            setCodes([]);
          }
        } catch (err) {
          console.error('[useCountryList] Failed to fetch from DB:', err);
          if (active) setCodes([]);
        }
      } else {
        setCodes(readCodes(fallbackKey));
      }
    }

    void load();

    // Listen to local storage changes for fallback mode
    if (!ecosystemId) {
      const handler = () => setCodes(readCodes(fallbackKey));
      window.addEventListener('storage', handler);
      return () => {
        active = false;
        window.removeEventListener('storage', handler);
      };
    }

    return () => {
      active = false;
    };
  }, [ecosystemId, moduleType, fallbackKey]);

  const add = useCallback(
    async (nums: number[]) => {
      if (ecosystemId) {
        const next = [...new Set([...codes, ...nums])].sort((a, b) => a - b);
        try {
          await saveComplianceRule({
            ecosystemId,
            module: moduleType,
            params: next,
          });
          setCodes(next);
        } catch (err) {
          console.error('[useCountryList] Failed to save DB:', err);
        }
      } else {
        const next = [...readCodes(fallbackKey), ...nums];
        writeCodes(fallbackKey, next);
      }
    },
    [ecosystemId, moduleType, fallbackKey, codes],
  );

  const remove = useCallback(
    async (nums: number[]) => {
      if (ecosystemId) {
        const drop = new Set(nums);
        const next = codes.filter((c) => !drop.has(c));
        try {
          await saveComplianceRule({
            ecosystemId,
            module: moduleType,
            params: next,
          });
          setCodes(next);
        } catch (err) {
          console.error('[useCountryList] Failed to save DB:', err);
        }
      } else {
        const drop = new Set(nums);
        const next = readCodes(fallbackKey).filter((c) => !drop.has(c));
        writeCodes(fallbackKey, next);
      }
    },
    [ecosystemId, moduleType, fallbackKey, codes],
  );

  const clear = useCallback(async () => {
    if (ecosystemId) {
      try {
        await saveComplianceRule({
          ecosystemId,
          module: moduleType,
          params: [],
        });
        setCodes([]);
      } catch (err) {
        console.error('[useCountryList] Failed to clear DB:', err);
      }
    } else {
      localStorage.removeItem(fallbackKey);
      window.dispatchEvent(new StorageEvent('storage', { key: fallbackKey }));
    }
  }, [ecosystemId, moduleType, fallbackKey]);

  return { codes, add, remove, clear };
}
