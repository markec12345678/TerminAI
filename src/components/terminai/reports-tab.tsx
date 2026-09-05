'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch } from '@/lib/owner-fetch'
import { monthTitle } from '@/lib/labels'
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Wallet,
  TrendingUp,
  CalendarCheck,
  CalendarX2,
  BarChart3,
  Scissors,
  Users,
  FileSpreadsheet,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'
import { ljTodayKey } from '@/lib/ljubljana'
import type { ReportDto } from './types'
import { formatPrice, slCount } from './types'

function currentMonthKey(): string {
  // Mesec po ljubljanskem wall-clocku (ne po UTC — sicer bi se ob koncu
  // meseca ponoči poročila odprla napačen mesec)
  return ljTodayKey().slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function KpiCard({
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
        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
        : accent === 'amber'
          ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
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

function lastVisitLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`
}

/**
 * Mesečno poročilo — KPI-ji, graf po dnevih, top storitve/stranke
 * in CSV izvoz za knjigovodstvo. Vse za PIN-om (imena + prihodki).
 */
export function ReportsTab({ businessName }: { businessName: string }) {
  const [month, setMonth] = useState<string>(currentMonthKey())
  const [report, setReport] = useState<ReportDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const res = await ownerFetch(`/api/reports?month=${m}`)
      if (res.ok) setReport(await res.json())
      else setReport(null)
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(month)
  }, [month, load])

  /** CSV za knjigovodstvo — prenesemo kot datoteko (blobs, ne navigacija). */
  const downloadCsv = async () => {
    setDownloading(true)
    try {
      const res = await ownerFetch(`/api/reports?month=${month}&format=csv`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `TerminAI-porocilo-${month}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({
        title: 'Poročilo preneseno',
        description: `TerminAI-porocilo-${month}.csv — pošljite ga knjigovodji (odpre se v Excelu).`,
      })
    } catch {
      toast({ title: 'Napaka', description: 'Prenos poročila ni uspel.', variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  const canGoNext = month < currentMonthKey()

  const chartData = (report?.days ?? []).map((d) => ({
    dan: Number(d.date.slice(8, 10)),
    'prihodki (€)': Math.round(d.revenueCents / 100),
  }))

  const hasData = (report?.realizedVisits ?? 0) > 0 || (report?.expectedVisits ?? 0) > 0

  return (
    <div className="space-y-4">
      {/* Glava: mesec + akcije */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold leading-tight">Mesečno poročilo</h3>
              <p className="text-xs text-muted-foreground">{businessName} · za knjigovodstvo in za vas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border bg-card p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                aria-label="Prejšnji mesec"
                title="Prejšnji mesec"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[130px] px-2 text-center text-sm font-semibold capitalize">
                {monthTitle(month)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => canGoNext && setMonth((m) => shiftMonth(m, 1))}
                disabled={!canGoNext}
                aria-label="Naslednji mesec"
                title={canGoNext ? 'Naslednji mesec' : 'Prihodnjih mesecev še ni'}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => void load(month)}
              aria-label="Osveži poročilo"
              title="Osveži"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button className="gap-1.5" onClick={() => void downloadCsv()} disabled={downloading}>
              {downloading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              <span className="hidden sm:inline">Prenesi CSV za knjigovodstvo</span>
              <span className="sm:hidden">CSV</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI-ji */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading || !report ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiCard
              icon={<Wallet className="h-5 w-5" />}
              label="Realizirano"
              value={formatPrice(report.realizedRevenueCents)}
              sub={slCount(report.realizedVisits, 'zaključen obisk', 'zaključena obiska', 'zaključeni obiski', 'zaključenih obiskov')}
              accent="primary"
            />
            <KpiCard
              icon={<CalendarCheck className="h-5 w-5" />}
              label="Pričakovano še"
              value={formatPrice(report.expectedRevenueCents)}
              sub={slCount(report.expectedVisits, 'odprt termin', 'odprta termina', 'odprti termini', 'odprtih terminov')}
              accent="emerald"
            />
            <KpiCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Povprečni obisk"
              value={report.realizedVisits > 0 ? formatPrice(report.avgVisitCents) : '—'}
              sub="realizirana vrednost"
            />
            <KpiCard
              icon={<CalendarX2 className="h-5 w-5" />}
              label="Odpovedani / izostanki"
              value={`${report.cancelled} / ${report.noShow}`}
              sub="iz tega meseca"
              accent="amber"
            />
          </>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : !report || !hasData ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-30" />
            Za {monthTitle(month)} ni še podatkov — izberite drug mesec ali počakajte na prve zaključene termine.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Graf po dnevih */}
          <Card className="border-border/60">
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Realizirani prihodki po dnevih</h3>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.015 40)" vertical={false} />
                    <XAxis
                      dataKey="dan"
                      tick={{ fontSize: 11, fill: 'oklch(0.5 0.02 30)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11, fill: 'oklch(0.5 0.02 30)' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      cursor={{ fill: 'oklch(0.52 0.21 16.5 / 0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid oklch(0.91 0.015 40)', fontSize: 12 }}
                      formatter={(value: number) => [`${value} €`, 'realizirano']}
                      labelFormatter={(label: number) => `${label}. dan v mesecu`}
                    />
                    <Bar dataKey="prihodki (€)" fill="oklch(0.645 0.246 16.439)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top storitve + stranke */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="border-b py-4">
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Najbolj donosne storitve</h3>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {report.topServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ni zaključenih obiskov.</p>
                ) : (
                  <ul className="space-y-2">
                    {report.topServices.map((s, i) => (
                      <li key={s.name} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{s.count}×</span>
                        <span className="w-16 text-right text-sm font-semibold text-primary">
                          {formatPrice(s.revenueCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="border-b py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Najboljše stranke meseca</h3>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {report.topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ni zaključenih obiskov.</p>
                ) : (
                  <ul className="space-y-2">
                    {report.topClients.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.visits}× · zadnji {lastVisitLabel(c.lastVisit)}
                        </span>
                        <span className="w-16 text-right text-sm font-semibold text-primary">
                          {formatPrice(c.revenueCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Opomba za knjigovodstvo */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-start gap-3 p-4">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">CSV za knjigovodstvo</strong> vsebuje samo zaključene
                (obračunane) obiske meseca: datum, uro, stranko, storitev in ceno z decimalno vejico —
                knjigovodja datoteko odpre v Excelu brez pretvorb, vi pa jo pošljete po e-pošti ali prenesete na USB.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
