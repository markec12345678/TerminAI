import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { BUSINESS_SLUG, generateSlots, nextDays, naiveDate, todayKey, getHoursForDayAsync } from '@/lib/booking'
import { closedDayReason } from '@/lib/holidays'
import { parseMessage, composeReply, dayLabel, type ReplyAvailability } from '@/lib/message-parser'
import { pinAllows } from '@/lib/pin'

const createSchema = z.object({
  phone: z.string().min(6, 'Telefon stranke je obvezen').max(24),
  name: z.string().max(60).optional().or(z.literal('')),
  email: z.string().email('Napačen e-poštni naslov').optional().or(z.literal('')),
  body: z.string().min(2, 'Sporočilo je prekratko').max(500),
})

/** Zgodovina sporočil (najnovejša first) — vsebuje telefone strank, samo lastnik. */
export async function GET(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const messages = await db.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ messages })
  } catch (e) {
    console.error('GET /api/messages error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju sporočil' }, { status: 500 })
  }
}

/**
 * Prejme sporočilo stranke (lastnik ga prilepi iz WhatsAppa/SMS),
 * ga razčleni, preveri zasedenost v bazi in sestavi osnutek odgovora.
 * Vse shrani — zgodovina ostane za evidence.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const body = await req.json()
    const parsedInput = createSchema.safeParse(body)
    if (!parsedInput.success) {
      return NextResponse.json(
        { error: parsedInput.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }
    const { phone, name, email, body: messageBody } = parsedInput.data

    const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG } })
    if (!business) {
      return NextResponse.json({ error: 'Salon ni nastavljen' }, { status: 404 })
    }

    const services = await db.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })

    const parsed = parseMessage(messageBody, services)

    // Razpoložljivost — za naročila in povpraševanja
    let avail: ReplyAvailability | null = null
    if (parsed.intent === 'booking' || parsed.intent === 'availability') {
      const target = parsed.dateHint ?? todayKey()

      // Za naročilo: najdaljša storitev (najkonzervativnejše okno);
      // za čisto povpraševanje: najkrajša (največ prostih ur)
      const pool = parsed.bookingServices.length > 0 ? parsed.bookingServices : services.map((s) => ({
        id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, peakPriceCents: s.peakPriceCents,
      }))
      const svc =
        parsed.bookingServices.length > 0
          ? pool.reduce((a, b) => (a.durationMin >= b.durationMin ? a : b))
          : pool.reduce((a, b) => (a.durationMin <= b.durationMin ? a : b))
      const svcRow = services.find((s) => s.id === svc.id) ?? null

      if (svcRow) {
        const dayStart = naiveDate(target, '00:00')
        const dayEnd = naiveDate(target, '23:59')
        const existing = await db.appointment.findMany({
          where: { startAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ['cancelled', 'no_show'] } },
          select: { startAt: true, endAt: true },
        })
        const hours = await getHoursForDayAsync(target)
        // Zaprt dan (praznik, dopust ali tedensko zaprt) — razlog za odgovor
        const closedReason = hours === null ? ((await closedDayReason(target)) ?? '') : null
        const slots = generateSlots(svcRow, target, existing, hours)
        const free = slots.filter((s) => s.available)

        // Zahtevana ura — prost/zaseden?
        let requestedFree: boolean | null = null
        if (parsed.timeHint) {
          const req = slots.find((s) => s.time === parsed.timeHint)
          if (req) requestedFree = req.available
        }

        // Alternativni dnevi, če je ciljni dan poln/zaprto
        const altDays: { dayLabel: string; times: string[] }[] = []
        if (free.length === 0) {
          for (const d of nextDays(8).filter((d) => d > target)) {
            if (altDays.length >= 2) break
            const ds = naiveDate(d, '00:00')
            const de = naiveDate(d, '23:59')
            const ex = await db.appointment.findMany({
              where: { startAt: { gte: ds, lte: de }, status: { notIn: ['cancelled', 'no_show'] } },
              select: { startAt: true, endAt: true },
            })
            const f = generateSlots(svcRow, d, ex, await getHoursForDayAsync(d)).filter((s) => s.available)
            if (f.length > 0) altDays.push({ dayLabel: dayLabel(d), times: f.slice(0, 2).map((s) => s.time) })
          }
        }

        avail = {
          date: target,
          dayLabel: dayLabel(target),
          times: free.slice(0, 3).map((s) => ({ time: s.time, peak: s.peak })),
          requestedTime: parsed.timeHint,
          requestedFree,
          altDays,
          closedReason,
        }
      }
    }

    const allParsed = services.map((s) => ({
      id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, peakPriceCents: s.peakPriceCents,
    }))

    const reply = composeReply(
      parsed,
      { name: business.name, phone: business.phone, address: business.address },
      allParsed,
      avail
    )

    const saved = await db.message.create({
      data: {
        name: name || null,
        phone,
        email: email || null,
        body: messageBody,
        intent: parsed.intent,
        reply,
      },
    })

    return NextResponse.json(
      {
        message: {
          id: saved.id,
          name: saved.name,
          phone: saved.phone,
          email: saved.email,
          body: saved.body,
          intent: saved.intent,
          reply: saved.reply,
          createdAt: saved.createdAt.toISOString(),
        },
        parsed: {
          intent: parsed.intent,
          services: parsed.services,
          dateHint: parsed.dateHint,
          timeHint: parsed.timeHint,
        },
        availability: avail,
      },
      { status: 201 }
    )
  } catch (e) {
    console.error('POST /api/messages error', e)
    return NextResponse.json({ error: 'Razčlenjevanje ni uspelo' }, { status: 500 })
  }
}
