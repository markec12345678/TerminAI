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
import { CalendarX, CheckCircle2, Clock, RefreshCw, Scissors, Wallet } from 'lucide-react'
import { dateParts, durationLabel, formatPrice, timeOfIso } from './types'

interface CancelInfo {
  businessName: string
  clientName: string
  serviceName: string
  startAt: string
  durationMin: number
  priceCents: number
}

type Phase = 'loading' | 'ready' | 'cancelling' | 'cancelled' | 'error'

/**
 * Odpoved termina s strani stranke — odpre se, ko obiskovalec pride na
 * povezavo /?cancel={token} (iz WhatsApp spomnika ali potrditve rezervacije).
 * Žeton nadomeesti PIN: ve, kateri termin sme odpovedati — in nič drugega.
 */
export function CancelDialog() {
  const [token, setToken] = useState<string | null>(null)
  const [info, setInfo] = useState<CancelInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('cancel')
    if (!t) return
    setToken(t)
    // Počisti URL, da osvežitev ne ponovi pogovorja
    window.history.replaceState({}, '', window.location.pathname)
    fetch(`/api/appointments/cancel?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? 'Povezava za odpoved ni veljavna.')
        return d
      })
      .then((d) => {
        setInfo(d.appointment as CancelInfo)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        setErrorMsg(e instanceof Error ? e.message : 'Povezava za odpoved ni veljavna.')
        setPhase('error')
      })
  }, [])

  // Brez parametra cancel= se dialog sploh ne prikaže
  const open = token !== null

  const doCancel = async () => {
    if (!token) return
    setPhase('cancelling')
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Odpoved ni uspela.')
      setPhase('cancelled')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Odpoved ni uspela.')
      setPhase('error')
    }
  }

  const dp = info ? dateParts(info.startAt.slice(0, 10)) : null

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm">
        {phase === 'cancelled' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Termin je odpovedan
              </DialogTitle>
              <DialogDescription>
                {info ? `${info.businessName} se bo veselil vašega novega obiska — rezervirate ga lahko na tej strani.` : 'Hvala za obvestilo.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button variant="outline" onClick={() => setToken(null)}>
                Zapri
              </Button>
            </DialogFooter>
          </>
        ) : phase === 'error' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <CalendarX className="h-5 w-5 text-rose-500" /> Odpoved ni mogoča
              </DialogTitle>
              <DialogDescription>{errorMsg ?? 'Povezava ni veljavna.'}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button variant="outline" onClick={() => setToken(null)}>
                Zapri
              </Button>
            </DialogFooter>
          </>
        ) : phase === 'loading' ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <CalendarX className="h-5 w-5 text-rose-500" /> Odpoved termina
              </DialogTitle>
              <DialogDescription>
                {info ? `Pozdravljeni, ${info.clientName}. Vaš termin pri ${info.businessName}:` : ''}
              </DialogDescription>
            </DialogHeader>

            {info && (
              <div className="space-y-2.5 rounded-xl border bg-muted/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Scissors className="h-3.5 w-3.5" /> Storitev
                  </span>
                  <span className="font-medium">{info.serviceName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Termin
                  </span>
                  <span className="font-medium">
                    {dp?.dayName}, {dp?.dayNum}. {dp?.month} ob {timeOfIso(info.startAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Trajanje
                  </span>
                  <span className="font-medium">{durationLabel(info.durationMin)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2.5">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" /> Cena
                  </span>
                  <span className="font-semibold text-primary">{formatPrice(info.priceCents)}</span>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button variant="destructive" className="w-full gap-2" onClick={doCancel} disabled={phase === 'cancelling'}>
                {phase === 'cancelling' ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Odpovedujem …
                  </>
                ) : (
                  <>
                    <CalendarX className="h-4 w-4" /> Odpovej termin
                  </>
                )}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setToken(null)}>
                Zadržim termin
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Odpoved je brezplačna. Nov termin rezervirate takoj spodaj na strani.
              </p>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
