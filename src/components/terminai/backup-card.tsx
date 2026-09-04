'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch } from '@/lib/owner-fetch'
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
import { ShieldCheck, HardDriveDownload, Plus, Download, RefreshCw, CheckCircle2, History, RotateCcw } from 'lucide-react'
import type { BackupListDto } from './types'

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Kartica varnostnih kopij — seznam, ročna kopija, prenos na USB. */
export function BackupCard() {
  const [data, setData] = useState<BackupListDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const res = await ownerFetch('/api/backup')
      if (res.ok) setData(await res.json())
    } catch {
      /* prikažemo prazno stanje */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createNow = async () => {
    setCreating(true)
    try {
      const res = await ownerFetch('/api/backup', { method: 'POST' })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setData({ backups: d.backups, lastBackupAt: d.backups[0]?.createdAt ?? null, dir: 'db/backups', auto: data?.auto ?? '' })
      toast({ title: 'Varnostna kopija ustvarjena ✓', description: `${d.backup.name} · ${sizeLabel(d.backup.sizeBytes)}` })
    } catch {
      toast({ title: 'Napaka', description: 'Kopije ni bilo mogoče ustvariti.', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const download = async (name: string) => {
    setDownloading(name)
    try {
      const res = await ownerFetch(`/api/backup?file=${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `TerminAI-${name}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Prenos se je začel', description: `Datoteko shranite na USB ključek: TerminAI-${name}` })
    } catch {
      toast({ title: 'Napaka', description: 'Prenos ni uspel.', variant: 'destructive' })
    } finally {
      setDownloading(null)
    }
  }

  /** Obnova baze iz kopije — pred obnovo se naredi zaščitna kopija. */
  const restore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const res = await ownerFetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', file: restoreTarget }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: 'Baza obnovljena ✓',
        description: `Stanje iz ${restoreTarget} — zaščitna kopija pred obnovo: ${data.safetyBackup}`,
      })
      setRestoreTarget(null)
      // Osveži celotno stran — vsi podatki (termine, stranke) so iz obnovljene baze
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      toast({
        title: 'Obnova ni uspela',
        description: e instanceof Error ? e.message : 'Poskusite znova.',
        variant: 'destructive',
      })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Varnostne kopije</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void load()} aria-label="Osveži kopije" title="Osveži">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-20" />
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-3 text-xs text-muted-foreground dark:bg-emerald-950/30">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                Samodejno varovanje je vklopljeno — nova kopija se naredi ob vsakem zagonu (največ ena na dan).{' '}
                {data?.lastBackupAt ? (
                  <>
                    Zadnja kopija: <strong className="text-foreground">{data.backups[0]?.ageLabel}</strong>.
                  </>
                ) : (
                  <>Kopij še ni — ustvarite prvo zdaj.</>
                )}
              </span>
            </div>

            {data && data.backups.length > 0 ? (
              <ul className="terminai-scroll max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {data.backups.map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[11px] font-medium">{b.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {b.ageLabel} · {sizeLabel(b.sizeBytes)}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() => setRestoreTarget(b.name)}
                        aria-label={`Obnovi iz ${b.name}`}
                        title="Obnovi bazo iz te kopije"
                      >
                        <RotateCcw className="h-3 w-3" /> Obnovi
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() => void download(b.name)}
                        disabled={downloading === b.name}
                        aria-label={`Prenesi ${b.name}`}
                        title="Prenesi na računalnik / USB"
                      >
                        {downloading === b.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        Prenesi
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                <HardDriveDownload className="mx-auto mb-1 h-5 w-5 opacity-40" />
                Baza se samodejno varuje na tem računalniku (mapa db/backups).
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => void createNow()} disabled={creating}>
                {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Naredi kopijo zdaj
              </Button>
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Kopija vsebuje vse termine, stranke in cenik. Prenesite jo na USB ključek za hrambo izven računalnika.
              Gumb <strong className="text-foreground">Obnovi</strong> vrne bazo na stanje izbrane kopije (pred obnovo se vedno naredi zaščitna kopija).
            </p>
          </>
        )}
      </CardContent>
    </Card>

    {/* AlertDialog: potrditev obnove */}
    <AlertDialog open={restoreTarget !== null} onOpenChange={(o) => !o && setRestoreTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Obnovi iz varnostne kopije?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Baza se vrne na stanje kopije <strong className="font-mono text-foreground">{restoreTarget}</strong> — termini,
                stranke in spremembe po tej kopiji izginejo.
              </p>
              <p>
                Pred obnovo se samodejno naredi <strong className="text-foreground">zaščitna kopija trenutnega stanja</strong>,
                tako da nič ne more biti izgubljeno.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction disabled={restoring} onClick={(e) => { e.preventDefault(); void restore() }}>
            {restoring ? 'Obnavljam …' : 'Obnovi bazo'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
