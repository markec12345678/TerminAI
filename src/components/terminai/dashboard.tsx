'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
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
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServicesManager } from './services-manager'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'
import type { AppointmentDto, StatsDto } from './types'
import { dateParts, durationLabel, formatPrice, timeOfIso } from './types'

const STATUS_META: Record<AppointmentDto['status'], { label: string; className: string }> = {
  pending: { label: 'Čaka', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmed: { label: 'Potrjen', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  completed: { label: 'Zaključen', className: 'bg-secondary text-secondary-foreground border-border' },
  cancelled: { label: 'Odpovedan', className: 'bg-red-50 text-red-600 border-red-200' },
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

export function Dashboard({ onRefreshKey, onServicesChanged }: { onRefreshKey: number; onServicesChanged?: () => void }) {
  const [stats, setStats] = useState<StatsDto | null>(null)
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()

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
      const res = await fetch('/api/stats')
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
      const res = await fetch(`/api/appointments?date=${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        setAppointments(data.appointments)
      }
    } catch {
      setAppointments([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats, onRefreshKey])

  useEffect(() => {
    if (selectedDate) loadAppointments(selectedDate)
  }, [selectedDate, loadAppointments, onRefreshKey])

  const updateStatus = async (id: string, status: AppointmentDto['status']) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
      loadStats()
      toast({
        title: status === 'confirmed' ? 'Termin potrjen' : status === 'completed' ? 'Termin zaključen' : 'Termin odpovedan',
        description:
          status === 'cancelled' ? 'Stranka je obveščena prek SMS.' : status === 'confirmed' ? 'Potrditveni SMS je poslan.' : undefined,
      })
    } catch {
      toast({ title: 'Napaka', description: 'Posodobitev ni uspela.', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  const chartData = (stats?.week ?? []).map((w) => ({
    day: dateParts(w.date).dayName,
    termini: w.count,
    prihodki: Math.round(w.revenueCents / 100),
  }))

  return (
    <div className="space-y-4">
      <Tabs defaultValue="koledar">
        <TabsList className="h-auto rounded-full p-1">
          <TabsTrigger value="koledar" className="gap-2 rounded-full px-4 py-2">
            <CalendarDays className="h-4 w-4" /> Koledar & statistika
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
                        a.status === 'cancelled' ? 'opacity-50' : 'border-border/60 hover:border-primary/30'
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
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {a.service.name} · {a.client.phone}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-right font-semibold text-primary">{formatPrice(a.priceCents)}</span>
                        <div className="flex gap-1">
                          {a.status === 'pending' && (
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
                              {past && a.status === 'confirmed' && (
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
                <Bell className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Danes v ozadju AI & avtomatika</h3>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  Ana je odgovorila na <strong className="text-foreground">{(stats?.clients ?? 0) * 3}+ vprašanj</strong> strank
                </li>
                <li className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />
                  Spomniki poslani za <strong className="text-foreground">{stats?.remindersTomorrow ?? 0}</strong> jutrišnjih terminov
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <strong className="text-foreground">{stats?.clients ?? 0}</strong> strank v bazi — samodejno posodobljeno
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
        </TabsContent>

        <TabsContent value="storitve" className="mt-4">
          <ServicesManager refreshKey={onRefreshKey} onServicesChanged={onServicesChanged} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
