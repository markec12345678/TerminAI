import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nowWallClock } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

/**
 * Rojstni dnevi — kot Zenoti "birthday campaigns", a brez naročnine:
 * lastnica vidi, kdo ima rojstni dan v naslednjih dneh, in pošlje
 * čestitko z WhatsApp gumbom (sporočilo je vnaprej pripravljeno,
 * OSEBNO: omeni priljubljeno storitev stranke).
 *
 * Rojstni dan je shranjen kot "MM-DD" (brez leta) — GDPR minimalno.
 * Vrne dogodke v naslednjih 45 dneh + "next" (prvi tudi čez okno,
 * da prazna kartica vedno pove, kdaj je naslednji).
 */

const WINDOW_DAYS = 45

interface Occurrence {
  inDays: number
  dateKey: string
}

/** Koliko dni do naslednje ponovitve MM-DD (0 = danes) + datumski ključ. Naivni-UTC konvencija kot ves program. */
function nextOccurrence(birthday: string, now: Date): Occurrence {
  const [mm, dd] = birthday.split('-').map(Number)
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  // 29. 2. v neprestavnem letu samodejno zdrsi na 1. 3. (Date prek spusti dan)
  let target = Date.UTC(now.getUTCFullYear(), mm - 1, dd)
  if (target < startOfToday) {
    target = Date.UTC(now.getUTCFullYear() + 1, mm - 1, dd)
  }
  const t = new Date(target)
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    inDays: Math.round((target - startOfToday) / 86400000),
    dateKey: `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`,
  }
}

interface ServiceAgg {
  serviceId: string
  name: string
  count: number
  last: Date
}

/** Priljubljena storitev: najpogostejša med zaključenimi obiski (izenačeno → novejša). */
function favoriteServices(appts: { clientId: string; serviceId: string; serviceName: string; startAt: Date }[]): Map<string, ServiceAgg> {
  const per = new Map<string, Map<string, ServiceAgg>>()
  for (const a of appts) {
    let sm = per.get(a.clientId)
    if (!sm) {
      sm = new Map()
      per.set(a.clientId, sm)
    }
    const cur = sm.get(a.serviceId)
    if (cur) {
      cur.count += 1
      cur.last = a.startAt
    } else {
      sm.set(a.serviceId, { serviceId: a.serviceId, name: a.serviceName, count: 1, last: a.startAt })
    }
  }
  const fav = new Map<string, ServiceAgg>()
  for (const [cid, sm] of per) {
    let best: ServiceAgg | null = null
    for (const agg of sm.values()) {
      if (!best || agg.count > best.count || (agg.count === best.count && agg.last > best.last)) {
        best = agg
      }
    }
    if (best) fav.set(cid, best)
  }
  return fav
}

export async function GET(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const now = nowWallClock()
    const clients = await db.client.findMany({
      where: { birthday: { not: null } },
      select: { id: true, name: true, phone: true, birthday: true },
      orderBy: { name: 'asc' },
    })

    const mapped = clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      birthday: c.birthday as string,
      ...nextOccurrence(c.birthday as string, now),
    }))

    const birthdays = mapped
      .filter((b) => b.inDays <= WINDOW_DAYS)
      .sort((a, b) => a.inDays - b.inDays)

    // Priljubljene storitve (samo za stranke v oknu — ostale ne potrebuje UI)
    const fav = new Map<string, ServiceAgg>()
    if (birthdays.length > 0) {
      const appts = await db.appointment.findMany({
        where: {
          clientId: { in: birthdays.map((b) => b.id) },
          status: { in: ['completed', 'checked_in'] },
        },
        select: { clientId: true, serviceId: true, startAt: true, service: { select: { name: true } } },
        orderBy: { startAt: 'asc' },
      })
      const flat = appts.map((a) => ({
        clientId: a.clientId,
        serviceId: a.serviceId,
        serviceName: a.service.name,
        startAt: a.startAt,
      }))
      for (const [cid, agg] of favoriteServices(flat)) {
        fav.set(cid, agg)
      }
    }
    for (const b of birthdays) {
      const f = fav.get(b.id)
      b.serviceId = f?.serviceId ?? null
      b.service = f?.name ?? null
    }

    // Prvi rojstni dan tudi čez okno — prazna kartica vseeno pove, kdaj je naslednji.
    const next = mapped
      .filter((b) => b.inDays > WINDOW_DAYS)
      .sort((a, b) => a.inDays - b.inDays)[0] ?? null

    return NextResponse.json({
      birthdays,
      next: next ? { name: next.name, birthday: next.birthday, inDays: next.inDays } : null,
    })
  } catch (e) {
    console.error('GET /api/birthdays error', e)
    return NextResponse.json({ error: 'Nalaganje rojstnih dni ni uspelo' }, { status: 500 })
  }
}
