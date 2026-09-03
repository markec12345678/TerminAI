import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nowWallClock } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

/**
 * Baza strank z zgodovino — obiski, prihodki, zadnji obisk, naslednji termin.
 * Samo lastnik (PIN) — vsebuje telefone strank.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN' }, { status: 401 })
    }

    const now = nowWallClock()
    const clients = await db.client.findMany({
      include: {
        appointments: {
          where: { status: { notIn: ['cancelled', 'no_show'] } },
          include: { service: { select: { name: true } } },
          orderBy: { startAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Izostanki (no_show) — poseben števec na stranko, ki se ne šteje v obiske
    const noShowAgg = await db.appointment.groupBy({
      by: ['clientId'],
      where: { status: 'no_show' },
      _count: { _all: true },
    })
    const noShowMap = new Map(noShowAgg.map((g) => [g.clientId, g._count._all]))

    const rows = clients.map((c) => {
      const done = c.appointments.filter((a) => a.status === 'completed' || a.startAt <= now)
      const upcoming = c.appointments.filter((a) => a.startAt > now && a.status !== 'completed')
      const totalCents = done.reduce((s, a) => s + a.priceCents, 0)
      const last = c.appointments.find((a) => a.startAt <= now) ?? null
      const next = upcoming.length > 0 ? upcoming[upcoming.length - 1] : null
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        visits: c.appointments.length,
        noShows: noShowMap.get(c.id) ?? 0,
        totalCents,
        lastVisit: last ? last.startAt.toISOString().slice(0, 10) : null,
        next: next
          ? {
              at: next.startAt.toISOString(),
              service: next.service.name,
            }
          : null,
        // priljubljena storitev (najpogostejša)
        favorite:
          [...c.appointments.map((a) => a.service.name)]
            .sort((a, b) =>
              c.appointments.filter((x) => x.service.name === b).length -
              c.appointments.filter((x) => x.service.name === a).length
            )[0] ?? null,
      }
    })

    // Razvrsti: najdejavnejše stranke naprej (po obiskih, nato prihodkih)
    rows.sort((a, b) => b.visits - a.visits || b.totalCents - a.totalCents)

    return NextResponse.json({
      clients: rows,
      totals: {
        clients: rows.length,
        visits: rows.reduce((s, r) => s + r.visits, 0),
        revenueCents: rows.reduce((s, r) => s + r.totalCents, 0),
      },
    })
  } catch (e) {
    console.error('GET /api/clients error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju strank' }, { status: 500 })
  }
}
