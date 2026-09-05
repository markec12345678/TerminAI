export interface ServiceDto {
  id: string
  name: string
  description: string | null
  durationMin: number
  bufferMin?: number
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
  closedReason?: string | null
  peakDay: boolean
  slots: SlotDto[]
}

/** Zaprt dan (praznik, dopust) — javni podatki za rezervacijski trak. */
export interface ClosedDayDto {
  date: string
  reason: string | null
}

/** Vnos na čakalnem seznamu — stranka, ki želi termin, ko se kaj sprosti. */
export interface WaitlistEntryDto {
  id: string
  name: string
  phone: string
  note: string | null
  service: { id: string; name: string } | null
  createdAt: string
}

/** Fotografija stranke (lokalni Photo Manager). Seznam nosi thumbUrl; povečava pridobi dataUrl. */
export interface PhotoDto {
  id: string
  kind: 'result' | 'before' | 'after' | 'reference' | string
  caption: string | null
  thumbUrl: string
  appointmentId: string | null
  appointment: { service: string; date: string } | null
  createdAt: string
}

/** Rojstni dan stranke — "MM-DD" (brez leta) + število dni do naslednjega. */
export interface BirthdayDto {
  id: string
  name: string
  phone: string
  birthday: string
  inDays: number
}

const MONTH_SLO_FULL = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
]

/** "05-03" → "5. marec" (za prikaz rojstnega dne). */
export function formatBirthday(bd: string, full = false): string {
  const [mm, dd] = bd.split('-').map(Number)
  if (!mm || !dd) return bd
  return `${dd}. ${full ? MONTH_SLO_FULL[mm - 1] : MONTH_SLO[mm - 1]}`
}

/** "5. 3." / "05-03" / "5/3" → "05-03" (null = prazno, false = neveljavno). */
export function parseBirthdayInput(v: string): string | null | false {
  const s = v.trim()
  if (!s) return null
  const m = /^(\d{1,2})[-./ ]+(\d{1,2})[-./ ]*$/.exec(s)
  if (!m) return false
  const dd = Number(m[1])
  const mm = Number(m[2])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false
  return `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

export interface AppointmentDto {
  id: string
  startAt: string
  endAt: string
  status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
  priceCents: number
  recurWeeks?: number | null
  cancelToken?: string | null
  notes?: string | null
  ownerNote?: string | null
  createdAt?: string
  updatedAt?: string
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

export interface RecurrenceDto {
  appointmentId: string
  client: { id: string; name: string; phone: string }
  service: { id: string; name: string }
  recurWeeks: number
  lastVisit: string
  lastVisitLabel: string
  nextDue: string
  nextDueDate: string
  nextDueLabel: string
  status: 'overdue' | 'due' | 'upcoming'
  covered: boolean
}

export interface BackupDto {
  name: string
  sizeBytes: number
  createdAt: string
  ageLabel: string
}

export interface BackupListDto {
  backups: BackupDto[]
  lastBackupAt: string | null
  dir: string
  auto: string
}

export interface ReportDayDto {
  date: string
  count: number
  revenueCents: number
}

export interface ReportServiceRowDto {
  name: string
  count: number
  revenueCents: number
}

export interface ReportClientRowDto {
  name: string
  visits: number
  revenueCents: number
  lastVisit: string
}

export interface ReportDto {
  month: string
  monthLabel: string
  realizedRevenueCents: number
  realizedVisits: number
  expectedRevenueCents: number
  expectedVisits: number
  cancelled: number
  noShow: number
  avgVisitCents: number
  days: ReportDayDto[]
  topServices: ReportServiceRowDto[]
  topClients: ReportClientRowDto[]
  months: string[]
}

export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)} €`
}

/** Povezava za odpoved termina (stranka klikne in odpove sama). */
export function cancelUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/?cancel=${encodeURIComponent(token)}`
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

/**
 * Slovensko števanje z dvojino: 1 → edina, 2 → dvojina, 3–4 → množina,
 * 5+ → rodilnik množine. Primer: slCount(3, 'stranka', 'stranki', 'stranke', 'strank')
 * → "3 stranke".
 */
export function slCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return `1 ${one}`
  if (n === 2) return `2 ${two}`
  const m10 = n % 10
  const m100 = n % 100
  if (m10 >= 3 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} ${few}`
  return `${n} ${many}`
}
