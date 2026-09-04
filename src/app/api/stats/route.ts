import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { naiveDate, nowWallClock, todayKey, dateKey, addMinutes, getHoursForDayAsync } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

export async function GET(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const today = todayKey()
    const todayStart = naiveDate(today, '00:00')
    const todayEnd = naiveDate(today, '23:59')
    const now = nowWallClock()

    // Začetek meseca
    const monthStart = naiveDate(`${today.slice(0, 7)}-01`, '00:00')

    const [todayAppointments, monthAppointments, pendingCount, clientsCount] = await Promise.all([
      db.appointment.findMany({
        where: { startAt: { gte: todayStart, lte: todayEnd }, status: { notIn: ['cancelled', 'no_show'] } },
        include: { service: true, client: true },
        orderBy: { startAt: 'asc' },
      }),
      db.appointment.findMany({
        where: { startAt: { gte: monthStart, lte: todayEnd }, status: { in: ['confirmed', 'checked_in', 'completed'] } },
        select: { priceCents: true },
      }),
      db.appointment.count({ where: { status: 'pending' } }),
      db.client.count(),
    ])

    // Zasedenost dneva: zasedene minute / vse odprte minute (ure salona iz baze)
    const hours = await getHoursForDayAsync(today)
    let occupancy = 0
    if (hours) {
      const [oh, om] = hours.open.split(':').map(Number)
      const [ch, cm] = hours.close.split(':').map(Number)
      const openMin = ch * 60 + cm - (oh * 60 + om)
      const bookedMin = todayAppointments.reduce((s, a) => s + a.service.durationMin, 0)
      occupancy = openMin > 0 ? Math.min(100, Math.round((bookedMin / openMin) * 100)) : 0
    }

    // Prihodki tega meseca
    const monthRevenueCents = monthAppointments.reduce((sum, a) => sum + a.priceCents, 0)

    // Rezervacije zadnjih 7 dni (po dnevu)
    const weekAgg: { date: string; count: number; revenueCents: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dayKeyStr = dateKey(addMinutes(naiveDate(today, '00:00'), -i * 1440))
      const ds = naiveDate(dayKeyStr, '00:00')
      const de = naiveDate(dayKeyStr, '23:59')
      const appts = await db.appointment.findMany({
        where: { createdAt: { gte: ds, lte: de }, status: { notIn: ['cancelled', 'no_show'] } },
        select: { priceCents: true },
      })
      weekAgg.push({
        date: dayKeyStr,
        count: appts.length,
        revenueCents: appts.reduce((s, a) => s + a.priceCents, 0),
      })
    }

    // Predhodni spominki "poslani" (simulacija: vsi jutrišnji potrjeni)
    const tomorrowStart = addMinutes(todayStart, 1440)
    const tomorrowEnd = addMinutes(todayEnd, 1440)
    const tomorrowCount = await db.appointment.count({
      where: { startAt: { gte: tomorrowStart, lte: tomorrowEnd }, status: { notIn: ['cancelled', 'no_show'] } },
    })

    return NextResponse.json({
      today: {
        date: today,
        count: todayAppointments.length,
        upcoming: todayAppointments.filter((a) => a.startAt > now).length,
        revenueCents: todayAppointments.reduce((s, a) => s + a.priceCents, 0),
      },
      month: {
        revenueCents: monthRevenueCents,
        appointments: monthAppointments.length,
      },
      pending: pendingCount,
      clients: clientsCount,
      occupancy,
      remindersTomorrow: tomorrowCount,
      week: weekAgg,
    })
  } catch (e) {
    console.error('GET /api/stats error', e)
    return NextResponse.json({ error: 'Napaka pri statistiki' }, { status: 500 })
  }
}
