import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { nowWallClock } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

const patchSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(200).optional().or(z.literal('')),
  durationMin: z.number().int().min(10).max(300).optional(),
  bufferMin: z.number().int().min(0).max(30).optional(),
  priceCents: z.number().int().min(0).max(100000).optional(),
  peakPriceCents: z.number().int().min(0).max(100000).optional(),
  category: z.string().max(40).optional().or(z.literal('')),
  active: z.boolean().optional(),
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
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Napačni podatki' },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}
    const d = parsed.data
    if (d.name !== undefined) data.name = d.name
    if (d.description !== undefined) data.description = d.description || null
    if (d.durationMin !== undefined) data.durationMin = d.durationMin
    if (d.bufferMin !== undefined) data.bufferMin = d.bufferMin
    if (d.priceCents !== undefined) data.priceCents = d.priceCents
    if (d.peakPriceCents !== undefined) data.peakPriceCents = Math.max(d.peakPriceCents, d.priceCents ?? 0)
    if (d.category !== undefined) data.category = d.category || null
    if (d.active !== undefined) data.active = d.active

    const service = await db.service.update({ where: { id }, data })
    return NextResponse.json({ service })
  } catch (e) {
    console.error('PATCH /api/services/[id] error', e)
    return NextResponse.json({ error: 'Posodobitev storitve ni uspela' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }
    const { id } = await params

    // Blokiraj brisanje, če obstajajo prihodnji aktivni termini te storitve
    // (nowWallClock = ljubljanski wall-clock, skladno s shranjenimi termini)
    const now = nowWallClock()
    const upcoming = await db.appointment.count({
      where: {
        serviceId: id,
        status: { notIn: ['cancelled', 'no_show'] },
        startAt: { gte: now },
      },
    })
    if (upcoming > 0) {
      return NextResponse.json(
        { error: `Storitve ni mogoče izbrisati — ima ${upcoming} prihodnjih terminov. Najprej odpovejte ali zaključite termine.` },
        { status: 409 }
      )
    }

    // Zgodovinski termini obstanejo — storitev samo arhiviramo
    await db.service.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ ok: true, archived: true })
  } catch (e) {
    console.error('DELETE /api/services/[id] error', e)
    return NextResponse.json({ error: 'Brisanje storitve ni uspelo' }, { status: 500 })
  }
}
