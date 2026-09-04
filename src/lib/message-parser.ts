/**
 * TerminAI — razčlenjevanje sporočil strank v slovenščini.
 *
 * Deluje popolnoma lokalno (brez AI, brez stroškov): prepozna namen
 * (naročilo / cena / cenik / zasedenost), storitve po imenih iz baze,
 * datum ("jutri", "v soboto") in uro ("ob 10", "10:30").
 *
 * Danes: lastnik prilepi sporočilo iz WhatsAppa/SMS → program sestavi
 * odgovor. Online faza: isti modul priključimo na WhatsApp API.
 */

import type { Service } from '@prisma/client'
import { todayKey, dateKey, addMinutes, naiveDate, dayOfWeek, nextDays, dayNameFull, formatDayLabel, formatPrice } from './booking'

export type Intent = 'booking' | 'price' | 'cenik' | 'availability' | 'unknown'

export interface ParsedService {
  id: string
  name: string
  durationMin: number
  priceCents: number
  peakPriceCents: number
}

export interface Parsed {
  intent: Intent
  services: ParsedService[] // vse zadete storitve (tudi različice)
  bookingServices: ParsedService[] // deduplicirano za seštevanje
  dateHint: string | null // YYYY-MM-DD
  timeHint: string | null // HH:mm
}

/** Mala črka brez šumnikov, da "strizenje" zadene "striženje". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/[š]/g, 's')
    .replace(/[ž]/g, 'z')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ključne besede iz imena storitve: "Striženje — ženske" → ["strizenje", "zenske"]. */
function serviceKeywords(name: string): string[] {
  return normalize(name)
    .split(/[—–\-+,/]|\bdol\b/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 5)
}

/** Prva beseda imena — osnova za dedupliciranje različic (ženski/moški striženje). */
function serviceBase(name: string): string {
  return normalize(name).split(/[—–\-+,]/)[0].trim()
}

function toParsedService(s: Service): ParsedService {
  return {
    id: s.id,
    name: s.name,
    durationMin: s.durationMin,
    priceCents: s.priceCents,
    peakPriceCents: s.peakPriceCents,
  }
}

/** Ključne besede namena (po prioriteti). */
function detectIntent(norm: string, matchedCount: number): Intent {
  if (/\bcenik|vse cene|vas ceni|vse cen\b/.test(norm)) return 'cenik'
  if (/\bnaroc|rezerv|prijav|zelim termin|bi termin|za termin|bi prisla|bi prisel|prisla bi|prisel bi|hotela bi|hotel bi|zelim priti|priti bi|zelim rezerv|se prijav/.test(norm)) {
    return 'booking'
  }
  if (/\bprost|zaseden|kdaj (lahko|imate|je|so)|terminov\b|prosti|proste|zasedeni/.test(norm)) return 'availability'
  if (/\bkoliko|koliksna|koliksn|cena|ceno|ceni\b|stros|stane/.test(norm)) return 'price'
  if (matchedCount > 0) return 'booking' // "striženje v soboto" = naročilo
  return 'unknown'
}

const WEEKDAYS: [RegExp, number][] = [
  [/\b(ponedelje\w*|pon)\b/, 1],
  [/\b(torek|torka|torkom|tor)\b/, 2],
  [/\b(sred[aoei]\w*|sred)\b/, 3],
  [/\b(cetrt\w*|cet)\b/, 4],
  [/\b(petek|petka|petkom|v pet)\b/, 5],
  [/\b(sobot\w*|sob)\b/, 6],
  [/\b(nedelj\w*|ned)\b/, 0],
]

/** Datum iz besedila: "danes", "jutri", "v soboto", "naslednji ponedeljek". */
function detectDateHint(norm: string): string | null {
  const today = todayKey()
  if (/\bdanes\b/.test(norm)) return today
  if (/\bjutri\b/.test(norm)) return dateKey(addMinutes(naiveDate(today, '00:00'), 1440))
  if (/\bpo jutrisnjem|pojutrisnjem\b/.test(norm)) return dateKey(addMinutes(naiveDate(today, '00:00'), 2880))

  for (const [re, dow] of WEEKDAYS) {
    if (re.test(norm)) {
      const base = naiveDate(today, '00:00')
      for (let i = 0; i < 14; i++) {
        const d = addMinutes(base, i * 1440)
        if (dayOfWeek(dateKey(d)) === dow) return dateKey(d)
      }
    }
  }
  return null
}

