import { NextResponse } from 'next/server'
import os from 'node:os'

export const dynamic = 'force-dynamic'

/**
 * Naslov, na katerega se lahko povežejo TELEFONI v istem omrežju.
 *
 * Kadar sistem teče na lastničinem računalniku (USB/offline), stranka s
 * telefonom ne more odpreti "localhost" — potrebuje LAN naslov račalnika
 * (npr. http://192.168.1.20:3000). QR koda na nadzorni plošči zato uporabi
 * ta endpoint: na račalniku vrne LAN naslov, na Vercelu pa javni naslov.
 */

function lanIp(): string | null {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue
      const a = i.address
      const privaten =
        /^192\.168\.\d/.test(a) || /^10\.\d/.test(a) || /^172\.(1[6-9]|2\d|3[01])\.\d/.test(a)
      if (privaten) return a
    }
  }
  return null
}

export async function GET() {
  // Na Vercelu notranji naslovi niso smiselni — uporabnik vidi javni origin.
  const ip = process.env.VERCEL ? null : lanIp()
  const port = process.env.PORT ?? '3000'
  return NextResponse.json(
    { lanUrl: ip ? `http://${ip}:${port}` : null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
