import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { closedDayReason, ensureHolidays } from '@/lib/holidays'
import type { Service } from '@prisma/client'

/**
 * TerminAI — jedro rezervacijske logike.
 *
 * Časi hranimo kot "naivne" UTC podatke: wall-clock iz Ljubljane
 * zapišemo kot UTC, tako je prikaz deterministicen ne glede na strežniški TZ.
 */

export const BUSINESS_SLUG = 'studio-aura'

// Privzeti delovni časi (0 = nedelja ... 6 = sobota) — uporabijo se kot
// začetna vrednost, dokler salon ne nastavi svojih v modulu Delovni čas.
const DEFAULT_HOURS: Record<number, { open: string; close: string } | null> = {
  0: null, // nedelja - zaprto
  1: { open: '09:00', close: '18:00' },
  2: { open: '09:00', close: '18:00' },
  3: { open: '09:00', close: '18:00' },
  4: { open: '09:00', close: '18:00' },
  5: { open: '09:00', close: '18:00' },
  6: { open: '09:00', close: '13:00' }, // sobota
}

const SLOT_STEP_MIN = 30

/** Pretvori "YYYY-MM-DD" + "HH:mm" v Date (UTC wall-clock). */
export function naiveDate(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0))
}

/** "YYYY-MM-DD" iz Date (po UTC wall-clock). */
export function dateKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Danes v Ljubljanskem wall-clocku glede na strežniški čas. */
export function todayKey(): string {
  const now = new Date()
  return dateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())))
}

export function nowWallClock(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()))
}

/** "HH:mm" iz Date. */
export function timeKey(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60000)
}

export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isPeak(dateStr: string, time: string): boolean {
  const dow = dayOfWeek(dateStr)
  if (dow === 6) return true // sobota = vršni dan
  if (dow === 0) return false
  return time >= '15:00' // delavnik popoldne
}

export interface DayHours {
  open: string
  close: string
  breakStart: string | null
  breakEnd: string | null
}

export function getHoursForDay(dateStr: string): DayHours | null {
  const h = DEFAULT_HOURS[dayOfWeek(dateStr)]
  return h ? { ...h, breakStart: null, breakEnd: null } : null
}

/** Prenese privzete ure v bazo (idempotentno) — prvi zagon. */
async function seedDefaultHours(businessId: string): Promise<void> {
  const existing = await db.workingHours.count({ where: { businessId } })
  if (existing > 0) return
  const rows = Object.entries(DEFAULT_HOURS)
    .filter(([, h]) => h !== null)
    .map(([day, h]) => ({ businessId, dayOfWeek: Number(day), open: (h as { open: string; close: string }).open, close: (h as { open: string; close: string }).close }))
  if (rows.length > 0) {
    await db.workingHours.createMany({ data: rows })
  }
}

/** Delovni časi salona iz baze (z avtomatskim sejanjem privzetih). */
export async function getBusinessHours(): Promise<Map<number, DayHours>> {
  const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG }, select: { id: true } })
  if (!business) return new Map()
  let rows = await db.workingHours.findMany({ where: { businessId: business.id } })
  if (rows.length === 0) {
    await seedDefaultHours(business.id)
    rows = await db.workingHours.findMany({ where: { businessId: business.id } })
  }
  return new Map(
    rows.map((r) => [r.dayOfWeek, { open: r.open, close: r.close, breakStart: r.breakStart, breakEnd: r.breakEnd }])
  )
}

/**
 * Delovni čas za konkretan datum — null, če je dan zaprt:
 * tedensko zaprt (npr. nedelja) ALI posebej zaprt dan (praznik, dopust).
 * Vsi klicoči (termini, sporočila, statistika) to enako upoštevajo.
 */
export async function getHoursForDayAsync(dateStr: string): Promise<DayHours | null> {
  if (await closedDayReason(dateStr)) return null
  const hours = await getBusinessHours()
  return hours.get(dayOfWeek(dateStr)) ?? null
}

export interface Slot {
  time: string
  available: boolean
  peak: boolean
  priceCents: number
}

export interface AppointmentBlock {
  startAt: Date
  endAt: Date
}

