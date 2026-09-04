'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch } from '@/lib/owner-fetch'
import { recurrenceLabel } from '@/lib/labels'
import { Repeat, CalendarPlus, RefreshCw, UserRound } from 'lucide-react'
import { waLink, WhatsAppIcon } from './whatsapp'
import type { ManualPrefill } from './manual-booking-dialog'
import type { RecurrenceDto } from './types'

const STATUS_META: Record<RecurrenceDto['status'], { label: string; className: string }> = {
  overdue: { label: 'rok je potekel', className: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800' },
  due: { label: 'na vrsti', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  upcoming: { label: 'kmalu', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
}

interface Props {
  refreshKey: number
  onBookForCustomer: (prefill: ManualPrefill) => void
  businessName: string
}

/**
 * "Kdo je na vrsti" — ponavljajoči obiski (npr. barvanje vsake 4 tedne).
 * Sistem sam pove, katere stranke je treba poklicati.
 */
export function RecurrenceCard({ refreshKey, onBookForCustomer, businessName }: Props) {
  const [entries, setEntries] = useState<RecurrenceDto[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const res = await ownerFetch('/api/appointments/recurrence')
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries ?? [])
      }
    } catch {
      /* prikažemo prazen seznam */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const active = entries.filter((e) => !e.covered)
  const covered = entries.filter((e) => e.covered)

  const waMessage = (e: RecurrenceDto) =>
    `Pozdravljena, ${e.client.name.split(' ')[0]}! Tukaj ${businessName} — prišel je čas za vaš ${e.service.name.toLowerCase()} (${recurrenceLabel(e.recurWeeks)}). Kdaj vam ustreza nov termin?`

  const book = (e: RecurrenceDto) => {
    // Datum: predvideni rok, če je v naslednjih 14 dneh
    const in14 = new Date(e.nextDue).getTime() - Date.now() < 14 * 1440 * 60000 && new Date(e.nextDue).getTime() > Date.now() - 7 * 1440 * 60000
    onBookForCustomer({
      name: e.client.name,
      phone: e.client.phone,
      serviceId: e.service.id,
      date: in14 ? e.nextDueDate : undefined,
      note: `Ponavljajoči obisk — ${recurrenceLabel(e.recurWeeks)}`,
      recurWeeks: e.recurWeeks,
    })
  }

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Ponavljajoči obiski — kdo je na vrsti</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void load()} aria-label="Osveži ponavljanja" title="Osveži">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : active.length === 0 && covered.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Ni ponavljajočih obiskov. Ob vnosu termina izberite npr. <strong>„vsake 4 tedne“</strong> — sistem vas bo sam opomnil, kdaj je stranka spet na vrsti.
          </p>
        ) : (
          <>
            <ul className="terminai-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
              {[...active, ...covered].map((e) => {
                const meta = STATUS_META[e.status]
                return (
                  <li key={e.appointmentId} className={`rounded-xl border p-3 ${e.covered ? 'border-border/40 bg-muted/30' : 'border-border/60'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1 truncate text-sm font-medium">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {e.client.name}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${e.covered ? 'border-secondary bg-secondary text-secondary-foreground' : meta.className}`}>
                        {e.covered ? 'že naročena' : meta.label}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {e.service.name} · {recurrenceLabel(e.recurWeeks)} · nazadnje {e.lastVisitLabel}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-foreground/80">
                        {e.covered ? 'nov termin: ' : 'predvideni obisk: '}
                        {e.nextDueLabel}
                      </span>
                      {!e.covered && (
                        <div className="flex gap-1.5">
                          <a
                            href={waLink(e.client.phone, waMessage(e))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-2.5 text-[11px] font-semibold text-[#128C3E] transition-colors hover:bg-[#25D366]/20 focus-visible:outline-2 focus-visible:outline-[#25D366]"
                            aria-label={`WhatsApp sporočilo ${e.client.name}`}
                            title="Pošlji WhatsApp — vabilo na nov termin"
                          >
                            <WhatsAppIcon className="h-3.5 w-3.5" /> Vabi
                          </a>
                          <Button size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-[11px]" onClick={() => book(e)}>
                            <CalendarPlus className="h-3.5 w-3.5" /> Naroči
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {active.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => {
                  const first = active[0]
                  window.open(waLink(first.client.phone, waMessage(first)), '_blank', 'noopener')
                  toast({ title: 'WhatsApp odprt', description: 'Sporočilo je pripravljeno — pritisnite Pošlji v WhatsAppu.' })
                }}
              >
                <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> Pokliči najbolj zamudno ({active[0].client.name})
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
