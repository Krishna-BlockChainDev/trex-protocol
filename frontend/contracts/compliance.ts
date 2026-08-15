/**
 * Modular Compliance contract helpers (viem).
 *
 * The ModularCompliance contract acts as the transfer-rule engine for a
 * T-REX token.  Compliance modules (country restrictions, max balance,
 * supply limits, etc.) are plugged in and removed at runtime.
 *
 * Key roles:
 *   - Token owner: bind/unbind modules, link the token.
 *   - Anyone: canTransfer() read to check transfer eligibility.
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
} from 'viem';
import ComplianceABI from './abi/compliance.json';

// ─── ABI (re-export for use with wagmi hooks) ─────────────────────────────────

export { ComplianceABI };

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Returns `true` when the transfer of `amount` tokens from `from` to `to`
 * is compliant with all currently bound modules.
 */
export async function canTransfer(
  complianceAddress: Address,
  from: Address,
  to: Address,
  amount: bigint,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'canTransfer',
    args: [from, to, amount],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

/**
 * Returns the list of compliance module addresses currently bound to this
 * compliance contract.
 */
export async function getModules(
  complianceAddress: Address,
  publicClient: PublicClient,
): Promise<Address[]> {
  return publicClient.readContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'getModules',
    args: [],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<Address[]>;
}

/**
 * Returns `true` when `moduleAddress` is bound to this compliance contract.
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
 * Returns the token address bound to this compliance contract.
 */
export async function getBoundToken(
  complianceAddress: Address,
  publicClient: PublicClient,
): Promise<Address> {
  return publicClient.readContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'getTokenBound',
    args: [],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<Address>;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Adds a compliance module to this compliance contract.
 * Caller must be the compliance owner.
 *
 * @param moduleAddress - Address of the deployed compliance module.
 */
export async function addModule(
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
 * Removes a compliance module from this compliance contract.
 * Caller must be the compliance owner.
 */
export async function removeModule(
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

/**
 * Binds a token to this compliance contract.
 * Should only be called once during token deployment / setup.
 * Caller must be the compliance owner.
 */
export async function bindToken(
  complianceAddress: Address,
  tokenAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'bindToken',
    args: [tokenAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Unbinds the token from this compliance contract.
 * Caller must be the compliance owner.
 */
export async function unbindToken(
  complianceAddress: Address,
  tokenAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: complianceAddress,
    abi: ComplianceABI,
    functionName: 'unbindToken',
    args: [tokenAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
