/**
 * OnchainID IdFactory contract helpers (viem).
 *
 * The IdFactory deploys an IdentityProxy for each user wallet and keeps a
 * wallet → identity mapping.  Callers (deployer / agent) invoke
 * `createIdentity` on behalf of investors.
 *
 * Contract: implementations.onchainIDFactory in deployed-addresses
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
  isAddress,
  zeroAddress,
} from 'viem';
import IdFactoryABI from './abi/idFactory.json';

// ─── ABI re-export ────────────────────────────────────────────────────────────

export { IdFactoryABI };

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the OnchainID identity contract address for `wallet`, or
 * `zeroAddress` (0x000…) when no identity has been created yet.
 */
export async function getIdentityByWallet(
  factoryAddress: Address,
  wallet: Address,
  publicClient: PublicClient,
): Promise<Address> {
  const result = (await publicClient.readContract({
    address: factoryAddress,
    abi: IdFactoryABI,
    functionName: 'getIdentity',
    args: [wallet],
  } as Parameters<typeof publicClient.readContract>[0])) as Address;
  return result;
}

/**
 * Returns `true` when the provided salt has already been used to deploy
 * an identity (i.e. the wallet already has an identity).
 */
export async function isSaltTaken(
  factoryAddress: Address,
  salt: string,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: factoryAddress,
    abi: IdFactoryABI,
    functionName: 'isSaltTaken',
    args: [salt],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Deploys a new IdentityProxy for `wallet` via the IdFactory and links
 * `wallet` to the resulting identity contract.
 *
 * The deployer (caller) must be the owner / agent permitted by the factory.
 *
 * @param factoryAddress - `implementations.onchainIDFactory` from deployed addresses.
 * @param wallet         - Investor wallet address the identity will be linked to.
 * @param salt           - Unique string used as the CREATE2 salt.
 *                         Defaults to the lower-case wallet address string.
 * @returns              Transaction hash of the deployment.
 */
export async function createIdentity(
  factoryAddress: Address,
  wallet: Address,
  salt: string,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  if (!isAddress(wallet)) {
    throw new Error(`Invalid wallet address: ${wallet}`);
  }

  const hash = await walletClient.writeContract({
    address: factoryAddress,
    abi: IdFactoryABI,
    functionName: 'createIdentity',
    args: [wallet, salt],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Builds the deterministic salt string for a wallet.
 * Using the lower-cased wallet address ensures one identity per wallet and is
 * predictable / auditable.
 */
export function buildSalt(wallet: Address): string {
  return wallet.toLowerCase();
}

/**
 * Returns `true` when the address is a real identity (not the zero address).
 */
export function hasIdentity(identityAddress: Address | undefined): boolean {
  if (!identityAddress) return false;
  return identityAddress !== zeroAddress;
}
