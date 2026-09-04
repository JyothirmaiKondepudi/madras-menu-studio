import { PrismaClient } from "@prisma/client";

// Next.js hot-reloads server code in dev, which would otherwise construct a
// brand new PrismaClient (and a brand new pool of DB connections) on every
// single file save. Stashing the instance on `globalThis` survives reloads,
// so dev mode reuses one client instead of slowly exhausting your database's
// connection limit. In production there's only one instance anyway (no hot
// reload), so the extra bookkeeping there is skipped.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
