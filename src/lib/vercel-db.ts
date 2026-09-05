/**
 * TerminAI — prilagoditev za Vercel (spletni demo).
 *
 * Vercelove serverless funkcije imajo EPHEMERAL datotečni sistem:
 * pisanje je možno le v /tmp, vse ostalo je samo za branje.
 * Zato baza SQLite na Vercelu živi v /tmp in se ob vsakem
 * "cold startu" (novo zaporedje funkcije) prepiše iz demo predloge
 * (db/demo-template.db, ki pride v funkcijo prek outputFileTracingIncludes).
 *
 * Lokalno (USB namestitev) se NIČ ne spremeni — uporabi se DATABASE_URL iz .env.
 *
 * Spletni demo je namenjen predstavitvi: vsak obisk se začne s svežimi
 * demo podatki (Studio Aura), spremembe niso trajno shranjene.
 */

import fs from 'node:fs'
import path from 'node:path'

/** Pot delovne (zapisljive) baze na Vercelu. */
export const RUNTIME_DB_PATH = '/tmp/terminai.db'

/** True, če tečemo znotraj Vercel serverless funkcije. */
export const isVercel = (): boolean => !!process.env.VERCEL

/**
 * URL podatkovnega vira za Prisma:
 * - Vercel:  file:/tmp/terminai.db (zapisljivo območje)
 * - lokalno: DATABASE_URL iz okolja (.env)
 */
export function databaseUrl(): string {
  if (isVercel()) return `file:${RUNTIME_DB_PATH}`
  return process.env.DATABASE_URL ?? 'file:./db/custom.db'
}

/** Kandidati za lokacijo demo predloge znotraj serverless funkcije. */
function templateCandidates(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, 'db', 'demo-template.db'),
    path.join(cwd, '..', 'db', 'demo-template.db'),
  ]
}

let ensured = false

/**
 * Enkrat na zagon funkcije (cold start) pripravi SQLite datoteko v /tmp:
 * kopira demo predlogo (Studio Aura + zgodovina + fotografije).
 * Sinhrono — pokliče se v src/lib/db.ts PRED konstrukcijo PrismaClienta.
 */
export function ensureDatabaseFile(): void {
  if (!isVercel() || ensured) return
  ensured = true

  if (fs.existsSync(RUNTIME_DB_PATH)) return

  const template = templateCandidates().find((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })

  try {
    if (template) {
      fs.copyFileSync(template, RUNTIME_DB_PATH)
      console.log('[vercel-db] demo predloga kopirana v /tmp:', template)
    } else {
      // Predloga ni prišla v paket — kreiraj vsaj prazno datoteko,
      // da napaka ostane berljiva (tabela ne obstaja) in ne ruši modula.
      fs.writeFileSync(RUNTIME_DB_PATH, Buffer.alloc(0))
      console.error('[vercel-db] OPOZORILO: demo-template.db ni najden v funkciji')
    }
  } catch (e) {
    console.error('[vercel-db] napaka pri pripravi baze v /tmp:', e)
  }
}
