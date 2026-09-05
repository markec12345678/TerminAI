import { NextRequest, NextResponse } from 'next/server'
import { pinAllows } from '@/lib/pin'
import { getRecurrenceOverview } from '@/lib/recurrence'

/** Seznam "kdo je na vrsti" — lastniški pregled (PIN). */
export async function GET(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const entries = await getRecurrenceOverview()
    return NextResponse.json({ entries })
  } catch (e) {
    console.error('GET /api/appointments/recurrence error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju ponavljanj' }, { status: 500 })
  }
}
