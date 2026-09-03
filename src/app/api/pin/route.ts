import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { BUSINESS_SLUG } from '@/lib/booking'
import { checkPin, hashPin } from '@/lib/pin'

const actionSchema = z.object({
  action: z.enum(['set', 'verify', 'change']),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN mora imeti 4–6 števk'),
  currentPin: z.string().regex(/^\d{4,6}$/).optional(),
})

/** Ali je PIN nastavljen (javno — za prikaz zaklepa v UI). */
export async function GET() {
  try {
    const business = await db.business.findUnique({
      where: { slug: BUSINESS_SLUG },
      select: { pinHash: true },
    })
    return NextResponse.json({ pinSet: !!business?.pinHash })
  } catch (e) {
    console.error('GET /api/pin error', e)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

/** Nastavi / preveri / zamenja PIN. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačen PIN' },
        { status: 400 }
      )
    }
    const { action, pin, currentPin } = parsed.data

    const status = await checkPin(null)

    if (action === 'set') {
      if (status === 'ok') {
        // PIN že obstaja → za spremembo zahtevamo trenutni
        if (!currentPin || (await checkPin(currentPin)) !== 'ok') {
          return NextResponse.json({ error: 'Za spremembo vnesite trenutni PIN.' }, { status: 401 })
        }
      }
      await db.business.update({ where: { slug: BUSINESS_SLUG }, data: { pinHash: hashPin(pin) } })
      return NextResponse.json({ ok: true, pinSet: true })
    }

    if (action === 'change') {
      if (status !== 'ok' || !currentPin || (await checkPin(currentPin)) !== 'ok') {
        return NextResponse.json({ error: 'Trenutni PIN je napačen.' }, { status: 401 })
      }
      await db.business.update({ where: { slug: BUSINESS_SLUG }, data: { pinHash: hashPin(pin) } })
      return NextResponse.json({ ok: true, pinSet: true })
    }

    // verify
    const v = await checkPin(pin)
    if (v !== 'ok') {
      return NextResponse.json({ error: 'Napačen PIN' }, { status: 401 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/pin error', e)
    return NextResponse.json({ error: 'Nastavitev PIN-a ni uspela' }, { status: 500 })
  }
}