/** Zgenerira vse možne terminske lokacije za storitev na dan. Ure so lahko podane (iz baze). */
export function generateSlots(service: Service, dateStr: string, blocks: AppointmentBlock[], hours?: DayHours | null): Slot[] {
  const dayHours = hours !== undefined ? hours : getHoursForDay(dateStr)
  if (!dayHours) return []

  const open = naiveDate(dateStr, dayHours.open)
  const close = naiveDate(dateStr, dayHours.close)
  // Premor (npr. 12:00–13:00): v tem oknu termini ne smejo potekati
  const breakStart = dayHours.breakStart ? naiveDate(dateStr, dayHours.breakStart) : null
  const breakEnd = dayHours.breakEnd ? naiveDate(dateStr, dayHours.breakEnd) : null
  // Priprava/razkuževanje po storitvi (buffer) — termin + priprava morata skupaj speti
  const bufferMin = service.bufferMin ?? 0
  const now = nowWallClock()
  const slots: Slot[] = []

  for (let t = open; addMinutes(t, service.durationMin + bufferMin) <= close; t = addMinutes(t, SLOT_STEP_MIN)) {
    const start = t
    const end = addMinutes(t, service.durationMin + bufferMin)
    const time = timeKey(start)
    const overlaps = blocks.some((b) => start < b.endAt && end > b.startAt)
    const inBreak = breakStart !== null && breakEnd !== null && start < breakEnd && end > breakStart
    const past = start <= addMinutes(now, 0)
    const peak = isPeak(dateStr, time)
    slots.push({
      time,
      available: !overlaps && !inBreak && !past,
      peak,
      priceCents: peak ? service.peakPriceCents : service.priceCents,
    })
  }
  return slots
}

/** Se naslednjih N dni (vključno z današnjim). */
export function nextDays(n: number): string[] {
  const out: string[] = []
  const base = naiveDate(todayKey(), '00:00')
  for (let i = 0; i < n; i++) out.push(dateKey(addMinutes(base, i * 1440)))
  return out
}

const DAY_NAMES_SLO = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob']
const DAY_NAMES_SLO_FULL = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
const MONTH_NAMES_SLO = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec']