/** Ura iz besedila: "ob 10", "ob 14h", "10:30", "ob 14.30", "ob 15 uri". */
function detectTimeHint(norm: string): string | null {
  let m = norm.match(/\bob (\d{1,2})[:.h]?(\d{2})?\b/)
  if (!m) m = norm.match(/\b(\d{1,2})[:.](\d{2})\b/)
  if (!m) m = norm.match(/\b(\d{1,2})h\b/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = m[2] ? Number(m[2]) : 0
  if (hh > 23 || mm > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Glavni vnos: sporočilo + dejavne storitve iz baze. */
export function parseMessage(body: string, services: Service[]): Parsed {
  const norm = normalize(body)

  const matched = services.filter((s) => serviceKeywords(s.name).some((k) => norm.includes(k)))

  // Dedupliciraj po osnovi (ženski + moški striženje = ena postavka za seštevanje)
  const seen = new Set<string>()
  const bookingServices: ParsedService[] = []
  for (const s of matched) {
    const base = serviceBase(s.name)
    if (!seen.has(base)) {
      seen.add(base)
      bookingServices.push(toParsedService(s))
    }
  }

  return {
    intent: detectIntent(norm, matched.length),
    services: matched.map(toParsedService),
    bookingServices,
    dateHint: detectDateHint(norm),
    timeHint: detectTimeHint(norm),
  }
}

function durationLabel(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

/** Podatki o terminih za odgovor. */
export interface ReplyAvailability {
  date: string
  dayLabel: string // "sobota, 6. dec"
  times: { time: string; peak: boolean }[]
  requestedTime: string | null
  requestedFree: boolean | null // null = ni bila zahtevana; true/false sicer
  altDays: { dayLabel: string; times: string[] }[] // ko je ciljni dan zaseden/zaprto
  closedReason?: string | null // razlog, če je ciljni dan posebej zaprt (praznik/dopust)
}

interface BusinessInfo {
  name: string
  phone: string
  address: string
}

/** Sestavi osnutek odgovora strankam (WhatsApp/SMS/e-pošta prijazno). */
export function composeReply(
  parsed: Parsed,
  biz: BusinessInfo,
  allServices: ParsedService[],
  avail: ReplyAvailability | null
): string {
  const footer = `— ${biz.name}, ${biz.address}\n📞 ${biz.phone}`

  // CENIK — celoten
  if (parsed.intent === 'cenik') {
    const lines = allServices.map((s) => `• ${s.name} — ${durationLabel(s.durationMin)} — ${formatPrice(s.priceCents)}${s.peakPriceCents > s.priceCents ? ` (vršni: ${formatPrice(s.peakPriceCents)})` : ''}`)
    return `Cenik — ${biz.name}:\n${lines.join('\n')}\n\n(Vršne cene veljajo ob sobotah in delavnih popoldnevih.)\nZa termin pišite dan + uro, takoj preverim. 🌸\n${footer}`
  }

  // CENA — izbrane storitve
  if (parsed.intent === 'price' && parsed.services.length > 0) {
    const lines = parsed.services.map((s) => `• ${s.name} — ${durationLabel(s.durationMin)} — ${formatPrice(s.priceCents)}${s.peakPriceCents > s.priceCents ? ` (vršni: ${formatPrice(s.peakPriceCents)})` : ''}`)
    return `Seveda, cene:\n${lines.join('\n')}\n\n(Vršne cene veljajo ob sobotah in delavnih popoldnevih.)\nŽelite termin? Napišite dan, takoj preverim proste ure. 🌸\n${footer}`
  }

  // NAROČILO / ZASEDENOST — s prostimi termini
  if ((parsed.intent === 'booking' || parsed.intent === 'availability') && avail) {
    const totalMin = parsed.bookingServices.reduce((acc, s) => acc + s.durationMin, 0)
    const totalCents = parsed.bookingServices.reduce((acc, s) => acc + s.priceCents, 0)
    const hasServices = parsed.bookingServices.length > 0

    let text = ''

    if (hasServices) {
      const lines = parsed.bookingServices.map((s) => `• ${s.name} (${durationLabel(s.durationMin)}) — ${formatPrice(s.priceCents)}`)
      text += `Lepo povabljeni! 🌸 Seveda, rezerviramo:\n${lines.join('\n')}\nSkupaj: ${formatPrice(totalCents)}${totalMin > 0 ? ` · trajanje ca. ${durationLabel(totalMin)}` : ''}\n\n`
    } else {
      text += `Lepo povabljeni! 🌸 Trenutno smo prosti takole:\n\n`
    }

    // Zahtevana ura
    if (avail.requestedTime && avail.requestedFree === true) {
      text += `Termin ob ${avail.requestedTime} (${avail.dayLabel}) je PROST — takoj rezerviram, samo potrdite. ✓\n`
    } else if (avail.requestedTime && avail.requestedFree === false) {
      text += `Termin ob ${avail.requestedTime} je žal zaseden. 🙈\n`
    }

    if (avail.times.length > 0) {
      const times = avail.times.map((t) => `${t.time}${t.peak ? ' (vršni)' : ''}`).join(', ')
      text += `Prosti termini — ${avail.dayLabel}:
${times}\nKateri vam ustreza? Takoj potrdim. 💇`
    } else if (avail.closedReason != null) {
      const reason = avail.closedReason.trim()
      text += `${avail.dayLabel} smo žal ZAPRTI${reason ? ` (${reason})` : ''}.\n${
        avail.altDays.length > 0
          ? `Prosti smo še:\n${avail.altDays.map((d) => `• ${d.dayLabel}: ${d.times.join(', ')}`).join('\n')}\nKateri dan vam ustreza?`
          : 'Pišite, kateri drug dan vam ustreza, takoj preverim. 🙏'
      }`
    } else if (avail.altDays.length > 0) {
      text += `${avail.dayLabel} je žal vse zasedeno.\nProsti smo še:\n${avail.altDays.map((d) => `• ${d.dayLabel}: ${d.times.join(', ')}`).join('\n')}\nKateri dan vam ustreza?`
    } else {
      text += `Trenutno je vse polno — radi vas uvrstimo takoj, ko se odpre termin. Pišite dan, ki vam ustreza.`
    }

    return `${text}\n\n${footer}`
  }

  // CENA brez zadetih storitev → pošlji cenik
  if (parsed.intent === 'price') {
    const lines = allServices.map((s) => `• ${s.name} — ${formatPrice(s.priceCents)}`)
    return `Seveda! Naš cenik:\n${lines.join('\n')}\nZa termin pišite dan + uro. 🌸\n${footer}`
  }

  // NEZNANO
  return `Hvala za sporočilo! 🌸 Za rezervacijo pišite storitev in dan (npr. "striženje v soboto"), za cene pa samo "cenik".\n${footer}`
}

/** Iskanje prostih terminov za odgovor (strežniška stran, iz prave baze). */
export function dayLabel(dateStr: string): string {
  return `${dayNameFull(dateStr).toLowerCase()}, ${formatDayLabel(dateStr)}`
}
