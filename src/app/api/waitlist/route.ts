import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { pinAllows } from '@/lib/pin'

const addSchema = z.object({
  name: z.string().min(2, 'Ime je prekratko').max(60),
  phone: z.string().min(6, 'Telefon ni veljaven').max(20),
  serviceId: z.string().optional().nullable(),
  note: z.string().max(300).optional().or(z.literal('')),
})

/**
 * Čakalni seznam — stranke, ki želijo termin, ko se kaj sprosti.
 * Ob odpovedi lastnica povabi prvo stranko s prostim časom (WhatsApp gumb v UI).
 * Celotna vsebina je za lastnico (PIN) — vsebuje telefone strank.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN' }, { status: 401 })
    }
    const entries = await db.waitlistEntry.findMany({
      orderBy: { createdAt: 'asc' },
      include: { service: { select: { id: true, name: true } } },
    })
    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        name: e.name,
        phone: e.phone,
        note: e.note,
        service: e.service ? { id: e.service.id, name: e.service.name } : null,
        createdAt: e.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('GET /api/waitlist error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju čakalnega seznama' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN' }, { status: 401 })
    }
    const body = await req.json()
    const parsed = addSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }
    const { name, phone, serviceId, note } = parsed.data

    // Preveri storitev, če je podana
    let service: { id: string; name: string } | null = null
    if (serviceId) {
      const s = await db.service.findUnique({ where: { id: serviceId } })
      if (!s) {
        return NextResponse.json({ error: 'Storitev ne obstaja' }, { status: 404 })
      }
      service = { id: s.id, name: s.name }
    }

    const entry = await db.waitlistEntry.create({
      data: {
        name,
        phone,
        serviceId: service?.id ?? null,
        note: note || null,
      },
    })
    return NextResponse.json(
      {
        entry: {
          id: entry.id,
          name: entry.name,
          phone: entry.phone,
          note: entry.note,
          service,
          createdAt: entry.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (e) {
    console.error('POST /api/waitlist error', e)
    return NextResponse.json({ error: 'Dodajanje na čakalni seznam ni uspelo' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN' }, { status: 401 })
    }
    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Manjka id' }, { status: 400 })
    }
    await db.waitlistEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/waitlist error', e)
    return NextResponse.json({ error: 'Brisanje ni uspelo' }, { status: 500 })
  }
}
