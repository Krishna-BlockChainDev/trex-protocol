import type { NextConfig } from 'next';
import path from 'path';

// Vercel sets VERCEL=1 in its build environment automatically.
// outputFileTracingRoot must NOT be set on Vercel — it causes Vercel's
// deployment scanner to mis-locate .next/routes-manifest-deterministic.json
// (ENOENT). Locally it silences the "multiple lockfiles" warning caused by
// Next.js walking up to the monorepo root.
const isVercel = Boolean(process.env.VERCEL);
const packageRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // Only set when running locally in the monorepo context (not on Vercel).
  ...(!isVercel ? { outputFileTracingRoot: packageRoot } : {}),

  reactStrictMode: true,

  // 'standalone' output is required for Docker / ECS Fargate deployments —
  // it produces .next/standalone, a self-contained Node.js server with no
  // node_modules at runtime.
  //
  // Vercel manages its own serverless packaging and is INCOMPATIBLE with
  // 'standalone' mode.  Set NEXT_OUTPUT_MODE=standalone in the environment
  // (e.g. in the Docker build step) to enable it; leave it unset for Vercel.
  ...(process.env.NEXT_OUTPUT_MODE === 'standalone'
    ? { output: 'standalone' }
    : {}),

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
