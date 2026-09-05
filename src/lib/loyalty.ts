/**
 * TerminAI — Motor zvestobe (P4).
 *
 * Jedro "motorja" je OSEBNI ritem stranke namesto fiksnih pravil:
 *  1. Pametni win-back: Ana, ki pride na 5 tednov, je "izgubljena" že po
 *     ~7 tednih; stranka z 12-tedenskim ritmom se alarm šele po ~17.
 *     Ritem izračunamo iz mediane razmikov med njenimi preteklimi obiski
 *     (padec nazaj na recurWeeks zadnjega termina, nazadnje 8 tednov).
 *  2. Predlog naslednjega obiska (pametni rebooking): ob zaključku obiska
 *     sistem predlaga datum po ritemu stranke, pripet na njen običajni
 *     dan v tednu — frizerka ga samo potrdi.
 *
 * Vse ostaja lokalno (SQLite) — brez naročnin, brez oblaka.
 */

import { db } from '@/lib/db'
import { nowWallClock, dateKey, dayNameFull, formatDayLabel } from './booking'
import { recurrenceLabel } from './labels'

const DAY_MS = 86_400_000

export interface WinbackDto {
  id: string
  name: string
  phone: string
  /** Koliko tednov nazaj je bil zadnji obisk. */
  weeksSince: number
  /** Osebni ritem v tednih (null = brez vzorca → uporabi privzeti prag). */
  typicalWeeks: number | null
  serviceId: string | null
  lastService: string | null
  lastVisitLabel: string
  /** Predlagan datum za rebooking "YYYY-MM-DD" (zarolan naprej, če je rok mimo). */
  suggestedDate: string | null
  suggestedLabel: string | null
}

export interface RebookSuggestion {
  date: string // YYYY-MM-DD
  label: string // "Petek, 9. okt."
  reason: string // "vsake 4 tedne" / "običajno vsakih 5 tednov"
}

/** Mediana razmikov (v dneh) med zaporednimi obiski; null, če ni vsaj 2 razmikov. */
function medianGapDays(visitDates: Date[]): number | null {
  if (visitDates.length < 3) return null
  const sorted = [...visitDates].sort((a, b) => a.getTime() - b.getTime())
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const g = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / DAY_MS)
    if (g > 3 && g < 365) gaps.push(g) // 3+ dni in < 1 leto — sicer gre za naključni obisk
  }
  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2)
}

/**
 * Osebni ritem stranke v tednih:
 * mediana razmikov → recurWeeks zadnjega termina → null (neznan ritem).
 * Čista funkcija — uporabljena tudi v /api/clients za pametni filter.
 */
export function typicalWeeksOf(visitDates: Date[], lastRecurWeeks: number | null): number | null {
  const med = medianGapDays(visitDates)
  if (med) return Math.max(1, Math.round(med / 7))
  if (lastRecurWeeks && lastRecurWeeks > 0) return lastRecurWeeks
  return null
}

/** Prag "dolgo je ni": 1,45× osebnega ritma (min. 4 tedne), brez ritma 8 tednov. */
export function staleThresholdWeeks(typicalWeeks: number | null): number {
  if (!typicalWeeks) return 8
  return Math.max(4, Math.round(typicalWeeks * 1.45))
}

function dayStartMs(d: Date): number {
  return new Date(`${dateKey(d)}T00:00:00Z`).getTime()
}

/** Berljiva oznaka dneva: "Petek, 9. okt." */
function dayLabel(dateStr: string): string {
  return `${dayNameFull(dateStr)}, ${formatDayLabel(dateStr)}`
}

/**
 * Win-back kandidati: stranke BREZ prihajajočega termina, katerih zadnji
 * obisk je čez NJIHOV prag. Razvrščeni po "nujnosti" (dnevi od obiska ÷ prag).
 */