export function dayNameShort(dateStr: string): string {
  return DAY_NAMES_SLO[dayOfWeek(dateStr)]
}
export function dayNameFull(dateStr: string): string {
  return DAY_NAMES_SLO_FULL[dayOfWeek(dateStr)]
}
export function formatDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${d}. ${MONTH_NAMES_SLO[m - 1]}`
}
export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(0)} €`
}
export function formatDateTimeShort(d: Date): string {
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}. ${timeKey(d)}`
}

/** Zagotovi, da demo podatki obstajajo (idempotentno). */
export async function ensureSeed(): Promise<void> {
  const count = await db.service.count()
  if (count > 0) return
  await seedDemo()
}

export async function seedDemo(): Promise<void> {
  const business = await db.business.create({
    data: {
      name: 'Studio Aura',
      slug: BUSINESS_SLUG,
      tagline: 'Frizerski & lepotni salon, Ljubljana center',
      city: 'Ljubljana',
      address: 'Trubarjeva 27, 1000 Ljubljana',
      phone: '+386 40 123 456',
      email: 'info@studio-aura.si',
    },
  })
  await seedDefaultHours(business.id)
  // Slovenski prazniki za tekoče in naslednje leto (demo od prvega zagona "ve",
  // kdaj je salon zaprt)
  const year = new Date().getUTCFullYear()
  await ensureHolidays([year, year + 1])

  const services = await Promise.all(
    [
      { name: 'Striženje — ženske', description: 'Svetovanje, prha, striženje in oblikovanje', durationMin: 45, priceCents: 3500, peakPriceCents: 4200, sortOrder: 1 },
      { name: 'Striženje — moški', description: 'Klasično ali moderno striženje s prho', durationMin: 30, priceCents: 2200, peakPriceCents: 2600, sortOrder: 2 },
      { name: 'Barvanje + prha', description: 'Kompletno barvanje z negovalno prho', durationMin: 120, priceCents: 8500, peakPriceCents: 9800, sortOrder: 3 },
      { name: 'Morjenje / prha', description: 'Trajno oblikovanje ali samo prha z nego', durationMin: 30, priceCents: 1800, peakPriceCents: 2100, sortOrder: 4 },
      { name: 'Poroka — styling', description: 'Svečana priprava las z vajo vnaprej', durationMin: 90, priceCents: 6500, peakPriceCents: 7500, sortOrder: 5 },
    ].map((s) =>
      db.service.create({
        data: {
          ...s,
          businessId: business.id,
          category: 'Frizerske storitve',
        },
      })
    )
  )

  const clientsData = [
    { name: 'Ana Novak', phone: '+386 41 555 123' },
    { name: 'Marko Kovač', phone: '+386 31 444 789' },
    { name: 'Petra Zupan', phone: '+386 51 333 256' },
    { name: 'Luka Bizjak', phone: '+386 30 222 914' },
    { name: 'Maja Kos', phone: '+386 70 111 652' },
    { name: 'Tina Hočevar', phone: '+386 41 900 340' },
  ]
  const clients = await Promise.all(clientsData.map((c) => db.client.create({ data: c })))

  // Današnji termini (glede na trenutni dan)
  const today = todayKey()
  const tomorrowKey = dateKey(addMinutes(naiveDate(today, '00:00'), 1440))
  const dayAfterKey = dateKey(addMinutes(naiveDate(today, '00:00'), 2880))

  const mk = (serviceIdx: number, clientIdx: number, dateStr: string, time: string, status: string, recurWeeks?: number) => {
    const svc = services[serviceIdx]
    const start = naiveDate(dateStr, time)
    const peak = isPeak(dateStr, time)
    return {
      serviceId: svc.id,
      clientId: clients[clientIdx].id,
      startAt: start,
      endAt: addMinutes(start, svc.durationMin),
      priceCents: peak ? svc.peakPriceCents : svc.priceCents,
      status,
      recurWeeks: recurWeeks ?? null,
      cancelToken: randomUUID().replace(/-/g, '').slice(0, 12),
    }
  }

  // Zgodovina za predstavitev ponavljajočih terminov (28 dni nazaj)
  const monthAgoKey = dateKey(addMinutes(naiveDate(today, '00:00'), -28 * 1440))
  const threeWeeksAgoKey = dateKey(addMinutes(naiveDate(today, '00:00'), -21 * 1440))

  // Bogata zgodovina za poročila (~40 dni nazaj, 2–4 obiski na delovnik).
  // Določilen vzorec (ne naključnost), da demo vedno izgleda enako —
  // vključene tudi redke odpovedi in izostanki za realne KPI-je.
  const PATTERN: Array<[number, string]> = [
    [0, '09:00'], [1, '10:30'], [2, '14:00'], [1, '16:30'],
    [0, '11:00'], [3, '15:00'], [0, '09:30'], [2, '13:00'],
  ]
  const history: ReturnType<typeof mk>[] = []
  let seq = 0
  for (let back = 41; back >= 2; back--) {
    const dayKey = dateKey(addMinutes(naiveDate(today, '00:00'), -back * 1440))
    if (dayOfWeek(dayKey) === 0) continue // nedelja — zaprto
    if (back === 28 || back === 21) continue // dneva zgodbe ponavljanj pustimo čista
    const dayIdx = 41 - back
    const count = 2 + (dayIdx % 3) // 2–4 obiski na dan
    for (let i = 0; i < count; i++) {
      const [svcIdx, time] = PATTERN[(dayIdx * 3 + i * 2) % PATTERN.length]
      seq++
      const status = seq % 17 === 5 ? 'cancelled' : seq % 23 === 7 ? 'no_show' : 'completed'
      history.push(mk(svcIdx, (dayIdx + i) % clients.length, dayKey, time, status))
    }
  }

  await db.appointment.createMany({
    data: [
      ...history,
      // Ponavljajoči stranki — "kdo je na vrsti" (zgodovina)
      mk(2, 2, monthAgoKey, '10:00', 'completed', 4), // Petra Zupan — barvanje vsake 4 tedne
      mk(1, 1, threeWeeksAgoKey, '11:00', 'completed', 3), // Marko Kovač — striženje vsaka 3 tedna
      mk(0, 0, today, '09:30', 'confirmed'),
      mk(1, 1, today, '11:00', 'completed'),
      mk(3, 2, today, '13:00', 'confirmed'),
      mk(0, 3, today, '16:00', 'pending'),
      mk(2, 4, tomorrowKey, '10:00', 'confirmed', 4), // Maja Kos — barvanje vsake 4 tedne
      mk(1, 5, tomorrowKey, '12:30', 'pending'),
      mk(0, 1, dayAfterKey, '15:30', 'confirmed'),
    ],
  })
}
