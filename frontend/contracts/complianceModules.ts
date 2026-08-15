/**
 * Compliance Module contract helpers (viem).
 *
 * Four modular compliance modules are supported:
 *   - CountryRestrictModule  — blacklist countries (block receivers in listed countries)
 *   - CountryAllowModule     — whitelist countries (only allow receivers in listed countries)
 *   - MaxBalanceModule       — cap per-investor token balance
 *   - SupplyLimitModule      — cap total token supply (blocks mint over the limit)
 *
 * Configuration always flows through ModularCompliance.callModuleFunction():
 *   compliance.callModuleFunction(
 *     encodeFunctionData({ abi, functionName, args }),
 *     moduleAddress
 *   )
 *
 * The helpers here encode calldata for the four config functions and expose
 * read helpers for querying current module state.
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
  encodeFunctionData,
} from 'viem';

import CountryRestrictModuleABI from './abi/countryRestrictModule.json';
import CountryAllowModuleABI from './abi/countryAllowModule.json';
import MaxBalanceModuleABI from './abi/maxBalanceModule.json';
import SupplyLimitModuleABI from './abi/supplyLimitModule.json';
import ComplianceABI from './abi/compliance.json';

// ─── ABI re-exports ───────────────────────────────────────────────────────────

export {
  CountryRestrictModuleABI,
  CountryAllowModuleABI,
  MaxBalanceModuleABI,
  SupplyLimitModuleABI,
};

// ─── Internal: callModuleFunction wrapper ─────────────────────────────────────

async function callModuleFunction(
  complianceAddress: Address,
  moduleAddress: Address,
  callData: `0x${string}`,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'callModuleFunction',
    args: [callData, moduleAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// ─── CountryRestrictModule ────────────────────────────────────────────────────

/**
 * Restricts a single country code via CountryRestrictModule.
 * Caller must be the compliance owner (calls via callModuleFunction).
 */
export async function restrictCountry(
  complianceAddress: Address,
  moduleAddress: Address,
  country: number,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: CountryRestrictModuleABI,
    functionName: 'addCountryRestriction',
    args: [country],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Removes a country restriction via CountryRestrictModule.
 */
export async function unrestrictCountry(
  complianceAddress: Address,
  moduleAddress: Address,
  country: number,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: CountryRestrictModuleABI,
    functionName: 'removeCountryRestriction',
    args: [country],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Batch-restricts multiple country codes.
 */
export async function batchRestrictCountries(
  complianceAddress: Address,
  moduleAddress: Address,
  countries: number[],
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: CountryRestrictModuleABI,
    functionName: 'batchRestrictCountries',
    args: [countries],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Batch-unrestricts multiple country codes.
 */
export async function batchUnrestrictCountries(
  complianceAddress: Address,
  moduleAddress: Address,
  countries: number[],
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: CountryRestrictModuleABI,
    functionName: 'batchUnrestrictCountries',
    args: [countries],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Returns whether a country is currently restricted for the given compliance.
 */
export async function isCountryRestricted(
  moduleAddress: Address,
  complianceAddress: Address,
  country: number,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: moduleAddress,
    abi: CountryRestrictModuleABI,
    functionName: 'isCountryRestricted',
    args: [complianceAddress, country],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

// ─── CountryAllowModule ───────────────────────────────────────────────────────

/**
 * Allows a single country code via CountryAllowModule.
 */
export async function allowCountry(
  complianceAddress: Address,
  moduleAddress: Address,
  country: number,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: CountryAllowModuleABI,
    functionName: 'addAllowedCountry',
    args: [country],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Removes a country from the allow list.
 */
export async function disallowCountry(
  complianceAddress: Address,
  moduleAddress: Address,
  country: number,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: CountryAllowModuleABI,
    functionName: 'removeAllowedCountry',
    args: [country],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Batch-allows multiple country codes.
 */
export async function batchAllowCountries(
  complianceAddress: Address,
  moduleAddress: Address,
  countries: number[],
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: CountryAllowModuleABI,
    functionName: 'batchAllowCountries',
    args: [countries],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Batch-removes countries from the allow list.
 */
export async function batchDisallowCountries(
  complianceAddress: Address,
  moduleAddress: Address,
  countries: number[],
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: CountryAllowModuleABI,
    functionName: 'batchDisallowCountries',
    args: [countries],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Returns whether a country is currently allowed for the given compliance.
 */
export async function isCountryAllowed(
  moduleAddress: Address,
  complianceAddress: Address,
  country: number,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: moduleAddress,
    abi: CountryAllowModuleABI,
    functionName: 'isCountryAllowed',
    args: [complianceAddress, country],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

// ─── MaxBalanceModule ─────────────────────────────────────────────────────────

/**
 * Sets the maximum per-investor balance via MaxBalanceModule.
 * Pass `0n` to remove the cap.
 */
export async function setMaxBalance(
  complianceAddress: Address,
  moduleAddress: Address,
  maxBalance: bigint,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: MaxBalanceModuleABI,
    functionName: 'setMaxBalance',
    args: [maxBalance],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Returns the currently configured max balance (0 = no cap).
 */
export async function getMaxBalance(
  moduleAddress: Address,
  complianceAddress: Address,
  publicClient: PublicClient,
): Promise<bigint> {
  return publicClient.readContract({
    address: moduleAddress,
    abi: MaxBalanceModuleABI,
    functionName: 'getMaxBalance',
    args: [complianceAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<bigint>;
}

// ─── SupplyLimitModule ────────────────────────────────────────────────────────

/**
 * Sets the maximum total supply via SupplyLimitModule.
 * Pass `0n` to remove the cap.
 */
export async function setSupplyLimit(
  complianceAddress: Address,
  moduleAddress: Address,
  limit: bigint,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const callData = encodeFunctionData({
    abi: SupplyLimitModuleABI,
    functionName: 'setSupplyLimit',
    args: [limit],
  });
  return callModuleFunction(
    complianceAddress,
    moduleAddress,
    callData,
    walletClient,
    publicClient,
  );
}

/**
 * Returns the currently configured supply limit (0 = no limit).
 */
export async function getSupplyLimit(
  moduleAddress: Address,
  complianceAddress: Address,
  publicClient: PublicClient,
): Promise<bigint> {
  return publicClient.readContract({
    address: moduleAddress,
    abi: SupplyLimitModuleABI,
    functionName: 'getSupplyLimit',
    args: [complianceAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<bigint>;
}

// ─── Generic: module bound status ─────────────────────────────────────────────

/**
 * Returns true when `moduleAddress` is bound to `complianceAddress`.
 * Uses the compliance contract's isModuleBound() function.
 */
export async function isModuleBound(
  complianceAddress: Address,
  moduleAddress: Address,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'isModuleBound',
    args: [moduleAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

/**
 * Binds a module to a compliance contract (addModule).
 * Caller must be the compliance owner.
 */
export async function addModuleToCompliance(
  complianceAddress: Address,
  moduleAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'addModule',
    args: [moduleAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Removes a module from a compliance contract.
 * Caller must be the compliance owner.
 */
export async function removeModuleFromCompliance(
  complianceAddress: Address,
  moduleAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'removeModule',
    args: [moduleAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
