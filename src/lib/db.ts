import { PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads in dev; Next.js re-evaluates modules on
// every change and would otherwise exhaust the Postgres connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
