import { PrismaClient } from "@prisma/client";

// Always ensure dotenv is loaded if we're in a Node.js environment
// This helps Prisma find PRISMA_CLIENT_ENGINE_TYPE and DATABASE_URL
if (typeof process !== 'undefined') {
  require('dotenv').config();
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
