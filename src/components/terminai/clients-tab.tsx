'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch } from '@/lib/owner-fetch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Users,
  Search,
  Phone,
  CalendarDays,
  Wallet,
  Heart,
  AlertTriangle,
  NotebookPen,
  Pencil,
  Download,
  Trash2,
  Sparkles,
  RefreshCw,
  History,
  Palette,
  Camera,
  Cake,
} from 'lucide-react'
import { shrinkFull, shrinkThumb } from '@/lib/image-resize'
import { formatPrice, dateParts, formatBirthday, parseBirthdayInput } from './types'
import type { PhotoDto } from './types'
import { waLink, WhatsAppIcon } from './whatsapp'

interface ClientRow {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  birthday: string | null
  photoCount: number
  visits: number
  noShows: number
  totalCents: number
  lastVisit: string | null
  next: { at: string; service: string } | null
  favorite: string | null
}

interface VisitRow {
  datum: string
  storitev: string
  status: string
  cena: number
  opomba: string | null
  formula: string | null
}

const PHOTO_KIND_LABEL: Record<string, string> = {
  before: 'Pred',
  after: 'Po',
  result: 'Rezultat',
  reference: 'Referenca',
}

const VISIT_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Čaka', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  confirmed: { label: 'Potrjen', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  checked_in: { label: 'Prišla', className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800' },
  completed: { label: 'Zaključen', className: 'bg-secondary text-secondary-foreground border-border' },
  cancelled: { label: 'Odpovedan', className: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800' },
  no_show: { label: 'Ni prišla', className: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
}

/** Koliko tednov nazaj je bil zadnji obisk (null, če ni podatka). */
function weeksSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(`${dateStr}T00:00:00Z`).getTime()) / 86400000)
  return days < 0 ? 0 : Math.floor(days / 7)
}

/** "Dolgo jih ni bilo" — zadnji obisk 8+ tednov nazaj in ni naslednjega termina. */
const STALE_WEEKS = 8

interface Props {
  businessName: string
}

