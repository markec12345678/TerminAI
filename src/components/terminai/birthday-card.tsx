'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ownerFetch } from '@/lib/owner-fetch'
import { waLink, WhatsAppIcon } from './whatsapp'
import { Cake, CalendarPlus, Check, Phone, RefreshCw, Settings2 } from 'lucide-react'
import type { ManualPrefill } from './manual-booking-dialog'
import type { BirthdayDto } from './types'
import { formatBirthday, slCount } from './types'
import { ljTodayKey } from '@/lib/ljubljana'

interface Props {
  businessName: string
  refreshKey: number
  onBookForCustomer: (prefill: ManualPrefill) => void
}

interface NextBirthday {
  name: string
  birthday: string
  inDays: number
}

/** Oznake poslanih čestitk — lokalno (lastnikov brskalnik), ključ vključuje LETO, zato se naslednje leto samodejno ponastavi. */
const SENT_KEY = 'terminai-bday-sent'
const BENEFIT_KEY = 'terminai-bday-benefit'

function sentKeyOf(b: BirthdayDto): string {
  return `${b.dateKey}|${b.id}`
}

function loadSent(): Set<string> {
  try {
    const year = ljTodayKey().slice(0, 4)
    const raw = JSON.parse(window.localStorage.getItem(SENT_KEY) ?? '[]') as string[]
    // počisti lanskoletne oznake (datumski ključ vsebuje leto)
    const kept = raw.filter((k) => k.slice(0, 4) === year)
    if (kept.length !== raw.length) {
      window.localStorage.setItem(SENT_KEY, JSON.stringify(kept))
    }
    return new Set(kept)
  } catch {
    return new Set()
  }
}

function persistSent(sent: Set<string>) {
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify([...sent]))
  } catch {
    /* zasebni način brskalnika ipd. — ni kritično */
  }
}

