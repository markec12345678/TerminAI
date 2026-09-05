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
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, Clock, CheckCircle2 } from 'lucide-react'
import { ownerFetch } from '@/lib/owner-fetch'
import { WhatsAppIcon as WaIcon, waLink } from './whatsapp'
import type { AppointmentDto } from './types'
import { timeOfIso, cancelUrl } from './types'
import { ljDateKeyOf } from '@/lib/ljubljana'

const SENT_PREFIX = 'terminai-reminders-sent:'

/** Pobriši oznake „poslano", starejše od 14 dni — shramba naj ne raste večno. */
function pruneOldSentKeys() {
  try {
    const cutoff = ljDateKeyOf(new Date(Date.now() - 14 * 86400000))
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(SENT_PREFIX) && k.slice(SENT_PREFIX.length) < cutoff) {
        window.localStorage.removeItem(k)
      }
    }
  } catch {
    /* zasebni način brskalnika ipd. — ni kritično */
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessName: string
  tomorrowDate: string | null // YYYY-MM-DD
}

function reminderText(businessName: string, a: AppointmentDto): string {
  const base = `Lep pozdrav iz ${businessName}! 🌸 Opominjamo vas na vaš termin jutri ob ${timeOfIso(a.startAt)} — ${a.service.name}. Veselimo se vas!`
  // Odpovedna povezava — stranka odpove sama z enim klikom (če termin ne more priti)
  if (a.cancelToken && typeof window !== 'undefined') {
    return `${base}\n\nČe ne morete priti, termin odpovejte tukaj: ${cancelUrl(window.location.origin, a.cancelToken)}`
  }
  return base
}

/**
 * Spomniki za jutrišnje termine — pošteni offline nadomestek za SMS:
 * za vsako stranko se pripravi WhatsApp sporočilo, lastnik ga s klikom pošlje.
 * (Online faza: isto besedilo bo odšlo samodejno.)
 */
export function RemindersDialog({ open, onOpenChange, businessName, tomorrowDate }: Props) {
  const [data, setData] = useState<{ date: string; appointments: AppointmentDto[] } | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  // Oznake „poslano" preživijo ponovno odpiranje (po datumu) — sicer bi
  // vsako odpiranje dialoga ponudilo spomnike znova in stranke dobile dvojna
  // sporočila.
  const loadSent = (dateStr: string): Set<string> => {
    try {
      const raw = window.localStorage.getItem(SENT_PREFIX + dateStr)
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      return new Set()
    }
  }
  const persistSent = (next: Set<string>, dateStr: string) => {
    try {
      window.localStorage.setItem(SENT_PREFIX + dateStr, JSON.stringify([...next]))
    } catch {
      /* ne kritično */
    }
  }

  useEffect(() => {
    if (!open || !tomorrowDate) return
    pruneOldSentKeys()
    let cancelled = false
    ownerFetch(`/api/appointments?date=${tomorrowDate}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return
        setData({ date: tomorrowDate, appointments: d.appointments })
        setSent(loadSent(tomorrowDate))
      })
      .catch(() => {
        if (cancelled) return
        setData({ date: tomorrowDate, appointments: [] })
        setSent(loadSent(tomorrowDate))
      })
    return () => {
      cancelled = true
    }
  }, [open, tomorrowDate])

  const loading = open && (!data || data.date !== tomorrowDate)
  const appointments = data?.date === tomorrowDate ? data.appointments : []
  const active = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Bell className="h-5 w-5 text-primary" /> Spomniki za jutri
          </DialogTitle>
          <DialogDescription>
            Za vsako stranko se pripravi sporočilo — kliknite WhatsApp ob vsaki, ki ste jo poslali.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Jutri ni terminov — nič za opomniti. 🌸
          </p>
        ) : (
          <div className="space-y-2">
            {active.map((a) => {
              const isSent = sent.has(a.id)
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                    isSent ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-border/60'
                  }`}
                >
                  <span className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-sm font-semibold">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {timeOfIso(a.startAt)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.client.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.service.name}</div>
                  </div>
                  {isSent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> poslano
                    </span>
                  ) : (
                    <Button asChild size="sm" className="gap-1.5 bg-[#25D366] text-white hover:bg-[#1eb856]">
                      <a
                        href={waLink(a.client.phone, reminderText(businessName, a))}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          setSent((s) => {
                            const next = new Set(s).add(a.id)
                            if (tomorrowDate) persistSent(next, tomorrowDate)
                            return next
                          })
                        }}
                      >
                        <WaIcon className="h-3.5 w-3.5" /> Pošlji
                      </a>
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          {sent.size > 0 && tomorrowDate && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-muted-foreground"
              onClick={() => {
                setSent(new Set())
                try {
                  window.localStorage.removeItem(SENT_PREFIX + tomorrowDate)
                } catch {
                  /* ne kritično */
                }
              }}
            >
              Ponastavi oznake
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zapri
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
