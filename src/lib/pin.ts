/**
 * TerminAI — PIN zaščita lastniškega območja.
 *
 * Enostaven 4–6 mestni PIN, shranjen kot sha256(slog:pin).
 * Stranke brez PIN-a lahko rezervirajo (javni API), občutljive
 * rute (brisanje, urejanje, nastavitve) pa zahtevajo glavo
 * x-owner-pin. Brez nastavljenega PIN-a je dostop dovoljen
 * (prvi zagon / demo) — UI poziva k nastavitvi.
 */

import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { BUSINESS_SLUG } from './booking'

const PIN_HEADER = 'x-owner-pin'

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(`${BUSINESS_SLUG}:${pin}`).digest('hex')
}

export function pinFromRequest(req: NextRequest): string | null {
  return req.headers.get(PIN_HEADER)
}

export type PinStatus = 'no-pin' | 'ok' | 'wrong'

export async function checkPin(pin: string | null): Promise<PinStatus> {
  const business = await db.business.findUnique({
    where: { slug: BUSINESS_SLUG },
    select: { pinHash: true },
  })
  if (!business?.pinHash) return 'no-pin'
  if (!pin) return 'wrong'
  return hashPin(pin) === business.pinHash ? 'ok' : 'wrong'
}

/** Vrne true, če dostop dovoljen (brez PIN-a ali pravilen). */
export async function pinAllows(req: NextRequest): Promise<boolean> {
  return (await checkPin(pinFromRequest(req))) !== 'wrong'
}
