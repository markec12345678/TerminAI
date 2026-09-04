import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { BUSINESS_SLUG, nowWallClock, seedDemo } from '@/lib/booking'
import { ensureHolidays } from '@/lib/holidays'
import { pinAllows } from '@/lib/pin'

const freshSchema = z.object({
  mode: z.literal('fresh'),
  businessName: z.string().min(2, 'Ime salona je obvezno').max(60),
  phone: z.string().min(6, 'Telefon je obvezen').max(24),
  address: z.string().max(120).optional().or(z.literal('')),
  city: z.string().max(60).optional().or(z.literal('')),
})

const demoSchema = z.object({ mode: z.literal('demo') })

const setupSchema = z.discriminatedUnion('mode', [freshSchema, demoSchema])

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
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
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
 * Reset baze — skupna osnova za čist start in demo obnovo.
 * POPRAVEK: brišemo tudi WorkingHours (FK na Business) in sporočila,
 * sicer bi brisanje salona padlo na tuji ključ.
 */
async function wipeAll(): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.appointment.deleteMany({})
    await tx.client.deleteMany({})
    await tx.service.deleteMany({})
    await tx.workingHours.deleteMany({})
    await tx.message.deleteMany({})
    await tx.closedDay.deleteMany({})
    await tx.business.deleteMany({})
  })
}

/**
 * Čist start — izbriše VSE (termine, stranke, storitve, salon, sporočila)
 * in ustvari prazen salon z danimi podatki. Uporabno pri prehodu demo → pravi salon.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const body = await req.json()
    const parsed = setupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }

    // Demo obnova — za prodajne predstavitve: Studio Aura z bogato zgodovino
    // (termini ~40 dni, ponavljanja, izostanki) in brez PIN-a.
    if (parsed.data.mode === 'demo') {
      await wipeAll()
      await seedDemo()
      const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG } })
      return NextResponse.json({ ok: true, demo: true, business, resetAt: nowWallClock().toISOString() })
    }

    const { businessName, phone, address, city } = parsed.data

    await wipeAll()

    // Nov salon takoj dobi slovenske praznike (tekoče + naslednje leto)
    const year = new Date().getUTCFullYear()
    await ensureHolidays([year, year + 1])

    await db.business.create({
      data: {
        name: businessName,
        slug: BUSINESS_SLUG,
        tagline: 'Rezervirajte svoj termin',
        phone,
        address: address || '',
        city: city || '',
      },
    })

    const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG } })
    return NextResponse.json({ ok: true, business, resetAt: nowWallClock().toISOString() })
  } catch (e) {
    console.error('POST /api/setup error', e)
    return NextResponse.json({ error: 'Nastavitev ni uspela' }, { status: 500 })
  }
}
