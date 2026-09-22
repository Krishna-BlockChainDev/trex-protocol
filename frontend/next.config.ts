import type { NextConfig } from 'next';
import path from 'path';

// Resolve the true root of this package (frontend/).
// This silences the "multiple lockfiles" warning Vercel emits when
// deploying a monorepo — Next.js was incorrectly walking up to the repo
// root and finding unrelated lockfiles in sibling packages.
const packageRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // Tell Next.js that frontend/ is the boundary for file-system tracing.
  // Moved to top-level in Next.js 15+ (was experimental.outputFileTracingRoot).
  outputFileTracingRoot: packageRoot,
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
