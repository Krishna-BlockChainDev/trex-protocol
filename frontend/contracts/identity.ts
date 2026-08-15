/**
 * OnchainID Identity contract helpers (viem).
 *
 * An OnchainID Identity contract implements IERC734 (key management) and
 * IERC735 (claims).  Each investor and the token itself have their own
 * identity contract deployed via the Identity Factory.
 *
 * Key purposes in T-REX:
 *   - Store KYC / AML claims issued by a trusted Claim Issuer.
 *   - Manage keys that authorise actions on the identity.
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
} from 'viem';
import IdentityABI from './abi/identity.json';

// ─── Constants (IERC734 key purposes) ─────────────────────────────────────────

export const KEY_PURPOSES = {
  MANAGEMENT: 1,
  ACTION: 2,
  CLAIM: 3,
  ENCRYPTION: 4,
} as const;

export const KEY_TYPES = {
  ECDSA: 1,
  RSA: 2,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdentityKey = {
  purposes: number[];
  keyType: number;
  key: `0x${string}`;
};

export type Claim = {
  claimType: bigint;
  scheme: bigint;
  issuer: Address;
  signature: `0x${string}`;
  data: `0x${string}`;
  uri: string;
};

// ─── ABI (re-export for use with wagmi hooks) ─────────────────────────────────

export { IdentityABI };

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the key data for a given `keyHash` on an identity contract.
 * The `keyHash` is typically `keccak256(abi.encode(address))`.
 */
export async function getKey(
  identityAddress: Address,
  keyHash: `0x${string}`,
  publicClient: PublicClient,
): Promise<IdentityKey> {
  const result = (await publicClient.readContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'getKey',
    args: [keyHash],
  } as Parameters<typeof publicClient.readContract>[0])) as [
    number[],
    number,
    `0x${string}`,
  ];

  return {
    purposes: result[0],
    keyType: result[1],
    key: result[2],
  };
}

/**
 * Returns the array of key hashes for a given `purpose` (1=MANAGEMENT,
 * 2=ACTION, 3=CLAIM, 4=ENCRYPTION).
 */
export async function getKeysByPurpose(
  identityAddress: Address,
  purpose: number,
  publicClient: PublicClient,
): Promise<`0x${string}`[]> {
  return publicClient.readContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'getKeysByPurpose',
    args: [BigInt(purpose)],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<
    `0x${string}`[]
  >;
}

/**
 * Returns `true` when `keyHash` has the specified `purpose` on the identity.
 */
export async function keyHasPurpose(
  identityAddress: Address,
  keyHash: `0x${string}`,
  purpose: number,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'keyHasPurpose',
    args: [keyHash, BigInt(purpose)],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

/**
 * Returns a claim by its `claimId` (keccak256 of issuer + claimType).
 */
export async function getClaim(
  identityAddress: Address,
  claimId: `0x${string}`,
  publicClient: PublicClient,
): Promise<Claim> {
  const result = (await publicClient.readContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'getClaim',
    args: [claimId],
  } as Parameters<typeof publicClient.readContract>[0])) as [
    bigint,
    bigint,
    Address,
    `0x${string}`,
    `0x${string}`,
    string,
  ];

  return {
    claimType: result[0],
    scheme: result[1],
    issuer: result[2],
    signature: result[3],
    data: result[4],
    uri: result[5],
  };
}

/**
 * Returns all claim IDs for a given `claimType` (topic).
 */
export async function getClaimIdsByTopic(
  identityAddress: Address,
  claimType: bigint,
  publicClient: PublicClient,
): Promise<`0x${string}`[]> {
  return publicClient.readContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'getClaimIdsByTopic',
    args: [claimType],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<
    `0x${string}`[]
  >;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Adds a key to the identity.
 * Caller must hold a MANAGEMENT key on the identity.
 *
 * @param keyHash  - keccak256 of the key (typically keccak256(abi.encode(address))).
 * @param purpose  - Key purpose (1=MANAGEMENT, 2=ACTION, 3=CLAIM, 4=ENCRYPTION).
 * @param keyType  - Key type (1=ECDSA, 2=RSA).
 */
export async function addKey(
  identityAddress: Address,
  keyHash: `0x${string}`,
  purpose: number,
  keyType: number,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'addKey',
    args: [keyHash, BigInt(purpose), BigInt(keyType)],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Removes a key from the identity.
 * Caller must hold a MANAGEMENT key.
 */
export async function removeKey(
  identityAddress: Address,
  keyHash: `0x${string}`,
  purpose: number,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'removeKey',
    args: [keyHash, BigInt(purpose)],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Adds a claim to the identity.
 * Caller must hold a CLAIM key or the identity itself must call this.
 */
export async function addClaim(
  identityAddress: Address,
  claimType: bigint,
  scheme: bigint,
  issuer: Address,
  signature: `0x${string}`,
  data: `0x${string}`,
  uri: string,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'addClaim',
    args: [claimType, scheme, issuer, signature, data, uri],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Removes a claim from the identity by its `claimId`.
 * Caller must hold a MANAGEMENT key.
 */
export async function removeClaim(
  identityAddress: Address,
  claimId: `0x${string}`,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: identityAddress,
    abi: IdentityABI,
    functionName: 'removeClaim',
    args: [claimId],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
