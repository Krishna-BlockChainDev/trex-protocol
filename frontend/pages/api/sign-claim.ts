/**
 * POST /api/sign-claim
 *
 * Server-side claim signing endpoint.
 *
 * The Issuer private key NEVER leaves the server — it is read from the
 * `ISSUER_PRIVATE_KEY` environment variable (set in .env.local, never
 * prefixed with NEXT_PUBLIC_).
 *
 * Request body:
 *   { identityAddress: string; topic: number; data: string }
 *
 * Response (200):
 *   { signature: `0x${string}`; dataHex: `0x${string}`; signerAddress: string }
 *
 * Response (4xx / 5xx):
 *   { error: string }
 *
 * Signing formula (matches OnchainID / T-REX standard):
 *   hash      = keccak256(abi.encode(identityAddress, topic, dataBytes))
 *   signature = eth_sign(hash)        // personal_sign adds the \x19 prefix
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  encodeAbiParameters,
  keccak256,
  stringToHex,
  fromHex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Response types ───────────────────────────────────────────────────────────

type SuccessBody = {
  /** ECDSA signature (65 bytes, hex). */
  signature: `0x${string}`;
  /** Hex-encoded UTF-8 bytes of the claim data. */
  dataHex: `0x${string}`;
  /** Ethereum address of the signing wallet (for debug / display). */
  signerAddress: string;
};

type ErrorBody = {
  error: string;
};

type ResponseBody = SuccessBody | ErrorBody;

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>,
) {
  // ── Method guard ────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed — use POST.' });
  }

  // ── Env guard ───────────────────────────────────────────────────────────────
  const rawKey = process.env.ISSUER_PRIVATE_KEY;
  if (!rawKey) {
    return res.status(500).json({
      error:
        'ISSUER_PRIVATE_KEY is not set. Add it to .env.local (server-side only).',
    });
  }

  // ── Input validation ────────────────────────────────────────────────────────
  const { identityAddress, topic, data } = req.body as {
    identityAddress?: unknown;
    topic?: unknown;
    data?: unknown;
  };

  if (
    typeof identityAddress !== 'string' ||
    !identityAddress.startsWith('0x')
  ) {
    return res.status(400).json({
      error: 'identityAddress must be a 0x-prefixed hex string.',
    });
  }
  // Accept topic as a number OR a string so callers can pass bigint-sized
  // values (e.g. keccak256("CLAIM_TOPIC") ≈ 77 decimal digits) that overflow
  // JavaScript's safe integer range.
  if (typeof topic !== 'number' && typeof topic !== 'string') {
    return res.status(400).json({
      error: 'topic must be a non-negative integer or numeric string.',
    });
  }
  let topicBigInt: bigint;
  try {
    topicBigInt = BigInt(topic);
    if (topicBigInt < BigInt(0)) throw new Error('negative');
  } catch {
    return res.status(400).json({
      error: 'topic must be a non-negative integer or numeric string.',
    });
  }
  if (typeof data !== 'string' || data.trim() === '') {
    return res.status(400).json({ error: 'data must be a non-empty string.' });
  }

  // ── Sign ────────────────────────────────────────────────────────────────────
  try {
    // Normalise private key: accept with or without leading 0x
    const normalised = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
    const account = privateKeyToAccount(normalised as `0x${string}`);

    // Encode claim data as UTF-8 hex bytes
    // This matches: ethers.utils.hexlify(ethers.utils.toUtf8Bytes(data))
    const dataHex = stringToHex(data.trim()) as `0x${string}`;

    // Compute the ERC-735 claim hash
    //   keccak256(abi.encode(address identityAddress, uint256 topic, bytes data))
    const abiHash = keccak256(
      encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
        [identityAddress as Address, topicBigInt, dataHex],
      ),
    );

    // Personal-sign the hash bytes (adds "\x19Ethereum Signed Message:\n32")
    // Matches: claimIssuerSigningKey.signMessage(ethers.utils.arrayify(hash))
    const hashBytes = fromHex(abiHash, 'bytes');
    const signature = await account.signMessage({
      message: { raw: hashBytes },
    });

    return res.status(200).json({
      signature,
      dataHex,
      signerAddress: account.address,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error during signing.';
    console.error('[sign-claim] Error:', message);
    return res.status(500).json({ error: message });
  }
}
