import { PrismaClient } from '@prisma/client'
import { databaseUrl, ensureDatabaseFile } from './vercel-db'

// Na Vercelu (serverless demo) baza živi v /tmp — datoteko pripravimo
// pred prvim odjemalcem. Lokalno je to no-op (.env ostaja avtoriteta).
ensureDatabaseFile()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: process.env.VERCEL ? ['error', 'warn'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
