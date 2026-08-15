/**
 * useIdentity – OnchainID identity creation & lookup hook.
 *
 * Allows a deployer to:
 *   1. Check whether a wallet already has an OnchainID identity via the factory.
 *   2. Create a new identity proxy on behalf of an investor wallet.
 *   3. Store / retrieve created identities — persisted to the DB Identity table,
 *      scoped by the currently active token ecosystem (activeToken.id).
 *
 * The history table (`allIdentities`) always shows ALL identities across every
 * ecosystem on the connected chain — not just the active one.
 *
 * When no ecosystem is active (activeToken == null) the hook falls back to the
 * legacy localStorage key `trex_identities` so existing data is not lost.
 *
 * The factory address is resolved from the chain infrastructure (Layer 1) via
 * `useTokenRegistryContext` → `infrastructure.oidIdFactory`.
 */

import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { type Address, isAddress, zeroAddress } from 'viem';
import type { PublicClient, WalletClient } from 'viem';
import { useDeployedAddresses } from './useDeployedAddresses';
import { useTokenRegistryContext } from '@/contexts/TokenRegistryContext';
import { useTransaction, type UseTransactionReturn } from './useTransaction';
import {
  getIdentityByWallet,
  createIdentity as createIdentityFn,
  buildSalt,
  hasIdentity,
} from '@/contracts/idFactory';
import {
  fetchIdentities,
  fetchAllIdentitiesByChain,
  saveIdentity as saveIdentityToDB,
  type DbIdentity,
} from '@/lib/api/identities';

// ─── localStorage fallback helpers ───────────────────────────────────────────

const LS_KEY = 'trex_identities';

/** Shape stored in localStorage / returned by the hook: wallet → identity address */
type StoredIdentityMap = Record<string, string>;

function readStoredIdentities(): StoredIdentityMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredIdentityMap) : {};
  } catch {
    return {};
  }
}

