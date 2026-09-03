import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { naiveDate, nowWallClock, isPeak, generateSlots, getHoursForDayAsync } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

const createSchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().min(2, 'Ime je prekratko').max(60),
  phone: z.string().min(6, 'Telefon ni veljaven').max(20),
  notes: z.string().max(300).optional().or(z.literal('')),
  recurWeeks: z.number().int().min(2).max(8).optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    const date = req.nextUrl.searchParams.get('date')

    let start: Date
    let end: Date
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      start = naiveDate(date, '00:00')
      end = naiveDate(date, '23:59')
    } else if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      start = naiveDate(from, '00:00')
      end = naiveDate(to, '23:59')
    } else {
      return NextResponse.json({ error: 'Napačen datumski interval' }, { status: 400 })
    }

    const appointments = await db.appointment.findMany({
      where: { startAt: { gte: start, lte: end } },
      include: { service: true, client: true },
      orderBy: { startAt: 'asc' },
    })

    return NextResponse.json({
      appointments: appointments.map((a) => ({
        id: a.id,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt.toISOString(),
        status: a.status,
        priceCents: a.priceCents,
        recurWeeks: a.recurWeeks,
        notes: a.notes,
        service: { id: a.service.id, name: a.service.name, durationMin: a.service.durationMin },
        client: { id: a.client.id, name: a.client.name, phone: a.client.phone },
      })),
    })
  } catch (e) {
    console.error('GET /api/appointments error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju terminov' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }
    const { serviceId, date, time, name, phone, notes, recurWeeks } = parsed.data

    // Ponavljajoči termin je lastniška nastavitev — javni obrazec je ne sme nastaviti
    let saveRecurWeeks: number | null = recurWeeks ?? null
    if (saveRecurWeeks !== null && !(await pinAllows(req))) {
      saveRecurWeeks = null
    }

    const service = await db.service.findUnique({ where: { id: serviceId } })
    if (!service) {
      return NextResponse.json({ error: 'Storitev ne obstaja' }, { status: 404 })
    }

    // Preveri razpoložljivost še enkrat na strežniku (race-safe)
    const dayStart = naiveDate(date, '00:00')
    const dayEnd = naiveDate(date, '23:59')
    const existing = await db.appointment.findMany({
      where: { startAt: { gte: dayStart, lte: dayEnd }, status: { not: 'cancelled' } },
      select: { startAt: true, endAt: true },
    })
    const slots = generateSlots(service, date, existing, await getHoursForDayAsync(date))
    const slot = slots.find((s) => s.time === time)
    if (!slot || !slot.available) {
      return NextResponse.json({ error: 'Ta termin ni več prost — izberite drugega.' }, { status: 409 })
    }

    // Najdi ali ustvari stranko (po telefonu)
    let client = await db.client.findFirst({ where: { phone } })
    if (!client) {
      client = await db.client.create({ data: { name, phone } })
    }

    const start = naiveDate(date, time)
    const priceCents = isPeak(date, time) ? service.peakPriceCents : service.priceCents

    const appointment = await db.appointment.create({
      data: {
        serviceId: service.id,
        clientId: client.id,
        startAt: start,
        endAt: new Date(start.getTime() + service.durationMin * 60000),
        priceCents,
        status: 'confirmed',
        recurWeeks: saveRecurWeeks,
        notes: notes || undefined,
      },
      include: { service: true, client: true },
    })

    return NextResponse.json(
      {
        appointment: {
          id: appointment.id,
          startAt: appointment.startAt.toISOString(),
          endAt: appointment.endAt.toISOString(),
          status: appointment.status,
          priceCents: appointment.priceCents,
          recurWeeks: appointment.recurWeeks,
          service: { id: appointment.service.id, name: appointment.service.name, durationMin: appointment.service.durationMin },
          client: { id: appointment.client.id, name: appointment.client.name, phone: appointment.client.phone },
        },
        bookedAt: nowWallClock().toISOString(),
      },
      { status: 201 }
    )
  } catch (e) {
    console.error('POST /api/appointments error', e)
    return NextResponse.json({ error: 'Rezervacija ni uspela' }, { status: 500 })
  }
}
