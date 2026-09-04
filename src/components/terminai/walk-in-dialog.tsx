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
import { playSound } from '@/lib/sounds'
import { Footprints, Phone, Sparkles, RefreshCw, UserRound } from 'lucide-react'
import type { AppointmentDto, AvailabilityDto, ServiceDto, SlotDto } from './types'
import { formatPrice } from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (appointment: AppointmentDto) => void
}

function todayKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

function nowMinutes(): number {
  const now = new Date()
  return now.getUTCHours() * 60 + now.getUTCMinutes()
}

interface ClientMini {
  id: string
  name: string
  phone: string
}

/**
 * Walk-in — stranka je stopila v salon brez termina.
 * Zenoti: "Master walk-in chaos" — pri nas: izberi stranko (ali vpiši novo),
 * storitev in prost slot OD ZDAJ → termin se takoj vpiše kot prijavljen.
 */
export function WalkInDialog({ open, onOpenChange, onCreated }: Props) {
  const [services, setServices] = useState<ServiceDto[]>([])
  const [clients, setClients] = useState<ClientMini[]>([])
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotDto[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [time, setTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  // Današnji datum (UTC — termini so shranjeni kot naivni UTC)
  const date = todayKey()
  const nowMin = nowMinutes()

  useEffect(() => {
    if (!open) return
    setServiceId(null)
    setTime(null)
    setSlots([])
    setName('')
    setPhone('')
    fetch('/api/services')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setServices(d.services))
      .catch(() => toast({ title: 'Napaka', description: 'Storitev ni bilo mogoče naložiti.', variant: 'destructive' }))
    // Baza strank za hiter izbor (PIN — lastnica je odklenila ploščo)
    ownerFetch('/api/clients')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setClients(d.clients.map((c: { id: string; name: string; phone: string }) => ({ id: c.id, name: c.name, phone: c.phone }))))
      .catch(() => setClients([]))
  }, [open, toast])

  const loadSlots = useCallback(async (sid: string) => {
    setSlotsLoading(true)
    setTime(null)
    try {
      const res = await fetch(`/api/availability?serviceId=${sid}&date=${todayKey()}`)
      const data: AvailabilityDto = await res.json()
      setSlots(data.slots ?? [])
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && serviceId) loadSlots(serviceId)
  }, [open, serviceId, loadSlots])

  // Samo sloti, ki še prihajajo (od zdaj naprej + 5 min priprave)
  const freeFromNow = useMemo(
    () =>
      slots.filter((s) => {
        if (!s.available) return false
        const [h, m] = s.time.split(':').map(Number)
        return h * 60 + m >= nowMin + 5
      }),
    [slots, nowMin]
  )

  // Ime se samodejno dopolni iz baze strank (po telefonu)
  const onPhoneChange = (v: string) => {
    setPhone(v)
    const norm = v.replace(/\s/g, '')
    const match = clients.find((c) => c.phone.replace(/\s/g, '') === norm && norm.length >= 6)
    if (match && !name) setName(match.name)
  }

  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId])
  const valid = !!serviceId && !!time && name.trim().length >= 2 && phone.trim().length >= 6

  const submit = async () => {
    if (!serviceId || !time) return
    setSubmitting(true)
    try {
      // Walk-in = stranka je TU: termin se vpiše takoj kot prijavljen (checked_in)
      const res = await ownerFetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          date,
          time,
          name,
          phone,
          status: 'checked_in',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Vnos ni uspel', description: data.error ?? 'Poskusite znova.', variant: 'destructive' })
        if (serviceId) loadSlots(serviceId)
        return
      }
      playSound('arrival')
      toast({
        title: 'Walk-in prijavljen 👋',
        description: `${name} — ${service?.name} ob ${time}. Ko končate, kliknite »Zaključi«.`,
      })
      onOpenChange(false)
      onCreated(data.appointment)
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Footprints className="h-5 w-5 text-primary" /> Walk-in — stranka je tu
          </DialogTitle>
          <DialogDescription>
            Vpis v 10 sekundah: stranka, storitev, prosti slot — takoj prijavljena.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stranka — nova ali iz baze (dopolni se po telefonu) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wi-name" className="flex items-center gap-1">
                <UserRound className="h-3 w-3" /> Ime *
              </Label>
              <Input
                id="wi-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                list="walkin-clients"
                placeholder="npr. Ana Novak"
                maxLength={60}
                autoComplete="off"
              />
              <datalist id="walkin-clients">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-phone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefon *
              </Label>
              <Input
                id="wi-phone"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                placeholder="040 123 456 — ime se dopolni"
                inputMode="tel"
                maxLength={20}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Storitev */}
          <div className="space-y-1.5">
            <Label>Storitev *</Label>
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
          </div>

          {/* Prosti sloti od zdaj naprej */}
          {serviceId && (
            <div className="space-y-1.5">
              <Label>Danes prosti sloti od zdaj *</Label>
              {slotsLoading ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : freeFromNow.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Danes ni več prostih slotov — vpišite jo prek »Dodaj termin« za drug dan.
                </p>
              ) : (
                <div className="terminai-scroll grid max-h-36 grid-cols-4 gap-2 overflow-y-auto pr-1">
                  {freeFromNow.map((s) => {
                    const selected = time === s.time
                    return (
                      <button
                        key={s.time}
                        type="button"
                        onClick={() => setTime(s.time)}
                        aria-pressed={selected}
                        className={`h-10 rounded-lg border text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-primary ${
                          selected
                            ? 'border-primary bg-primary text-primary-foreground shadow-md'
                            : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                        }`}
                      >
                        {s.time}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {service && time && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="font-medium">{service.name}</div>
              <div className="mt-1 flex items-center justify-between text-muted-foreground">
                <span>danes, od {time} naprej</span>
                <span className="font-semibold text-primary">{formatPrice(service.priceCents)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Prekliči
          </Button>
          <Button className="gap-1.5" disabled={!valid || submitting} onClick={submit}>
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Prijavi in vpiši
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
