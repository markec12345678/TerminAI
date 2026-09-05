import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { pinAllows } from '@/lib/pin'

const patchSchema = z.object({
  name: z.string().min(2, 'Ime je prekratko').max(60).optional(),
  phone: z.string().min(6, 'Telefon ni veljaven').max(20).optional(),
  email: z.string().email('Napačen e-poštni naslov').optional().or(z.literal('')),
  // Opombe o stranki: formule barvanja, alergije, želje ...
  notes: z.string().max(1000).optional().or(z.literal('')),
  // Rojstni dan kot "MM-DD" (brez leta) ali prazno (izbris)
  birthday: z.string().max(10).optional().or(z.literal('')),
})

/** Preveri/normalizira rojstni dan: sprejme "MM-DD"; vrne null ob napaki. */
function validBirthday(v: string): string | null {
  const m = /^(\d{1,2})[-./ ]+(\d{1,2})[-./ ]*$/.exec(v.trim())
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/**
 * GET /api/clients/[id] (PIN) — podatki stranke.
 * Privzeto: GDPR izvoz (pravica dostopa) kot JSON datoteka za prenos.
 * ?view=plain: enaki podatki brez prenosnika — za zgodovino obiskov v UI
 * (vključno z zasebnimi opombami frizerke — formulami).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const { id } = await params
    const plain = req.nextUrl.searchParams.get('view') === 'plain'
    const client = await db.client.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { startAt: 'desc' },
          include: { service: { select: { name: true } } },
        },
        photos: { orderBy: { createdAt: 'desc' }, select: { kind: true, caption: true, dataUrl: true, createdAt: true, appointmentId: true } },
      },
    })
    if (!client) {
      return NextResponse.json({ error: 'Stranka ne obstaja' }, { status: 404 })
    }

    const exportData = {
      stranka: {
        ime: client.name,
        telefon: client.phone,
        ePosta: client.email ?? null,
        opombe: client.notes ?? null,
        rojstniDan: client.birthday ?? null,
      },
      termini: client.appointments.map((a) => ({
        datum: a.startAt.toISOString(),
        storitev: a.service.name,
        status: a.status,
        cena: a.priceCents,
        opomba: a.notes ?? null,
        formula: a.ownerNote ?? null,
      })),
      fotografije: client.photos.map((p) => ({
        posneta: p.createdAt.toISOString(),
        vrsta: p.kind,
        opis: p.caption ?? null,
      })),
    }

    // UI način: brez Content-Disposition, brez namena/datuma izvoza
    if (plain) {
      return NextResponse.json(exportData)
    }

    const gdprData = {
      izvoz: new Date().toISOString(),
      namen: 'GDPR — izpis vseh podatkov, ki jih hranimo o stranki',
      ...exportData,
      termini: exportData.termini.map((a) => ({
        ...a,
        formula: undefined, // zasebna opomba frizerke ni podatek stranke — v izvoz ne gre
        cena: `${(a.cena / 100).toFixed(2)} €`,
      })),
      // Fotografije so osebni podatek — v izvoz gredo prave slike (base64 JPEG)
      fotografije: client.photos.map((p) => ({
        posneta: p.createdAt.toISOString(),
        vrsta: p.kind,
        opis: p.caption ?? null,
        slika: p.dataUrl,
      })),
    }

    return new NextResponse(JSON.stringify(gdprData, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="TerminAI-stranka-${client.name.replace(/[^\w\-čšžČŠŽ ]/g, '').replace(/\s+/g, '-')}.json"`,
      },
    })
  } catch (e) {
    console.error('GET /api/clients/[id] error', e)
    return NextResponse.json({ error: 'Izvoz ni uspel' }, { status: 500 })
  }
}

/**
 * PATCH /api/clients/[id] (PIN) — urejanje stranke:
 * ime, telefon, e-pošta in opombe (formule, alergije, želje).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}
    const d = parsed.data
    if (d.name !== undefined) data.name = d.name
    if (d.phone !== undefined) data.phone = d.phone
    if (d.email !== undefined) data.email = d.email || null
    if (d.notes !== undefined) data.notes = d.notes || null
    if (d.birthday !== undefined) {
      if (d.birthday === '') {
        data.birthday = null // izbris rojstnega dne
      } else {
        const bd = validBirthday(d.birthday)
        if (!bd) {
          return NextResponse.json(
            { error: 'Rojstni dan ni veljaven — zapišite ga kot 5. 3. ali 05-03.' },
            { status: 400 }
          )
        }
        data.birthday = bd
      }
    }

    const client = await db.client.update({ where: { id }, data })
    return NextResponse.json({ ok: true, client: { id: client.id, name: client.name } })
  } catch (e) {
    console.error('PATCH /api/clients/[id] error', e)
    return NextResponse.json({ error: 'Shranjevanje stranke ni uspelo' }, { status: 500 })
  }
}

/**
 * DELETE /api/clients/[id] (PIN) — GDPR izbris ("pravica do izbrisa").
 * Izbriše stranko IN vse njene termine (tudi zgodovino) — nepovratno.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const { id } = await params
    const client = await db.client.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true, photos: true } } },
    })
    if (!client) {
      return NextResponse.json({ error: 'Stranka ne obstaja' }, { status: 404 })
    }

    const deleted = await db.$transaction(async (tx) => {
      await tx.photo.deleteMany({ where: { clientId: id } })
      const appts = await tx.appointment.deleteMany({ where: { clientId: id } })
      await tx.client.delete({ where: { id } })
      return { appointments: appts.count, photos: client._count.photos }
    })

    return NextResponse.json({ ok: true, removedAppointments: deleted.appointments })
  } catch (e) {
    console.error('DELETE /api/clients/[id] error', e)
    return NextResponse.json({ error: 'Izbris ni uspel' }, { status: 500 })
  }
}
