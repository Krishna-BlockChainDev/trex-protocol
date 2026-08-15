/**
 * useComplianceModules – reactive compliance module state hook.
 *
 * Reads from all four modular compliance modules via wagmi's useReadContracts
 * and exposes admin actions (configure modules, add/remove modules) pre-wired
 * to useTransaction for loading / error state management.
 *
 * Usage:
 *   const { modules, actions, txState } = useComplianceModules();
 *   if (!modules.countryRestrict.isBound) return <p>Module not bound</p>;
 *   await actions.restrictCountries([356, 840]);
 */

import { useMemo } from 'react';
import { useReadContracts, usePublicClient, useWalletClient } from 'wagmi';
import { type Abi, type Address, type Hash, formatUnits } from 'viem';
import type { PublicClient, WalletClient } from 'viem';
import { useContracts } from './useContracts';
import { useTransaction, type UseTransactionReturn } from './useTransaction';
import {
  ComplianceABI,
  CountryRestrictModuleABI,
  CountryAllowModuleABI,
  MaxBalanceModuleABI,
  SupplyLimitModuleABI,
  restrictCountry,
  unrestrictCountry,
  batchRestrictCountries,
  batchUnrestrictCountries,
  allowCountry,
  disallowCountry,
  batchAllowCountries,
  batchDisallowCountries,
  setMaxBalance,
  setSupplyLimit,
  addModuleToCompliance,
  removeModuleFromCompliance,
} from '@/contracts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModuleStatus = {
  /** `true` when this module address is configured (non-empty) */
  hasAddress: boolean;
  /** `true` when the module is bound to the compliance contract */
  isBound: boolean;
  /** The deployed module address (empty string when not configured) */
  address: string;
};

export type CountryRestrictState = ModuleStatus & {
  /** Check a specific country code */
  checkCountry: (country: number) => Promise<boolean>;
};

export type CountryAllowState = ModuleStatus & {
  /** Check a specific country code */
  checkCountry: (country: number) => Promise<boolean>;
};

export type MaxBalanceState = ModuleStatus & {
  /** Raw max balance value (0n = no cap) */
  maxBalance: bigint;
  /** Human-readable max balance string */
  formattedMaxBalance: string;
};

export type SupplyLimitState = ModuleStatus & {
  /** Raw supply limit value (0n = no limit) */
  supplyLimit: bigint;
  /** Human-readable supply limit string */
  formattedSupplyLimit: string;
};

export type ComplianceModuleActions = {
  // ── CountryRestrictModule ────────────────────────────────────────────────
  restrictCountry: (country: number) => Promise<Hash | undefined>;
  unrestrictCountry: (country: number) => Promise<Hash | undefined>;
  batchRestrictCountries: (countries: number[]) => Promise<Hash | undefined>;
  batchUnrestrictCountries: (countries: number[]) => Promise<Hash | undefined>;
  // ── CountryAllowModule ───────────────────────────────────────────────────
  allowCountry: (country: number) => Promise<Hash | undefined>;
  disallowCountry: (country: number) => Promise<Hash | undefined>;
  batchAllowCountries: (countries: number[]) => Promise<Hash | undefined>;
  batchDisallowCountries: (countries: number[]) => Promise<Hash | undefined>;
  // ── MaxBalanceModule ─────────────────────────────────────────────────────
  setMaxBalance: (maxBalance: bigint) => Promise<Hash | undefined>;
  // ── SupplyLimitModule ────────────────────────────────────────────────────
  setSupplyLimit: (limit: bigint) => Promise<Hash | undefined>;
  // ── Module binding ───────────────────────────────────────────────────────
  addModule: (moduleAddress: Address) => Promise<Hash | undefined>;
  removeModule: (moduleAddress: Address) => Promise<Hash | undefined>;
};

export type UseComplianceModulesReturn = {
  countryRestrict: CountryRestrictState;
  countryAllow: CountryAllowState;
  maxBalance: MaxBalanceState;
  supplyLimit: SupplyLimitState;
  /** `true` while module data is loading */
  isLoading: boolean;
  /** `true` when the fetch failed */
  isError: boolean;
  /** Manually re-fetch module state */
  refetch: () => void;
  /** Pre-wired action helpers */
  actions: ComplianceModuleActions;
  /** Shared transaction lifecycle state for all actions */
  txState: UseTransactionReturn;
  /** Token decimals (for formatting balance/supply values) */
  decimals: number;
};

