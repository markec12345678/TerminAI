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
import { Plus, Pencil, Trash2, Scissors, RefreshCcw, Store, Clock, Flame, MapPin, Phone, Mail, Save, Building2 } from 'lucide-react'
import type { ServiceDto, BusinessDto } from './types'
import { durationLabel, formatPrice } from './types'

const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180]

interface FormState {
  name: string
  description: string
  durationMin: string
  price: string
  peakPrice: string
  category: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  durationMin: '30',
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
        priceCents,
        peakPriceCents: peakCents,
        category: form.category,
      }
      const res = editing
        ? await fetch(`/api/services/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/services', {
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
      const res = await fetch(`/api/services/${s.id}`, { method: 'DELETE' })
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
      const res = await fetch('/api/setup', {
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
      const res = await fetch('/api/setup', {
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
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="border-b py-4">
          <div className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-amber-600" />
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
            className="mt-3 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
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
                <Label htmlFor="svc-cat">Kategorija</Label>
                <Input
                  id="svc-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="npr. Frizerske storitve"
                  maxLength={40}
                />
              </div>
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
