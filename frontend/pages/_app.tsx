import '@/styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { ConfigProvider, theme } from 'antd';

// Load the wallet provider stack only on the client – keeps pino /
// thread-stream (WalletConnect deps) out of the server bundle entirely.
const ClientProviders = dynamic(() => import('@/components/ClientProviders'), {
  ssr: false,
  loading: () => null,
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <ClientProviders>
        <Component {...pageProps} />
      </ClientProviders>
    </ConfigProvider>
  );
}
