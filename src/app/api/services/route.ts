import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ensureSeed, BUSINESS_SLUG } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

export async function GET() {
  try {
    await ensureSeed()
    const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG } })
    const services = await db.service.findMany({
      where: { active: true, businessId: business?.id },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ business, services })
  } catch (e) {
    console.error('GET /api/services error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju storitev' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().min(2, 'Ime storitve je prekratko').max(60),
  description: z.string().max(200).optional().or(z.literal('')),
  durationMin: z.number().int().min(10).max(300),
  priceCents: z.number().int().min(0).max(100000),
  peakPriceCents: z.number().int().min(0).max(100000),
  category: z.string().max(40).optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }
    const { name, description, durationMin, priceCents, peakPriceCents, category } = parsed.data

    const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG } })
    if (!business) {
      return NextResponse.json({ error: 'Salon ne obstaja' }, { status: 404 })
    }

    const maxOrder = await db.service.findFirst({
      where: { businessId: business.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const service = await db.service.create({
      data: {
        name,
        description: description || null,
        durationMin,
        priceCents,
        peakPriceCents: Math.max(peakPriceCents, priceCents),
        category: category || null,
        businessId: business.id,
        sortOrder: (maxOrder?.sortOrder ?? 0) + 1,
      },
    })

    return NextResponse.json({ service }, { status: 201 })
  } catch (e) {
    console.error('POST /api/services error', e)
    return NextResponse.json({ error: 'Dodajanje storitve ni uspelo' }, { status: 500 })
  }
}
