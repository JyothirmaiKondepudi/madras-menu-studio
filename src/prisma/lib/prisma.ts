import { PrismaClient } from "@prisma/client";

// fill in: a globalThis-backed singleton, same idea as a Spring @Bean
// singleton — construct once, reuse everywhere.

const prisma = globalThis as unknown as { prisma?: PrismaClient };


// then: outside production only, save `prisma` back onto globalForPrisma.prisma