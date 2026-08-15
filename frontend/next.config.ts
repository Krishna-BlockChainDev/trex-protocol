import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for Docker / ECS Fargate deployments.
  // Produces .next/standalone – a self-contained Node.js server
  // that does not need node_modules at runtime.
  output: 'standalone',
  transpilePackages: ['@rainbow-me/rainbowkit', 'antd', '@ant-design/icons'],

  async rewrites() {
    return [
      {
        source: '/v1/health-check',
        destination: '/api/v1/health-check',
      },
    ];
  },

  webpack(config) {
    // @metamask/sdk references @react-native-async-storage/async-storage, which
    // is a React Native-only package and does not exist in a browser build.
    // Alias it to an empty stub so webpack stops emitting the "Module not found"
    // warning without breaking any runtime behaviour.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'stubs/empty.js',
      ),
    };
    return config;
  },
};

export default nextConfig;
