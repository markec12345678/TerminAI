import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { nowWallClock } from '@/lib/booking'
import { pinAllows } from '@/lib/pin'

/**
 * Rojstni dnevi — kot Zenoti "birthday campaigns", a brez naročnine:
 * lastnica vidi, kdo ima rojstni dan v naslednjih dneh, in pošlje
 * čestitko z WhatsApp gumbom (sporočilo je vnaprej pripravljeno).
 *
 * Rojstni dan je shranjen kot "MM-DD" (brez leta) — GDPR minimalno.
 * Vrne dogodke v naslednjih 45 dneh, urejene po bližini.
 */

const WINDOW_DAYS = 45

/** Koliko dni do naslednje ponovitve MM-DD (0 = danes). UTC konvencija kot ves program. */
function daysUntil(birthday: string, now: Date): number {
  const [mm, dd] = birthday.split('-').map(Number)
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  // 29. 2. v neprestavnem letu samodejno zdrsi na 1. 3. (Date prek spusti dan)
  let target = Date.UTC(now.getUTCFullYear(), mm - 1, dd)
  if (target < startOfToday) {
    target = Date.UTC(now.getUTCFullYear() + 1, mm - 1, dd)
  }
  return Math.round((target - startOfToday) / 86400000)
}

export async function GET(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const now = nowWallClock()
    const clients = await db.client.findMany({
      where: { birthday: { not: null } },
      select: { id: true, name: true, phone: true, birthday: true },
      orderBy: { name: 'asc' },
    })

    const birthdays = clients
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        birthday: c.birthday as string,
        inDays: daysUntil(c.birthday as string, now),
      }))
      .filter((b) => b.inDays <= WINDOW_DAYS)
      .sort((a, b) => a.inDays - b.inDays)

    return NextResponse.json({
      birthdays,
      withoutBirthday: clients.length === 0 ? 'none' : undefined,
    })
  } catch (e) {
    console.error('GET /api/birthdays error', e)
    return NextResponse.json({ error: 'Nalaganje rojstnih dni ni uspelo' }, { status: 500 })
  }
}