function loadBenefit(): string {
  try {
    return window.localStorage.getItem(BENEFIT_KEY) ?? ''
  } catch {
    return ''
  }
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
 * kdaj ima stranka rojstni dan, s OSEBNO WhatsApp čestitko (omeni njeno
 * priljubljeno storitev) in enojnim gumbom za naročilo "rojstnodnevnega
 * obiska". Frizerke vedo: rojstnodnevno sporočilo je najbolj "odprto"
 * sporočilo na svetu — stranka se oglaša sama nazaj.
 */
export function BirthdayCard({ businessName, refreshKey, onBookForCustomer }: Props) {
  const [items, setItems] = useState<BirthdayDto[] | null>(null)
  const [next, setNext] = useState<NextBirthday | null>(null)
  const [error, setError] = useState(false)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [benefit, setBenefit] = useState('')
  const [editing, setEditing] = useState(false)
  const [benefitDraft, setBenefitDraft] = useState('')

  const load = useCallback(() => {
    ownerFetch('/api/birthdays')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setItems(d.birthdays ?? [])
        setNext(d.next ?? null)
        // oznake "poslano" + ugodnost živita v lastnikovem brskalniku (localStorage)
        setSent(loadSent())
        const bft = loadBenefit()
        setBenefit(bft)
        setBenefitDraft(bft)
      })
      .catch(() => {
        setError(true)
        /* tiho — kartica je stranski modul */
      })
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  /** Čestitka z rojstnodnevnim povabilom (frizerka jo lahko še prilagodi). */
  const greet = (b: BirthdayDto) => {
    const first = b.name.split(' ')[0]
    const parts = [`Živjo ${first}! Vse najboljše ob rojstnem dnevu! 🎂💐`]
    const bft = benefit.trim()
    if (bft) parts.push(`V rojstnem mesecu te pri nas čaka ${bft}.`)
    const svc = b.service?.toLowerCase()
    parts.push(svc ? `Kdaj ti ustreza termin za ${svc}?` : 'Kdaj pa se spet vidimo?')
    parts.push(`Lep pozdrav, ${businessName}`)
    return waLink(b.phone, parts.join(' '))
  }

  const markSent = (b: BirthdayDto) => {
    const key = sentKeyOf(b)
    if (sent.has(key)) return
    const next = new Set(sent)
    next.add(key)
    setSent(next)
    persistSent(next)
  }

  const resetSent = () => {
    setSent(new Set())
    persistSent(new Set())
  }

  const saveBenefit = () => {
    const v = benefitDraft.trim()
    setBenefit(v)
    try {
      window.localStorage.setItem(BENEFIT_KEY, v)
    } catch {
      /* ni kritično */
    }
    setEditing(false)
  }

  const book = (b: BirthdayDto) => {
    onBookForCustomer({
      name: b.name,
      phone: b.phone,
      serviceId: b.serviceId ?? undefined,
      // predlagani "rojstnodnevni obisk": dan rojstnega dne (če je v 90 dneh — trak ročnega vnosa)
      date: b.inDays <= 90 ? b.dateKey : undefined,
    })
  }

  const soon = (items ?? []).filter((b) => b.inDays <= 14)
  const nextSoon = (items ?? []).find((b) => b.inDays > 14) ?? null
  const soonLabel = soon.length > 0 ? `${slCount(soon.length, 'stranka', 'stranki', 'stranke', 'strank')} v 14 dneh` : ''
  const sentCount = soon.filter((b) => sent.has(sentKeyOf(b))).length

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
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setBenefitDraft(benefit)
              setEditing((v) => !v)
            }}
            aria-label={editing ? 'Zapri nastavitev ugodnosti' : 'Nastavi rojstnodnevno ugodnost'}
            title="Ugodnost v čestitki (neobvezno)"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => load()} aria-label="Osveži rojstne dneve" title="Osveži">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Rojstnodnevna čestitka je najbolj odprto sporočilo, ki ga prejme — stranka
          se odzove sama. Rojstni dan dodate pri stranki (svinčilka v Bazi strank).
        </p>

        {editing && (
          <div className="space-y-2 rounded-xl border bg-secondary/40 p-3">
            <Label htmlFor="bday-benefit" className="text-xs font-medium">
              Ugodnost v čestitki (neobvezno)
            </Label>
            <Input
              id="bday-benefit"
              value={benefitDraft}
              onChange={(e) => setBenefitDraft(e.target.value)}
              placeholder="npr. −20 % na obisk"
              className="h-8 text-xs"
              maxLength={80}
            />
            <p className="text-[10px] leading-snug text-muted-foreground">
              Pustite prazno, če ne ponujate ugodnosti — čestitka ne obljublja ničesar.
              Nastavitev se shrani v tem brskalniku.
            </p>
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>
                Prekliči
              </Button>
              <Button size="sm" className="h-7 px-3 text-xs" onClick={saveBenefit}>
                Shrani
              </Button>
            </div>
          </div>
        )}

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
              {nextSoon
                ? `V naslednjih 14 dneh ni rojstnih dni — naslednja je ${nextSoon.name.split(' ')[0]} (${formatBirthday(nextSoon.birthday)}).`
                : next
                  ? `V naslednjih 45 dneh ni rojstnih dni — prva je ${next.name.split(' ')[0]} (${formatBirthday(next.birthday)}, ${inDaysLabel(next.inDays)}).`
                  : 'Stranke z rojstnim dnevom v tem obdobju ni. Dodajte rojstne dneve pri strankah — čestitke delajo čudeže.'}
            </p>
          </div>
        ) : (
          <div className="terminai-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
            {soon.map((b) => {
              const isSent = sent.has(sentKeyOf(b))
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/30 ${
                    b.inDays === 0
                      ? 'border-primary/40 bg-primary/5'
                      : isSent
                        ? 'border-border/60 bg-muted/40'
                        : 'border-border/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${isSent ? 'text-muted-foreground' : ''}`}>{b.name}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          b.inDays === 0
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {inDaysLabel(b.inDays)}
                      </span>
                      {isSent && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                          title="Čestitka je bila odprta za pošiljanje — klik na WhatsApp odpre znova"
                        >
                          <Check className="h-3 w-3" /> poslano
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Cake className="h-3 w-3" /> {formatBirthday(b.birthday, true)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {b.phone}
                      </span>
                    </div>
                    {b.service && (
                      <div className="mt-0.5 truncate text-[11px] text-foreground/70" title={`Priljubljena storitev: ${b.service}`}>
                        najpogosteje: {b.service}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      asChild
                      size="icon"
                      variant="outline"
                      className="h-10 w-10 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <a
                        href={greet(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Čestitka ${b.name} na WhatsApp`}
                        title="Pošlji čestitko — sporočilo je pripravljeno"
                        onClick={() => markSent(b)}
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-10 w-10"
                      onClick={() => book(b)}
                      aria-label={`Naroči rojstnodnevni obisk za ${b.name}`}
                      title={b.inDays <= 90 ? `Naroči obisk ${b.inDays === 0 ? 'danes' : inDaysLabel(b.inDays)} — predlagan datum je rojstni dan` : 'Naroči obisk'}
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {nextSoon && (
              <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
                Naslednja: {nextSoon.name.split(' ')[0]} — {formatBirthday(nextSoon.birthday)} ({inDaysLabel(nextSoon.inDays)}).
              </p>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-[10px] leading-snug text-muted-foreground">
                {sentCount > 0
                  ? `${slCount(sentCount, 'čestitka', 'čestitki', 'čestitke', 'čestitk')} že odprtih za pošiljanje.`
                  : 'Orodje je brez naročnine — kot "birthday campaigns" v dražjih sistemih.'}
              </p>
              {sentCount > 0 && (
                <button
                  type="button"
                  className="shrink-0 text-[10px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={resetSent}
                  title='Ponastavi oznake "poslano"'
                >
                  Ponastavi oznake
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
