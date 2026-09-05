/**
 * TerminAI — pomočniki za ljubljanski wall-clock (izomorfno: strežnik + brskalnik).
 *
 * Konvencija aplikacije: termini so shranjeni kot "naivni UTC" —
 * ljubljanski wall-clock zapisan kot UTC. Te funkcije trenutni čas
 * izrazijo v ISTI konvenciji, ne glede na časovni pas stroja, na katerem
 * koda teče (lastnikov laptop, Vercel UTC, tuj telefonski brskalnik).
 * Brez tega bi se dan preklopil ob 01:00/02:00 ponoči in termini bi
 * ostali "razpoložljivi" še uro ali dve v preteklost.
 */

const TZ = 'Europe/Ljubljana'

interface LjParts {
  y: number
  m: number
  d: number
  hh: number
  mm: number
}

function ljParts(instant: Date): LjParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const map: Record<string, string> = {}
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hh: Number(map.hour),
    mm: Number(map.minute),
  }
}

/** Trenutni čas, izražen kot naivni-UTC Date (ljubljanski wall-clock). */
export function ljNow(): Date {
  const { y, m, d, hh, mm } = ljParts(new Date())
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0))
}

/** Današnji datum "YYYY-MM-DD" po ljubljanskem wall-clocku. */
export function ljTodayKey(): string {
  const { y, m, d } = ljParts(new Date())
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Jutrišnji datum "YYYY-MM-DD" po ljubljanskem wall-clocku. */
export function ljTomorrowKey(): string {
  const { y, m, d } = ljParts(new Date())
  const t = new Date(Date.UTC(y, m - 1, d + 1))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}

/** Datumski ključ "YYYY-MM-DD" poljubnega trenutka, po ljubljanski uri. */
export function ljDateKeyOf(instant: Date): string {
  const { y, m, d } = ljParts(instant)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Minuti od polnoči po ljubljanski uri (npr. 09:30 → 570). */
export function ljMinutesOfDay(): number {
  const { hh, mm } = ljParts(new Date())
  return hh * 60 + mm
}
