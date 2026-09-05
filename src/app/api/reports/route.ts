import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BUSINESS_SLUG, dateKey, timeKey, todayKey } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'
import { monthTitle } from '@/lib/labels'

/**
 * Mesečno poročilo za lastnico — KPI-ji, top storitve/stranke, dnevni graf.
 * ?format=csv vrne datoteko za knjigovodstvo (samo zaključeni = obračunani
 * obiski): UTF-8 BOM, podpičja kot ločila, decimalna vejica — Excel
 * jo v Sloveniji odpre brez pretvorb.
 *
 * PIN zaščiteno (imena strank + prihodki).
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

const STATUS_LABELS: Record<string, string> = {
  pending: 'Čaka',
  confirmed: 'Potrjen',
  checked_in: 'Prišla',
  completed: 'Zaključen',
  cancelled: 'Odpovedan',
  no_show: 'Ni prišla',
}

function monthRange(month: string): { start: Date; endExclusive: Date } {
  const [y, m] = month.split('-').map(Number)
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    endExclusive: new Date(Date.UTC(y, m, 1)),
  }
}

/** CSV polje: v narekovaje, če vsebuje ločilo/narekovaj/prelom vrstice. */
function csvField(value: string): string {
  if (/[";\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function eurCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export async function GET(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }

    const currentMonth = todayKey().slice(0, 7)
    let month = req.nextUrl.searchParams.get('month') ?? currentMonth
    if (!MONTH_RE.test(month) || month > currentMonth) month = currentMonth

    const { start, endExclusive } = monthRange(month)

    const [appointments, business] = await Promise.all([
      db.appointment.findMany({
        where: { startAt: { gte: start, lt: endExclusive } },
        include: { service: true, client: true },
        orderBy: { startAt: 'asc' },
      }),
      db.business.findUnique({ where: { slug: BUSINESS_SLUG }, select: { name: true } }),
    ])

    // ---------- CSV izvoz za knjigovodstvo ----------
    if (req.nextUrl.searchParams.get('format') === 'csv') {
      const rows = appointments.filter((a) => a.status === 'completed')
      const lines: string[] = [
        `${business?.name ?? 'Salon'} — obračunani obiski, ${monthTitle(month)}`,
        `Izvoz: ${todayKey()} · TerminAI`,
        '',
        ['Datum', 'Ura', 'Stranka', 'Telefon', 'Storitev', 'Cena (EUR)', 'Status'].join(';'),
      ]
      for (const a of rows) {
        lines.push(
          [
            dateKey(a.startAt),
            timeKey(a.startAt),
            a.client.name,
            a.client.phone,
            a.service.name,
            eurCents(a.priceCents),
            STATUS_LABELS[a.status] ?? a.status,
          ]
            .map(csvField)
            .join(';')
        )
      }
      const total = rows.reduce((s, a) => s + a.priceCents, 0)
      lines.push('', ['', '', '', '', 'SKUPAJ', eurCents(total), ''].join(';'))
      const csv = '\uFEFF' + lines.join('\r\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="TerminAI-porocilo-${month}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // ---------- JSON poročilo ----------
    const completed = appointments.filter((a) => a.status === 'completed')
    const upcoming = appointments.filter((a) => a.status === 'pending' || a.status === 'confirmed' || a.status === 'checked_in')
    const realizedRevenueCents = completed.reduce((s, a) => s + a.priceCents, 0)
    const expectedRevenueCents = upcoming.reduce((s, a) => s + a.priceCents, 0)

    // Realizirano po dnevih (graf)
    const dayMap = new Map<string, { count: number; revenueCents: number }>()
    for (const a of completed) {
      const key = dateKey(a.startAt)
      const cur = dayMap.get(key) ?? { count: 0, revenueCents: 0 }
      cur.count++
      cur.revenueCents += a.priceCents
      dayMap.set(key, cur)
    }
    const days = Array.from(dayMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Top storitve
    const svcMap = new Map<string, { name: string; count: number; revenueCents: number }>()
    for (const a of completed) {
      const cur = svcMap.get(a.service.name) ?? { name: a.service.name, count: 0, revenueCents: 0 }
      cur.count++
      cur.revenueCents += a.priceCents
      svcMap.set(a.service.name, cur)
    }
    const topServices = Array.from(svcMap.values())
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5)

    // Top stranke
    const cliMap = new Map<string, { name: string; visits: number; revenueCents: number; lastVisit: string }>()
    for (const a of completed) {
      const cur =
        cliMap.get(a.client.id) ??
        { name: a.client.name, visits: 0, revenueCents: 0, lastVisit: a.startAt.toISOString() }
      cur.visits++
      cur.revenueCents += a.priceCents
      if (a.startAt.toISOString() > cur.lastVisit) cur.lastVisit = a.startAt.toISOString()
      cliMap.set(a.client.id, cur)
    }
    const topClients = Array.from(cliMap.values())
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5)

    // Meseci z podatki (navigacija)
    const all = await db.appointment.findMany({ select: { startAt: true } })
    const monthSet = new Set<string>([currentMonth])
    for (const a of all) monthSet.add(dateKey(a.startAt).slice(0, 7))
    const months = Array.from(monthSet).sort().reverse()

    return NextResponse.json({
      month,
      monthLabel: monthTitle(month),
      realizedRevenueCents,
      realizedVisits: completed.length,
      expectedRevenueCents,
      expectedVisits: upcoming.length,
      cancelled: appointments.filter((a) => a.status === 'cancelled').length,
      noShow: appointments.filter((a) => a.status === 'no_show').length,
      avgVisitCents: completed.length > 0 ? Math.round(realizedRevenueCents / completed.length) : 0,
      days,
      topServices,
      topClients,
      months,
    })
  } catch (e) {
    console.error('GET /api/reports error', e)
    return NextResponse.json({ error: 'Napaka pri poročilu' }, { status: 500 })
  }
}
