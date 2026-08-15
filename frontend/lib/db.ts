/**
 * Prisma client singleton for Next.js
 *
 * In development, Next.js fast-refresh re-runs module code on every HMR update.
 * Without the global singleton guard each reload would open a new DB connection
 * pool and exhaust the database's max_connections limit quickly.
 *
 * The pattern below stores the single PrismaClient instance on the Node.js
 * `global` object so it survives HMR reloads in development while production
 * always creates a single instance at module load time.
 *
 * Reference: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management#prevent-hot-reloading-from-creating-new-instances-of-prisma-client
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
