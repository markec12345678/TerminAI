import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { pinAllows } from '@/lib/pin'

/**
 * Fotografije strank — lokalni "Photo Manager" (kot Zenoti, a brez oblaka).
 *
 * Shranjevanje: slika se pomanjša V BRSKALNIKU (canvas) na ~1200 px JPEG
 * + sličica ~320 px; v bazi sta dva base64 niza. SQLite z VACUUM INTO
 * backupom tako zajame tudi slike — nič ne gre v oblak.
 *
 * Varnost: vse poti za PIN-om (fotografije so osebni podatek).
 */

const KINDS = ['result', 'before', 'after', 'reference'] as const

// Velikostna varovalka: ~600 KB velika slika, ~120 KB sličica
const MAX_DATA_BYTES = 600_000
const MAX_THUMB_BYTES = 120_000
// Zgornja meja na obisk / stranko, da baza ne zrase
const MAX_PER_APPOINTMENT = 12
const MAX_PER_CLIENT = 300

const postSchema = z.object({
  clientId: z.string().min(1),
  appointmentId: z.string().nullish(),
  kind: z.enum(KINDS).default('result'),
  dataUrl: z.string().min(30),
  thumbUrl: z.string().min(30),
  caption: z.string().max(120).optional(),
})

/** Odkodira base64 JPEG in preveri velikost. Vrne število bajtov ali null. */
function jpegBytes(dataUrl: string, max: number): number | null {
  const m = /^data:image\/jpe?g;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) return null
  const bytes = Math.floor((m[1].length * 3) / 4)
  return bytes > max ? null : bytes
}

/** GET: ?id= ena slika (povečava) · ?clientId= seznam sličic · ?appointmentId= filter. */
export async function GET(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const id = req.nextUrl.searchParams.get('id')
    const clientId = req.nextUrl.searchParams.get('clientId')
    const appointmentId = req.nextUrl.searchParams.get('appointmentId')

    // Ena sama fotografija — celotna slika za povečavo
    if (id) {
      const photo = await db.photo.findUnique({
        where: { id },
        include: { appointment: { include: { service: { select: { name: true } } } } },
      })
      if (!photo) return NextResponse.json({ error: 'Fotografija ne obstaja' }, { status: 404 })
      return NextResponse.json({
        photo: {
          id: photo.id,
          kind: photo.kind,
          caption: photo.caption,
          dataUrl: photo.dataUrl,
          createdAt: photo.createdAt.toISOString(),
          appointment: photo.appointment
            ? {
                service: photo.appointment.service.name,
                date: photo.appointment.startAt.toISOString(),
              }
            : null,
        },
      })
    }

    // Seznam sličic za stranko (opcionalno samo za en obisk)
    if (clientId) {
      const photos = await db.photo.findMany({
        where: appointmentId ? { clientId, appointmentId } : { clientId },
        orderBy: { createdAt: 'desc' },
        include: { appointment: { include: { service: { select: { name: true } } } } },
      })
      return NextResponse.json({
        photos: photos.map((p) => ({
          id: p.id,
          kind: p.kind,
          caption: p.caption,
          thumbUrl: p.thumbUrl,
          appointmentId: p.appointmentId,
          appointment: p.appointment
            ? {
                service: p.appointment.service.name,
                date: p.appointment.startAt.toISOString(),
              }
            : null,
          createdAt: p.createdAt.toISOString(),
        })),
      })
    }

    return NextResponse.json({ error: 'Podajte clientId ali id' }, { status: 400 })
  } catch (e) {
    console.error('GET /api/photos error', e)
    return NextResponse.json({ error: 'Nalaganje fotografij ni uspelo' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const parsed = postSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }
    const { clientId, appointmentId, kind, dataUrl, thumbUrl, caption } = parsed.data

    if (jpegBytes(dataUrl, MAX_DATA_BYTES) === null) {
      return NextResponse.json(
        { error: 'Slika ni JPEG ali je prevelika (max ~600 KB). Poskusite znova.' },
        { status: 400 }
      )
    }
    if (jpegBytes(thumbUrl, MAX_THUMB_BYTES) === null) {
      return NextResponse.json({ error: 'Sličica ni veljavna.' }, { status: 400 })
    }

    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) return NextResponse.json({ error: 'Stranka ne obstaja' }, { status: 404 })

    if (appointmentId) {
      const appt = await db.appointment.findUnique({ where: { id: appointmentId } })
      if (!appt) return NextResponse.json({ error: 'Termin ne obstaja' }, { status: 404 })
      if (appt.clientId !== clientId) {
        return NextResponse.json({ error: 'Termin pripada drugi stranki' }, { status: 400 })
      }
      const count = await db.photo.count({ where: { appointmentId } })
      if (count >= MAX_PER_APPOINTMENT) {
        return NextResponse.json(
          { error: `Na en obisk lahko pripnete največ ${MAX_PER_APPOINTMENT} fotografij.` },
          { status: 400 }
        )
      }
    }

    const total = await db.photo.count({ where: { clientId } })
    if (total >= MAX_PER_CLIENT) {
      return NextResponse.json(
        { error: 'Preveč fotografij pri tej stranki — izbrišite starejše.' },
        { status: 400 }
      )
    }

    const photo = await db.photo.create({
      data: {
        clientId,
        appointmentId: appointmentId ?? null,
        kind,
        dataUrl,
        thumbUrl,
        caption: caption?.trim() || null,
      },
    })

    return NextResponse.json({
      photo: {
        id: photo.id,
        kind: photo.kind,
        caption: photo.caption,
        thumbUrl: photo.thumbUrl,
        appointmentId: photo.appointmentId,
        appointment: null,
        createdAt: photo.createdAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('POST /api/photos error', e)
    return NextResponse.json({ error: 'Shranjevanje fotografije ni uspelo' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Podajte id' }, { status: 400 })
    const removed = await db.photo.deleteMany({ where: { id } })
    if (removed.count === 0) {
      return NextResponse.json({ error: 'Fotografija ne obstaja' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/photos error', e)
    return NextResponse.json({ error: 'Brisanje ni uspelo' }, { status: 500 })
  }
}
