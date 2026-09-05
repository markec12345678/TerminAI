/**
 * TerminAI — zvočna opozorila prek Web Audio API.
 *
 * Zakaj Web Audio in ne .mp3 datoteke?
 *  - deluje 100 % offline (izdelek teče brez interneta na računalniku salona),
 *  - brez dodatnih datotek, manjša namestitev na USB,
 *  - zvok generiramo iz sinusnih tonov (mehek, "zvonček", ne moteč).
 *
 * Brskalniki zahtevajo interakcijo uporabnika, preden lahko zvok predvaja
 * (autoplay policy) — zato `unlockAudio()` pokličemo ob prvem kliku/gestu.
 */

const STORAGE_KEY = 'terminai-sound'

export function getSoundPref(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function setSoundPref(on: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
}

/** En sam AudioContext za celo aplikacijo (brskalniki omejujejo število). */
let ctx: AudioContext | null = null

/** Odklene zvok ob prvem uporabniškem gestu (klik, dotik). Brez tega brskalnik utiša. */
export function unlockAudio(): void {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // AudioContext ni na voljo — utišamo tiho, brez napake
  }
}

/** En mehek ton: sinus z eksponentnim pojemanjem (kot mehak zvonček). */
function tone(freq: number, startAt: number, duration: number, peak = 0.16): void {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t = ctx.currentTime + startAt
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

export type SoundKind = 'booking' | 'cancel' | 'arrival' | 'complete' | 'message'

/**
 * Predvaja zvok, če je zvok vklopljen (nastavitev uporabnika).
 *  - booking: prijeten dvotonski "ding-dong" (nova rezervacija)
 *  - cancel:  mehak padajoči ton (odpoved)
 *  - arrival: topel dvotonski pozdrav (stranka je prišla)
 *  - complete: kratek zaključni ton
 *  - message: kratek "pop" (novo sporočilo)
 */
export function playSound(kind: SoundKind): void {
  if (typeof window === 'undefined' || !getSoundPref()) return
  try {
    unlockAudio()
    if (!ctx || ctx.state !== 'running') return
    switch (kind) {
      case 'booking':
        // ding-dong: C6 → G5 (prijetno dvigovanje, kot vstopni zvonec)
        tone(1047, 0, 0.35, 0.18)
        tone(784, 0.18, 0.45, 0.14)
        break
      case 'cancel':
        // mehak padajoči ton: E5 → C5
        tone(659, 0, 0.25, 0.12)
        tone(523, 0.16, 0.4, 0.1)
        break
      case 'arrival':
        // topel pozdrav: G5 → C6
        tone(784, 0, 0.28, 0.16)
        tone(1047, 0.14, 0.4, 0.14)
        break
      case 'complete':
        // kratek zaključek: E6 sam
        tone(1319, 0, 0.3, 0.12)
        break
      case 'message':
        // kratek pop: C5
        tone(523, 0, 0.18, 0.14)
        break
    }
  } catch {
    // tiho — zvok nikoli ne sme pokvariti uporabniške izkušnje
  }
}
