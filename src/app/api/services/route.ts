import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeed, BUSINESS_SLUG } from '@/lib/booking'

export async function GET() {
  try {
    await ensureSeed()
    const business = await db.business.findUnique({ where: { slug: BUSINESS_SLUG } })
    const services = await db.service.findMany({
      where: { active: true, businessId: business?.id },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ business, services })
  } catch (e) {
    console.error('GET /api/services error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju storitev' }, { status: 500 })
  }
}
