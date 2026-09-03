import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateSlots, dayNameFull, getHoursForDayAsync, isPeak, naiveDate } from '@/lib/booking'

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date') ?? ''
    const serviceId = req.nextUrl.searchParams.get('serviceId') ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceId) {
      return NextResponse.json({ error: 'Manjkajoči parametri' }, { status: 400 })
    }

    const service = await db.service.findUnique({ where: { id: serviceId } })
    if (!service) {
      return NextResponse.json({ error: 'Storitev ne obstaja' }, { status: 404 })
    }

    const dayStart = naiveDate(date, '00:00')
    const dayEnd = naiveDate(date, '23:59')
    const appointments = await db.appointment.findMany({
      where: {
        startAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['cancelled', 'no_show'] },
      },
      select: { startAt: true, endAt: true },
    })

    const hours = await getHoursForDayAsync(date)
    const slots = generateSlots(
      service,
      date,
      appointments.map((a) => ({ startAt: a.startAt, endAt: a.endAt })),
      hours
    )

    return NextResponse.json({
      date,
      dayName: dayNameFull(date),
      open: hours !== null,
      peakDay: isPeak(date, '12:00') && dayNameFull(date) === 'Sobota',
      slots,
    })
  } catch (e) {
    console.error('GET /api/availability error', e)
    return NextResponse.json({ error: 'Napaka pri računanju terminov' }, { status: 500 })
  }
}
