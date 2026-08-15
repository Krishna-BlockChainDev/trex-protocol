import type { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';

/** Server-side only */
const RPC_URLS: Record<string, string> = {
  '11155111':
    process.env.SEPOLIA_RPC_URL ??
    'https://ethereum-sepolia-rpc.publicnode.com',
  '1': process.env.MAINNET_RPC_URL ?? 'https://cloudflare-eth.com',
  '97':
    process.env.BSC_TESTNET_RPC_URL ??
    'https://data-seed-prebsc-1-s1.binance.org:8545',
  '80002':
    process.env.POLYGON_AMOY_RPC_URL ?? 'https://rpc-amoy.polygon.technology',
};

/**
 * In some corporate/dev environments the outbound HTTPS traffic is intercepted
 * by a proxy that presents a self-signed certificate.  Node.js fetch (undici)
 * rejects these by default with SELF_SIGNED_CERT_IN_CHAIN.
 *
 * When NODE_TLS_REJECT_UNAUTHORIZED=0 is set in the environment we create a
 * custom HTTPS agent that skips certificate validation so the proxy can reach
 * the upstream RPC URL.  This flag should NEVER be set in production.
 */
const tlsAgent =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

/**
 * Perform an upstream fetch, optionally bypassing TLS certificate validation.
 * Uses the native node:https module when a permissive agent is needed because
 * the global fetch (undici) does not accept a Node https.Agent.
 */
async function upstreamFetch(
  url: string,
  body: string,
): Promise<{ status: number; data: unknown }> {
  // If no custom agent is needed, use the built-in global fetch.
  if (!tlsAgent) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data: unknown = await resp.json();
    return { status: resp.status, data };
  }

  // Corporate proxy / self-signed cert path: use node:https directly.
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      agent: tlsAgent,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 502, data: JSON.parse(text) });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Only JSON-RPC POST requests are valid.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const chainId = String(req.query.chainId);
  const rpcUrl = RPC_URLS[chainId];

  if (!rpcUrl) {
    res.status(400).json({ error: `Unsupported chainId: ${chainId}` });
    return;
  }

  try {
    const body = JSON.stringify(req.body);
    const { status, data } = await upstreamFetch(rpcUrl, body);
    // Mirror the upstream HTTP status (200 for success, 4xx/5xx on errors).
    res.status(status).json(data);
  } catch (err) {
    console.error('[rpc-proxy] upstream request failed', { chainId, err });
    res.status(502).json({ error: 'Bad Gateway — upstream RPC unreachable' });
  }
}
