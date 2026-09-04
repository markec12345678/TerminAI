'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Users, Search, Phone, CalendarDays, Wallet, Heart, AlertTriangle, NotebookPen, Pencil, Download, Trash2, Sparkles, RefreshCw } from 'lucide-react'
import { formatPrice } from './types'

interface ClientRow {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  visits: number
  noShows: number
  totalCents: number
  lastVisit: string | null
  next: { at: string; service: string } | null
  favorite: string | null
}

/** Baza strank — obiski, prihodki, opombe (formule) + GDPR izvoz/izbris. */
export function ClientsTab() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Urejanje stranke (opombe, e-pošta)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<ClientRow | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
  }, [clients, query])

  const totals = useMemo(
    () => ({
      visits: clients.reduce((s, c) => s + c.visits, 0),
      revenue: clients.reduce((s, c) => s + c.totalCents, 0),
    }),
    [clients]
  )

  const openEdit = (c: ClientRow) => {
    setEditing(c)
    setEditNotes(c.notes ?? '')
    setEditEmail(c.email ?? '')
    setEditOpen(true)
  }

  const saveClient = async () => {
    if (!editing) return
    setEditSaving(true)
    try {
      const res = await ownerFetch(`/api/clients/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editNotes, email: editEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Napaka', description: data.error ?? 'Shranjevanje ni uspelo.', variant: 'destructive' })
        return
      }
      toast({ title: 'Shranjeno ✓', description: `${editing.name} — opombe vidne pri naslednjem obisku.` })
      setEditOpen(false)
      load()
    } catch {
      toast({ title: 'Napaka', description: 'Povezava ni uspela.', variant: 'destructive' })
    } finally {
      setEditSaving(false)
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Baza strank</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{clients.length} strank</span>
            <span>·</span>
            <span>{totals.visits} obiskov</span>
            <span>·</span>
            <span className="font-semibold text-foreground">{formatPrice(totals.revenue)}</span>
          </div>
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
            Opombe (formule barvanja, alergije) se shranijo ob stranki — pri urejanju kliknite svinčnik.
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
              {query ? 'Ni zadetkov za iskanje.' : 'Baza strank se bo polnila z vsako rezervacijo.'}
            </p>
          ) : (
            <div className="terminai-scroll max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.visits >= 5 && (
                        <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
                          <Heart className="h-3 w-3" /> zvesta stranka
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: opombe o stranki */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <NotebookPen className="h-5 w-5 text-primary" /> {editing?.name}
            </DialogTitle>
            <DialogDescription>
              Formule barvanja, alergije, želje — vidne samo vam (za PIN-om).
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
