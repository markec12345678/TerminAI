'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  MessageSquare,
  Send,
  Sparkles,
  CalendarPlus,
  Copy,
  Mail,
  Phone,
  History,
  CheckCircle2,
  Clock,
  Tag,
  CalendarDays,
} from 'lucide-react'
import { WhatsAppIcon as WaIcon, waLink } from './whatsapp'
import { ownerFetch } from '@/lib/owner-fetch'
import type { ManualPrefill } from './manual-booking-dialog'
import type { AppointmentDto } from './types'
import { slCount } from './types'

interface MessageRow {
  id: string
  name: string | null
  phone: string
  email: string | null
  body: string
  intent: string
  reply: string | null
  createdAt: string
}

interface ParsedResult {
  intent: string
  services: { id: string; name: string; priceCents: number; peakPriceCents: number; durationMin: number }[]
  dateHint: string | null
  timeHint: string | null
}

interface AvailabilityResult {
  date: string
  dayLabel: string
  times: { time: string; peak: boolean }[]
  requestedTime: string | null
  requestedFree: boolean | null
  altDays: { dayLabel: string; times: string[] }[]
}

interface AnalyzeResponse {
  message: MessageRow
  parsed: ParsedResult
  availability: AvailabilityResult | null
}

const INTENT_META: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  booking: { label: 'Naročilo', icon: <CalendarDays className="h-3 w-3" />, className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  price: { label: 'Cena', icon: <Tag className="h-3 w-3" />, className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  cenik: { label: 'Cenik', icon: <Tag className="h-3 w-3" />, className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  availability: { label: 'Zasedenost', icon: <Clock className="h-3 w-3" />, className: 'bg-primary/10 text-primary border-primary/20' },
  unknown: { label: 'Neznano', icon: <MessageSquare className="h-3 w-3" />, className: 'bg-muted text-muted-foreground border-border' },
}

const EXAMPLES = [
  {
    name: 'Ana Novak',
    phone: '040 555 111',
    body: 'Pozdravljeni! Naročam se na striženje in barvanje v soboto.',
  },
  {
    name: 'Mojca Kos',
    phone: '031 222 333',
    body: 'Koliko stane barvanje s prho?',
  },
  {
    name: 'Sabina Li',
    phone: '051 909 808',
    body: 'Prosim pošljite mi cenik. Hvala!',
  },
]

interface Props {
  onBookForCustomer: (prefill: ManualPrefill) => void
  onAppointmentCreated?: (a: AppointmentDto) => void
}

/**
 * Modul Sporočila — stranka piše na WhatsApp/SMS, lastnik sporočilo prilepi
 * sem, program ga razume, preveri termine in sestavi odgovor.
 * 1 klik: odgovor gre ven (WhatsApp/e-pošta/kopija), termin se vpiše.
 */
export function MessageInbox({ onBookForCustomer }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [body, setBody] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [history, setHistory] = useState<MessageRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const { toast } = useToast()

  const loadHistory = useCallback(async () => {
    try {
      const res = await ownerFetch('/api/messages')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.messages)
      }
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const submit = async () => {
    if (body.trim().length < 2 || phone.trim().length < 6) return
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await ownerFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, body }),
      })
      const data: AnalyzeResponse & { error?: string } = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Razčlenjevanje ni uspelo.', variant: 'destructive' })
        return
      }
      setResult(data)
      loadHistory()
      toast({
        title: 'Sporočilo razčlenjeno ✓',
        description: 'Odgovor je pripravljen — pošljite ga ali vpišite termin.',
      })
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setAnalyzing(false)
    }
  }

  const copyReply = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Skopirano', description: 'Odgovor je v odložišču — prilepite v WhatsApp/SMS.' })
    } catch {
      toast({ title: 'Napaka', description: 'Kopiranje ni uspelo.', variant: 'destructive' })
    }
  }

  const intentMeta = result ? INTENT_META[result.parsed.intent] ?? INTENT_META.unknown : null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* VNOS SPOROČILA */}
      <Card className="border-border/60">
        <CardHeader className="border-b py-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Novo sporočilo stranke</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Prilepite, kar vam je stranka napisala na WhatsAppu ali SMS — program razume, preveri termine in pripravi odgovor.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {/* Primeri za hitri preizkus */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Preizkusi:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.body}
                onClick={() => { setName(ex.name); setPhone(ex.phone); setBody(ex.body) }}
                className="rounded-full border bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                {ex.body.length > 38 ? ex.body.slice(0, 36) + '…' : ex.body}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mi-name">Ime stranke</Label>
              <Input id="mi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Ana Novak" maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mi-phone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefon *
              </Label>
              <Input id="mi-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="npr. 040 123 456" inputMode="tel" maxLength={24} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mi-email" className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> E-pošta (neobvezno — omogoči odgovor po e-pošti)
            </Label>
            <Input id="mi-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="npr. ana@email.si" inputMode="email" maxLength={80} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mi-body">Sporočilo stranke *</Label>
            <Textarea
              id="mi-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="npr. Naročam se na striženje in barvanje v soboto"
              rows={3}
              maxLength={500}
              className="resize-none"
            />
          </div>

          <Button
            className="w-full gap-2"
            disabled={analyzing || body.trim().length < 2 || phone.trim().length < 6}
            onClick={submit}
          >
            {analyzing ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" /> Razčlenjujem …
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Razčleni in pripravi odgovor
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* PROGRAMOV ODGOVOR */}
      <Card className="border-primary/30">
        <CardHeader className="border-b py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Pripravljen odgovor</h3>
            </div>
            {result && intentMeta && (
              <Badge variant="outline" className={`gap-1 ${intentMeta.className}`}>
                {intentMeta.icon} {intentMeta.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {!result ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
              {analyzing ? 'Berem sporočilo, preverjam termine …' : 'Vnesite sporočilo — odgovor se prikaže tukaj.'}
            </div>
          ) : (
            <>
              {/* Pogovor */}
              <div className="space-y-3">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                  {result.message.body}
                  <div className="mt-1 text-right text-[10px] text-primary-foreground/70">
                    {result.message.name ?? result.message.phone}
                  </div>
                </div>
                <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-sm border bg-card px-4 py-2.5 text-sm shadow-sm">
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed">{result.message.reply}</pre>
                </div>
              </div>

              {/* Razčlenjeno */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {result.parsed.services.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1 font-normal">
                    {s.name}
                  </Badge>
                ))}
                {result.parsed.dateHint && (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <CalendarDays className="h-3 w-3" /> {result.availability?.dayLabel ?? result.parsed.dateHint}
                  </Badge>
                )}
                {result.parsed.timeHint && (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Clock className="h-3 w-3" /> {result.parsed.timeHint}
                  </Badge>
                )}
              </div>

              {/* Status zahtevane ure */}
              {result.availability?.requestedTime && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    result.availability.requestedFree
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                  }`}
                >
                  {result.availability.requestedFree ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Termin ob {result.availability.requestedTime} je PROST — potrdite stranki.
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4" /> Termin ob {result.availability.requestedTime} je ZASEDEN — predlagajte alternativo.
                    </>
                  )}
                </div>
              )}

              {/* Akcije */}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild className="gap-1.5 bg-[#25D366] text-white hover:bg-[#1eb856]">
                  <a href={waLink(phone, result.message.reply ?? '')} target="_blank" rel="noopener noreferrer">
                    <WaIcon className="h-4 w-4" /> Pošlji po WhatsAppu
                  </a>
                </Button>
                {email ? (
                  <Button asChild variant="outline" className="gap-1.5">
                    <a
                      href={`mailto:${email}?subject=${encodeURIComponent(`Odgovor — ${result.parsed.intent === 'cenik' ? 'cenik' : 'vaš termin'}`)}&body=${encodeURIComponent(result.message.reply ?? '')}`}
                    >
                      <Mail className="h-4 w-4" /> Pošlji po e-pošti
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" className="gap-1.5" onClick={() => copyReply(result.message.reply ?? '')}>
                    <Copy className="h-4 w-4" /> Kopiraj odgovor
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="gap-1.5 sm:col-span-2"
                  onClick={() =>
                    onBookForCustomer({
                      name,
                      phone,
                      serviceId: result.parsed.services[0]?.id,
                      date: result.parsed.dateHint ?? undefined,
                      note: `iz sporočila: ${result.message.body.slice(0, 80)}`,
                    })
                  }
                >
                  <CalendarPlus className="h-4 w-4" /> Vpiši termin za to stranko
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ZGODOVINA */}
      <Card className="border-border/60 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Zgodovina sporočil</h3>
          </div>
          <span className="text-xs text-muted-foreground">{slCount(history.length, 'shranjeno', 'shranjeni', 'shranjena', 'shranjenih')}</span>
        </CardHeader>
        <CardContent className="p-4">
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Še ni sporočil — poskusite z zgornjimi primeri.
            </p>
          ) : (
            <div className="terminai-scroll max-h-96 space-y-2.5 overflow-y-auto pr-1">
              {history.map((m) => {
                const meta = INTENT_META[m.intent] ?? INTENT_META.unknown
                return (
                  <div key={m.id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">{m.name ?? 'Neznana stranka'}</span>
                      <span className="text-muted-foreground">{m.phone}</span>
                      <Badge variant="outline" className={`ml-auto gap-1 ${meta.className}`}>
                        {meta.icon} {meta.label}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">”{m.body}”</p>
                    {m.reply && (
                      <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        {m.reply.split('\n').slice(0, 3).join('\n')}
                        {m.reply.split('\n').length > 3 ? ' …' : ''}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
