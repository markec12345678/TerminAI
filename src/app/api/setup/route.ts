import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { BUSINESS_SLUG, nowWallClock } from '@/lib/booking'

const setupSchema = z.object({
  mode: z.literal('fresh'),
  businessName: z.string().min(2, 'Ime salona je obvezno').max(60),
  phone: z.string().min(6, 'Telefon je obvezen').max(24),
  address: z.string().max(120).optional().or(z.literal('')),
  city: z.string().max(60).optional().or(z.literal('')),
})

const editSchema = z.object({
  mode: z.literal('edit'),
  businessName: z.string().min(2, 'Ime salona je obvezno').max(60),
  phone: z.string().min(6, 'Telefon je obvezen').max(24),
  address: z.string().max(120).optional().or(z.literal('')),
  city: z.string().max(60).optional().or(z.literal('')),
  email: z.string().email('Napačen e-poštni naslov').optional().or(z.literal('')),
  tagline: z.string().max(80).optional().or(z.literal('')),
})

/**
 * Urejanje podatkov salona BREZ brisanja — ime, telefon, naslov, e-pošta.
 * Ti podatki se izpisujejo strankam (rezervacijska stran, odgovori).
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = editSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }
    const { businessName, phone, address, city, email, tagline } = parsed.data

    const business = await db.business.update({
      where: { slug: BUSINESS_SLUG },
      data: {
        name: businessName,
        phone,
        address: address ?? undefined,
        city: city ?? undefined,
        email: email ?? undefined,
        tagline: tagline ?? undefined,
      },
    })

    return NextResponse.json({ ok: true, business })
  } catch (e) {
    console.error('PATCH /api/setup error', e)
    return NextResponse.json({ error: 'Posodobitev ni uspela' }, { status: 500 })
  }
}

/**
 * Čist start — izbriše VSE (termine, stranke, storitve, salon) in ustvari
 * prazen salon z danimi podatki. Uporabno pri prehodu demo → pravi salon.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = setupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }
    const { businessName, phone, address, city } = parsed.data

    await db.$transaction(async (tx) => {
      await tx.appointment.deleteMany({})
      await tx.client.deleteMany({})
      await tx.service.deleteMany({})
      await tx.business.deleteMany({})

      await tx.business.create({
        data: {
          name: businessName,
          slug: BUSINESS_SLUG,
          tagline: 'Rezervirajte svoj termin',
          phone,
          address: address || '',
          city: city || '',
        },
      })
    })

    const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG } })
    return NextResponse.json({ ok: true, business, resetAt: nowWallClock().toISOString() })
  } catch (e) {
    console.error('POST /api/setup error', e)
    return NextResponse.json({ error: 'Nastavitev ni uspela' }, { status: 500 })
  }
}
