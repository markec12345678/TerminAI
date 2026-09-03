'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch } from '@/lib/owner-fetch'
import { RECURRENCE_OPTIONS, recurrenceLabel } from '@/lib/labels'
import { Plus, Phone, CalendarPlus, Sparkles, Flame, MessageSquare, Repeat } from 'lucide-react'
import type { AppointmentDto, AvailabilityDto, ServiceDto, SlotDto } from './types'
import { dateParts, formatPrice } from './types'

export interface ManualPrefill {
  name?: string
  phone?: string
  serviceId?: string
  date?: string
  note?: string
  recurWeeks?: number | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  date?: string | null
  prefill?: ManualPrefill | null
  onCreated: (appointment: AppointmentDto) => void
}

function nextDates(days: number): string[] {
  const out: string[] = []
  const now = new Date()
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  for (let i = 0; i < days; i++) {
    const d = new Date(base.getTime() + i * 1440 * 60000)
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`)
  }
  return out
}

/**
 * Ročni vnos termina — za rezervacije, ki so prišle po telefonu ali WhatsAppu.
 * Uporablja isti API kot javni rezervacijski widget (prekrivanja se preverijo).
 * Podprt tudi kot nadzorovan dialog s predizpolnjenimi podatki (iz modula Sporočila).
 */
export function ManualBookingDialog({ open, onOpenChange, date, prefill, onCreated }: Props) {
  const [services, setServices] = useState<ServiceDto[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotDto[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [time, setTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [recurWeeks, setRecurWeeks] = useState<string>('none')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  // Ob odprtju dialoga: naloži storitve, pripravi datume in predizpolni podatke
  useEffect(() => {
    if (!open) return
    const ds = nextDates(14)
    setDates(ds)
    const wanted = prefill?.date ?? date
    setPickedDate(wanted && ds.includes(wanted) ? wanted : ds[0])
    setServiceId(prefill?.serviceId ?? null)
    setName(prefill?.name ?? '')
    setPhone(prefill?.phone ?? '')
    setNotes(prefill?.note ?? '')
    setRecurWeeks(prefill?.recurWeeks != null ? String(prefill.recurWeeks) : 'none')
    setServicesLoading(true)
    fetch('/api/services')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setServices(d.services))
      .catch(() => toast({ title: 'Napaka', description: 'Storitev ni bilo mogoče naložiti.', variant: 'destructive' }))
      .finally(() => setServicesLoading(false))
  }, [open, date, prefill, toast])

  const loadSlots = useCallback(async (sid: string, dateStr: string) => {
    setSlotsLoading(true)
    setTime(null)
    try {
      const res = await fetch(`/api/availability?serviceId=${sid}&date=${dateStr}`)
      const data: AvailabilityDto = await res.json()
      setSlots(data.slots ?? [])
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && serviceId && pickedDate) loadSlots(serviceId, pickedDate)
  }, [open, serviceId, pickedDate, loadSlots])
  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId])
  const slot = useMemo(() => slots.find((s) => s.time === time) ?? null, [slots, time])

  const reset = () => {
    setServiceId(null)
    setTime(null)
    setSlots([])
    setName('')
    setPhone('')
    setNotes('')
    setRecurWeeks('none')
  }

  const submit = async () => {
    if (!serviceId || !pickedDate || !time) return
    setSubmitting(true)
    try {
      // ownerFetch: nosi PIN glavo, da ponavljajoča nastavitev ostane varovana
      const res = await ownerFetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          date: pickedDate,
          time,
          name,
          phone,
          notes,
          recurWeeks: recurWeeks === 'none' ? null : Number(recurWeeks),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Vnos ni uspel', description: data.error ?? 'Poskusite znova.', variant: 'destructive' })
        if (serviceId && pickedDate) loadSlots(serviceId, pickedDate)
        return
      }
      toast({
        title: 'Termin vnešen ✓',
        description:
          recurWeeks !== 'none'
            ? `${name} — ${service?.name}, ${dateParts(pickedDate!).dayName} ob ${time} · ${recurrenceLabel(Number(recurWeeks))}`
            : `${name} — ${service?.name}, ${dateParts(pickedDate!).dayName} ob ${time}`,
      })
      onOpenChange(false)
      reset()
      onCreated(data.appointment)
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const valid = !!serviceId && !!pickedDate && !!time && name.trim().length >= 2 && phone.trim().length >= 6

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <CalendarPlus className="h-5 w-5 text-primary" /> Dodaj termin
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            Za rezervacije po telefonu, WhatsAppu ali SMS — vnos traja nekaj sekund.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stranka */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mb-name">Ime in priimek *</Label>
              <Input id="mb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Ana Novak" maxLength={60} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mb-phone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefon *
              </Label>
              <Input id="mb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="npr. 040 123 456" inputMode="tel" maxLength={20} autoComplete="off" />
            </div>
          </div>

          {/* Storitev */}
          <div className="space-y-1.5">
            <Label>Storitev *</Label>
            {servicesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={serviceId ?? ''} onValueChange={(v) => setServiceId(v || null)}>
                <SelectTrigger className="w-full" aria-label="Izberite storitev">
                  <SelectValue placeholder="Izberite storitev …" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {formatPrice(s.priceCents)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Dan */}
          <div className="space-y-1.5">
            <Label>Dan *</Label>
            <div className="terminai-scroll flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Izberite dan">
              {dates.map((d) => {
                const p = dateParts(d)
                const selected = d === pickedDate
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPickedDate(d)}
                    className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-center transition-all focus-visible:outline-2 focus-visible:outline-primary ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground shadow'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <span className={`text-[10px] font-medium uppercase ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{p.dayName}</span>
                    <span className="text-base font-semibold leading-none">{p.dayNum}</span>
                    <span className={`text-[10px] ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{p.month}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ura */}
          {serviceId && pickedDate && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Ura *</Label>
                <span className="text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-amber-400" /> vršni čas
                  </span>
                </span>
              </div>
              {slotsLoading ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Na ta dan ni prostih terminov — izberite drug dan.
                </p>
              ) : (
                <div className="terminai-scroll grid max-h-40 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
                  {slots.map((s) => {
                    const selected = time === s.time
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.available}
                        onClick={() => setTime(s.time)}
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
                          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-amber-900">
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

          {/* Ponavljanje + opomba */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Repeat className="h-3 w-3" /> Ponavljajoči obisk
              </Label>
              <Select value={recurWeeks} onValueChange={setRecurWeeks}>
                <SelectTrigger className="w-full" aria-label="Ponavljajoči obisk">
                  <SelectValue placeholder="Brez ponavljanja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brez ponavljanja</SelectItem>
                  {RECURRENCE_OPTIONS.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      {recurrenceLabel(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Npr. barvanje vsake 4 tedne — sistem vas opomni, kdaj je stranka spet na vrsti.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mb-notes">Opomba (neobvezno)</Label>
              <Textarea id="mb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="npr. iz WhatsAppa — rada bi sobotni termin" rows={3} maxLength={300} />
            </div>
          </div>

          {/* Povzetek */}
          {service && slot && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{service.name}</span>
                {recurWeeks !== 'none' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Repeat className="h-3 w-3" /> {recurrenceLabel(Number(recurWeeks))}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-muted-foreground">
                <span>
                  {dateParts(pickedDate!).dayName}, {dateParts(pickedDate!).dayNum}. {dateParts(pickedDate!).month} ob {slot.time}
                </span>
                <span className="font-semibold text-primary">{formatPrice(slot.priceCents)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Prekliči
          </Button>
          <Button className="gap-1.5" disabled={!valid || submitting} onClick={submit}>
            {submitting ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" /> Vnašam …
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Vnesi termin
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
