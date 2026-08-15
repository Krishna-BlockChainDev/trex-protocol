import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  sepolia,
  mainnet,
  bscTestnet,
  polygonAmoy,
  hardhat,
} from 'wagmi/chains';
import { http } from 'wagmi';

/**
 * Wagmi + RainbowKit config
 *
 * - connectors  : MetaMask (injected) + WalletConnect are included automatically
 *                 by getDefaultConfig when a projectId is supplied.
 * - chains      : Sepolia first → default network for new connections.
 *                 Hardhat localhost (chainId 31337) is included for local dev.
 * - ssr: true   : Required for Next.js Pages Router; wagmi persists the
 *                 connector state in localStorage and auto-reconnects on load.
 * - transports  : RPC calls for Sepolia, Mainnet, BSC Testnet and Polygon Amoy
 *                 are proxied through /api/rpc/[chainId] so that provider API
 *                 keys (Infura / Alchemy) are kept server-side and are never
 *                 baked into the JS bundle.  Set SEPOLIA_RPC_URL /
 *                 MAINNET_RPC_URL / BSC_TESTNET_RPC_URL /
 *                 POLYGON_AMOY_RPC_URL in your server environment (no
 *                 NEXT_PUBLIC_ prefix).
 *
 *                 Hardhat connects directly to http://127.0.0.1:8545 (the
 *                 default Hardhat node port) — no proxy needed.
 */
export const config = getDefaultConfig({
  appName: 'ERC-3643 T-REX',
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  chains: [sepolia, bscTestnet, polygonAmoy, mainnet, hardhat],
  transports: {
    // Requests are proxied through /api/rpc/[chainId].
    // The real provider URL (+ API key) lives in server-side env vars.
    [sepolia.id]: http(`/api/rpc/${sepolia.id}`),
    [bscTestnet.id]: http(`/api/rpc/${bscTestnet.id}`),
    [polygonAmoy.id]: http(`/api/rpc/${polygonAmoy.id}`),
    [mainnet.id]: http(`/api/rpc/${mainnet.id}`),
    // Hardhat node runs locally — connect directly, no proxy.
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
  ssr: true,
});
