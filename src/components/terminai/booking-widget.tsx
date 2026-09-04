'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  Scissors,
  Clock,
  Calendar as CalendarIcon,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Phone,
  User,
  Bell,
  MapPin,
  Flame,
  Link2,
  Copy,
  Check,
} from 'lucide-react'
import type { AppointmentDto, AvailabilityDto, ClosedDayDto, ServiceDto, SlotDto } from './types'
import { dateParts, durationLabel, formatPrice, timeOfIso, cancelUrl } from './types'
import { copyToClipboard } from '@/lib/clipboard'
import { WhatsAppIcon, waLink, waBookingText } from './whatsapp'

type Step = 'service' | 'datetime' | 'details' | 'done'

interface Props {
  services: ServiceDto[]
  businessName: string
  businessTagline: string | null
  businessAddress: string
  businessPhone: string
  loading: boolean
  onBooked: (appointment: AppointmentDto) => void
}

export function BookingWidget({ services, businessName, businessTagline, businessAddress, businessPhone, loading, onBooked }: Props) {
  const [step, setStep] = useState<Step>('service')
  const [service, setService] = useState<ServiceDto | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState<string | null>(null)
  const [closedDays, setClosedDays] = useState<Map<string, string>>(new Map())
  const [closedReason, setClosedReason] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotDto[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slot, setSlot] = useState<SlotDto | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState<AppointmentDto | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const { toast } = useToast()

  // Trenutni naslov strani (SSR varno) — za odpovedno povezavo
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ''
  )

  // Se naslednjih 14 dni
  useEffect(() => {
    const out: string[] = []
    const now = new Date()
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    for (let i = 0; i < 14; i++) {
      const d = new Date(base.getTime() + i * 1440 * 60000)
      out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`)
    }
    setDates(out)
  }, [])

  // Zaprti dnevi (prazniki, dopust) — za trak dni (javni API)
  useEffect(() => {
    fetch('/api/closed-days')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { days: ClosedDayDto[] }) => {
        setClosedDays(new Map(d.days.map((x) => [x.date, x.reason ?? ''])))
      })
      .catch(() => {
        /* trak dni deluje tudi brez — dan je le izberljiv */
      })
  }, [])

  const loadSlots = useCallback(async (serviceId: string, dateStr: string) => {
    setSlotsLoading(true)
    setSlot(null)
    try {
      const res = await fetch(`/api/availability?serviceId=${serviceId}&date=${dateStr}`)
      const data: AvailabilityDto = await res.json()
      setSlots(data.slots ?? [])
      setClosedReason(data.closedReason ?? null)
    } catch {
      setSlots([])
      toast({ title: 'Napaka', description: 'Terminov ni bilo mogoče naložiti.', variant: 'destructive' })
    } finally {
      setSlotsLoading(false)
    }
  }, [toast])

  const selectService = (s: ServiceDto) => {
    setService(s)
    setStep('datetime')
    if (date) loadSlots(s.id, date)
  }

  const selectDate = (d: string) => {
    setDate(d)
    if (service) loadSlots(service.id, d)
  }

  const selectedPrice = useMemo(() => {
    if (!service) return 0
    if (slot) return slot.priceCents
    return service.priceCents
  }, [service, slot])

  const submit = async () => {
    if (!service || !date || !slot) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: service.id, date, time: slot.time, name, phone, notes }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Rezervacija ni uspela', description: data.error ?? 'Poskusite znova.', variant: 'destructive' })
        if (date && service) loadSlots(service.id, date)
        return
      }
      setConfirmed(data.appointment)
      setStep('done')
      onBooked(data.appointment)
      toast({
        title: 'Termin rezerviran! 🎉',
        description: `${service.name} — ${dateParts(date!).dayNum}. ${dateParts(date!).month} ob ${slot.time}`,
      })
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep('service')
    setService(null)
    setDate(null)
    setSlot(null)
    setSlots([])
    setName('')
    setPhone('')
    setNotes('')
    setConfirmed(null)
  }

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'service', label: 'Storitev', icon: <Scissors className="h-4 w-4" /> },
    { key: 'datetime', label: 'Termin', icon: <Clock className="h-4 w-4" /> },
    { key: 'details', label: 'Podatki', icon: <User className="h-4 w-4" /> },
    { key: 'done', label: 'Potrditev', icon: <CheckCircle2 className="h-4 w-4" /> },
  ]
  const activeIndex = steps.findIndex((s) => s.key === step)

  return (
    <Card className="overflow-hidden border-border/60 shadow-xl shadow-primary/5">
      <CardHeader className="border-b bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Scissors className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold leading-tight">{businessName}</h3>
                <p className="text-xs text-primary-foreground/75">{businessTagline ?? 'Rezervirajte svoj termin'}</p>
              </div>
            </div>
          </div>
          <div className="hidden sm:block text-right text-xs text-primary-foreground/75">
            <div className="flex items-center justify-end gap-1">
              <MapPin className="h-3 w-3" /> {businessAddress.split(',')[0]}
            </div>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <Phone className="h-3 w-3" /> {businessPhone}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center gap-1.5">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                  i < activeIndex
                    ? 'bg-white text-primary'
                    : i === activeIndex
                      ? 'bg-white text-primary ring-2 ring-white/50'
                      : 'bg-white/15 text-primary-foreground/60'
                }`}
                aria-current={i === activeIndex ? 'step' : undefined}
              >
                {i < activeIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`hidden md:block text-[11px] font-medium ${i === activeIndex ? 'text-white' : 'text-primary-foreground/60'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <div className={`h-px flex-1 ${i < activeIndex ? 'bg-white/70' : 'bg-white/20'}`} />}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : step === 'service' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Izberite storitev:</p>
            <div className="space-y-2.5">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectService(s)}
                  className="group flex w-full items-center justify-between rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div className="min-w-0 pr-3">
                    <div className="font-medium leading-tight">{s.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{durationLabel(s.durationMin)}</span>
                      {s.description && <span className="hidden sm:inline">{s.description}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-primary">{formatPrice(s.priceCents)}</div>
                    <div className="text-[10px] text-muted-foreground">vršni {formatPrice(s.peakPriceCents)}</div>
                  </div>
                  <ArrowRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        ) : step === 'datetime' && service ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep('service')} className="gap-1 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Nazaj
              </Button>
              <div className="text-sm font-medium truncate">{service.name}</div>
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Clock className="h-3 w-3" /> {durationLabel(service.durationMin)}
              </Badge>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Izberite dan</p>
              <div className="terminai-scroll flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Izberite dan">
                {dates.map((d) => {
                  const p = dateParts(d)
                  const isToday = d === dates[0]
                  const selected = d === date
                  const closed = closedDays.has(d)
                  const reason = closedDays.get(d)
                  return (
                    <button
                      key={d}
                      role="radio"
                      aria-checked={selected}
                      disabled={closed}
                      title={closed ? `Zaprto${reason ? ` — ${reason}` : ''}` : undefined}
                      onClick={() => selectDate(d)}
                      className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center transition-all focus-visible:outline-2 focus-visible:outline-primary ${
                        closed
                          ? 'cursor-not-allowed border-border/40 bg-muted/60 text-muted-foreground/40'
                          : selected
                            ? 'border-primary bg-primary text-primary-foreground shadow-md'
                            : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                      }`}
                    >
                      <span className={`text-[10px] font-medium uppercase ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {p.dayName}
                      </span>
                      <span className={`text-lg font-semibold leading-none ${closed ? 'line-through' : ''}`}>{p.dayNum}</span>
                      <span className={`text-[10px] ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{p.month}</span>
                      {isToday && !selected && <span className="absolute" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {date && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prosti termini</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-amber-400" /> vršni čas
                    </span>
                  </div>
                </div>
                {slotsLoading ? (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <CalendarIcon className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    {closedReason
                      ? <>Na ta dan je salon zaprt <span className="text-rose-600">({closedReason})</span>. Izberite drug dan.</>
                      : <>Na ta dan je salon zaprt. Izberite drug dan.</>}
                  </div>
                ) : (
                  <div className="terminai-scroll grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
                    {slots.map((s) => {
                      const selected = slot?.time === s.time
                      return (
                        <button
                          key={s.time}
                          disabled={!s.available}
                          onClick={() => setSlot(s)}
                          aria-pressed={selected}
                          className={`relative h-10 rounded-lg border text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-primary ${
                            selected
                              ? 'border-primary bg-primary text-primary-foreground shadow-md'
                              : s.available
                                ? 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                                : 'cursor-not-allowed border-transparent bg-muted text-muted-foreground/35 line-through'
                          }`}
                        >
                          {s.time}
                          {s.available && s.peak && !selected && (
                            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[7px] text-amber-900" title="Vršni čas">
                              <Flame className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 p-3">
              <div className="text-xs text-muted-foreground">
                {slot ? (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateParts(date!).dayName}, {dateParts(date!).dayNum}. {dateParts(date!).month} ob {slot.time}
                    </span>
                    {slot.peak && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">vršni čas</span>}
                  </>
                ) : (
                  'Izberite dan in uro …'
                )}
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold text-primary">{formatPrice(selectedPrice)}</div>
              </div>
              <Button disabled={!slot} onClick={() => setStep('details')} className="gap-1">
                Naprej <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : step === 'details' && service && date && slot ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('datetime')} className="gap-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Nazaj na termin
            </Button>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-name">Ime in priimek *</Label>
                <Input
                  id="bk-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="npr. Ana Novak"
                  autoComplete="name"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-phone">Telefon * <span className="text-muted-foreground font-normal">(za SMS spominik)</span></Label>
                <Input
                  id="bk-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="npr. 040 123 456"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={20}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-notes">Opomba (neobvezno)</Label>
                <Textarea
                  id="bk-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="npr. rada bi krajšo frizuro, konkretno po zgornji sliki"
                  rows={2}
                  maxLength={300}
                />
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-3 text-sm">
              <div className="font-medium">{service.name}</div>
              <div className="mt-1 flex items-center justify-between text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateParts(date).dayName}, {dateParts(date).dayNum}. {dateParts(date).month} ob {slot.time}
                </span>
                <span className="font-semibold text-primary">{formatPrice(selectedPrice)}</span>
              </div>
            </div>

            <Button className="w-full gap-2 text-base" size="lg" disabled={submitting || name.trim().length < 2 || phone.trim().length < 6} onClick={submit}>
              {submitting ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" /> Rezerviram …
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Potrdi rezervacijo
                </>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Odpoved brez stroškov do 24 h pred terminom. Spominik vam pošljemo dan prej.
            </p>
          </div>
        ) : confirmed ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h4 className="font-display text-2xl font-semibold">Termin potrjen!</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {confirmed.client.name}, vidimo se kmalu. 🌸
            </p>

            <div className="mx-auto mt-5 max-w-sm space-y-2.5 rounded-xl border bg-muted/40 p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storitev</span>
                <span className="font-medium">{confirmed.service.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Termin</span>
                <span className="font-medium">
                  {confirmed.startAt.split('T')[0].split('-').reverse().join('.').slice(0, 8)} ob {timeOfIso(confirmed.startAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trajanje</span>
                <span className="font-medium">{durationLabel(confirmed.service.durationMin)}</span>
              </div>
              <div className="flex justify-between border-t pt-2.5">
                <span className="text-muted-foreground">Cena</span>
                <span className="font-semibold text-primary">{formatPrice(confirmed.priceCents)}</span>
              </div>
            </div>

            <div className="mx-auto mt-4 flex max-w-sm items-center gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
              <Bell className="h-4 w-4 shrink-0 text-primary" />
              SMS spominik bo poslan na {confirmed.client.phone} dan pred terminom.
            </div>

            {/* Odpovedna povezava — stranka lahko termin odpove sama z enim klikom */}
            {confirmed.cancelToken && origin && (
              <div className="mx-auto mt-3 max-w-sm rounded-xl border border-dashed p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  Shranite to povezavo — z njo lahko termin odpovete kadar koli:
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-foreground" title={cancelUrl(origin, confirmed.cancelToken)}>
                    {cancelUrl(origin, confirmed.cancelToken).replace(/^https?:\/\//, '')}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1.5"
                    onClick={async () => {
                      const ok = await copyToClipboard(cancelUrl(origin, confirmed.cancelToken!))
                      if (ok) {
                        setLinkCopied(true)
                        setTimeout(() => setLinkCopied(false), 2000)
                      } else {
                        toast({ title: 'Kopiranje ni uspelo', description: 'Povezavo prepišite ročno.', variant: 'destructive' })
                      }
                    }}
                  >
                    {linkCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {linkCopied ? 'Kopirano' : 'Kopiraj'}
                  </Button>
                </div>
              </div>
            )}

            <Button variant="outline" className="mt-5" onClick={reset}>
              Nova rezervacija
            </Button>
          </div>
        ) : null}
      </CardContent>

      {/* Nadomestni kanal za stranke izven salona: klic ali WhatsApp (zastonj, brez API-ja) */}
      {!loading && (
        <div className="border-t bg-muted/30 px-4 py-3 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-2.5 sm:flex-row">
            <p className="text-xs text-muted-foreground">Niste v salonu? Pišite ali pokličite — vpišemo vas:</p>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={`tel:${businessPhone.replace(/\s/g, '')}`}>
                  <Phone className="h-3.5 w-3.5" /> Pokliči
                </a>
              </Button>
              <Button asChild size="sm" className="gap-1.5 bg-[#25D366] text-white hover:bg-[#1eb856]">
                <a href={waLink(businessPhone, waBookingText(service?.name))} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
