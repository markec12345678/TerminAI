export interface ServiceDto {
  id: string
  name: string
  description: string | null
  durationMin: number
  priceCents: number
  peakPriceCents: number
  category: string | null
}

export interface BusinessDto {
  id: string
  name: string
  tagline: string | null
  city: string
  address: string
  phone: string
  email: string | null
}

export interface SlotDto {
  time: string
  available: boolean
  peak: boolean
  priceCents: number
}

export interface AvailabilityDto {
  date: string
  dayName: string
  open: boolean
  peakDay: boolean
  slots: SlotDto[]
}

export interface AppointmentDto {
  id: string
  startAt: string
  endAt: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  priceCents: number
  notes?: string | null
  service: { id: string; name: string; durationMin: number }
  client: { id: string; name: string; phone: string }
}

export interface StatsDto {
  today: { date: string; count: number; upcoming: number; revenueCents: number }
  month: { revenueCents: number; appointments: number }
  pending: number
  clients: number
  occupancy: number
  remindersTomorrow: number
  week: { date: string; count: number; revenueCents: number }[]
}

export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)} €`
}

export function timeOfIso(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

const DAY_SLO = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob']
const MONTH_SLO = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec']

export function dateParts(dateStr: string): { dayName: string; dayNum: number; month: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { dayName: DAY_SLO[dow], dayNum: d, month: MONTH_SLO[m - 1] }
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}
