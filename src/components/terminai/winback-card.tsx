'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ownerFetch } from '@/lib/owner-fetch'
import { recurrenceLabel } from '@/lib/labels'
import { HeartHandshake, CalendarPlus, RefreshCw, UserRound } from 'lucide-react'
import { waLink, WhatsAppIcon } from './whatsapp'
import type { ManualPrefill } from './manual-booking-dialog'
import type { WinbackDto } from './types'
import { slCount } from './types'

interface Props {
  refreshKey: number
  onBookForCustomer: (prefill: ManualPrefill) => void
  businessName: string
}

/**
 * Motor zvestobe — pametni win-back (kot Zenoti "win-back flows",
 * a glede na OSEBNI ritem stranke in brez naročnine).
 * Ana na 5 tednih je alarm po 7 tednih; stranka z 12-tedenskim ritmom
 * šele po 17. Fiksni 8-tedenski prag bi Ano odkril prepozno.
 */
export function WinbackCard({ refreshKey, onBookForCustomer, businessName }: Props) {
  const [items, setItems] = useState<WinbackDto[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await ownerFetch('/api/loyalty')
      if (res.ok) {
        const data = await res.json()
        setItems(data.winback ?? [])
        setError(false)
      } else {
        throw new Error()
      }
    } catch {
      setError(true)
      /* tiho — kartica je stranski modul */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const waMessage = (w: WinbackDto) => {
    const first = w.name.split(' ')[0]
    const weeks = slCount(w.weeksSince, 'teden', 'tedna', 'tedni', 'tednov')
    const service = w.lastService?.toLowerCase()
    return `Živjo ${first}! Tukaj ${businessName} — že ${weeks} te ni bilo pri nas 💇‍♀️ ${
      service ? `Kdaj ti ustreza termin za ${service}?` : 'Kdaj ti ustreza naslednji obisk?'
    } Lep pozdrav!`
  }

  const book = (w: WinbackDto) => {
    onBookForCustomer({
      name: w.name,
      phone: w.phone,
      serviceId: w.serviceId ?? undefined,
      date: w.suggestedDate ?? undefined,
    })
  }

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <HeartHandshake className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="truncate text-sm font-semibold">Dolgo jih ni bilo</h3>
            {items && items.length > 0 && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                {slCount(items.length, 'stranka', 'stranki', 'stranke', 'strank')}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void load()} aria-label="Osveži win-back" title="Osveži">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {items === null ? (
          error ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Seznama ni bilo mogoče naložiti.
            </p>
          ) : (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs leading-relaxed text-muted-foreground">
            Vse stranke so bile pri vas v svojem ritmu — baza je zdrava! 💚
            <br />
            <span className="text-[10px]">Ko bo kdo presegel svoj običajni razmik obiskov, se bo pojavila tukaj.</span>
          </p>
        ) : (
          <>
            <ul className="terminai-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
              {items.map((w) => {
                const urgent = w.weeksSince >= 12
                return (
                  <li key={w.id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1 truncate text-sm font-medium">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {w.name}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          urgent
                            ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        }`}
                        title={urgent ? 'Več kot 3 mesece — pokliči kmalu' : 'Presegla svoj običajni ritem'}
                      >
                        {slCount(w.weeksSince, 'teden', 'tedna', 'tedni', 'tednov')} ni bilo tu
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {w.lastService ?? 'obisk'} ·{' '}
                      {w.typicalWeeks ? (
                        <>običajno {recurrenceLabel(w.typicalWeeks)}</>
                      ) : (
                        <>brez vzorca</>
                      )}{' '}
                      · zadnji obisk {w.lastVisitLabel}
                    </div>
                    {w.suggestedLabel && (
                      <div className="mt-1 text-[11px] font-medium text-foreground/80">
                        predlagan termin: {w.suggestedLabel}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-1.5">
                      <a
                        href={waLink(w.phone, waMessage(w))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-2.5 text-[11px] font-semibold text-[#128C3E] transition-colors hover:bg-[#25D366]/20 focus-visible:outline-2 focus-visible:outline-[#25D366]"
                        aria-label={`WhatsApp sporočilo ${w.name}`}
                        title="Pošlji WhatsApp — vabilo nazaj"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5" /> Vabi
                      </a>
                      <Button size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-[11px]" onClick={() => book(w)}>
                        <CalendarPlus className="h-3.5 w-3.5" /> Naroči
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Prag ni fiksni — vsaka stranka ima svoj ritem obiskov, alarm se sproži, ko ga preseže.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
