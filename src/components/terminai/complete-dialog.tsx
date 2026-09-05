'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { shrinkFull, shrinkThumb } from '@/lib/image-resize'
import { ljNow } from '@/lib/ljubljana'
import { Palette, CheckCircle2, CalendarPlus, Sparkles, RefreshCw, Camera, Trash2 } from 'lucide-react'
import type { AppointmentDto, PhotoDto } from './types'
import { formatPrice, timeOfIso } from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Termin, ki ga zaključujemo */
  appointment: AppointmentDto | null
  /** Po uspešnem zaključku (parent osveži koledar/statistiko) */
  onCompleted: () => void
  /** Odpre ročni vnos z predizpolnjeno stranko/storitvijo (rebooking) */
  onBookNext: (a: AppointmentDto) => void
}

const PHOTO_KINDS = [
  { value: 'after', label: 'Po (rezultat)' },
  { value: 'before', label: 'Pred' },
  { value: 'result', label: 'Rezultat' },
  { value: 'reference', label: 'Referenca' },
] as const

/**
 * Zaključek obiska — Zenotijev najbolj hvaljen del profila stranke:
 * ob zaključku frizerka zapiše, kaj je naredila (formula, količine),
 * in po želji priloži fotografijo (pred/po). Vse ostane LOKALNO —
 * za razliko od Zenoti Photo Managerja (oblak, 225+ USD/mesec).
 * Takoj za tem ponudi še "Naroči naslednji obisk" (rebooking nudge).
 */
export function CompleteDialog({ open, onOpenChange, appointment, onCompleted, onBookNext }: Props) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  // Fotografije obiska
  const [photos, setPhotos] = useState<PhotoDto[]>([])
  const [kind, setKind] = useState<string>('after')
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open && appointment) {
      setNote(appointment.ownerNote ?? '')
      setDone(false)
      setKind('after')
      // Fotografije, ki so že pripete na ta obisk (npr. "pred" posneta prej)
      ownerFetch(`/api/photos?clientId=${appointment.client.id}&appointmentId=${appointment.id}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setPhotos(d.photos ?? []))
        .catch(() => setPhotos([]))
    }
  }, [open, appointment])

  if (!appointment) return null

  /** Sliko pomanjša v brskalniku in takoj shrani (lokalno). */
  const addPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'To ni slika', description: 'Izberite fotografijo (JPG/PNG).', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const [dataUrl, thumbUrl] = await Promise.all([shrinkFull(file), shrinkThumb(file)])
      const res = await ownerFetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: appointment.client.id,
          appointmentId: appointment.id,
          kind,
          dataUrl,
          thumbUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Fotografija ni shranjena', description: data.error ?? 'Poskusite znova.', variant: 'destructive' })
        return
      }
      setPhotos((prev) => [...prev, data.photo])
      toast({ title: 'Fotografija shranjena 📷', description: 'Povečana je v zgodovini obiskov stranke.' })
    } catch {
      toast({ title: 'Napaka', description: 'Slike ni bilo mogoče obdelati.', variant: 'destructive' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removePhoto = async (id: string) => {
    setRemoving(id)
    try {
      const res = await ownerFetch(`/api/photos?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setPhotos((prev) => prev.filter((p) => p.id !== id))
    } catch {
      toast({ title: 'Napaka', description: 'Brisanje ni uspelo.', variant: 'destructive' })
    } finally {
      setRemoving(null)
    }
  }

  const submit = async () => {
    setSaving(true)
    try {
      const res = await ownerFetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', ownerNote: note }),
      })
      if (!res.ok) throw new Error()
      playSound('complete')
      onCompleted()
      setDone(true)
    } catch {
      toast({ title: 'Napaka', description: 'Zaključek ni uspel. Poskusite znova.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const bookNext = () => {
    onBookNext(appointment)
    onOpenChange(false)
  }

  const apptDate = new Date(appointment.startAt)

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setDone(false) }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Zaključi obisk
              </DialogTitle>
              <DialogDescription>
                {appointment.client.name} — {appointment.service.name} ({formatPrice(appointment.priceCents)})
                {apptDate.getTime() < ljNow().getTime() && ` · ${timeOfIso(appointment.startAt)}`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-1">
              <Label htmlFor="cd-formula" className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-primary" /> Kaj je bilo narejeno? (formula, količine)
              </Label>
              <Textarea
                id="cd-formula"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="npr. 6-0 + 7-34 (30 g), razvijalec 9 %, 35 min · šiške skrajšala za 2 cm"
                rows={4}
                maxLength={500}
                autoFocus
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                Zasebna opomba — vidi se samo vi, pri naslednjem obisku stranke.
                Pustite prazno, če vam ni treba.
              </p>
            </div>

            {/* Fotografija obiska — lokalni Photo Manager (kot Zenoti, a brez oblaka) */}
            <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-primary" /> Fotografija rezultata
                </Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger size="sm" className="h-7 w-[150px] text-xs" aria-label="Vrsta fotografije">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHOTO_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Izberi fotografijo"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void addPhoto(f)
                }}
              />
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="group relative">
                      <img
                        src={p.thumbUrl}
                        alt={`Fotografija obiska — ${appointment.client.name}`}
                        className="h-20 w-20 rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => void removePhoto(p.id)}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-1 text-red-500 shadow-sm transition-colors hover:bg-red-50 dark:hover:bg-red-950/60"
                        aria-label="Odstrani fotografijo"
                        disabled={removing === p.id}
                      >
                        {removing === p.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                      <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1 text-[9px] font-semibold text-foreground">
                        {PHOTO_KINDS.find((k) => k.value === p.kind)?.label.split(' ')[0] ?? p.kind}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {uploading ? 'Shranjujem …' : photos.length > 0 ? 'Dodaj še eno' : 'Dodaj fotografijo'}
              </Button>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Pomanjša se samodejno in shrani <strong>lokalno</strong> — naslednjič takoj
                vidite, kako je bilo prej. (Neobvezno.)
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Prekliči
              </Button>
              <Button className="gap-1.5" onClick={() => void submit()} disabled={saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Zaključi
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <Sparkles className="h-5 w-5 text-primary" /> Obisk zaključen ✓
              </DialogTitle>
              <DialogDescription>
                {note.trim() || photos.length > 0
                  ? 'Formula in fotografije so shranjene pri stranki — naslednjič vse vidi v 1 sekundi.'
                  : 'Hvala! Stranka je bila dodana v današnjo statistiko.'}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-start gap-2.5">
                <CalendarPlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Naroči naslednji obisk?</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Stranka je še tu — to je trenutek, ko reče &raquo;ja&laquo;. {appointment.recurWeeks
                      ? `Prihaja ${appointment.recurWeeks === 2 ? 'vsaki 2 tedni' : `vsake ${appointment.recurWeeks} tedne`} — predlagajte podoben termin.`
                      : 'Veliko frizerk takoj dogovori naslednji termin — manj praznih lukenj.'}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Zapri
              </Button>
              <Button className="gap-1.5" onClick={bookNext}>
                <CalendarPlus className="h-4 w-4" /> Naroči naslednji obisk
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
