import { db } from '@/lib/db'

/**
 * TerminAI — slovenski državni prazniki + zaprti dnevi.
 *
 * Prazniki za vsako leto izračunamo iz koledarja (fiksni + velikonočni);
 * dopust ali drug zaprt dan doda lastnik ročno (model ClosedDay).
 */

interface Holiday {
  date: string // YYYY-MM-DD
  name: string
}

/** Velikonočna nedelja (gregorijanski computus, algoritem Meeusa/Jonesa/Butcherja). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function iso(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function plusDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 1440 * 60000)
}

/** Vsi slovenski državni prazniki za dano leto. */
export function slovenianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)
  const fixed: Holiday[] = [
    { date: `${year}-01-01`, name: 'novo leto' },
    { date: `${year}-01-02`, name: 'novo leto' },
    { date: `${year}-02-08`, name: 'Prešernov dan' },
    { date: `${year}-04-27`, name: 'dan upora proti okupatorju' },
    { date: `${year}-05-01`, name: 'praznik dela' },
    { date: `${year}-05-02`, name: 'praznik dela' },
    { date: `${year}-06-25`, name: 'dan državnosti' },
    { date: `${year}-11-01`, name: 'dan reformacije' },
    { date: `${year}-11-23`, name: 'dan Rudija Maclja' },
    { date: `${year}-12-25`, name: 'božič' },
    { date: `${year}-12-26`, name: 'dan samostojnosti in enotnosti' },
  ]
  const moveable: Holiday[] = [
    { date: iso(easter), name: 'velikonočna nedelja' },
    { date: iso(plusDays(easter, 1)), name: 'velikonočni ponedeljek' },
    { date: iso(plusDays(easter, 49)), name: 'binkošti' },
  ]
  return [...fixed, ...moveable]
}

/**
 * Zapiše praznike za podana leta v bazo (idempotentno — obstoječi datumi
 * se preskočijo). Vrne število novo dodanih dni.
 */
export async function ensureHolidays(years: number[]): Promise<number> {
  let added = 0
  for (const year of years) {
    for (const h of slovenianHolidays(year)) {
      const existing = await db.closedDay.findUnique({ where: { date: h.date } })
      if (existing) continue
      // Ne pišimo čez ročno dodan zaprt dan (npr. dopust) — reason ohranimo
      await db.closedDay.create({ data: { date: h.date, reason: `praznik — ${h.name}` } })
      added++
    }
  }
  return added
}

/** Razlog za zaprtost dneva (null = ordinary delovni dan). */
export async function closedDayReason(dateStr: string): Promise<string | null> {
  const row = await db.closedDay.findUnique({ where: { date: dateStr } })
  return row ? (row.reason ?? '') : null
}

/** Naslednjih N dni, vključno z današnjim (YYYY-MM-DD). */
export function upcomingDays(n: number, from: string): string[] {
  const [y, m, d] = from.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(iso(plusDays(base, i)))
  return out
}
