'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch, setStoredPin } from '@/lib/owner-fetch'
import { Plus, Pencil, Trash2, Scissors, RefreshCcw, Store, Clock, Flame, MapPin, Phone, Mail, Save, Building2, KeyRound, CalendarClock, CalendarX, PartyPopper, Sun, X, Upload, History } from 'lucide-react'
import type { ServiceDto, BusinessDto, ClosedDayDto } from './types'
import { durationLabel, formatPrice, dateParts } from './types'
import { Switch } from '@/components/ui/switch'

const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180]
const BUFFERS = [0, 5, 10, 15, 20, 30]

interface FormState {
  name: string
  description: string
  durationMin: string
  bufferMin: string
  price: string
  peakPrice: string
  category: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  durationMin: '30',
  bufferMin: '0',
  price: '',
  peakPrice: '',
  category: '',
}

function eurosToCents(v: string): number | null {
  const n = Number(v.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export function ServicesManager({ refreshKey, onServicesChanged }: { refreshKey: number; onServicesChanged?: () => void }) {
  const [services, setServices] = useState<ServiceDto[]>([])
  const [businessName, setBusinessName] = useState<string>('Studio Aura')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceDto | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()

  // Podatki salona (ime, telefon, naslov, e-pošta) — urejanje BREZ brisanja
  const [biz, setBiz] = useState<BusinessDto | null>(null)
  const [bizForm, setBizForm] = useState({ name: '', phone: '', address: '', email: '' })
  const [bizSaving, setBizSaving] = useState(false)

  // Delovni čas (7 dni, iz baze) + premor
  const [hoursRows, setHoursRows] = useState<{
    dayOfWeek: number
    dayName: string
    open: string
    close: string
    breakStart: string
    breakEnd: string
    closed: boolean
  }[]>([])
  const [hoursSaving, setHoursSaving] = useState(false)

  // Zaprti dnevi (prazniki, dopust)
  const [closedDays, setClosedDays] = useState<ClosedDayDto[]>([])
  const [cdForm, setCdForm] = useState({ date: '', reason: '' })
  const [vacForm, setVacForm] = useState({ from: '', to: '', reason: 'dopust' })
  const [cdBusy, setCdBusy] = useState<string | null>(null)

  // PIN zaščita
  const [pinSet, setPinSet] = useState(false)
  const [pinNew, setPinNew] = useState('')
  const [pinCurrent, setPinCurrent] = useState('')
  const [pinSaving, setPinSaving] = useState(false)

  // Reset na čist salon
  const [resetOpen, setResetOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/services')
      if (res.ok) {
        const data = await res.json()
        setServices(data.services)
        if (data.business?.name) setBusinessName(data.business.name)
        if (data.business) {
          setBiz(data.business)
          setBizForm({
            name: data.business.name ?? '',
            phone: data.business.phone ?? '',
            address: data.business.address ?? '',
            email: data.business.email ?? '',
          })
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // Zaprti dnevi — javni seznam (trakovi dni + kartica)
  const loadClosedDays = useCallback(() => {
    fetch('/api/closed-days')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { days: ClosedDayDto[] }) => setClosedDays(d.days))
      .catch(() => {
        /* ne kritično */
      })
  }, [])

  // Delovni čas + stanje PIN-a + zaprti dnevi (enkrat)
  useEffect(() => {
    fetch('/api/hours')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) =>
        setHoursRows(
          (d.hours as { dayOfWeek: number; dayName: string; open: string | null; close: string | null; breakStart: string | null; breakEnd: string | null; closed: boolean }[]).map((h) => ({
            dayOfWeek: h.dayOfWeek,
            dayName: h.dayName,
            open: h.open ?? '09:00',
            close: h.close ?? '18:00',
            breakStart: h.breakStart ?? '',
            breakEnd: h.breakEnd ?? '',
            closed: h.closed,
          }))
        )
      )
      .catch(() => setHoursRows([]))
    fetch('/api/pin')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPinSet(d.pinSet))
      .catch(() => setPinSet(false))
    loadClosedDays()
  }, [loadClosedDays])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (s: ServiceDto) => {
    setEditing(s)
    setForm({
      name: s.name,
      description: s.description ?? '',
      durationMin: String(s.durationMin),
      bufferMin: String(s.bufferMin ?? 0),
      price: (s.priceCents / 100).toFixed(2).replace('.', ','),
      peakPrice: (s.peakPriceCents / 100).toFixed(2).replace('.', ','),
      category: s.category ?? '',
    })
    setDialogOpen(true)
  }

  const save = async () => {
    const priceCents = eurosToCents(form.price)
    let peakCents = eurosToCents(form.peakPrice || form.price)
    if (priceCents === null || peakCents === null) {
      toast({ title: 'Napačna cena', description: 'Vnesite ceno v evrih, npr. 25 ali 25,50.', variant: 'destructive' })
      return
    }
    if (peakCents < priceCents) peakCents = priceCents

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        durationMin: Number(form.durationMin),
        bufferMin: Number(form.bufferMin),
        priceCents,
        peakPriceCents: peakCents,
        category: form.category,
      }
      const res = editing
        ? await ownerFetch(`/api/services/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await ownerFetch('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Shranjevanje ni uspelo.', variant: 'destructive' })
        return
      }
      toast({
        title: editing ? 'Storitev posodobljena' : 'Storitev dodana',
        description: payload.name,
      })
      setDialogOpen(false)
      load()
      onServicesChanged?.()
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (s: ServiceDto) => {
    setBusyId(s.id)
    try {
      const res = await ownerFetch(`/api/services/${s.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Brisanje blokirano', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Storitev odstranjena', description: `${s.name} — zgodovina terminov ostane shranjena.` })
      load()
      onServicesChanged?.()
    } catch {
      toast({ title: 'Napaka', description: 'Brisanje ni uspelo.', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  const freshStart = async () => {
    setResetting(true)
    try {
      const res = await ownerFetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'fresh',
          businessName: newName,
          phone: newPhone,
          address: newAddress,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Reset ni uspel.', variant: 'destructive' })
        return
      }
      toast({
        title: 'Salon pripravljen! ✨',
        description: `${newName} — sedaj dodajte svoje storitve in cene.`,
      })
      setResetOpen(false)
      setBusinessName(newName)
      setServices([])
      onServicesChanged?.()
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setResetting(false)
    }
  }

  const saveBiz = async () => {
    if (bizForm.name.trim().length < 2 || bizForm.phone.trim().length < 6) {
      toast({ title: 'Manjkajo podatki', description: 'Ime in telefon sta obvezna.', variant: 'destructive' })
      return
    }
    setBizSaving(true)
    try {
      const res = await ownerFetch('/api/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'edit',
          businessName: bizForm.name.trim(),
          phone: bizForm.phone.trim(),
          address: bizForm.address.trim(),
          city: biz?.city ?? '',
          email: bizForm.email.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Shranjevanje ni uspelo.', variant: 'destructive' })
        return
      }
      toast({ title: 'Podatki salona shranjeni ✓', description: 'Izpisujejo se strankam na strani in v odgovorih.' })
      setBusinessName(bizForm.name)
      onServicesChanged?.()
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setBizSaving(false)
    }
  }

  const saveHours = async () => {
    const openDays = hoursRows.filter((r) => !r.closed)
    for (const r of openDays) {
      if (r.open >= r.close) {
        toast({ title: 'Napačen delovni čas', description: `${r.dayName}: konec mora biti pozneje od začetka.`, variant: 'destructive' })
        return
      }
      if ((r.breakStart && !r.breakEnd) || (!r.breakStart && r.breakEnd)) {
        toast({ title: 'Napačen premor', description: `${r.dayName}: vnesite začetek IN konec premora (ali pustite oba prazna).`, variant: 'destructive' })
        return
      }
      if (r.breakStart && r.breakEnd && (r.breakStart >= r.breakEnd || r.breakStart <= r.open || r.breakEnd >= r.close)) {
        toast({ title: 'Napačen premor', description: `${r.dayName}: premor mora biti znotraj delovnega časa.`, variant: 'destructive' })
        return
      }
    }
    setHoursSaving(true)
    try {
      const res = await ownerFetch('/api/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours: openDays.map((r) => ({
            dayOfWeek: r.dayOfWeek,
            open: r.open,
            close: r.close,
            breakStart: r.breakStart || null,
            breakEnd: r.breakEnd || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Shranjevanje ni uspelo.', variant: 'destructive' })
        return
      }
      toast({ title: 'Delovni čas shranjen ✓', description: 'Prosti termini se takoj preračunajo.' })
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setHoursSaving(false)
    }
  }

  // --- Zaprti dnevi (akcije) ---
  const addClosedDay = async () => {
    if (!cdForm.date) {
      toast({ title: 'Manjka datum', description: 'Izberite datum, ki ga želite zapreti.', variant: 'destructive' })
      return
    }
    setCdBusy('add')
    try {
      const res = await ownerFetch('/api/closed-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', date: cdForm.date, reason: cdForm.reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Dan zaprt ✓', description: `${cdForm.date}${cdForm.reason ? ` — ${cdForm.reason}` : ''} — stranke ga ne morejo izbrati.` })
      setCdForm({ date: '', reason: '' })
      loadClosedDays()
    } catch {
      toast({ title: 'Napaka', description: 'Zaprti dan ni bil shranjen.', variant: 'destructive' })
    } finally {
      setCdBusy(null)
    }
  }

  const addVacation = async () => {
    if (!vacForm.from || !vacForm.to) {
      toast({ title: 'Manjkajo datumi', description: 'Izberite od in do (npr. dopust teden dni).', variant: 'destructive' })
      return
    }
    if (vacForm.from > vacForm.to) {
      toast({ title: 'Napačen obseg', description: '"Od" mora biti pred "do".', variant: 'destructive' })
      return
    }
    setCdBusy('vac')
    try {
      const res = await ownerFetch('/api/closed-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-range', from: vacForm.from, to: vacForm.to, reason: vacForm.reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Dopust zaprt ✓', description: `Zaprtih dni: ${data.added} — spomniki in rezervacije se prilagodijo.` })
      setVacForm({ from: '', to: '', reason: 'dopust' })
      loadClosedDays()
    } catch {
      toast({ title: 'Napaka', description: 'Dopusta ni bilo mogoče zapreti.', variant: 'destructive' })
    } finally {
      setCdBusy(null)
    }
  }

  const importHolidays = async () => {
    setCdBusy('hol')
    try {
      const year = new Date().getFullYear()
      const res = await ownerFetch('/api/closed-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'holidays', years: [year, year + 1] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: data.added > 0 ? `Dodanih ${data.added} praznikov ✓` : 'Prazniki so že uvoženi',
        description: `${year} in ${year + 1} — salon teh dni ne ponuja terminov.`,
      })
      loadClosedDays()
    } catch {
      toast({ title: 'Napaka', description: 'Uvoz praznikov ni uspel.', variant: 'destructive' })
    } finally {
      setCdBusy(null)
    }
  }

  const removeClosedDay = async (date: string) => {
    setCdBusy(date)
    try {
      const res = await ownerFetch(`/api/closed-days?date=${encodeURIComponent(date)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Dan spet odprt', description: `${date} — termini se takoj ponudijo.` })
      loadClosedDays()
    } catch {
      toast({ title: 'Napaka', description: 'Brisanje ni uspelo.', variant: 'destructive' })
    } finally {
      setCdBusy(null)
    }
  }

  const savePin = async () => {
    if (pinNew.length < 4) {
      toast({ title: 'PIN je prekratki', description: 'Uporabite 4–6 števk.', variant: 'destructive' })
      return
    }
    if (pinSet && pinCurrent.length < 4) {
      toast({ title: 'Manjka trenutni PIN', description: 'Za spremembo vnesite trenutni PIN.', variant: 'destructive' })
      return
    }
    setPinSaving(true)
    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', pin: pinNew, currentPin: pinCurrent || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Nastavitev ni uspela.', variant: 'destructive' })
        return
      }
      toast({ title: 'PIN nastavljen ✓', description: 'Nadzorna plošča se ob naslednjem obisku zaklene.' })
      setStoredPin(pinNew) // takoj uporabi novi PIN v tej seji
      setPinSet(true)
      setPinNew('')
      setPinCurrent('')
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setPinSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Podatki salona */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Podatki salona</h3>
          </div>
          <span className="text-xs text-muted-foreground">vidni strankam</span>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="biz-name">Ime salona *</Label>
              <Input id="biz-name" value={bizForm.name} onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-phone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefon * <span className="font-normal text-muted-foreground">(WhatsApp)</span>
              </Label>
              <Input id="biz-phone" value={bizForm.phone} onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })} inputMode="tel" maxLength={24} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-address" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Naslov
              </Label>
              <Input id="biz-address" value={bizForm.address} onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-email" className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> E-pošta
              </Label>
              <Input id="biz-email" value={bizForm.email} onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })} inputMode="email" maxLength={80} />
            </div>
          </div>
          <Button className="mt-3 gap-1.5" size="sm" disabled={bizSaving} onClick={saveBiz}>
            {bizSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Shrani podatke
          </Button>
        </CardContent>
      </Card>

      {/* Delovni čas */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Delovni čas</h3>
          </div>
          <span className="text-xs text-muted-foreground">določa proste termine</span>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {hoursRows.length === 0 ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            hoursRows.map((r) => (
              <div key={r.dayOfWeek} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/60 px-3 py-2">
                <span className="w-24 shrink-0 text-sm font-medium">{r.dayName}</span>
                <Switch
                  checked={!r.closed}
                  onCheckedChange={(open) => setHoursRows((rows) => rows.map((x) => (x.dayOfWeek === r.dayOfWeek ? { ...x, closed: !open } : x)))}
                  aria-label={`${r.dayName} odprto/zaprto`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    value={r.open ?? ''}
                    disabled={r.closed}
                    onChange={(e) => setHoursRows((rows) => rows.map((x) => (x.dayOfWeek === r.dayOfWeek ? { ...x, open: e.target.value } : x)))}
                    className="h-9 w-[104px]"
                    aria-label={`${r.dayName} odprtje`}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={r.close ?? ''}
                    disabled={r.closed}
                    onChange={(e) => setHoursRows((rows) => rows.map((x) => (x.dayOfWeek === r.dayOfWeek ? { ...x, close: e.target.value } : x)))}
                    className="h-9 w-[104px]"
                    aria-label={`${r.dayName} zaprtje`}
                  />
                  {/* Premor (npr. 12:00–13:00) */}
                  <div className={`flex items-center gap-1.5 ${r.closed ? 'opacity-40' : ''}`}>
                    <Sun className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                    <Input
                      type="time"
                      value={r.breakStart}
                      disabled={r.closed}
                      onChange={(e) => setHoursRows((rows) => rows.map((x) => (x.dayOfWeek === r.dayOfWeek ? { ...x, breakStart: e.target.value } : x)))}
                      className="h-9 w-[96px]"
                      aria-label={`${r.dayName} premor od`}
                      title="Premor od (kosilo) — v tem oknu termini niso na voljo"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={r.breakEnd}
                      disabled={r.closed}
                      onChange={(e) => setHoursRows((rows) => rows.map((x) => (x.dayOfWeek === r.dayOfWeek ? { ...x, breakEnd: e.target.value } : x)))}
                      className="h-9 w-[96px]"
                      aria-label={`${r.dayName} premor do`}
                      title="Premor do (kosilo)"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
          <p className="text-[10px] leading-snug text-muted-foreground">
            Premor (sončna ikona) = kosilo ali počitek — v tem oknu stranke ne morejo rezervirati.
          </p>
          <Button className="mt-2 gap-1.5" size="sm" disabled={hoursSaving} onClick={saveHours}>
            {hoursSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Shrani delovni čas
          </Button>
        </CardContent>
      </Card>

      {/* Zaprti dnevi & prazniki */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <CalendarX className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Zaprti dnevi &amp; prazniki</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void importHolidays()}
            disabled={cdBusy === 'hol'}
          >
            {cdBusy === 'hol' ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <PartyPopper className="h-3.5 w-3.5" />}
            Uvozi praznike
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ti dnevi so za stranke <strong>vidno zaprti</strong> — ne morejo rezervirati, modul Sporočila pa ponudi druge dneve.
          </p>

          {/* Dopust (obseg) */}
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="vac-from" className="text-xs">Dopust od</Label>
                <Input
                  id="vac-from"
                  type="date"
                  value={vacForm.from}
                  onChange={(e) => setVacForm({ ...vacForm, from: e.target.value })}
                  className="h-9 w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vac-to" className="text-xs">do</Label>
                <Input
                  id="vac-to"
                  type="date"
                  value={vacForm.to}
                  onChange={(e) => setVacForm({ ...vacForm, to: e.target.value })}
                  className="h-9 w-[150px]"
                />
              </div>
              <Button size="sm" className="gap-1.5" disabled={cdBusy === 'vac'} onClick={() => void addVacation()}>
                {cdBusy === 'vac' ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Sun className="h-3.5 w-3.5" />}
                Zapri dopust
              </Button>
            </div>
          </div>

          {/* Posamezen dan */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="cd-date" className="text-xs">Zapri dan</Label>
              <Input
                id="cd-date"
                type="date"
                value={cdForm.date}
                onChange={(e) => setCdForm({ ...cdForm, date: e.target.value })}
                className="h-9 w-[150px]"
              />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label htmlFor="cd-reason" className="text-xs">Razlog (npr. šola, bolezen)</Label>
              <Input
                id="cd-reason"
                value={cdForm.reason}
                onChange={(e) => setCdForm({ ...cdForm, reason: e.target.value })}
                maxLength={80}
                placeholder="neobvezno"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={cdBusy === 'add'} onClick={() => void addClosedDay()}>
              {cdBusy === 'add' ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <CalendarX className="h-3.5 w-3.5" />}
              Zapri
            </Button>
          </div>

          {/* Seznam zaprtih dni */}
          {closedDays.length > 0 ? (
            <ul className="terminai-scroll max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {closedDays.map((c) => {
                const p = dateParts(c.date)
                return (
                  <li key={c.date} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium">
                        {p.dayName}, {p.dayNum}. {p.month}
                      </span>
                      {c.reason && <span className="ml-2 text-xs text-muted-foreground">{c.reason}</span>}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                      disabled={cdBusy === c.date}
                      onClick={() => void removeClosedDay(c.date)}
                      aria-label={`Odpri ${c.date}`}
                      title="Odstrani — dan bo spet odprt"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              <PartyPopper className="mx-auto mb-1 h-4 w-4 opacity-40" />
              Ni zaprtih dni — uvozite praznike ali zaprite dopust.
            </p>
          )}
        </CardContent>
      </Card>

      {/* PIN zaščita */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Zaščita lastnika (PIN)</h3>
          </div>
          {pinSet ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">vklopljena</span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400">ni nastavljena</span>
          )}
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            PIN zaklene nadzorno ploščo — stranke lahko še vedno rezervirajo, urejanje podatkov pa je možno samo z PIN-om.
            Priporočamo 4–6 števk, ki jih poznate samo vi.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinSet && (
              <div className="space-y-1.5">
                <Label htmlFor="pin-current">Trenutni PIN</Label>
                <Input
                  id="pin-current"
                  type="password"
                  inputMode="numeric"
                  value={pinCurrent}
                  onChange={(e) => setPinCurrent(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pin-new">{pinSet ? 'Nov PIN' : 'PIN (4–6 števk)'}</Label>
              <Input
                id="pin-new"
                type="password"
                inputMode="numeric"
                value={pinNew}
                onChange={(e) => setPinNew(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
            </div>
          </div>
          <Button className="gap-1.5" size="sm" disabled={pinSaving} onClick={savePin}>
            {pinSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {pinSet ? 'Zamenjaj PIN' : 'Nastavi PIN'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Storitve — {businessName}</h3>
          </div>
          <Button onClick={openAdd} className="gap-1.5" size="sm">
            <Plus className="h-4 w-4" /> Dodaj storitev
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Scissors className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="font-medium">Ni še nobene storitve</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dodajte storitve, ki jih ponujate — s trajanjem in cenami.
              </p>
              <Button onClick={openAdd} className="mt-4 gap-1.5" size="sm" variant="outline">
                <Plus className="h-4 w-4" /> Prva storitev
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>{durationLabel(s.durationMin)}</span>
                      {(s.bufferMin ?? 0) > 0 && <span title="Priprava/razkuževanje po storitvi">+{s.bufferMin} min priprava</span>}
                      <span className="font-semibold text-foreground">{formatPrice(s.priceCents)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Flame className="h-3 w-3 text-amber-500" /> vršni {formatPrice(s.peakPriceCents)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(s)}
                      aria-label={`Uredi ${s.name}`}
                      title="Uredi"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => remove(s)}
                      disabled={busyId === s.id}
                      aria-label={`Odstrani ${s.name}`}
                      title="Odstrani"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Čist start */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/40">
        <CardHeader className="border-b py-4">
          <div className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold">Začetek s pravim salonom (čist start)</h3>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Izbriše vse demo podatke (Studio Aura, termini, stranke) in ustvari salon z vašim imenom.
            Nato dodajte svoje storitve. <strong>Nepovratno!</strong> Najprej naredite rezervo.
          </p>
          <Button
            variant="outline"
            className="mt-3 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/60 dark:hover:text-amber-200"
            onClick={() => setResetOpen(true)}
          >
            <Store className="h-4 w-4" /> Nastavi pravi salon
          </Button>
        </CardContent>
      </Card>

      {/* Dialog: dodaj/uredi storitev */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Uredi storitev' : 'Nova storitev'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Spremenite podatke storitve.' : 'Vnesite storitev, ki jo salon ponuja.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="svc-name">Ime storitve *</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="npr. Striženje — ženske"
                maxLength={60}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svc-desc">Opis</Label>
              <Textarea
                id="svc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="npr. Svetovanje, prha, striženje in oblikovanje"
                rows={2}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="svc-dur">Trajanje *</Label>
                <Select
                  value={form.durationMin}
                  onValueChange={(v) => setForm({ ...form, durationMin: v })}
                >
                  <SelectTrigger id="svc-dur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {durationLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="svc-buffer">
                  Priprava po storitvi <span className="font-normal text-muted-foreground">(razkuževanje)</span>
                </Label>
                <Select
                  value={form.bufferMin}
                  onValueChange={(v) => setForm({ ...form, bufferMin: v })}
                >
                  <SelectTrigger id="svc-buffer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUFFERS.map((b) => (
                      <SelectItem key={b} value={String(b)}>
                        {b === 0 ? 'brez' : `${b} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svc-cat">Kategorija</Label>
              <Input
                id="svc-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="npr. Frizerske storitve"
                maxLength={40}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="svc-price">Redna cena (€) *</Label>
                <Input
                  id="svc-price"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="npr. 25"
                  inputMode="decimal"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="svc-peak">
                  Vršni čas (€) <span className="text-muted-foreground font-normal">popoldne/sobota</span>
                </Label>
                <Input
                  id="svc-peak"
                  value={form.peakPrice}
                  onChange={(e) => setForm({ ...form, peakPrice: e.target.value })}
                  placeholder="npr. 30"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={save} disabled={saving || form.name.trim().length < 2 || !form.price.trim()}>
              {saving ? 'Shranjujem …' : editing ? 'Shrani spremembe' : 'Dodaj storitev'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: čist start */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nastavi pravi salon</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>To bo izbrisalo vse trenutne podatke (demo salon, termini, stranke) in ustvarilo prazen salon.</p>
                <div className="space-y-2.5 rounded-lg border bg-background p-3">
                  <div className="grid gap-1">
                    <Label htmlFor="rst-name">Ime salona *</Label>
                    <Input id="rst-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="npr. Salon Lepota" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="rst-phone">Telefon *</Label>
                    <Input id="rst-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="npr. 01 234 5678" inputMode="tel" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="rst-addr">Naslov</Label>
                    <Input id="rst-addr" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="npr. Trubarjeva 27, Ljubljana" />
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  if (newName.trim().length >= 2 && newPhone.trim().length >= 6) freshStart()
                }}
                disabled={resetting || newName.trim().length < 2 || newPhone.trim().length < 6}
              >
                {resetting ? 'Pripravljam …' : 'Potrdi — čist start'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
