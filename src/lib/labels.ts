/**
 * TerminAI — čisti pomožniki za ponavljajoče termine (skupni strežniku in odjemalcu).
 */

export const RECURRENCE_OPTIONS = [2, 3, 4, 6, 8] as const

/** Slovenska oznaka: "vsaka 2 tedna", "vsake 4 tedne", "vsakih 6 tednov". */
export function recurrenceLabel(weeks: number | null | undefined): string {
  if (!weeks) return ''
  if (weeks === 1) return 'vsak teden'
  if (weeks === 2) return 'vsaka 2 tedna'
  if (weeks >= 5) return `vsakih ${weeks} tednov`
  return `vsake ${weeks} tedne`
}
