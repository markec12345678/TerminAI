import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { pinAllows } from '@/lib/pin'
import { backupsDir, createBackup, listBackups } from '@/lib/backup'

/**
 * GET /api/backup — seznam varnostnih kopij (PIN).
 * GET /api/backup?file=ime.db — prenos posamezne kopije (PIN).
 */
export async function GET(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }

  const file = req.nextUrl.searchParams.get('file')
  if (file) {
    // Zagotovi veljavno, varno ime datoteke (brez poti)
    if (!/^\d{4}-\d{2}-\d{2}_\d{4}\.db$/.test(file)) {
      return NextResponse.json({ error: 'Napačno ime datoteke' }, { status: 400 })
    }
    const full = path.join(backupsDir(), file)
    if (!fs.existsSync(full)) {
      return NextResponse.json({ error: 'Kopija ne obstaja' }, { status: 404 })
    }
    const buf = fs.readFileSync(full)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="TerminAI-${file}"`,
      },
    })
  }

  try {
    const backups = listBackups()
    return NextResponse.json({
      backups,
      lastBackupAt: backups[0]?.createdAt ?? null,
      dir: 'db/backups',
      auto: 'ob zagonu, če je zadnja kopija starejša od 24 ur',
    })
  } catch (e) {
    console.error('GET /api/backup error', e)
    return NextResponse.json({ error: 'Napaka pri nalaganju kopij' }, { status: 500 })
  }
}

/** POST /api/backup — ročno ustvari varnostno kopijo zdaj (PIN). */
export async function POST(req: NextRequest) {
  if (!(await pinAllows(req))) {
    return NextResponse.json({ error: 'Zahtevan PIN lastnika' }, { status: 401 })
  }
  try {
    const backup = await createBackup()
    return NextResponse.json({ backup, backups: listBackups() }, { status: 201 })
  } catch (e) {
    console.error('POST /api/backup error', e)
    return NextResponse.json({ error: 'Varnostne kopije ni bilo mogoče ustvariti' }, { status: 500 })
  }
}
