/**
 * Identity Registry contract helpers (viem).
 *
 * The Identity Registry tracks which wallet addresses have a verified
 * on-chain identity (OnchainID) and stores each investor's country code.
 * It is the gatekeeper for T-REX token transfers.
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
} from 'viem';
import IdentityRegistryABI from './abi/identityRegistry.json';

// ─── ABI (re-export for use with wagmi hooks) ─────────────────────────────────

export { IdentityRegistryABI };

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Returns `true` when `investorAddress` is registered in the identity
 * registry AND holds a valid claim from a trusted issuer.
 */
export async function isVerified(
  registryAddress: Address,
  investorAddress: Address,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'isVerified',
    args: [investorAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

/**
 * Returns `true` when `investorAddress` has an identity registered
 * (without checking claim validity).
 */
export async function contains(
  registryAddress: Address,
  investorAddress: Address,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'contains',
    args: [investorAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

/**
 * Returns the OnchainID identity contract address for `investorAddress`.
 */
export async function getIdentityAddress(
  registryAddress: Address,
  investorAddress: Address,
  publicClient: PublicClient,
): Promise<Address> {
  return publicClient.readContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'identity',
    args: [investorAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<Address>;
}

/**
 * Returns the ISO-3166-1 numeric country code for `investorAddress`.
 */
export async function getInvestorCountry(
  registryAddress: Address,
  investorAddress: Address,
  publicClient: PublicClient,
): Promise<number> {
  return publicClient.readContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'investorCountry',
    args: [investorAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<number>;
}

/**
 * Returns the address of the Identity Registry Storage contract.
 */
export async function getIdentityRegistryStorage(
  registryAddress: Address,
  publicClient: PublicClient,
): Promise<Address> {
  return publicClient.readContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'identityStorage',
    args: [],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<Address>;
}

/**
 * Returns the Trusted Issuers Registry address linked to this registry.
 */
export async function getTrustedIssuersRegistry(
  registryAddress: Address,
  publicClient: PublicClient,
): Promise<Address> {
  return publicClient.readContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'issuersRegistry',
    args: [],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<Address>;
}

/**
 * Returns the Claim Topics Registry address linked to this registry.
 */
export async function getClaimTopicsRegistry(
  registryAddress: Address,
  publicClient: PublicClient,
): Promise<Address> {
  return publicClient.readContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'topicsRegistry',
    args: [],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<Address>;
}

/**
 * Returns `true` when `agentAddress` holds the Agent role on the Identity Registry.
 */
export async function checkIsRegistryAgent(
  registryAddress: Address,
  agentAddress: Address,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'isAgent',
    args: [agentAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Adds `agentAddress` as an agent on the Identity Registry.  Caller must be the owner.
 */
export async function addRegistryAgent(
  registryAddress: Address,
  agentAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'addAgent',
    args: [agentAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Removes `agentAddress` from the agent role on the Identity Registry.  Caller must be the owner.
 */
export async function removeRegistryAgent(
  registryAddress: Address,
  agentAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'removeAgent',
    args: [agentAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Registers a new investor identity.
 * Caller must be an agent of the Identity Registry.
 *
 * @param investorAddress  - The investor's wallet address.
 * @param identityAddress  - Their OnchainID contract address.
 * @param countryCode      - ISO-3166-1 numeric country code (e.g. 840 = USA).
 */
export async function registerIdentity(
  registryAddress: Address,
  investorAddress: Address,
  identityAddress: Address,
  countryCode: number,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'registerIdentity',
    args: [investorAddress, identityAddress, countryCode],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Updates the identity contract linked to `investorAddress`.
 * Caller must be an agent.
 */
export async function updateIdentity(
  registryAddress: Address,
  investorAddress: Address,
  newIdentityAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'updateIdentity',
    args: [investorAddress, newIdentityAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Updates the country code for `investorAddress`.
 * Caller must be an agent.
 */
export async function updateCountry(
  registryAddress: Address,
  investorAddress: Address,
  countryCode: number,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'updateCountry',
    args: [investorAddress, countryCode],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Removes an investor identity from the registry.
 * Caller must be an agent.
 */
export async function deleteIdentity(
  registryAddress: Address,
  investorAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'deleteIdentity',
    args: [investorAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Batch-registers multiple investor identities in one transaction.
 * Caller must be an agent.
 */
export async function batchRegisterIdentity(
  registryAddress: Address,
  investorAddresses: Address[],
  identityAddresses: Address[],
  countryCodes: number[],
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: IdentityRegistryABI,
    functionName: 'batchRegisterIdentity',
    args: [investorAddresses, identityAddresses, countryCodes],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
