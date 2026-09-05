import { NextRequest, NextResponse } from 'next/server'
import { pinAllows } from '@/lib/pin'
import { suggestNextVisit } from '@/lib/loyalty'

/**
 * Motor zvestobe — predlog naslednjega obiska za pravkar zaključen termin
 * (pametni rebooking). ?appointmentId=… ; samo lastnik.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN' }, { status: 401 })
    }
    const appointmentId = req.nextUrl.searchParams.get('appointmentId')
    if (!appointmentId) {
      return NextResponse.json({ error: 'Manjka appointmentId' }, { status: 400 })
    }
    const suggestion = await suggestNextVisit(appointmentId)
    return NextResponse.json(
      { suggestion },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('GET /api/loyalty/rebook error', e)
    return NextResponse.json({ error: 'Napaka pri predlogu termina' }, { status: 500 })
  }
}
