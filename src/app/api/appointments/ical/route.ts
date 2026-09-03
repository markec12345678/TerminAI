import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nowWallClock } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

/**
 * Izvoz koledarja v formatu iCal (.ics) — lastnik ga uvozi v Google Koledar,
 * Apple Koledar ali telefon. PIN zaščiten (vsebuje imena strank).
 */

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/** ICS tekstne vrednosti: escape \ ; , in nove vrstice. */
function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function icsLine(key: string, value: string): string {
  return `${key}:${value}\r\n`
}

export async function GET(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN — vnesite PIN lastnika.' }, { status: 401 })
    }

    const now = nowWallClock()
    const from = new Date(now.getTime() - 30 * 1440 * 60000) // zadnjih 30 dni
    const to = new Date(now.getTime() + 180 * 1440 * 60000) // naslednjih 6 mesecev

    const [appointments, business] = await Promise.all([
      db.appointment.findMany({
        where: {
          startAt: { gte: from, lte: to },
          status: { in: ['pending', 'confirmed', 'completed'] },
        },
        include: { service: true, client: true },
        orderBy: { startAt: 'asc' },
      }),
      db.business.findFirst(),
    ])

    const lines: string[] = []
    lines.push(icsLine('BEGIN', 'VCALENDAR'))
    lines.push(icsLine('VERSION', '2.0'))
    lines.push(icsLine('PRODID', '-//TerminAI//TerminAI 1.0//SL'))
    lines.push(icsLine('CALSCALE', 'GREGORIAN'))
    lines.push(icsLine('METHOD', 'PUBLISH'))
    lines.push(icsLine('X-WR-CALNAME', icsEscape(`TerminAI — ${business?.name ?? 'Koledar'}`)))

    for (const a of appointments) {
      lines.push(icsLine('BEGIN', 'VEVENT'))
      lines.push(icsLine('UID', `${a.id}@terminai`))
      lines.push(icsLine('DTSTAMP', icsDate(now)))
      lines.push(icsLine('DTSTART', icsDate(a.startAt)))
      lines.push(icsLine('DTEND', icsDate(a.endAt)))
      lines.push(icsLine('SUMMARY', icsEscape(`${a.client.name} — ${a.service.name}`)))
      lines.push(
        icsLine(
          'DESCRIPTION',
          icsEscape(
            `TerminAI${a.notes ? ` · opomba: ${a.notes}` : ''}${a.recurWeeks ? ` · ponavljajoči: vsakih ${a.recurWeeks} tednov` : ''}`
          )
        )
      )
      lines.push(icsLine('STATUS', a.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED'))
      lines.push(icsLine('END', 'VEVENT'))
    }
    lines.push(icsLine('END', 'VCALENDAR'))

    return new NextResponse(lines.join(''), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="terminai-koledar.ics"',
      },
    })
  } catch (e) {
    console.error('GET /api/appointments/ical error', e)
    return NextResponse.json({ error: 'Izvoz koledarja ni uspel' }, { status: 500 })
  }
}
