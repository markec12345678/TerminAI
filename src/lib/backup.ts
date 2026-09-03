/**
 * TerminAI — samodejne varnostne kopije SQLite baze.
 *
 * Vsaka kopija je samostojen snapshot (VACUUM INTO) — varno tudi,
 * če strežnik ravno piše. Hranimo zadnjih 14 kopij v db/backups/.
 *
 * Ob vsakem zagonu strežnika (instrumentation.ts) se naredi kopija,
 * če je zadnja starejša od 24 ur; nato se preverja na vsake 6 ur.
 */

import fs from 'node:fs'
import path from 'node:path'
import { db } from './db'

const DB_URL = process.env.DATABASE_URL ?? ''
const MAX_BACKUPS = 14
const MIN_HOURS_BETWEEN = 24
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // preveri na 6 ur

/** Absolutna pot do mape z varnostnimi kopijami. */
export function backupsDir(): string {
  return path.join(process.cwd(), 'db', 'backups')
}

/** Ime trenutne baze (npr. "custom.db") iz DATABASE_URL. */
function dbFileName(): string {
  const clean = DB_URL.replace(/^file:/, '').split('?')[0]
  return path.basename(clean) || 'custom.db'
}

export interface BackupFileDto {
  name: string
  sizeBytes: number
  createdAt: string // ISO
  ageLabel: string
}

/** Seznam obstoječih kopij (najnovejše najprej). */
export function listBackups(): BackupFileDto[] {
  const dir = backupsDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const full = path.join(dir, f)
      const st = fs.statSync(full)
      return { name: f, sizeBytes: st.size, createdAt: st.mtime.toISOString(), ageLabel: ageLabel(st.mtime) }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function ageLabel(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'pravkar'
  if (mins < 60) return `pred ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `pred ${hours} ur${hours === 1 ? 'o' : hours === 2 ? 'ama' : hours === 3 || hours === 4 ? 'i' : ''}`
  const days = Math.floor(hours / 24)
  return `pred ${days} dnevi`
}

/** Ustvari novo varnostno kopijo (konzistenten snapshot prek VACUUM INTO). */
export async function createBackup(): Promise<BackupFileDto> {
  const dir = backupsDir()
  fs.mkdirSync(dir, { recursive: true })
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const target = path.join(dir, `${stamp}.db`)

  // VACUUM INTO naredi atomaren, samostojen snapshot tudi med pisanjem
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`)

  // Počisti stare kopije (drži zadnjih MAX_BACKUPS)
  const all = listBackups()
  for (const old of all.slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(backupsDir(), old.name))
    } catch {
      /* neuspešno brisanje ni kritično */
    }
  }

  const st = fs.statSync(target)
  return { name: path.basename(target), sizeBytes: st.size, createdAt: st.mtime.toISOString(), ageLabel: 'pravkar' }
}

/** Koliko ur je od zadnje kopije (null = še nobene). */
function hoursSinceLast(): number | null {
  const last = listBackups()[0]
  if (!last) return null
  return (Date.now() - new Date(last.createdAt).getTime()) / 3600000
}

/**
 * Zaženi vzdrževalno zanko: ob zagonu (če je zadnja kopija starejša od
 * 24 h) in nato preverjanje na vsakih 6 ur. Ne blokira zagona strežnika.
 */
export function startBackupScheduler(): void {
  const run = async () => {
    try {
      const hrs = hoursSinceLast()
      if (hrs === null || hrs >= MIN_HOURS_BETWEEN) {
        const b = await createBackup()
        console.log(`[TerminAI] Varnostna kopija ustvarjena: ${b.name} (${(b.sizeBytes / 1024).toFixed(0)} kB)`)
      }
    } catch (e) {
      console.warn('[TerminAI] Samodejna varnostna kopija ni uspela:', e instanceof Error ? e.message : e)
    }
  }
  // Prvi poskus po 5 s (pusti bazi, da se inicializira)
  setTimeout(() => void run(), 5000)
  const timer = setInterval(() => void run(), CHECK_INTERVAL_MS)
  // Ne drži procesa živega zaradi intervala
  if (typeof timer.unref === 'function') timer.unref()
}
