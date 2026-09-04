'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { ownerFetch, clearStoredPin } from '@/lib/owner-fetch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Sparkles, RefreshCw, TriangleAlert } from 'lucide-react'

/**
 * Demo način — obnovi Studio Aura z bogato demo zgodovino.
 * Namensko za prodajne obiske: namestitelj s klikom pokaže poln demo,
 * po predstavitvi pa nastavi pravi salon ("Nastavi pravi salon").
 * Zahteva vpis DEMO (poleg PIN-a), ker izbriše vse trenutne podatke.
 */
export function DemoResetCard() {
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const restore = async () => {
    setBusy(true)
    try {
      const res = await ownerFetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'demo' }),
      })
      if (!res.ok) throw new Error()
      // PIN se pri obnovi ponastavi (nov salon) — počistimo shranjenega
      clearStoredPin()
      toast({
        title: 'Demo podatki obnovljeni',
        description: 'Studio Aura z bogato zgodovino — stran se osveži.',
      })
      setTimeout(() => window.location.reload(), 900)
    } catch {
      toast({ title: 'Napaka', description: 'Obnova demo podatkov ni uspela.', variant: 'destructive' })
      setBusy(false)
    }
  }

  return (
    <Card className="border-amber-200/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold">Demo podatki (za predstavitev)</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Obnovi Studio Aura z bogato demo zgodovino: ~40 dni terminov, ponavljajoče stranke,
          izostanki in polno mesečno poročilo. Namensko za predstavitev stranki — po njej
          uporabite <strong className="text-foreground">„Nastavi pravi salon“</strong> in vnesete njene podatke.
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-red-200/60 bg-red-50/50 p-3 text-xs text-muted-foreground dark:bg-red-950/30">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
          <span>
            <strong className="text-foreground">Izbriše vse trenutne podatke</strong> (termine, stranke,
            storitve, sporočila) in ponastavi PIN.
          </span>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Obnovi demo podatke
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Obnovim demo podatke?</AlertDialogTitle>
              <AlertDialogDescription>
                Vsi trenutni podatki (termine, stranke, storitve, sporočila, PIN) bodo izbrisani in
                zamenjani z demo bazo Studio Aura. Tega ni mogoče razveljaviti — pred nadaljevanjem
                po potrebi naredite varnostno kopijo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <label htmlFor="demo-confirm" className="text-sm font-medium">
                Za potrditev vpišite <strong>DEMO</strong>:
              </label>
              <Input
                id="demo-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase().trim())}
                placeholder="DEMO"
                className="text-center font-mono tracking-[0.3em]"
                autoComplete="off"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText('')}>Prekliči</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== 'DEMO' || busy}
                onClick={(e) => {
                  e.preventDefault() // dialog naj se ne zapre, dokler ne uspe
                  void restore()
                }}
              >
                {busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                {busy ? 'Obnavljam …' : 'Da, obnovi demo'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