// ─── ABI casts ────────────────────────────────────────────────────────────────

/** Used only for isModuleBound calls — that function lives on ModularCompliance */
const COMP_ABI = ComplianceABI as Abi;
const CR_ABI = CountryRestrictModuleABI as Abi;
const CA_ABI = CountryAllowModuleABI as Abi;
const MB_ABI = MaxBalanceModuleABI as Abi;
const SL_ABI = SupplyLimitModuleABI as Abi;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useComplianceModules(
  decimals = 18,
): UseComplianceModulesReturn {
  const { addresses } = useContracts();
  const txState = useTransaction();

  const rawPublicClient = usePublicClient();
  const { data: rawWalletClient } = useWalletClient();
  const publicClient = rawPublicClient as PublicClient | undefined;
  const walletClient = rawWalletClient as WalletClient | undefined;

  const complianceAddr = addresses?.compliance as Address | undefined;
  const mods = addresses?.modules;

  const crAddr = (mods?.countryRestrictModule || undefined) as
    | Address
    | undefined;
  const caAddr = (mods?.countryAllowModule || undefined) as Address | undefined;
  const mbAddr = (mods?.maxBalanceModule || undefined) as Address | undefined;
  const slAddr = (mods?.supplyLimitModule || undefined) as Address | undefined;

  // ── Batch-read all module state in one RPC call ───────────────────────────
  const contracts = useMemo(() => {
    const list = [];

    if (complianceAddr) {
      // isModuleBound is on ModularCompliance, NOT on the module — use COMP_ABI
      if (crAddr)
        list.push({
          address: complianceAddr,
          abi: COMP_ABI,
          functionName: 'isModuleBound' as const,
          args: [crAddr],
        });
      if (caAddr)
        list.push({
          address: complianceAddr,
          abi: COMP_ABI,
          functionName: 'isModuleBound' as const,
          args: [caAddr],
        });
      if (mbAddr)
        list.push({
          address: complianceAddr,
          abi: COMP_ABI,
          functionName: 'isModuleBound' as const,
          args: [mbAddr],
        });
      if (slAddr)
        list.push({
          address: complianceAddr,
          abi: COMP_ABI,
          functionName: 'isModuleBound' as const,
          args: [slAddr],
        });
    }

    // Max balance + supply limit reads (keyed by compliance addr)
    if (mbAddr && complianceAddr) {
      list.push({
        address: mbAddr,
        abi: MB_ABI,
        functionName: 'getMaxBalance' as const,
        args: [complianceAddr],
      });
    }
    if (slAddr && complianceAddr) {
      list.push({
        address: slAddr,
        abi: SL_ABI,
        functionName: 'getSupplyLimit' as const,
        args: [complianceAddr],
      });
    }

    return list;
  }, [complianceAddr, crAddr, caAddr, mbAddr, slAddr]);

  const {
    data: results,
    isLoading,
    isError,
    refetch,
  } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: {
      enabled: Boolean(complianceAddr),
      refetchInterval: 15_000,
    },
    allowFailure: true,
  });

  // ── Parse results — slot indices depend on which modules are configured ───
  let slotIndex = 0;
  const nextResult = () => {
    const val = results?.[slotIndex]?.result;
    slotIndex += 1;
    return val;
  };

  const crBound = crAddr && complianceAddr ? Boolean(nextResult()) : false;
  const caBound = caAddr && complianceAddr ? Boolean(nextResult()) : false;
  const mbBound = mbAddr && complianceAddr ? Boolean(nextResult()) : false;
  const slBound = slAddr && complianceAddr ? Boolean(nextResult()) : false;

  const rawMaxBalance =
    (mbAddr && complianceAddr
      ? (nextResult() as bigint | undefined)
      : undefined) ?? BigInt(0);
  const rawSupplyLimit =
    (slAddr && complianceAddr
      ? (nextResult() as bigint | undefined)
      : undefined) ?? BigInt(0);

  const formattedMaxBalance =
    rawMaxBalance === BigInt(0)
      ? 'No cap'
      : parseFloat(formatUnits(rawMaxBalance, decimals)).toLocaleString();
  const formattedSupplyLimit =
    rawSupplyLimit === BigInt(0)
      ? 'No limit'
      : parseFloat(formatUnits(rawSupplyLimit, decimals)).toLocaleString();

  // ── Client guard ──────────────────────────────────────────────────────────
  function requireClients(): {
    wc: WalletClient;
    pc: PublicClient;
    comp: Address;
  } {
    if (!walletClient || !publicClient) {
      throw new Error(
        'Wallet not connected. Please connect your wallet first.',
      );
    }
    if (!complianceAddr) {
      throw new Error(
        'Compliance contract address is not available for the current network.',
      );
    }
    return { wc: walletClient, pc: publicClient, comp: complianceAddr };
  }

  function requireModule(addr: Address | undefined, name: string): Address {
    if (!addr)
      throw new Error(`${name} address is not configured for this network.`);
    return addr;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const actions: ComplianceModuleActions = {
    restrictCountry: (country) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(crAddr, 'CountryRestrictModule');
        return restrictCountry(comp, mod, country, wc, pc);
      }),

    unrestrictCountry: (country) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(crAddr, 'CountryRestrictModule');
        return unrestrictCountry(comp, mod, country, wc, pc);
      }),

    batchRestrictCountries: (countries) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(crAddr, 'CountryRestrictModule');
        return batchRestrictCountries(comp, mod, countries, wc, pc);
      }),

    batchUnrestrictCountries: (countries) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(crAddr, 'CountryRestrictModule');
        return batchUnrestrictCountries(comp, mod, countries, wc, pc);
      }),

    allowCountry: (country) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(caAddr, 'CountryAllowModule');
        return allowCountry(comp, mod, country, wc, pc);
      }),

    disallowCountry: (country) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(caAddr, 'CountryAllowModule');
        return disallowCountry(comp, mod, country, wc, pc);
      }),

    batchAllowCountries: (countries) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(caAddr, 'CountryAllowModule');
        return batchAllowCountries(comp, mod, countries, wc, pc);
      }),

    batchDisallowCountries: (countries) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(caAddr, 'CountryAllowModule');
        return batchDisallowCountries(comp, mod, countries, wc, pc);
      }),

    setMaxBalance: (maxBalance) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(mbAddr, 'MaxBalanceModule');
        return setMaxBalance(comp, mod, maxBalance, wc, pc);
      }),

    setSupplyLimit: (limit) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        const mod = requireModule(slAddr, 'SupplyLimitModule');
        return setSupplyLimit(comp, mod, limit, wc, pc);
      }),

    addModule: (moduleAddress) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        return addModuleToCompliance(comp, moduleAddress, wc, pc);
      }),

    removeModule: (moduleAddress) =>
      txState.execute(() => {
        const { wc, pc, comp } = requireClients();
        return removeModuleFromCompliance(comp, moduleAddress, wc, pc);
      }),
  };

  // ── Composed state ────────────────────────────────────────────────────────

  const checkCountryRestricted = async (country: number): Promise<boolean> => {
    if (!publicClient || !crAddr || !complianceAddr) return false;
    const r = await publicClient.readContract({
      address: crAddr,
      abi: CR_ABI,
      functionName: 'isCountryRestricted',
      args: [complianceAddr, country],
    } as Parameters<typeof publicClient.readContract>[0]);
    return Boolean(r);
  };

  const checkCountryAllowed = async (country: number): Promise<boolean> => {
    if (!publicClient || !caAddr || !complianceAddr) return false;
    const r = await publicClient.readContract({
      address: caAddr,
      abi: CA_ABI,
      functionName: 'isCountryAllowed',
      args: [complianceAddr, country],
    } as Parameters<typeof publicClient.readContract>[0]);
    return Boolean(r);
  };

  return {
    countryRestrict: {
      hasAddress: Boolean(crAddr),
      isBound: crBound,
      address: mods?.countryRestrictModule ?? '',
      checkCountry: checkCountryRestricted,
    },
    countryAllow: {
      hasAddress: Boolean(caAddr),
      isBound: caBound,
      address: mods?.countryAllowModule ?? '',
      checkCountry: checkCountryAllowed,
    },
    maxBalance: {
      hasAddress: Boolean(mbAddr),
      isBound: mbBound,
      address: mods?.maxBalanceModule ?? '',
      maxBalance: rawMaxBalance,
      formattedMaxBalance,
    },
    supplyLimit: {
      hasAddress: Boolean(slAddr),
      isBound: slBound,
      address: mods?.supplyLimitModule ?? '',
      supplyLimit: rawSupplyLimit,
      formattedSupplyLimit,
    },
    isLoading,
    isError,
    refetch,
    actions,
    txState,
    decimals,
  };
}
