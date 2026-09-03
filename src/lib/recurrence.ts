/**
 * TerminAI — ponavljajoči se termini ("barvanje vsake 4 tedne").
 *
 * Vsak termin lahko nosi recurWeeks (npr. 4). Iz zadnjega obiska
 * izračunamo "kdo je na vrsti": naslednji predvideni obisk je
 * startAt + recurWeeks tednov. Če je stranka po zadnjem ponavljajočem
 * obisku že imela nov termin za isto storitev, je "pokrita".
 */

import { db } from '@/lib/db'
import { nowWallClock, dateKey, dayNameShort, formatDateTimeShort } from './booking'

export interface RecurrenceEntryDto {
  appointmentId: string
  client: { id: string; name: string; phone: string }
  service: { id: string; name: string }
  recurWeeks: number
  lastVisit: string // ISO
  lastVisitLabel: string
  nextDue: string // ISO
  nextDueDate: string // YYYY-MM-DD
  nextDueLabel: string
  status: 'overdue' | 'due' | 'upcoming'
  covered: boolean // stranka ima že novejši termin za isto storitev
}

const DAY_MS = 1440 * 60000
const HORIZON_DAYS = 21 // pokaži dogodke v naslednjih 3 tednih

/**
 * Seznam ponavljajočih strank, razvrščen po nujnosti:
 * 1. rok je potekel (overdue) — poklicati takoj
 * 2. rok v naslednjih 7 dneh (due)
 * 3. rok v 8–21 dneh (upcoming)
 * Pokrite stranke (že imajo novejši termin) so na dnu z oznako.
 */
export async function getRecurrenceOverview(): Promise<RecurrenceEntryDto[]> {
  const now = nowWallClock()
  const todayMs = new Date(`${todayKeyFor(now)}T00:00:00Z`).getTime()

  // Zadnji termin vsakega (stranka, storitev) para z recurWeeks
  const recurring = await db.appointment.findMany({
    where: { recurWeeks: { not: null }, status: { notIn: ['cancelled', 'no_show'] } },
    include: { service: true, client: true },
    orderBy: { startAt: 'desc' },
  })

  // Vsi neodpovedani termini — za ugotavljanje pokritosti
  const all = await db.appointment.findMany({
    where: { status: { notIn: ['cancelled', 'no_show'] } },
    select: { id: true, clientId: true, serviceId: true, startAt: true },
  })

  // (clientId, serviceId) → zadnji termin s ponavljanjem (desc → prvi je zadnji)
  const latest = new Map<string, (typeof recurring)[number]>()
  for (const appt of recurring) {
    const key = `${appt.clientId}:${appt.serviceId}`
    if (!latest.has(key)) latest.set(key, appt)
  }

  const entries: RecurrenceEntryDto[] = []
  for (const appt of latest.values()) {
    const weeks = appt.recurWeeks
    if (!weeks) continue

    // Rolaj naprej, če je rok že več ciklov za nami
    let effectiveDue = new Date(appt.startAt.getTime() + weeks * 7 * DAY_MS)
    while (effectiveDue.getTime() < now.getTime() - weeks * 7 * DAY_MS) {
      effectiveDue = new Date(effectiveDue.getTime() + weeks * 7 * DAY_MS)
    }

    // Izven obzorja 21 dni → zaenkrat ni zanimiv
    if (effectiveDue.getTime() > now.getTime() + HORIZON_DAYS * DAY_MS) continue

    // Pokritost: novejši termin za isto storitev po zadnjem ponavljajočem obisku
    const covered = all.some(
      (a) => a.id !== appt.id && a.clientId === appt.clientId && a.serviceId === appt.serviceId && a.startAt > appt.startAt
    )

    const dueDayMs = new Date(`${dateKey(effectiveDue)}T00:00:00Z`).getTime()
    const daysDiff = Math.round((dueDayMs - todayMs) / DAY_MS)
    const status: RecurrenceEntryDto['status'] = daysDiff < 0 ? 'overdue' : daysDiff <= 7 ? 'due' : 'upcoming'

    entries.push({
      appointmentId: appt.id,
      client: { id: appt.client.id, name: appt.client.name, phone: appt.client.phone },
      service: { id: appt.service.id, name: appt.service.name },
      recurWeeks: weeks,
      lastVisit: appt.startAt.toISOString(),
      lastVisitLabel: formatDateTimeShort(appt.startAt),
      nextDue: effectiveDue.toISOString(),
      nextDueDate: dateKey(effectiveDue),
      nextDueLabel: `${dayNameShort(dateKey(effectiveDue))}, ${effectiveDue.getUTCDate()}.${effectiveDue.getUTCMonth() + 1}.`,
      status,
      covered,
    })
  }

  const rank = { overdue: 0, due: 1, upcoming: 2 }
  return entries
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        Number(a.covered) - Number(b.covered) ||
        a.nextDue.localeCompare(b.nextDue)
    )
    .slice(0, 30)
}

function todayKeyFor(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
