/**
 * TerminAI — instrumentation hook (Next.js).
 *
 * register() se izvede enkrat ob zagonu strežnika (dev ali produkcija).
 * Tu zagonimo vzdrževalne naloge: samodejne varnostne kopije baze.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackupScheduler } = await import('./lib/backup')
    startBackupScheduler()
    console.log('[TerminAI] Vzdrževalne naloge zagnane (samodejne varnostne kopije)')
  }
}
