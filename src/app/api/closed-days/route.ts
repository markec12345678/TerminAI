import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { todayKey } from '@/lib/booking'
import { ensureHolidays, upcomingDays } from '@/lib/holidays'
import { pinAllows } from '@/lib/pin'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const addSchema = z.object({ action: z.literal('add'), date: dateStr, reason: z.string().max(80).optional() })

const rangeSchema = z.object({
  action: z.literal('add-range'),
  from: dateStr,
  to: dateStr,
  reason: z.string().max(80).optional(),
})

const holidaysSchema = z.object({ action: z.literal('holidays'), years: z.array(z.number().int().min(2020).max(2100)).max(3) })

/**
 * GET /api/closed-days — JAVNO (tudi rezervacijski widget strank):
 * zaprti dnevi v naslednjih 200 dneh (prazniki, dopust ...).
 */
export async function GET() {
  try {
    const days = upcomingDays(200, todayKey())
    const rows = await db.closedDay.findMany({
      where: { date: { in: days } },
      select: { date: true, reason: true },
      orderBy: { date: 'asc' },
    })
    return NextResponse.json({ days: rows })
  } catch (e) {
    console.error('GET /api/closed-days error', e)
    return NextResponse.json({ days: [] })
  }
}

/**
 * POST /api/closed-days (PIN) — trije nameni:
 *  - add: en dan (npr. 1. maj, bolezen)
 *  - add-range: dopust od–do
 *  - holidays: uvoz slovenskih praznikov za podana leta
 */
export async function POST(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const parsed = z.union([addSchema, rangeSchema, holidaysSchema]).safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Napačni podatki' }, { status: 400 })
    }
    const data = parsed.data

    if (data.action === 'add') {
      const existing = await db.closedDay.findUnique({ where: { date: data.date } })
      if (existing) {
        // Dopust lahko podaljša obstoječi praznik — samo posodobi razlog
        await db.closedDay.update({ where: { date: data.date }, data: { reason: data.reason ?? existing.reason } })
        return NextResponse.json({ ok: true, added: 0, updated: 1 })
      }
      await db.closedDay.create({ data: { date: data.date, reason: data.reason ?? null } })
      return NextResponse.json({ ok: true, added: 1, updated: 0 })
    }

    if (data.action === 'add-range') {
      if (data.from > data.to) {
        return NextResponse.json({ error: 'Datum "od" mora biti pred "do".' }, { status: 400 })
      }
      const all = upcomingDays(370, data.from).filter((d) => d >= data.from && d <= data.to)
      let added = 0
      for (const d of all) {
        const existing = await db.closedDay.findUnique({ where: { date: d } })
        if (!existing) {
          await db.closedDay.create({ data: { date: d, reason: data.reason ?? null } })
          added++
        }
      }
      return NextResponse.json({ ok: true, added, updated: 0 })
    }

    // holidays — uvoz praznikov
    const added = await ensureHolidays(data.years)
    return NextResponse.json({ ok: true, added, updated: 0 })
  } catch (e) {
    console.error('POST /api/closed-days error', e)
    return NextResponse.json({ error: 'Zaprti dan ni bilo mogoče shraniti' }, { status: 500 })
  }
}

/** DELETE /api/closed-days?date=YYYY-MM-DD (PIN) — odstrani zaprt dan. */
export async function DELETE(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const date = req.nextUrl.searchParams.get('date') ?? ''
    if (!dateStr.safeParse(date).success) {
      return NextResponse.json({ error: 'Napačen datum' }, { status: 400 })
    }
    try {
      await db.closedDay.delete({ where: { date } })
    } catch {
      return NextResponse.json({ error: 'Ta dan ni zaprt' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/closed-days error', e)
    return NextResponse.json({ error: 'Brisanje ni uspelo' }, { status: 500 })
  }
}
