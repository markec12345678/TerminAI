import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { nowWallClock } from '@/lib/booking'

/**
 * Odpoved termina prek povezave — stranka klikne ?cancel={token} iz WhatsApp
 * spomnika in odpove sama, brez PIN-a (žeton je overitev).
 */

const tokenSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{8,16}$/),
})

async function findByToken(token: string) {
  return db.appointment.findUnique({
    where: { cancelToken: token },
    include: {
      service: { select: { name: true, durationMin: true, business: { select: { name: true } } } },
      client: { select: { name: true } },
    },
  })
}

/** Javni podatki termina za potrditveni pogov (brez telefona in ID-jev). */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') ?? ''
    if (!tokenSchema.safeParse({ token }).success) {
      return NextResponse.json({ error: 'Povezava za odpoved ni veljavna.' }, { status: 400 })
    }
    const a = await findByToken(token)
    if (!a) {
      return NextResponse.json({ error: 'Termin ni bil najden — povezava je morda stara.' }, { status: 404 })
    }
    if (a.status === 'cancelled') {
      return NextResponse.json({ error: 'Ta termin je že odpovedan.' }, { status: 409 })
    }
    if (a.status === 'completed' || a.status === 'no_show' || a.endAt < nowWallClock()) {
      return NextResponse.json({ error: 'Ta termin je že mimo.' }, { status: 409 })
    }
    return NextResponse.json({
      appointment: {
        businessName: a.service.business.name,
        clientName: a.client.name,
        serviceName: a.service.name,
        startAt: a.startAt.toISOString(),
        durationMin: a.service.durationMin,
        priceCents: a.priceCents,
      },
    })
  } catch (e) {
    console.error('GET /api/appointments/cancel error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju termina' }, { status: 500 })
  }
}

/** Odpoved — označi termin kot odpovedan, sprosti termin. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = tokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Povezava za odpoved ni veljavna.' }, { status: 400 })
    }
    const a = await findByToken(parsed.data.token)
    if (!a) {
      return NextResponse.json({ error: 'Termin ni bil najden — povezava je morda stara.' }, { status: 404 })
    }
    if (a.status !== 'pending' && a.status !== 'confirmed') {
      const msg = a.status === 'cancelled' ? 'Ta termin je že odpovedan.' : 'Ta termin je že mimo.'
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    if (a.endAt < nowWallClock()) {
      return NextResponse.json({ error: 'Ta termin je že mimo — prosimo pokličite salon.' }, { status: 409 })
    }
    await db.appointment.update({
      where: { id: a.id },
      data: { status: 'cancelled' },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/appointments/cancel error', e)
    return NextResponse.json({ error: 'Odpoved ni uspela' }, { status: 500 })
  }
}