/** Baza strank — obiski, prihodki, opombe (formule) + GDPR izvoz/izbris + zgodovina + win-back. */
export function ClientsTab({ businessName }: Props) {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Win-back filter: stranke, ki jih je dolgo ni bilo
  const [staleOnly, setStaleOnly] = useState(false)

  // Urejanje stranke (opombe, e-pošta, rojstni dan)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<ClientRow | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editBirthday, setEditBirthday] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Zgodovina obiskov (s formulami + fotografije)
  const [historyTarget, setHistoryTarget] = useState<ClientRow | null>(null)
  const [history, setHistory] = useState<VisitRow[] | null>(null)
  const [photos, setPhotos] = useState<PhotoDto[] | null>(null)

  // Povečava fotografije (lightbox)
  const [zoomPhoto, setZoomPhoto] = useState<PhotoDto | null>(null)
  const [zoomFull, setZoomFull] = useState<string | null>(null)
  const [zoomLoading, setZoomLoading] = useState(false)
  const [zoomDeleting, setZoomDeleting] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [addingPhoto, setAddingPhoto] = useState(false)

  // GDPR izbris
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(() => {
    ownerFetch('/api/clients')
      .then(async (r) => {
        if (r.status === 401) {
          setError('PIN')
          return null
        }
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => {
        if (d) {
          setClients(d.clients)
          setError(null)
        }
      })
      .catch(() => setError('Napaka pri nalaganju strank.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Za vsako stranko: ali je "dolgo ni bilo tu" (8+ tednov, brez naslednjega termina). */
  const staleMap = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const c of clients) {
      if (c.next) {
        map.set(c.id, null) // ima prihajajoči termin — ni kandidat
        continue
      }
      const w = weeksSince(c.lastVisit)
      map.set(c.id, w !== null && w >= STALE_WEEKS ? w : null)
    }
    return map
  }, [clients])

  const staleCount = useMemo(
    () => clients.filter((c) => staleMap.get(c.id) != null).length,
    [clients, staleMap]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = clients
    if (staleOnly) list = list.filter((c) => staleMap.get(c.id) != null)
    if (!q) return list
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
  }, [clients, query, staleOnly, staleMap])

  const totals = useMemo(
    () => ({
      visits: clients.reduce((s, c) => s + c.visits, 0),
      revenue: clients.reduce((s, c) => s + c.totalCents, 0),
    }),
    [clients]
  )

  /** Win-back sporočilo — kot Zenoti "win-back flows", a osebno in brez naročnine. */
  const winbackLink = (c: ClientRow) => {
    const first = c.name.split(' ')[0]
    return waLink(
      c.phone,
      `Živjo ${first}! Že dolgo te nismo videle pri ${businessName} 💇‍♀️ Kdaj ti ustreza naslednji obisk? Lep pozdrav!`
    )
  }

  const openEdit = (c: ClientRow) => {
    setEditing(c)
    setEditNotes(c.notes ?? '')
    setEditEmail(c.email ?? '')
    // "05-03" → "5. 3." (berljivo za vnos; server sprejme tudi "05-03")
    setEditBirthday(c.birthday ? c.birthday.split('-').map(Number).reverse().join('. ') + '.' : '')
    setEditOpen(true)
  }

  const saveClient = async () => {
    if (!editing) return
    // Rojstni dan: sprejmemo "5. 3.", "05-03" itn.; prazno = izbris
    const bd = parseBirthdayInput(editBirthday)
    if (bd === false) {
      toast({
        title: 'Rojstni dan ni veljaven',
        description: 'Zapišite ga kot 5. 3. ali 05-03 (dan in mesec).',
        variant: 'destructive',
      })
      return
    }
    setEditSaving(true)
    try {
      const res = await ownerFetch(`/api/clients/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editNotes, email: editEmail, birthday: bd ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Shranjevanje ni uspelo.', variant: 'destructive' })
        return
      }
      toast({
        title: 'Shranjeno ✓',
        description: bd
          ? `${editing.name} — rojstni dan ${formatBirthday(bd, true)}; opombe vidne pri naslednjem obisku.`
          : `${editing.name} — opombe vidne pri naslednjem obisku.`,
      })
      setEditOpen(false)
      load()
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  /** Zgodovina obiskov z zasebnimi opombami (formule) + fotografije. */
  const openHistory = (c: ClientRow) => {
    setHistoryTarget(c)
    setHistory(null)
    setPhotos(null)
    ownerFetch(`/api/clients/${c.id}?view=plain`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHistory(d.termini ?? []))
      .catch(() => {
        setHistory([])
        toast({ title: 'Napaka', description: 'Zgodovine ni bilo mogoče naložiti.', variant: 'destructive' })
      })
    ownerFetch(`/api/photos?clientId=${c.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPhotos(d.photos ?? []))
      .catch(() => setPhotos([]))
  }

  /** Povečava fotografije — naloži veliko sliko (dataUrl) posebej. */
  const openZoom = (p: PhotoDto) => {
    setZoomPhoto(p)
    setZoomFull(null)
    setZoomLoading(true)
    ownerFetch(`/api/photos?id=${p.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setZoomFull(d.photo?.dataUrl ?? null))
      .catch(() => setZoomFull(null))
      .finally(() => setZoomLoading(false))
  }

  const deleteZoomPhoto = async () => {
    if (!zoomPhoto) return
    setZoomDeleting(true)
    try {
      const res = await ownerFetch(`/api/photos?id=${zoomPhoto.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setPhotos((prev) => (prev ? prev.filter((p) => p.id !== zoomPhoto.id) : prev))
      setZoomPhoto(null)
      setZoomFull(null)
      toast({ title: 'Fotografija izbrisana' })
    } catch {
      toast({ title: 'Napaka', description: 'Brisanje ni uspelo.', variant: 'destructive' })
    } finally {
      setZoomDeleting(false)
    }
  }

  /** Dodaj referenco — sliko, ki jo prinese stranka (šlosa, ki jo želi). */
  const addReferencePhoto = async (file: File) => {
    if (!historyTarget) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'To ni slika', description: 'Izberite fotografijo (JPG/PNG).', variant: 'destructive' })
      return
    }
    setAddingPhoto(true)
    try {
      const [dataUrl, thumbUrl] = await Promise.all([shrinkFull(file), shrinkThumb(file)])
      const res = await ownerFetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: historyTarget.id,
          kind: 'reference',
          dataUrl,
          thumbUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Fotografija ni shranjena', description: data.error ?? 'Poskusite znova.', variant: 'destructive' })
        return
      }
      setPhotos((prev) => [data.photo, ...(prev ?? [])])
      toast({ title: 'Referenca shranjena 📷', description: `${historyTarget.name} — vidna v njeni zgodovini.` })
    } catch {
      toast({ title: 'Napaka', description: 'Slike ni bilo mogoče obdelati.', variant: 'destructive' })
    } finally {
      setAddingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  /** GDPR: izvoz vseh podatkov stranke kot JSON datoteko. */
  const exportClient = async (c: ClientRow) => {
    setExporting(c.id)
    try {
      const res = await ownerFetch(`/api/clients/${c.id}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `TerminAI-${c.name.replace(/\s+/g, '-')}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Izvoz prenesen ✓', description: 'Vsa zgodovina stranke v eni datoteki (GDPR).' })
    } catch {
      toast({ title: 'Napaka', description: 'Izvoz ni uspel.', variant: 'destructive' })
    } finally {
      setExporting(null)
    }
  }

  /** GDPR: trajen izbris stranke in vseh njenih terminov. */
  const deleteClient = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await ownerFetch(`/api/clients/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Izbris ni uspel.', variant: 'destructive' })
        return
      }
      toast({
        title: 'Stranka izbrisana',
        description: `${deleteTarget.name} · odstranjenih terminov: ${data.removedAppointments}`,
      })
      setDeleteTarget(null)
      load()
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Baza strank</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{clients.length} strank</span>
            <span>·</span>
            <span>{totals.visits} obiskov</span>
            <span>·</span>
            <span className="font-semibold text-foreground">{formatPrice(totals.revenue)}</span>
          </div>
          {/* Win-back stikalo — stranke, ki jih je dolgo ni bilo */}
          <Button
            size="sm"
            variant={staleOnly ? 'default' : 'outline'}
            className={`ml-auto gap-1.5 ${staleOnly ? '' : 'border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/60'}`}
            onClick={() => setStaleOnly((v) => !v)}
            aria-pressed={staleOnly}
            title="Stranke, ki jih je 8+ tednov ni bilo tu — povabite jih nazaj"
          >
            <Heart className="h-4 w-4" /> Dolgo jih ni bilo{staleCount > 0 ? ` (${staleCount})` : ''}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Iskanje po imenu ali telefonu …"
              className="pl-9"
              aria-label="Iskanje strank"
            />
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            <NotebookPen className="mr-1 inline h-3 w-3 align-[-2px]" />
            {staleOnly
              ? 'Te stranke so že 8+ tednov brez obiska in nimajo novega termina — kliknite WhatsApp in jih povabite nazaj.'
              : 'Opombe (formule barvanja, alergije) se shranijo ob stranki — pri urejanju kliknite svinčnik. Zgodovina obiskov: ura ikona.'}
          </p>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {error === 'PIN' ? 'Dostop zavrnjen — vnesite PIN.' : error}
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {staleOnly
                ? 'Odlično — vse stranke so bile pri vas v zadnjih 8 tednih ali imajo nov termin.'
                : query
                  ? 'Ni zadetkov za iskanje.'
                  : 'Baza strank se bo polnila z vsako rezervacijo.'}
            </p>
          ) : (
            <div className="terminai-scroll max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((c) => {
                const staleWeeks = staleMap.get(c.id)
                const isStale = staleWeeks != null
                return (
                  <div
                    key={c.id}
                    className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
                      isStale && staleOnly
                        ? 'border-amber-300/60 bg-amber-50/40 dark:border-amber-700/50 dark:bg-amber-950/20'
                        : 'border-border/60 hover:border-primary/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        {c.visits >= 5 && (
                          <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
                            <Heart className="h-3 w-3" /> zvesta stranka
                          </Badge>
                        )}
                        {isStale && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                            title="8+ tednov brez obiska in brez novega termina"
                          >
                            <RefreshCw className="h-3 w-3" /> {staleWeeks} {staleWeeks === 2 ? 'tedna' : 'tednov'} ni bilo tu
                          </Badge>
                        )}
                        {c.noShows > 0 && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-400"
                            title="Število izostankov — poteče če pravi termini"
                          >
                            <AlertTriangle className="h-3 w-3" /> {c.noShows}× ni prišla
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {c.visits} obiskov
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Wallet className="h-3 w-3" /> {formatPrice(c.totalCents)}
                        </span>
                        {c.photoCount > 0 && (
                          <span className="inline-flex items-center gap-1" title="Fotografije v zgodovini">
                            <Camera className="h-3 w-3" /> {c.photoCount}
                          </span>
                        )}
                        {c.birthday && (
                          <span className="inline-flex items-center gap-1" title={`Rojstni dan: ${formatBirthday(c.birthday, true)}`}>
                            <Cake className="h-3 w-3" /> {formatBirthday(c.birthday)}
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <div
                          className="mt-1 flex items-start gap-1.5 rounded-lg bg-primary/5 px-2 py-1 text-[11px] leading-snug text-primary/90"
                          title={c.notes}
                        >
                          <NotebookPen className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">{c.notes}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                      <div className="text-right text-xs text-muted-foreground">
                        {c.next ? (
                          <div>
                            <span className="text-[10px] uppercase tracking-wide">naslednji</span>
                            <div className="font-medium text-foreground">
                              {new Date(c.next.at).getUTCDate()}. ob{' '}
                              {String(new Date(c.next.at).getUTCHours()).padStart(2, '0')}:
                              {String(new Date(c.next.at).getUTCMinutes()).padStart(2, '0')}
                            </div>
                            <div className="truncate">{c.next.service}</div>
                          </div>
                        ) : (
                          <div>{c.favorite ? `največkrat: ${c.favorite}` : c.lastVisit ? `zadnji obisk ${c.lastVisit}` : 'še ni obiskala'}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {isStale && (
                          <Button asChild size="icon" variant="outline" className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300">
                            <a
                              href={winbackLink(c)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Povabi ${c.name} nazaj na WhatsApp`}
                              title="Povabi nazaj — sporočilo je pripravljeno"
                            >
                              <WhatsAppIcon className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openHistory(c)}
                          aria-label={`Zgodovina obiskov ${c.name}`}
                          title="Zgodovina obiskov (s formulami)"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(c)}
                          aria-label={`Opombe za ${c.name}`}
                          title="Opombe (formule, alergije)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={exporting === c.id}
                          onClick={() => void exportClient(c)}
                          aria-label={`Izvozi podatke ${c.name}`}
                          title="GDPR izvoz — vsi podatki v JSON"
                        >
                          {exporting === c.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                          onClick={() => setDeleteTarget(c)}
                          aria-label={`Izbriši ${c.name}`}
                          title="GDPR izbris — stranka in vsi njeni termini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: zgodovina obiskov stranke (s formulami + fotografije) */}
      <Dialog open={historyTarget !== null} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <History className="h-5 w-5 text-primary" /> {historyTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Vsi obiski — formule in fotografije so zasebne (za PIN-om), strankine opombe pa so zraven.
            </DialogDescription>
          </DialogHeader>

          {/* Fotografije — lokalni Photo Manager: rezultati + reference */}
          <div className="rounded-xl border border-border/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Camera className="h-4 w-4 text-primary" /> Fotografije
                {photos && photos.length > 0 && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {photos.length}
                  </span>
                )}
              </span>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Dodaj referenčno fotografijo"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void addReferencePhoto(f)
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                disabled={addingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                {addingPhoto ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Dodaj referenco
              </Button>
            </div>
            {photos === null ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-20 rounded-lg" />
                ))}
              </div>
            ) : photos.length === 0 ? (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Še ni fotografij — dodajte jih ob zaključku obiska (pred/po) ali kot referenco,
                ki jo prinese stranka (šlosa, ki si jo želi).
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="group relative overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.03] focus-visible:scale-[1.03]"
                    onClick={() => openZoom(p)}
                    aria-label={`Poglej fotografijo — ${PHOTO_KIND_LABEL[p.kind] ?? p.kind}`}
                    title={`${PHOTO_KIND_LABEL[p.kind] ?? p.kind}${p.caption ? ` · ${p.caption}` : ''}`}
                  >
                    <img
                      src={p.thumbUrl}
                      alt={`Fotografija — ${historyTarget?.name} (${PHOTO_KIND_LABEL[p.kind] ?? p.kind})`}
                      className="h-20 w-20 object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1 text-[9px] font-semibold text-foreground">
                      {PHOTO_KIND_LABEL[p.kind] ?? p.kind}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {history === null ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Stranka še ni imela terminov.
            </p>
          ) : (
            <div className="terminai-scroll max-h-[60vh] space-y-2 overflow-y-auto pr-1 py-1">
              {history.map((v, i) => {
                const st = VISIT_STATUS[v.status] ?? { label: v.status, className: 'bg-secondary text-secondary-foreground border-border' }
                const p = dateParts(v.datum.slice(0, 10))
                return (
                  <div key={i} className={`rounded-xl border p-3 ${v.status === 'cancelled' || v.status === 'no_show' ? 'border-border/40 opacity-60' : 'border-border/60'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">
                          {p.dayName}, {p.dayNum}. {p.month}
                          <span className="ml-1 font-normal text-muted-foreground">
                            {v.datum.slice(11, 16)}
                          </span>
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.className}`}>{st.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">{formatPrice(v.cena)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{v.storitev}</div>
                    {v.formula && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-primary/5 px-2 py-1.5 text-[11px] leading-snug text-primary/90">
                        <Palette className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{v.formula}</span>
                      </div>
                    )}
                    {v.opomba && (
                      <div className="mt-1 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                        <NotebookPen className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{v.opomba}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: povečava fotografije (lightbox) */}
      <Dialog open={zoomPhoto !== null} onOpenChange={(o) => !o && (setZoomPhoto(null), setZoomFull(null))}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-base">
              <Camera className="h-4 w-4 text-primary" />
              {zoomPhoto && (PHOTO_KIND_LABEL[zoomPhoto.kind] ?? zoomPhoto.kind)}
              {zoomPhoto?.caption && (
                <span className="font-normal text-muted-foreground">· {zoomPhoto.caption}</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {zoomPhoto?.appointment
                ? `${zoomPhoto.appointment.service} — ${dateParts(zoomPhoto.appointment.date.slice(0, 10)).dayName}, ${dateParts(zoomPhoto.appointment.date.slice(0, 10)).dayNum}. ${dateParts(zoomPhoto.appointment.date.slice(0, 10)).month}`
                : `Pri stranki od ${zoomPhoto ? dateParts(zoomPhoto.createdAt.slice(0, 10)).dayNum : ''}. ${zoomPhoto ? dateParts(zoomPhoto.createdAt.slice(0, 10)).month : ''}`}
              {zoomPhoto && ` · ${historyTarget?.name ?? ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-48 justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/40">
            {zoomLoading ? (
              <div className="flex h-72 w-full items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : zoomFull ? (
              <img
                src={zoomFull}
                alt={`Fotografija — ${historyTarget?.name ?? ''}`}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            ) : (
              <div className="flex h-72 w-full items-center justify-center text-sm text-muted-foreground">
                Slike ni bilo mogoče naložiti.
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => (setZoomPhoto(null), setZoomFull(null))}>
              Zapri
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              disabled={zoomDeleting}
              onClick={() => void deleteZoomPhoto()}
            >
              {zoomDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Izbriši fotografijo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: opombe o stranki */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <NotebookPen className="h-5 w-5 text-primary" /> {editing?.name}
            </DialogTitle>
            <DialogDescription>
              Formule barvanja, alergije, rojstni dan — vidno samo vam (za PIN-om).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cl-notes">Opombe o stranki</Label>
              <Textarea
                id="cl-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="npr. 6-34 + 7-43, občutljiva lasišča; rada kratke šiške"
                rows={4}
                maxLength={1000}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-birthday" className="flex items-center gap-1">
                <Cake className="h-3.5 w-3.5 text-primary" /> Rojstni dan
              </Label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <Input
                  id="cl-birthday"
                  value={editBirthday}
                  onChange={(e) => setEditBirthday(e.target.value)}
                  placeholder="npr. 5. 3."
                  inputMode="numeric"
                  maxLength={10}
                />
                <p className="text-[11px] leading-snug text-muted-foreground sm:pt-1.5">
                  {(() => {
                    const p = parseBirthdayInput(editBirthday)
                    if (p === null) return 'Brez leta — samo za čestitko.'
                    if (p === false) return 'Neveljavno — zapišite kot 5. 3.'
                    return `Shranimo: ${formatBirthday(p, true)}`
                  })()}
                </p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-email">E-pošta</Label>
              <Input
                id="cl-email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="neobvezno"
                inputMode="email"
                maxLength={80}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Prekliči
            </Button>
            <Button className="gap-1.5" onClick={() => void saveClient()} disabled={editSaving}>
              {editSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: GDPR izbris */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbrisati stranko?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">{deleteTarget?.name}</strong> — GDPR izbris izbriše stranko in{' '}
                  <strong className="text-foreground">vse njene termine</strong> (tudi zgodovino in statistiko).
                  Dejanje je nepovratno.
                </p>
                <p className="text-xs">
                  Če želite podatke obdržati za evidenco, raje uporabite izvoz (gumb za prenos) pred izbrisom.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void deleteClient()
              }}
            >
              {deleting ? 'Brišem …' : 'Trajno izbriši'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
