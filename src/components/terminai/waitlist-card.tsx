'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch } from '@/lib/owner-fetch'
import { waLink, WhatsAppIcon } from './whatsapp'
import { Hourglass, Plus, Phone, Trash2, RefreshCw, Sparkles } from 'lucide-react'
import type { ServiceDto, WaitlistEntryDto } from './types'
import { dateParts } from './types'

interface Props {
  businessName: string
  onCountChange?: (count: number) => void
}

/** Berljiva oznaka, kako dolgo stranka čaka: "čaka 3 dni" / "čaka 2 tedna". */
function waitingSince(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
  if (days === 0) return 'danes dodana'
  if (days === 1) return 'čaka 1 dan'
  if (days < 14) return `čaka ${days} ${days === 2 ? 'dneva' : 'dni'}`
  const weeks = Math.floor(days / 7)
  return `čaka ${weeks} ${weeks === 2 ? 'tedna' : 'tedne'}`
}

/**
 * Čakalni seznam — kot Zenoti "Automated Waitlist Management", a brez
 * naročnine: ob odpovedi lastnica s klikom povabi stranko (WhatsApp
 * z vnaprej izpolnjenim sporočilom). Stranke so urejene po vrsti čakanja.
 */
export function WaitlistCard({ businessName, onCountChange }: Props) {
  const [entries, setEntries] = useState<WaitlistEntryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [serviceId, setServiceId] = useState<string>('none')
  const [services, setServices] = useState<ServiceDto[]>([])
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(() => {
    ownerFetch('/api/waitlist')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setEntries(d.entries)
        onCountChange?.(d.entries.length)
      })
      .catch(() => {
        /* tiho — kartica je stranski modul */
      })
      .finally(() => setLoading(false))
  }, [onCountChange])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (addOpen) {
      fetch('/api/services')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setServices(d.services))
        .catch(() => setServices([]))
    }
  }, [addOpen])

  const add = async () => {
    setSaving(true)
    try {
      const res = await ownerFetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          note: note || undefined,
          serviceId: serviceId === 'none' ? null : serviceId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Dodajanje ni uspelo', description: data.error ?? 'Poskusite znova.', variant: 'destructive' })
        return
      }
      setEntries((prev) => [...prev, data.entry])
      onCountChange?.(entries.length + 1)
      toast({ title: 'Dodana na čakalni seznam ⏳', description: `${name} — ob prvi odpovedi jo povabite s klikom.` })
      setAddOpen(false)
      setName('')
      setPhone('')
      setNote('')
      setServiceId('none')
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const res = await ownerFetch(`/api/waitlist?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setEntries((prev) => prev.filter((e) => e.id !== id))
      onCountChange?.(Math.max(0, entries.length - 1))
    } catch {
      toast({ title: 'Napaka', description: 'Brisanje ni uspelo.', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  /** WhatsApp povabilo z vnaprej izpolnjenim sporočilom. */
  const invite = (e: WaitlistEntryDto) =>
    waLink(
      e.phone,
      `Živjo ${e.name.split(' ')[0]}! Pri ${businessName} se je sprostil termin${e.service ? ` za ${e.service.name}` : ''} — če vam ustreza, vas z veseljem uvrstim. Lep pozdrav!`
    )

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 border-b py-4">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Čakalni seznam</h3>
        </div>
        {entries.length > 0 && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {entries.length} {entries.length === 1 ? 'stranka' : entries.length === 2 ? 'stranki' : 'stranke'}
          </span>
        )}
        <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Dodaj
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Stranke, ki želijo termin &raquo;kdaj se kaj sprosti&laquo;. Ob odpovedi jih povabite z enim klikom (WhatsApp) —
          ko dobijo termin, jih zbrišite s seznama.
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            Seznam je prazen — dodajte stranko, ki čaka na prost termin.
          </p>
        ) : (
          <div className="terminai-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.name}</span>
                    {e.service && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {e.service.name}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{waitingSince(e.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {e.phone}
                    </span>
                  </div>
                  {e.note && <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{e.note}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button asChild size="icon" variant="outline" className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300">
                    <a href={invite(e)} target="_blank" rel="noopener noreferrer" aria-label={`Povabi ${e.name} na WhatsApp`} title="Povabi na WhatsApp — sporočilo je pripravljeno">
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                    disabled={busyId === e.id}
                    onClick={() => void remove(e.id)}
                    aria-label={`Odstrani ${e.name} s seznama`}
                    title="Odstrani — stranka je dobila termin"
                  >
                    {busyId === e.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Zadnjič osveženo za {dateParts(today).dayName}, {dateParts(today).dayNum}. {dateParts(today).month} —
            seznam shranjen lokalno, brez oblaka.
          </p>
        )}
      </CardContent>

      {/* Dialog: dodaj na čakalni seznam */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Hourglass className="h-5 w-5 text-primary" /> Dodaj na čakalni seznam
            </DialogTitle>
            <DialogDescription>
              Stranka, ki bi radi prišla, ko se termin sprosti. Ni je v koledarju — samo na seznamu.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wl-name">Ime in priimek *</Label>
                <Input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Ana Novak" maxLength={60} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wl-phone" className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefon *
                </Label>
                <Input id="wl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="040 123 456" inputMode="tel" maxLength={20} autoComplete="off" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Za katero storitev čaka?</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="w-full" aria-label="Storitev na čakalnem seznamu">
                  <SelectValue placeholder="Karkoli — samo povabite me" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Karkoli — samo povabite me</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-note">Opomba (neobvezno)</Label>
              <Textarea id="wl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="npr. lahko samo dopoldne / sobote" rows={2} maxLength={300} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Prekliči
            </Button>
            <Button className="gap-1.5" disabled={saving || name.trim().length < 2 || phone.trim().length < 6} onClick={() => void add()}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Dodaj na seznam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
