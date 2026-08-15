/**
 * ERC-3643 Token contract helpers (viem).
 *
 * The token proxy implements IToken (ERC-20 + pause / freeze / burn /
 * identity-registry access).  Import this module to obtain a typed viem
 * contract instance pointing at the correct proxy for the connected chain.
 */

import {
  getContract,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
} from 'viem';
import TokenABI from './abi/token.json';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenInfo = {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  paused: boolean;
  owner: string;
  identityRegistry: string;
  compliance: string;
};

// ─── ABI (re-export for use with wagmi hooks) ─────────────────────────────────

export { TokenABI };

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns a viem contract instance for the ERC-3643 token at `address`.
 *
 * Pass a `PublicClient` for read-only access, or a `WalletClient` (or both
 * via `{ public: publicClient, wallet: walletClient }`) for read+write.
 *
 * @example
 * const token = getTokenContract(address, publicClient);
 * const name  = await token.read.name();
 */
export function getTokenContract(
  address: Address,
  client: PublicClient | WalletClient,
) {
  return getContract({
    address,
    abi: TokenABI,
    client,
  } as Parameters<typeof getContract>[0]);
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Fetches core token metadata concurrently.
 */
export async function getTokenInfo(
  address: Address,
  publicClient: PublicClient,
): Promise<TokenInfo> {
  const read = (functionName: string, args: unknown[] = []) =>
    publicClient.readContract({
      address,
      abi: TokenABI,
      functionName,
      args,
    } as Parameters<typeof publicClient.readContract>[0]);

  const [name, symbol, decimals, totalSupply, paused, owner, ir, compliance] =
    await Promise.all([
      read('name'),
      read('symbol'),
      read('decimals'),
      read('totalSupply'),
      read('paused'),
      read('owner'),
      read('identityRegistry'),
      read('compliance'),
    ]);

  return {
    name: name as string,
    symbol: symbol as string,
    decimals: decimals as number,
    totalSupply: totalSupply as bigint,
    paused: paused as boolean,
    owner: owner as string,
    identityRegistry: ir as string,
    compliance: compliance as string,
  };
}

/**
 * Returns the raw token balance (bigint) for `walletAddress`.
 * Use `formatUnits(balance, decimals)` for display.
 */
export async function getTokenBalance(
  tokenAddress: Address,
  walletAddress: Address,
  publicClient: PublicClient,
): Promise<bigint> {
  return publicClient.readContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'balanceOf',
    args: [walletAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<bigint>;
}

/**
 * Returns `true` when `walletAddress` holds the Agent role on the token.
 */
export async function checkIsAgent(
  tokenAddress: Address,
  walletAddress: Address,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'isAgent',
    args: [walletAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

/**
 * Returns `true` when `walletAddress` is frozen on the token.
 */
export async function isAddressFrozen(
  tokenAddress: Address,
  walletAddress: Address,
  publicClient: PublicClient,
): Promise<boolean> {
  return publicClient.readContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'isFrozen',
    args: [walletAddress],
  } as Parameters<typeof publicClient.readContract>[0]) as Promise<boolean>;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Pauses all token transfers.  Caller must be the token owner / agent.
 * Returns the transaction hash.
 */
export async function pauseToken(
  tokenAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'pause',
    args: [],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Unpauses token transfers.  Returns the transaction hash.
 */
export async function unpauseToken(
  tokenAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'unpause',
    args: [],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Freezes or unfreezes a wallet address.  Caller must be an agent.
 */
export async function setAddressFrozen(
  tokenAddress: Address,
  walletAddress: Address,
  frozen: boolean,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'setAddressFrozen',
    args: [walletAddress, frozen],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Mints `amount` tokens to `toAddress`.  Caller must be an agent.
 */
export async function mintTokens(
  tokenAddress: Address,
  toAddress: Address,
  amount: bigint,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'mint',
    args: [toAddress, amount],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Burns `amount` tokens from `fromAddress`.  Caller must be an agent.
 */
export async function burnTokens(
  tokenAddress: Address,
  fromAddress: Address,
  amount: bigint,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'burn',
    args: [fromAddress, amount],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Adds `agentAddress` as an agent on the token.  Caller must be the owner.
 */
export async function addTokenAgent(
  tokenAddress: Address,
  agentAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'addAgent',
    args: [agentAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Removes `agentAddress` from the agent role on the token.  Caller must be the owner.
 */
export async function removeTokenAgent(
  tokenAddress: Address,
  agentAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'removeAgent',
    args: [agentAddress],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Forces a transfer from `from` to `to`.  Caller must be an agent.
 */
export async function forcedTransfer(
  tokenAddress: Address,
  from: Address,
  to: Address,
  amount: bigint,
  walletClient: WalletClient,
  publicClient: PublicClient,
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: TokenABI,
    functionName: 'forcedTransfer',
    args: [from, to, amount],
    account: walletClient.account!,
    chain: walletClient.chain,
  } as Parameters<typeof walletClient.writeContract>[0]);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
