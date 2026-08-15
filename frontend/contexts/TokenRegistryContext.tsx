/**
 * TokenRegistryContext — DB-primary token registry + chain infrastructure
 *
 * Two-layer architecture:
 *   - ChainInfrastructure: shared contracts deployed once per chain (fetched from DB)
 *   - TokenEcosystem: per-token proxy suite deployed via TREXFactory (fetched from DB)
 *
 * The only things kept in localStorage are two tiny UI preferences:
 *   trex_ecosystem_mode          → 'platform' | 'custom'
 *   trex_active_token_<chainId>  → UUID of the selected ecosystem
 *
 * Lifecycle:
 *   mount / chain-switch → fetch infrastructure + ecosystems from DB → setState
 *   addToken             → POST /api/ecosystems   → prepend to state
 *   removeToken          → DELETE /api/ecosystems/:id → filter from state
 *   updateToken          → PUT  /api/ecosystems/:id → update in state
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useChainId } from 'wagmi';
import type {
  DeployedTokenEcosystem,
  DeployedChainInfrastructure,
  TokenEcosystemMode,
  TokenRegistryContextValue,
} from '@/types/tokenRegistry';
import {
  fetchEcosystems,
  saveEcosystem,
  deleteEcosystem,
  updateEcosystem,
  dbRowToEcosystem,
} from '@/lib/api/ecosystems';
import { fetchInfrastructure } from '@/lib/api/infrastructure';

// ── localStorage: UI preferences only ────────────────────────────────────────

const activeKey = (chainId: number) => `trex_active_token_${chainId}`;
const MODE_KEY = 'trex_ecosystem_mode';

function loadActiveId(chainId: number): string | null {
  try {
    return localStorage.getItem(activeKey(chainId));
  } catch {
    return null;
  }
}
function saveActiveId(chainId: number, id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(activeKey(chainId));
    } else {
      localStorage.setItem(activeKey(chainId), id);
    }
  } catch {
    /* ignore */
  }
}
function loadMode(): TokenEcosystemMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'custom' ? 'custom' : 'platform';
  } catch {
    return 'platform';
  }
}
function saveMode(m: TokenEcosystemMode): void {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

export const TokenRegistryContext =
  createContext<TokenRegistryContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function TokenRegistryProvider({ children }: { children: ReactNode }) {
  const chainId = useChainId();

  // UI preferences (localStorage only — not business data)
  const [mode, setModeState] = useState<TokenEcosystemMode>(() => loadMode());
  const [activeTokenId, setActiveTokenIdState] = useState<string | null>(() =>
    loadActiveId(chainId),
  );

  // Token list — loaded from DB
  const [tokens, setTokens] = useState<DeployedTokenEcosystem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Chain infrastructure — loaded from DB, with static config fallback
  const [infrastructure, setInfrastructure] =
    useState<DeployedChainInfrastructure | null>(null);
  const [isInfraLoading, setIsInfraLoading] = useState(true);

  // Track previous chainId for derived-state update of activeTokenId pref
  const [prevChainId, setPrevChainId] = useState(chainId);
  if (prevChainId !== chainId) {
    setPrevChainId(chainId);
    setActiveTokenIdState(loadActiveId(chainId));
    setTokens([]); // clear stale data immediately; useEffect will refetch
    setInfrastructure(null);
    setIsLoading(true);
    setIsInfraLoading(true);
  }

  // ── Fetch infrastructure on mount + chain change ──────────────────────────
  // DB-ONLY: No static config file fallback. If infrastructure has not been
  // deployed and saved to the DB for this chain, infrastructure will be null.
  // The deploy page blocks the deployment button until infra is in the DB.
  // Expose a stable function reference that pages/components can call to
  // force a re-fetch of the chain infrastructure from the DB (e.g. after
  // deploying chain infra from the UI).
  const [infraRefreshKey, setInfraRefreshKey] = useState(0);

  const refreshInfrastructure = useCallback(async () => {
    setIsInfraLoading(true);
    const dbInfra = await fetchInfrastructure(chainId);
    setInfrastructure(dbInfra ?? null);
    setIsInfraLoading(false);
    setInfraRefreshKey((k) => k + 1);
  }, [chainId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInfra() {
      setIsInfraLoading(true);
      setInfrastructure(null);

      const dbInfra = await fetchInfrastructure(chainId);
      if (cancelled) return;

      setInfrastructure(dbInfra ?? null);
      setIsInfraLoading(false);
    }

    void loadInfra();
    return () => {
      cancelled = true;
    };
     
  }, [chainId, infraRefreshKey]);

  // ── Fetch ecosystems on mount + chain change ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const rows = await fetchEcosystems(chainId);
      if (cancelled) return;
      setTokens(rows.map(dbRowToEcosystem));
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const setMode = useCallback((m: TokenEcosystemMode) => {
    setModeState(m);
    saveMode(m);
  }, []);

  const setActiveTokenId = useCallback(
    (id: string | null) => {
      setActiveTokenIdState(id);
      saveActiveId(chainId, id);
    },
    [chainId],
  );

  const addToken = useCallback(
    async (token: DeployedTokenEcosystem): Promise<void> => {
      await saveEcosystem(token);
      setTokens((prev) => {
        if (prev.some((t) => t.id === token.id)) return prev;
        return [token, ...prev];
      });
    },
    [],
  );

  const removeToken = useCallback(
    async (id: string): Promise<void> => {
      await deleteEcosystem(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      setActiveTokenIdState((prev) => {
        if (prev === id) {
          saveActiveId(chainId, null);
          return null;
        }
        return prev;
      });
    },
    [chainId],
  );

  const updateToken = useCallback(
    async (
      id: string,
      updates: Partial<DeployedTokenEcosystem>,
    ): Promise<void> => {
      await updateEcosystem(id, updates);
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  // ── Derived values ────────────────────────────────────────────────────────

  const activeToken: DeployedTokenEcosystem | null =
    mode === 'custom'
      ? (tokens.find((t) => t.id === activeTokenId) ?? null)
      : null;

  const value: TokenRegistryContextValue = {
    isLoading,
    mode,
    setMode,
    tokens,
    activeToken,
    activeTokenId,
    setActiveTokenId,
    infrastructure,
    isInfraLoading,
    refreshInfrastructure,
    addToken,
    removeToken,
    updateToken,
  };

  return (
    <TokenRegistryContext.Provider value={value}>
      {children}
    </TokenRegistryContext.Provider>
  );
}

// ── Context accessor ──────────────────────────────────────────────────────────

export function useTokenRegistryContext(): TokenRegistryContextValue {
  const ctx = useContext(TokenRegistryContext);
  if (!ctx) {
    throw new Error(
      'useTokenRegistryContext must be used within a <TokenRegistryProvider>',
    );
  }
  return ctx;
}
