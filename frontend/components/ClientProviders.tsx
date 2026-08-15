import { ReactNode, useSyncExternalStore } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { TokenRegistryProvider } from '@/contexts/TokenRegistryContext';

const queryClient = new QueryClient();

/**
 * useSyncExternalStore-based mount guard.
 * Returns `true` on the client after hydration, `false` on the server.
 * This is the React team's recommended way to handle server/client divergence
 * without triggering the React Compiler ESLint rules.
 */
function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {}, // subscribe – no-op (value never changes)
    () => true, // client snapshot
    () => false, // server snapshot
  );
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  const mounted = useIsMounted();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {/* TokenRegistryProvider must be inside WagmiProvider so it can
              call useChainId(); it wraps children so all pages have access. */}
          <TokenRegistryProvider>
            {mounted ? children : null}
          </TokenRegistryProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
