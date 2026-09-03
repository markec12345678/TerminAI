'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch, setStoredPin, getStoredPin } from '@/lib/owner-fetch'
import {
  CalendarDays,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Bell,
  BarChart3,
  Wallet,
  RefreshCw,
  UserRound,
  Store,
  MessageSquare,
  Plus,
  Printer,
  Lock,
  CalendarClock,
  Repeat,
  UserX,
  Link2,
  CalendarArrowDown,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServicesManager } from './services-manager'
import { ManualBookingDialog, type ManualPrefill } from './manual-booking-dialog'
import { MessageInbox } from './message-inbox'
import { ClientsTab } from './clients-tab'
import { RemindersDialog } from './reminders-dialog'
import { RecurrenceCard } from './recurrence-card'
import { BackupCard } from './backup-card'
import { recurrenceLabel } from '@/lib/labels'
import { copyToClipboard } from '@/lib/clipboard'
import { QRCodeSVG } from 'qrcode.react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'
import type { AppointmentDto, StatsDto } from './types'
import { dateParts, durationLabel, formatPrice, timeOfIso, cancelUrl } from './types'
import { QrCode } from 'lucide-react'

const STATUS_META: Record<AppointmentDto['status'], { label: string; className: string }> = {
  pending: { label: 'Čaka', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmed: { label: 'Potrjen', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  completed: { label: 'Zaključen', className: 'bg-secondary text-secondary-foreground border-border' },
  cancelled: { label: 'Odpovedan', className: 'bg-red-50 text-red-600 border-red-200' },
  no_show: { label: 'Ni prišla', className: 'bg-rose-100 text-rose-700 border-rose-200' },
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: 'primary' | 'emerald' | 'amber' | 'default'
}) {
  const iconColor =
    accent === 'primary'
      ? 'bg-primary/10 text-primary'
      : accent === 'emerald'
        ? 'bg-emerald-100 text-emerald-600'
        : accent === 'amber'
          ? 'bg-amber-100 text-amber-600'
          : 'bg-secondary text-secondary-foreground'
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="font-display text-2xl font-semibold leading-tight">{value}</div>
          {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export function Dashboard({ onRefreshKey, onServicesChanged, businessName }: { onRefreshKey: number; onServicesChanged?: () => void; businessName: string }) {
  const [stats, setStats] = useState<StatsDto | null>(null)
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualPrefill, setManualPrefill] = useState<ManualPrefill | null>(null)

  // PIN zaščita lastniškega območja
  const [locked, setLocked] = useState(true) // zaklenjen, dokler ne preverimo
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinChecking, setPinChecking] = useState(false)

  // Spomniki za jutri
  const [remindersOpen, setRemindersOpen] = useState(false)
  // Osvežitev kartice ponavljanj (nov termin lahko pokrije "na vrsti" stranko)
  const [recurrenceKey, setRecurrenceKey] = useState(0)
  const { toast } = useToast()

  // Ali je PIN nastavljen? (javni podatek) — shranjeni PIN iz seje samodejno
  // odklene ploščo tudi po osvežitvi strani.
  useEffect(() => {
    let cancelled = false
    fetch('/api/pin')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (d) => {
        if (cancelled) return
        if (!d.pinSet) {
          setLocked(false)
          return
        }
        const stored = getStoredPin()
        if (stored) {
          const r = await fetch('/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', pin: stored }),
          })
          if (cancelled) return
          if (r.ok) {
            setLocked(false)
            return
          }
        }
        setLocked(true)
      })
      .catch(() => {
        if (!cancelled) setLocked(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const unlock = async () => {
    if (pinInput.length < 4) return
    setPinChecking(true)
    setPinError(null)
    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: pinInput }),
      })
      if (!res.ok) {
        setPinError('Napačen PIN. Poskusite znova.')
        setPinInput('')
        return
      }
      setStoredPin(pinInput)
      setLocked(false)
      // Statistika je zaščitena s PIN-om — naloži jo zdaj, ko je PIN shranjen
      loadStats()
    } catch {
      setPinError('Povezava ni uspela.')
    } finally {
      setPinChecking(false)
    }
  }

  useEffect(() => {
    const out: string[] = []
    const now = new Date()
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    for (let i = 0; i < 10; i++) {
      const d = new Date(base.getTime() + i * 1440 * 60000)
      out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`)
    }
    setDates(out)
    setSelectedDate(out[0])
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const res = await ownerFetch('/api/stats')
      if (res.ok) setStats(await res.json())
    } catch {
      /* prikažemo skeleton */
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAppointments = useCallback(async (dateStr: string) => {
    setListLoading(true)
    try {
      const res = await ownerFetch(`/api/appointments?date=${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        setAppointments(data.appointments)
      } else {
        setAppointments([])
      }
    } catch {
      setAppointments([])
    } finally {
      setListLoading(false)
    }
  }, [])

  // Podatke naložimo šele, ko je plošča odklenjena (API-ji zahtevajo PIN;
  // sicer bi prvi klic padel s 401 in ostal prazen seznam terminov).
  useEffect(() => {
    if (!locked) loadStats()
  }, [locked, loadStats, onRefreshKey])

  useEffect(() => {
    if (!locked && selectedDate) loadAppointments(selectedDate)
  }, [locked, selectedDate, loadAppointments, onRefreshKey])

  const updateStatus = async (id: string, status: AppointmentDto['status']) => {
    setBusyId(id)
    try {
      const res = await ownerFetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
      loadStats()
      toast(
        status === 'no_show'
          ? {
              title: 'Zabeleženo: stranka ni prišla',
              description: 'Izostanek se vidi pri stranki v zavihku Stranke.',
            }
          : {
              title:
                status === 'confirmed'
                  ? 'Termin potrjen'
                  : status === 'completed'
                    ? 'Termin zaključen'
                    : 'Termin odpovedan',
              description:
                status === 'cancelled' ? 'Stranka je obveščena prek SMS.' : status === 'confirmed' ? 'Potrditveni SMS je poslan.' : undefined,
            }
      )
    } catch {
      toast({ title: 'Napaka', description: 'Posodobitev ni uspela.', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  /** Kopiraj odpovedno povezavo — pošljite jo stranki (WhatsApp), odpove sama. */
  const copyCancelLink = async (a: AppointmentDto) => {
    if (!a.cancelToken || typeof window === 'undefined') return
    const ok = await copyToClipboard(cancelUrl(window.location.origin, a.cancelToken))
    toast(
      ok
        ? {
            title: 'Odpovedna povezava kopirana',
            description: 'Pošljite jo stranki (WhatsApp) — termin odpove sama z enim klikom.',
          }
        : { title: 'Kopiranje ni uspelo', variant: 'destructive' }
    )
  }

  /** Izvozi termine v iCal (.ics) — uvoz v Google/Apple Koledar ali telefon. */
  const exportIcal = async () => {
    try {
      const res = await ownerFetch('/api/appointments/ical')
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'terminai-koledar.ics'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({
        title: 'Koledar izvožen',
        description: 'Datoteko terminai-koledar.ics uvozite v Google Koledar ali telefon.',
      })
    } catch {
      toast({ title: 'Napaka', description: 'Izvoz koledarja ni uspel.', variant: 'destructive' })
    }
  }

  const chartData = (stats?.week ?? []).map((w) => ({
    day: dateParts(w.date).dayName,
    termini: w.count,
    prihodki: Math.round(w.revenueCents / 100),
  }))

  const onManualCreated = (a: AppointmentDto) => {
    void a
    loadStats()
    if (selectedDate) loadAppointments(selectedDate)
    setRecurrenceKey((k) => k + 1)
  }

  const openManual = (prefill: ManualPrefill | null) => {
    setManualPrefill(prefill)
    setManualOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* PIN vrata — zaščita lastniškega območja */}
      {locked ? (
        <Card className="mx-auto max-w-sm border-primary/30">
          <CardContent className="space-y-4 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">Nadzorna plošča je zaklenjena</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Vnesite PIN lastnika — rezervacija strank ostaja odprta.
              </p>
            </div>
            <div className="space-y-1.5 text-left">
              <Input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') unlock() }}
                placeholder="PIN (4–6 števk)"
                className="text-center text-lg tracking-[0.3em]"
                aria-label="PIN lastnika"
                autoFocus
              />
              {pinError && <p className="text-xs text-red-500">{pinError}</p>}
            </div>
            <Button className="w-full gap-1.5" disabled={pinInput.length < 4 || pinChecking} onClick={unlock}>
              {pinChecking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Odkleni
            </Button>
            <p className="text-[11px] text-muted-foreground">
              PIN ste nastavili v zavihku Storitve &amp; salon. Če ste ga pozabili, ga namestitelj ponastavi.
            </p>
          </CardContent>
        </Card>
      ) : (
      <Tabs defaultValue="koledar">
        <TabsList className="h-auto rounded-full p-1">
          <TabsTrigger value="koledar" className="gap-2 rounded-full px-4 py-2">
            <CalendarDays className="h-4 w-4" /> Koledar & statistika
          </TabsTrigger>
          <TabsTrigger value="sporocila" className="gap-2 rounded-full px-4 py-2">
            <MessageSquare className="h-4 w-4" /> Sporočila
          </TabsTrigger>
          <TabsTrigger value="stranke" className="gap-2 rounded-full px-4 py-2">
            <Users className="h-4 w-4" /> Stranke
          </TabsTrigger>
          <TabsTrigger value="storitve" className="gap-2 rounded-full px-4 py-2">
            <Store className="h-4 w-4" /> Storitve & salon
          </TabsTrigger>
        </TabsList>

        <TabsContent value="koledar" className="mt-4">
      <div className="space-y-4">
      {/* Statistika */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Termini danes" value={String(stats.today.count)} sub={`${stats.today.upcoming} še prihaja`} accent="primary" />
            <StatCard icon={<Wallet className="h-5 w-5" />} label="Prihodki meseca" value={formatPrice(stats.month.revenueCents)} sub={`${stats.month.appointments} terminov`} accent="emerald" />
            <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Zasedenost danes" value={`${stats.occupancy}%`} sub="prostih terminov še je" />
            <StatCard icon={<Clock className="h-5 w-5" />} label="Čakajo potrditev" value={String(stats.pending)} sub={`${stats.remindersTomorrow} spomnikov jutri`} accent="amber" />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Koledar dneva */}
        <Card className="border-border/60 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Koledar terminov</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => openManual(null)}>
                <Plus className="h-4 w-4" /> Dodaj termin
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.print()}
                aria-label="Natisni dnevni red"
                title="Natisni dnevni red"
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={exportIcal}
                aria-label="Izvozi koledar (iCal)"
                title="Izvozi koledar (iCal) — Google/telefon"
              >
                <CalendarArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  loadStats()
                  if (selectedDate) loadAppointments(selectedDate)
                }}
                aria-label="Osveži"
                title="Osveži"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="terminai-scroll flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Izberite dan">
              {dates.map((d) => {
                const p = dateParts(d)
                const selected = d === selectedDate
                return (
                  <button
                    key={d}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedDate(d)}
                    className={`flex h-14 w-13 shrink-0 flex-col items-center justify-center rounded-lg border px-3 transition-all focus-visible:outline-2 focus-visible:outline-primary ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground shadow'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <span className={`text-[10px] font-medium uppercase ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{p.dayName}</span>
                    <span className="text-base font-semibold leading-none">{p.dayNum}</span>
                  </button>
                )
              })}
            </div>

            {listLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-30" />
                Na ta dan ni terminov.
              </div>
            ) : (
              <div className="terminai-scroll max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {appointments.map((a) => {
                  const meta = STATUS_META[a.status]
                  const past = new Date(a.startAt) < new Date()
                  return (
                    <div
                      key={a.id}
                      className={`flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
                        a.status === 'cancelled' || a.status === 'no_show'
                          ? 'opacity-50'
                          : 'border-border/60 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary py-1.5">
                        <span className="font-display text-lg font-semibold leading-none">{timeOfIso(a.startAt)}</span>
                        <span className="text-[10px] text-muted-foreground">{durationLabel(a.service.durationMin)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 truncate font-medium">
                            <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                            {a.client.name}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span>
                          {a.recurWeeks != null && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                              title={`Ponavljajoči obisk — ${recurrenceLabel(a.recurWeeks)}`}
                            >
                              <Repeat className="h-3 w-3" /> {recurrenceLabel(a.recurWeeks)}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {a.service.name} · {a.client.phone}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-right font-semibold text-primary">{formatPrice(a.priceCents)}</span>
                        <div className="flex gap-1">
                          {a.status === 'pending' && !past && (
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => updateStatus(a.id, 'confirmed')}
                              disabled={busyId === a.id}
                              aria-label="Potrdi termin"
                              title="Potrdi"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {(a.status === 'confirmed' || a.status === 'pending') && (
                            <>
                              {past ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => updateStatus(a.id, 'completed')}
                                    disabled={busyId === a.id}
                                    aria-label="Zaključi termin"
                                    title="Zaključi"
                                  >
                                    <TrendingUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                                    onClick={() => updateStatus(a.id, 'no_show')}
                                    disabled={busyId === a.id}
                                    aria-label="Stranka ni prišla"
                                    title="Ni prišla — zabeleži izostanek"
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {a.cancelToken && (
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-8 w-8"
                                      onClick={() => copyCancelLink(a)}
                                      aria-label="Kopiraj odpovedno povezavo"
                                      title="Kopiraj odpovedno povezavo — pošlji stranki"
                                    >
                                      <Link2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                                    onClick={() => updateStatus(a.id, 'cancelled')}
                                    disabled={busyId === a.id}
                                    aria-label="Odpovej termin"
                                    title="Odpovej"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Graf + info */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border/60">
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Rezervacije — zadnjih 7 dni</h3>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {loading || !stats ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.015 40)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'oklch(0.5 0.02 30)' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'oklch(0.5 0.02 30)' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        cursor={{ fill: 'oklch(0.52 0.21 16.5 / 0.06)' }}
                        contentStyle={{ borderRadius: 12, border: '1px solid oklch(0.91 0.015 40)', fontSize: 12 }}
                        formatter={(value: number) => [value, 'terminov']}
                      />
                      <Bar dataKey="termini" fill="oklch(0.645 0.246 16.439)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Jutri pred vami</h3>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <strong className="text-foreground">{stats?.remindersTomorrow ?? 0}</strong> terminov jutri
                </li>
                <li className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />
                  Spomniki za <strong className="text-foreground">{stats?.remindersTomorrow ?? 0}</strong> strank pripravljeni — s klikom jih pošljete po WhatsAppu
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <strong className="text-foreground">{stats?.clients ?? 0}</strong> strank v bazi — baza je vaša
                </li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setRemindersOpen(true)}
                disabled={(stats?.remindersTomorrow ?? 0) === 0}
              >
                <Bell className="h-4 w-4" /> Pripravi spomnike ({stats?.remindersTomorrow ?? 0})
              </Button>
            </CardContent>
          </Card>

          <RecurrenceCard refreshKey={recurrenceKey + onRefreshKey} onBookForCustomer={openManual} businessName={businessName} />

          <ShareQrCard />
        </div>
      </div>
      </div>
        </TabsContent>

        <TabsContent value="sporocila" className="mt-4">
          <MessageInbox onBookForCustomer={openManual} />
        </TabsContent>

        <TabsContent value="stranke" className="mt-4">
          <ClientsTab />
        </TabsContent>

        <TabsContent value="storitve" className="mt-4">
          <ServicesManager refreshKey={onRefreshKey} onServicesChanged={onServicesChanged} />
          <div className="mt-4">
            <BackupCard />
          </div>
        </TabsContent>
      </Tabs>
      )}

      {/* Skupni dialog za ročni vnos — odprt s koledarja ali iz Sporočil */}
      <ManualBookingDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        date={selectedDate}
        prefill={manualPrefill}
        onCreated={onManualCreated}
      />

      {/* Spomniki za jutri (WhatsApp osnutki) */}
      <RemindersDialog
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
        businessName={businessName}
        tomorrowDate={dates[1] ?? null}
      />

      {/* Tiskanje dnevenga reda (vidno samo pri tiskanju) */}
      <div id="print-area">
        <div style={{ fontFamily: 'Georgia, serif', color: '#000', padding: '24px' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{businessName}</div>
            <div style={{ fontSize: 13 }}>Dnevni red — {selectedDate ? `${dateParts(selectedDate).dayName}, ${dateParts(selectedDate).dayNum}. ${dateParts(selectedDate).month}` : ''}</div>
          </div>
          {appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show').length === 0 ? (
            <p style={{ textAlign: 'center', fontStyle: 'italic', marginTop: 32 }}>Ni terminov.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px', width: 52 }}>Ura</th>
                  <th style={{ padding: '6px 4px' }}>Stranka</th>
                  <th style={{ padding: '6px 4px' }}>Storitev</th>
                  <th style={{ padding: '6px 4px', width: 90 }}>Telefon</th>
                </tr>
              </thead>
              <tbody>
                {appointments
                  .filter((a) => a.status !== 'cancelled' && a.status !== 'no_show')
                  .sort((a, b) => a.startAt.localeCompare(b.startAt))
                  .map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #ccc' }}>
                      <td style={{ padding: '7px 4px', fontWeight: 700 }}>{timeOfIso(a.startAt)}</td>
                      <td style={{ padding: '7px 4px' }}>{a.client.name}</td>
                      <td style={{ padding: '7px 4px' }}>{a.service.name}</td>
                      <td style={{ padding: '7px 4px' }}>{a.client.phone}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 24, fontSize: 11, color: '#555', textAlign: 'right' }}>
            Natisnjeno {new Date().getUTCDate()}.{new Date().getUTCMonth() + 1}.{new Date().getUTCFullYear()} · TerminAI
          </div>
        </div>
      </div>
    </div>
  )
}

/** QR koda s trenutnim naslovom sistema — stranka v salonu jo oslika in rezervira sama. */
function ShareQrCard() {
  // window.location.origin je na voljo samo v brskalniku (SSR varno)
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => null
  )

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col items-center gap-4 p-4 sm:flex-row">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border bg-white p-2">
          {origin ? (
            <QRCodeSVG value={origin} size={112} bgColor="#ffffff" fgColor="#1a1412" />
          ) : (
            <Skeleton className="h-28 w-28" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <QrCode className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Stranka v salonu rezervira sama</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Stranka s telefonom oslika kodo (telefon mora biti na vašem WiFi) in takoj rezervira —
            brez registracije, na vsakem telefonu. Kodo lahko natisnete in prilepite na ogledalo.
          </p>
          {origin && (
            <p className="truncate rounded-md bg-muted/60 px-2 py-1 font-mono text-[11px] text-muted-foreground" title={origin}>
              {origin.replace(/^https?:\/\//, '')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