function writeStoredIdentityLS(wallet: Address, identity: Address): void {
  if (typeof window === 'undefined') return;
  const map = readStoredIdentities();
  map[wallet.toLowerCase()] = identity;
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UseIdentityReturn = {
  /** The IdFactory contract address for the connected chain, or `null`. */
  factoryAddress: Address | null;

  // ── Check (read) ─────────────────────────────────────────────────────────

  /**
   * Query the factory for an existing identity linked to `wallet`.
   * Sets `existingIdentity` after the call resolves.
   */
  checkIdentity: (wallet: Address) => Promise<Address | null>;
  /** Identity address returned by the last `checkIdentity` call. */
  existingIdentity: Address | null;
  /** `true` while `checkIdentity` is in progress. */
  isChecking: boolean;
  /** Error message from the last failed `checkIdentity` call. */
  checkError: string | null;

  // ── Create (write) ───────────────────────────────────────────────────────

  /**
   * Call `IdFactory.createIdentity(wallet, salt)` on behalf of `wallet`.
   * Resolves after the tx is mined.  The new identity address is persisted
   * to the DB (or localStorage fallback) and returned via `createdIdentity`.
   */
  create: (wallet: Address, salt?: string) => Promise<void>;
  /** Transaction lifecycle state for the create call. */
  txState: UseTransactionReturn;
  /**
   * The identity address that was created in the last successful `create` call.
   * Also persisted to the DB under the active ecosystemId.
   */
  createdIdentity: Address | null;

  // ── Stored identities (ecosystem-scoped, for form lookups) ───────────────

  /**
   * Refresh the stored identities map from the DB or localStorage.
   */
  refreshIdentities: () => Promise<void>;

  /**
   * Look up a previously created identity without calling the chain.
   * Checks the in-memory map (populated from DB or localStorage).
   */
  getStoredIdentity: (wallet: Address) => Address | undefined;
  /**
   * wallet → identity address pairs for the active ecosystem only.
   * Used for form autocomplete / lookups. For the full history table use `allIdentities`.
   */
  storedIdentities: StoredIdentityMap;

  // ── All identities (chain-scoped, for the history table) ─────────────────

  /**
   * All identities across every ecosystem on the connected chain.
   * Used by the history table — not filtered by active ecosystem.
   */
  allIdentities: DbIdentity[];
  /** Refresh `allIdentities` from the DB. */
  refreshAllIdentities: () => Promise<void>;

  // ── Status ───────────────────────────────────────────────────────────────

  /** `true` when the factory address is known and a public client is available. */
  isReady: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIdentity(): UseIdentityReturn {
  const { activeToken } = useDeployedAddresses();
  const { infrastructure } = useTokenRegistryContext();
  const rawPublicClient = usePublicClient();
  const { data: rawWalletClient } = useWalletClient();
  const publicClient = rawPublicClient as PublicClient | undefined;
  const walletClient = rawWalletClient as WalletClient | undefined;
  const chainId = useChainId();

  const txState = useTransaction();

  // ── Factory address — from chain infrastructure (Layer 1) ────────────────
  // oidIdFactory is a shared contract deployed once per chain; it is not
  // part of the per-token ContractAddresses but lives on the infrastructure.
  const factoryAddress = (infrastructure?.oidIdFactory ??
    null) as Address | null;

  // ── Local state ───────────────────────────────────────────────────────────
  const [existingIdentity, setExistingIdentity] = useState<Address | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [createdIdentity, setCreatedIdentity] = useState<Address | null>(null);

  // Lazy init: start with localStorage data so the table isn't empty on first
  // render while the async DB fetch is in-flight.
  const [storedIdentities, setStoredIdentities] = useState<StoredIdentityMap>(
    () => (typeof window !== 'undefined' ? readStoredIdentities() : {}),
  );

  // All identities across every ecosystem on this chain (for history table)
  const [allIdentities, setAllIdentities] = useState<DbIdentity[]>([]);

  // ── Ecosystem-scoped identity loading ──────────────────────────────────────
  const activeEcoId = activeToken?.id ?? null;

  useEffect(() => {
    let isActive = true;

    if (activeEcoId) {
      // Fetch identities scoped to this ecosystem from the DB.
      fetchIdentities(activeEcoId)
        .then((rows) => {
          if (!isActive) return;
          const map: StoredIdentityMap = {};
          for (const r of rows) {
            map[r.walletAddress.toLowerCase()] = r.identityAddress;
          }
          setStoredIdentities(map);
        })
        .catch(() => {
          // DB unavailable — keep whatever is in state.
        });
    } else {
      // No active ecosystem → fall back to localStorage.
      if (typeof window !== 'undefined') {
        Promise.resolve().then(() => {
          if (!isActive) return;
          setStoredIdentities(readStoredIdentities());
        });
      }
    }

    return () => {
      isActive = false;
    };
  }, [activeEcoId]);

  // ── Chain-wide identity loading (for history table) ────────────────────────
  useEffect(() => {
    let isActive = true;
    fetchAllIdentitiesByChain(chainId)
      .then((rows) => {
        if (!isActive) return;
        setAllIdentities(rows);
      })
      .catch(() => {});
    return () => {
      isActive = false;
    };
  }, [chainId]);

  // ── checkIdentity ─────────────────────────────────────────────────────────
  const checkIdentity = async (wallet: Address): Promise<Address | null> => {
    setCheckError(null);
    setExistingIdentity(null);

    if (!factoryAddress) {
      const msg =
        'Factory address not available – connect wallet to a supported network.';
      setCheckError(msg);
      return null;
    }
    if (!publicClient) {
      const msg = 'Public client unavailable. Ensure wallet is connected.';
      setCheckError(msg);
      return null;
    }
    if (!isAddress(wallet)) {
      const msg = `Invalid wallet address: ${wallet}`;
      setCheckError(msg);
      return null;
    }

    setIsChecking(true);
    try {
      const identity = await getIdentityByWallet(
        factoryAddress,
        wallet,
        publicClient,
      );
      const resolved = hasIdentity(identity) ? identity : null;
      setExistingIdentity(resolved);
      return resolved;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to check identity.';
      setCheckError(msg);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  // ── create ────────────────────────────────────────────────────────────────
  const create = async (wallet: Address, salt?: string): Promise<void> => {
    if (!factoryAddress) {
      throw new Error(
        'Factory address not available – connect wallet to a supported network.',
      );
    }
    if (!publicClient || !walletClient) {
      throw new Error(
        'Wallet not connected. Please connect your wallet first.',
      );
    }
    if (!isAddress(wallet)) {
      throw new Error(`Invalid wallet address: ${wallet}`);
    }

    const effectiveSalt = salt ?? buildSalt(wallet);

    // execute() returns the hash on success, undefined on failure.
    const hash = await txState.execute(async () => {
      return createIdentityFn(
        factoryAddress,
        wallet,
        effectiveSalt,
        walletClient,
        publicClient,
      );
    });

    // After the tx is mined, read back the identity address from the factory.
    if (hash) {
      try {
        const identity = await getIdentityByWallet(
          factoryAddress,
          wallet,
          publicClient,
        );
        if (hasIdentity(identity) && identity !== zeroAddress) {
          setCreatedIdentity(identity);

          if (activeEcoId) {
            // Persist to DB scoped by active ecosystem.
            await saveIdentityToDB(activeEcoId, wallet, identity);
            setStoredIdentities((prev) => ({
              ...prev,
              [wallet.toLowerCase()]: identity,
            }));
            await refreshIdentities(); // Ensure state is fresh
          } else {
            // Fallback: persist to localStorage.
            writeStoredIdentityLS(wallet, identity);
            setStoredIdentities(readStoredIdentities());
          }
          // Always refresh the chain-wide list so history table updates immediately
          const allRows = await fetchAllIdentitiesByChain(chainId);
          setAllIdentities(allRows);
        }
      } catch {
        // Non-fatal: hash was obtained; user can re-check manually.
      }
    }
  };

  // ── refreshIdentities ─────────────────────────────────────────────────────
  const refreshIdentities = async (): Promise<void> => {
    if (activeEcoId) {
      try {
        const rows = await fetchIdentities(activeEcoId);
        const map: StoredIdentityMap = {};
        for (const r of rows) {
          map[r.walletAddress.toLowerCase()] = r.identityAddress;
        }
        setStoredIdentities(map);
      } catch {
        // ignore
      }
    } else {
      if (typeof window !== 'undefined') {
        setStoredIdentities(readStoredIdentities());
      }
    }
  };

  // ── refreshAllIdentities ──────────────────────────────────────────────────
  const refreshAllIdentities = async (): Promise<void> => {
    try {
      const rows = await fetchAllIdentitiesByChain(chainId);
      setAllIdentities(rows);
    } catch {
      // ignore
    }
  };

  // ── getStoredIdentity ─────────────────────────────────────────────────────
  const getStoredIdentity = (wallet: Address): Address | undefined => {
    return (storedIdentities[wallet.toLowerCase()] as Address) ?? undefined;
  };

  const isReady = Boolean(factoryAddress && publicClient);

  return {
    factoryAddress,
    checkIdentity,
    existingIdentity,
    isChecking,
    checkError,
    create,
    txState,
    createdIdentity,
    getStoredIdentity,
    storedIdentities,
    refreshIdentities,
    allIdentities,
    refreshAllIdentities,
    isReady,
  };
}
