'use client'

import { useEffect, useState } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { ownerFetch } from '@/lib/owner-fetch'
import { playSound } from '@/lib/sounds'
import { Palette, CheckCircle2, CalendarPlus, Sparkles, RefreshCw } from 'lucide-react'
import type { AppointmentDto } from './types'
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

/**
 * Zaključek obiska — Zenotijev najbolj hvaljen del profila stranke:
 * ob zaključku frizerka zapiše, kaj je naredila (formula, količine).
 * Opomba je zasebna (samo za lastnico) in se pokaže v zgodovini obiskov.
 * Takoj za tem ponudi še "Naroči naslednji obisk" (rebooking nudge).
 */
export function CompleteDialog({ open, onOpenChange, appointment, onCompleted, onBookNext }: Props) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setNote(appointment?.ownerNote ?? '')
      setDone(false)
    }
  }, [open, appointment])

  if (!appointment) return null

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
      <DialogContent className="sm:max-w-md">
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Zaključi obisk
              </DialogTitle>
              <DialogDescription>
                {appointment.client.name} — {appointment.service.name} ({formatPrice(appointment.priceCents)})
                {apptDate.getTime() < Date.now() && ` · ${timeOfIso(appointment.startAt)}`}
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
                {note.trim()
                  ? 'Formula je shranjena pri stranki — naslednjič jo vidite v 1 sekundi.'
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
