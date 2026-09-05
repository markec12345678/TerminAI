'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ownerFetch } from '@/lib/owner-fetch'
import { waLink, WhatsAppIcon } from './whatsapp'
import { Cake, Phone } from 'lucide-react'
import type { BirthdayDto } from './types'
import { formatBirthday } from './types'

interface Props {
  businessName: string
}

/** Berljiva bližina: "danes 🎉" / "jutri" / "čez 3 dni". */
function inDaysLabel(inDays: number): string {
  if (inDays === 0) return 'danes 🎉'
  if (inDays === 1) return 'jutri'
  if (inDays === 2) return 'čez 2 dni'
  return `čez ${inDays} dni`
}

/**
 * Rojstni dnevi — kot Zenoti "birthday campaigns", a brez naročnine:
 * kdaj ima stranka rojstni dan, s pripravljeno WhatsApp čestitko.
 * Frizerke vedo: rojstnodnevno sporočilo je najbolj "odprto" sporočilo
 * na svetu — stranka se oglaša sama nazaj.
 */
export function BirthdayCard({ businessName }: Props) {
  const [items, setItems] = useState<BirthdayDto[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    ownerFetch('/api/birthdays')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setItems(d.birthdays ?? []))
      .catch(() => {
        setError(true)
        /* tiho — kartica je stranski modul */
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Čestitka z rojstnodnevnim povabilom (frizerka jo lahko še prilagodi). */
  const greet = (b: BirthdayDto) => {
    const first = b.name.split(' ')[0]
    return waLink(
      b.phone,
      `Živjo ${first}! Vse najboljše ob rojstnem dnevu! 🎂💐 Pri ${businessName} vam v rojstnem mesecu podarimo -20 % na obisk — kdaj pa vam ustreza? Lep pozdrav!`
    )
  }

  const soon = (items ?? []).filter((b) => b.inDays <= 14)
  const next = (items ?? []).find((b) => b.inDays > 14) ?? null
  const soonLabel =
    soon.length === 1 ? '1 stranka v 14 dneh' : soon.length === 2 ? '2 stranki v 14 dneh' : `${soon.length} strank v 14 dneh`

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 border-b py-4">
        <div className="flex items-center gap-2">
          <Cake className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Rojstni dnevi</h3>
        </div>
        {soon.length > 0 && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {soonLabel}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Rojstnodnevna čestitka je najbolj odprto sporočilo, ki ga prejme — stranka
          se odzove sama. Rojstni dan dodate pri stranki (svinčilka v Bazi strank).
        </p>

        {items === null ? (
          error ? (
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
              Seznama ni bilo mogoče naložiti.
            </p>
          ) : (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          )
        ) : soon.length === 0 ? (
          <div className="space-y-2">
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
              {next
                ? `V naslednjih 14 dneh ni rojstnih dni — naslednja je ${next.name.split(' ')[0]} (${formatBirthday(next.birthday)}).`
                : 'V naslednjih 45 dneh ni rojstnih dni. Dodajte jih pri strankah — čestitke delajo čudeže.'}
            </p>
          </div>
        ) : (
          <div className="terminai-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
            {soon.map((b) => (
              <div
                key={b.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/30 ${
                  b.inDays === 0
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{b.name}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        b.inDays === 0
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {inDaysLabel(b.inDays)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Cake className="h-3 w-3" /> {formatBirthday(b.birthday, true)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {b.phone}
                    </span>
                  </div>
                </div>
                <Button
                  asChild
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300"
                >
                  <a
                    href={greet(b)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Čestitka ${b.name} na WhatsApp`}
                    title="Pošlji čestitko — sporočilo je pripravljeno"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ))}
            {next && (
              <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
                Naslednja: {next.name.split(' ')[0]} — {formatBirthday(next.birthday)} (čez {next.inDays} dni).
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
