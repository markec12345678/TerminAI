import { NextRequest, NextResponse } from 'next/server'
import { pinAllows } from '@/lib/pin'
import { getWinbackCandidates } from '@/lib/loyalty'

/**
 * Motor zvestobe — win-back kandidati (samo lastnik, vsebuje telefone).
 * Stranke, ki so presegle SVOJ osebni ritem obiskov in nimajo novega termina.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await pinAllows(req))) {
      return NextResponse.json({ error: 'Napačen PIN' }, { status: 401 })
    }
    const winback = await getWinbackCandidates()
    return NextResponse.json(
      { winback },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('GET /api/loyalty error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju zvestobe' }, { status: 500 })
  }
}
