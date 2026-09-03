'use client'

import { Button } from '@/components/ui/button'
import { Sparkles, ArrowDown, Bell, CalendarCheck, TrendingUp, PhoneOff, WifiOff } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden dot-grid">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:pb-24 lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary">
            <WifiOff className="h-3.5 w-3.5" />
            Deluje tudi brez interneta · podatki ostanejo pri vas
          </div>

          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Manjkajoči termini <br />
            <span className="italic text-primary">so končani.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            TerminAI je rezervacijski sistem za frizerske, kozmetične in druge salone. Stranke rezervirajo same
            <strong className="text-foreground"> 24/7</strong> — na vašem računalniku, brez naročnine in brez
            odvisnosti od interneta. Izostanki se zmanjšajo za <strong className="text-foreground">do 40 %</strong>,
            AI recepcionarka Ana pa je na voljo kot <strong className="text-foreground">dodatek</strong>.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2 text-base shadow-lg shadow-primary/25">
              <a href="#demo">
                <Sparkles className="h-4 w-4" /> Poglej živi demo
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 text-base">
              <a href="#cene">Cene za salone</a>
            </Button>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t pt-6">
            {[
              { icon: <PhoneOff className="h-4 w-4" />, value: '−80 %', label: 'telefoniranja' },
              { icon: <Bell className="h-4 w-4" />, value: '−40 %', label: 'izostankov' },
              { icon: <TrendingUp className="h-4 w-4" />, value: '+22 %', label: 'prihodkov' },
            ].map((s, i) => (
              <div key={i}>
                <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="text-primary">{s.icon}</span> {s.label}
                </dt>
                <dd className="mt-1 font-display text-3xl font-semibold text-primary">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Vizualna kartica */}
        <div className="relative hidden lg:block" aria-hidden="true">
          <div className="absolute left-6 top-6 z-10 max-w-[240px] -rotate-2 rounded-2xl border bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
              </span>
              Nova rezervacija
            </div>
            <div className="mt-2 font-medium">Ana Novak</div>
            <div className="text-xs text-muted-foreground">Striženje — ženske · sob 10:30</div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              <WifiOff className="h-3 w-3" /> Brez interneta · offline
            </div>
          </div>

          <div className="absolute bottom-10 right-4 z-10 max-w-[230px] rotate-1 rounded-2xl border bg-card p-4 shadow-xl">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prihodki — oktober</div>
            <div className="mt-1 font-display text-3xl font-semibold text-primary">4.280 €</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[78%] rounded-full bg-primary" />
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">96 terminov · 78 % zasedenost</div>
          </div>

          <div className="mx-auto max-w-md rounded-3xl border bg-gradient-to-br from-primary to-primary/70 p-8 shadow-2xl shadow-primary/30">
            <div className="flex items-center gap-3 text-primary-foreground">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-lg font-semibold">Danes — sreda</div>
                <div className="text-xs text-primary-foreground/70">8 terminov · 2 čakata potrditev</div>
              </div>
            </div>
            <div className="mt-6 space-y-2.5">
              {[
                { t: '09:30', n: 'Striženje — ž.', s: 'Potrjen' },
                { t: '11:00', n: 'Striženje — m.', s: 'Zaključen' },
                { t: '13:00', n: 'Morjenje', s: 'Potrjen' },
                { t: '16:00', n: 'Barvanje', s: 'Čaka' },
              ].map((r) => (
                <div key={r.t} className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm text-primary-foreground">
                  <span className="font-display font-semibold">{r.t}</span>
                  <span className="flex-1 truncate">{r.n}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.s === 'Čaka' ? 'bg-amber-300/90 text-amber-900' : 'bg-emerald-300/80 text-emerald-900'}`}>
                    {r.s}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-white/20 pt-4 text-xs text-primary-foreground/80">
              <span>Zasedenost</span>
              <span className="font-semibold text-white">72 %</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex justify-center pb-8">
        <a href="#demo" aria-label="Pomakni se do dema" className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary">
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </a>
      </div>
    </section>
  )
}