export async function getWinbackCandidates(): Promise<WinbackDto[]> {
  const now = nowWallClock()
  const todayMs = dayStartMs(now)
  const thisYear = now.getUTCFullYear()

  const clients = await db.client.findMany({
    include: {
      appointments: {
        where: { status: { notIn: ['cancelled', 'no_show'] } },
        select: {
          startAt: true,
          recurWeeks: true,
          serviceId: true,
          service: { select: { name: true } },
        },
        orderBy: { startAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const scored: Array<WinbackDto & { ratio: number }> = []

  for (const c of clients) {
    if (c.appointments.length === 0) continue

    // Prihajajoči termin → ni kandidat (sistem jo že "drži")
    if (c.appointments.some((a) => a.startAt.getTime() > now.getTime())) continue

    const last = c.appointments[0] // desc → zadnji obisk
    const lastVisitMs = dayStartMs(last.startAt)
    const daysSince = Math.round((todayMs - lastVisitMs) / DAY_MS)
    if (daysSince < 14) continue // manj kot 2 tedni — še ni alarm

    const typicalWeeks = typicalWeeksOf(
      c.appointments.map((a) => a.startAt),
      last.recurWeeks
    )
    const thresholdDays = staleThresholdWeeks(typicalWeeks) * 7
    if (daysSince < thresholdDays) continue

    // Predlagan datum: zadnji obisk + ritem, zarolan naprej čez danes
    let suggestedDate: string | null = null
    let suggestedLabel: string | null = null
    if (typicalWeeks) {
      let due = new Date(lastVisitMs + typicalWeeks * 7 * DAY_MS)
      while (due.getTime() < todayMs + DAY_MS) {
        due = new Date(due.getTime() + typicalWeeks * 7 * DAY_MS)
      }
      if (due.getTime() <= todayMs + 30 * DAY_MS) {
        suggestedDate = dateKey(due)
        suggestedLabel = dayLabel(suggestedDate)
      }
    }

    const y = last.startAt.getUTCFullYear()
    scored.push({
      id: c.id,
      name: c.name,
      phone: c.phone,
      weeksSince: Math.floor(daysSince / 7),
      typicalWeeks,
      serviceId: last.serviceId,
      lastService: last.service.name,
      lastVisitLabel:
        y === thisYear
          ? `${last.startAt.getUTCDate()}.${last.startAt.getUTCMonth() + 1}.`
          : `${last.startAt.getUTCDate()}.${last.startAt.getUTCMonth() + 1}. ${y}`,
      suggestedDate,
      suggestedLabel,
      ratio: daysSince / thresholdDays,
    })
  }

  return scored
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 12)
    .map(({ ratio: _ratio, ...rest }) => rest)
}

/**
 * Predlog naslednjega obiska za pravkar zaključen termin:
 *  1. recurWeeks termina → danes + N tednov (isti dan v tednu kot obisk)
 *  2. sicer osebna mediana stranke → obisk + mediana dni, pripeto na
 *     dan v tednu obiska (stranke prihajajo "svoj" dan)
 *  3. brez vzorca → null (klasični ročni vnos)
 */
export async function suggestNextVisit(appointmentId: string): Promise<RebookSuggestion | null> {
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      client: {
        include: {
          appointments: {
            where: { status: { notIn: ['cancelled', 'no_show'] } },
            select: { startAt: true },
            orderBy: { startAt: 'asc' },
          },
        },
      },
    },
  })
  if (!appt) return null

  const now = nowWallClock()
  const todayMs = dayStartMs(now)

  // 1) Ponavljajoči ritem iz termina (najmočnejši signal)
  if (appt.recurWeeks && appt.recurWeeks > 0) {
    const d = new Date(todayMs + appt.recurWeeks * 7 * DAY_MS)
    return {
      date: dateKey(d),
      label: dayLabel(dateKey(d)),
      reason: recurrenceLabel(appt.recurWeeks),
    }
  }

  // 2) Osebni ritem stranke — mediana razmikov med preteklimi obiski
  const past = appt.client.appointments.filter((a) => a.startAt.getTime() <= now.getTime())
  const med = medianGapDays(past.map((a) => a.startAt))
  if (!med) return null

  const visitDayMs = dayStartMs(appt.startAt)
  let target = new Date(visitDayMs + med * DAY_MS)

  // Pripet na dan v tednu obiska (najbližji isti dan)
  const want = appt.startAt.getUTCDay()
  const diff = (want - target.getUTCDay() + 7) % 7
  const fwd = new Date(target.getTime() + diff * DAY_MS)
  const bwd = new Date(target.getTime() - ((7 - diff) % 7) * DAY_MS)
  target = fwd.getTime() - target.getTime() <= target.getTime() - bwd.getTime() ? fwd : bwd

  // Varna mreža: nikoli v preteklosti
  if (target.getTime() <= todayMs) target = new Date(todayMs + 7 * DAY_MS)

  return {
    date: dateKey(target),
    label: dayLabel(dateKey(target)),
    reason: `običajno ${recurrenceLabel(Math.max(1, Math.round(med / 7)))}`,
  }
}
