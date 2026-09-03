import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { BUSINESS_SLUG, getBusinessHours } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

const DAY_NAMES = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']

const putSchema = z.object({
  hours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        open: z.string().regex(/^\d{2}:\d{2}$/),
        close: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .max(7),
})

/** Sedemdnevni delovni čas salona (0 = nedelja). */
export async function GET() {
  try {
    const hours = await getBusinessHours()
    return NextResponse.json({
      hours: Array.from({ length: 7 }, (_, day) => ({
        dayOfWeek: day,
        dayName: DAY_NAMES[day],
        open: hours.get(day)?.open ?? null,
        close: hours.get(day)?.close ?? null,
        closed: !hours.has(day),
      })),
    })
  } catch (e) {
    console.error('GET /api/hours error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju delovnega časa' }, { status: 500 })
  }
}

/** Shranjevanje delovnega časa (samo lastnik s PIN-om). */
export async function PUT(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Napačni podatki delovnega časa' }, { status: 400 })
    }

    // Validacija: open < close
    for (const h of parsed.data.hours) {
      if (h.open >= h.close) {
        return NextResponse.json(
          { error: `${DAY_NAMES[h.dayOfWeek]}: konec mora biti pozneje od začetka.` },
          { status: 400 }
        )
      }
    }

    const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG }, select: { id: true } })
    if (!business) {
      return NextResponse.json({ error: 'Salon ni nastavljen' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      await tx.workingHours.deleteMany({ where: { businessId: business.id } })
      if (parsed.data.hours.length > 0) {
        await tx.workingHours.createMany({
          data: parsed.data.hours.map((h) => ({
            businessId: business.id,
            dayOfWeek: h.dayOfWeek,
            open: h.open,
            close: h.close,
          })),
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PUT /api/hours error', e)
    return NextResponse.json({ error: 'Shranjevanje delovnega časa ni uspelo' }, { status: 500 })
  }
}
