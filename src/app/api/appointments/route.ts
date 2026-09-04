import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
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
    // Seznam terminov vsebuje telefone strank — samo lastnik (PIN).
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    const date = req.nextUrl.searchParams.get('date')
    const since = req.nextUrl.searchParams.get('since')

    // "since" način: vsi termini (kateri koli dan), spremenjeni po ISO-časovnem žigu —
    // za živo zaznavanje novih rezervacij/odpovedi v nadzorni plošči (polling).
    if (since) {
      const sinceDate = new Date(since)
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json({ error: 'Napačen parameter since' }, { status: 400 })
      }
      const changed = await db.appointment.findMany({
        where: { updatedAt: { gte: sinceDate } },
        include: { service: true, client: true },
        orderBy: { startAt: 'asc' },
        take: 200,
      })
      return NextResponse.json({ appointments: changed.map(toDto) })
    }

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

    return NextResponse.json({ appointments: appointments.map(toDto) })
  } catch (e) {
    console.error('GET /api/appointments error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju terminov' }, { status: 500 })
  }
}

function toDto(a: { id: string; startAt: Date; endAt: Date; status: string; priceCents: number; recurWeeks: number | null; cancelToken: string | null; notes: string | null; createdAt: Date; updatedAt: Date; service: { id: string; name: string; durationMin: number }; client: { id: string; name: string; phone: string } }) {
  return {
    id: a.id,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    status: a.status,
    priceCents: a.priceCents,
    recurWeeks: a.recurWeeks,
    cancelToken: a.cancelToken,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    service: { id: a.service.id, name: a.service.name, durationMin: a.service.durationMin },
    client: { id: a.client.id, name: a.client.name, phone: a.client.phone },
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
    const hours = await getHoursForDayAsync(date)
    if (hours === null) {
      return NextResponse.json({ error: 'Na ta dan je salon zaprto (praznik ali dopust) — izberite drug dan.' }, { status: 400 })
    }
    const existing = await db.appointment.findMany({
      where: { startAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ['cancelled', 'no_show'] } },
      select: { startAt: true, endAt: true },
    })
    const slots = generateSlots(service, date, existing, hours)
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
        cancelToken: randomUUID().replace(/-/g, '').slice(0, 12),
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
          cancelToken: appointment.cancelToken,
          createdAt: appointment.createdAt.toISOString(),
          updatedAt: appointment.updatedAt.toISOString(),
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
