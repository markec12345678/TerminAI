import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { pinAllows } from '@/lib/pin'

const patchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const { id } = await params
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Napačen status' }, { status: 400 })
    }

    const appointment = await db.appointment.update({
      where: { id },
      data: { status: parsed.data.status },
      include: { service: true, client: true },
    })

    return NextResponse.json({
      appointment: {
        id: appointment.id,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        status: appointment.status,
        priceCents: appointment.priceCents,
        service: { id: appointment.service.id, name: appointment.service.name, durationMin: appointment.service.durationMin },
        client: { id: appointment.client.id, name: appointment.client.name, phone: appointment.client.phone },
      },
    })
  } catch (e) {
    console.error('PATCH /api/appointments/[id] error', e)
    return NextResponse.json({ error: 'Posodobitev ni uspela' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const { id } = await params
    await db.appointment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/appointments/[id] error', e)
    return NextResponse.json({ error: 'Brisanje ni uspelo' }, { status: 500 })
  }
}
