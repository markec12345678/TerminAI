'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  Clock,
  Bot,
  BellRing,
  Flame,
  LayoutDashboard,
  ShieldCheck,
  Smartphone,
  ArrowRight,
  Store,
  Users,
  Wallet,
  Check,
} from 'lucide-react'

const FEATURES = [
  {
    icon: <Clock className="h-5 w-5" />,
    title: 'Rezervacije 24/7',
    text: 'Stranke rezervirajo kadar koli — tudi ob 23. uri, ko vi že spite. Vsak prosti termin je na voljo.',
  },
  {
    icon: <Bot className="h-5 w-5" />,
    title: 'AI recepcionarka Ana',
    text: 'V slovenščini odgovarja na vprašanja o cenah, storitvah in delovnem času. Namesto vas, brez prestanka.',
  },
  {
    icon: <BellRing className="h-5 w-5" />,
    title: 'SMS & e-mail spomniki',
    text: 'Samodejno spomni stranko dan prej. Izostanki se zmanjšajo za 30–40 % — to je čist prihodek.',
  },
  {
    icon: <Flame className="h-5 w-5" />,
    title: 'Pametne vršne cene',
    text: 'Sobota in popoldnevi samodejno dražji, tihi termini cenejši. Zasedenost se izenači — več prometa.',
  },
  {
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: 'Nadzorna plošča v živo',
    text: 'Koledar, prihodki, zasedenost in baza strank na enem zaslonu. Tudi na telefonu.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Baza strank & zgodovina',
    text: 'Vsak obisk shranjen: kolikokrat je stranka tu, kaj ima rada, koliko prinese. Marketing postane natančen.',
  },
]

const STEPS = [
  {
    icon: <Store className="h-6 w-6" />,
    step: '1',
    title: 'Aktivirajte salon',
    text: 'Vnesete storitve, cene in delovni čas. V 15 minutah je vaša rezervacijska stran živa na spletu.',
  },
  {
    icon: <Users className="h-6 w-6" />,
    step: '2',
    title: 'Stranke rezervirajo same',
    text: 'Povezavo delite na Instagramu, Google profilu in vizitki. Ana odgovarja, spomniki letijo, vi ne dvignete telefon.',
  },
  {
    icon: <Wallet className="h-6 w-6" />,
    step: '3',
    title: 'Vi samo pobirate denar',
    text: 'Vsako jutro pregled dneva na telefonu. Manj praznih terminov, manj izostankov, več prihodkov.',
  },
]

export function Features() {
  return (
    <section id="funkcije" className="scroll-mt-16 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Vse, kar salon potrebuje. <span className="italic text-primary">Nič, česar ne.</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Zasnovano za frizerje, kozmetike, masažerje, trenerje in vse, ki živijo od terminov.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="group border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {f.icon}
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Kako deluje */}
        <div className="mt-16 rounded-3xl border bg-gradient-to-br from-secondary/60 to-background p-6 sm:p-10">
          <h3 className="text-center font-display text-2xl font-semibold sm:text-3xl">Kako deluje — trije koraki</h3>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-14 top-7 hidden h-px w-[calc(100%-3rem)] border-t border-dashed border-primary/30 md:block" aria-hidden="true" />
                )}
                <div className="relative flex items-start gap-4">
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                    {s.icon}
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold text-primary shadow">
                      {s.step}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold">{s.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const PLANS = [
  {
    name: 'Start',
    price: '0 €',
    period: 'prvih 30 dni',
    desc: 'Za preizkus brez tveganja.',
    features: ['Neomejene rezervacije', 'AI recepcionarka Ana', 'SMS spomniki', '1 izvajalec'],
    cta: 'Začni brezplačno',
    highlight: false,
  },
  {
    name: 'Rast',
    price: '29 €',
    period: 'na mesec',
    desc: 'Za salone, ki želijo zrasti.',
    features: [
      'Vse iz Start',
      'Pametne vršne cene',
      'Nadzorna plošča & statistika',
      'Baza strank & zgodovina',
      'Podpora v slovenščini',
    ],
    cta: 'Izberi Rast',
    highlight: true,
  },
  {
    name: 'Pro',
    price: '59 €',
    period: 'na mesec',
    desc: 'Za ekipe in verige salonov.',
    features: [
      'Vse iz Rast',
      'Do 5 izvajalcev',
      'Google & Instagram povezava',
      'Tvoja domena & logotip',
      'Prednostna podpora',
    ],
    cta: 'Izberi Pro',
    highlight: false,
  },
]

export function Pricing() {
  return (
    <section id="cene" className="scroll-mt-16 bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Cena enega striženja na dan. <span className="italic text-primary">Doslovno.</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            29 €/mes prinese že 2–3 dodatna termina. Vse ostalo je čist dobiček. Brez skritega, brez dolgoročne pogodbe.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card
              key={p.name}
              className={`relative border-border/60 ${
                p.highlight
                  ? 'border-primary/50 shadow-xl shadow-primary/15 md:-mt-4 md:scale-[1.02]'
                  : 'hover:border-primary/30'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow">
                  Najbolj priljubljena
                </div>
              )}
              <CardContent className="p-6">
                <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-6 w-full gap-1.5 ${p.highlight ? 'shadow-lg shadow-primary/25' : ''}`}
                  variant={p.highlight ? 'default' : 'outline'}
                  size="lg"
                >
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" /> Vsi paketi: brez namestitve, brez kreditne kartice za preizkus.
        </p>
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: 'Koliko časa trava uvedba?',
    a: 'Približno 15 minut: vnesete storitve, cene in delovni čas. Pomagate si lahko z AI, ki predlaga storitve iz vaše stroke. Rezervacijska stran je takoj živa.',
  },
  {
    q: 'Kaj če stranka nima telefona s pametnim zaslonom?',
    a: 'Rezervacijska stran deluje na vsakem telefonu z brskalnikom — brez namestitve aplikacije. Starejše stranke lahko seveda pokličejo, vi pa termin vpišete v nadzorno ploščo.',
  },
  {
    q: 'Kako točno AI recepcionarka zmanjša moj telefon?',
    a: 'Ana odgovarja na ponavljajoča vprašanja (cene, trajanje, delovni čas, odpovedi) na vaši spletni strani in vam pošlje povzetek. Ocena naših salonov: 60–80 % manj klicev in sporočil.',
  },
  {
    q: 'Ali se stranke res izogibajo izostankom zaradi spomnikov?',
    a: 'SMS spominik 24 ur pred terminom je najbolj učinkovit — saloni poročajo o 30–40 % manj izostankih. Vsak preprečen izostanek je 35 € ali več prihodka.',
  },
  {
    q: 'Kaj se zgodi po 30-dnevnem brezplačnem obdobju?',
    a: 'Nič se ne izbriše. Če ne izberete paketa, sistem preprosto preklopi v način "samo ogled". Vaši podatki in zgodovina ostanejo shranjeni, kadar koli lahko nadaljujete.',
  },
  {
    q: 'Ali lahko zavedem več izvajalcev (dva frizerja)?',
    a: 'Da — paket Rast pokriva 1 izvajalca, Pro pa do 5. Vsak izvajalec ima svoj koledar, stranka pa vidi le skupne proste termine.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Pogosta vprašanja</h2>
          <p className="mt-3 text-muted-foreground">Odgovori, ki jih lastniki salonov največkrat sprašujejo.</p>
        </div>

        <Accordion type="single" collapsible className="mt-8">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium hover:text-primary hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-primary-foreground shadow-2xl shadow-primary/30 sm:p-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <h2 className="relative font-display text-3xl font-semibold sm:text-4xl">
          Vaš nasledji termin je že <span className="italic">rezerviran.</span>
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/85">
          Pridružite se salonom, ki so zamenjali telefon in papirnat koledar za sistem, ki dela tudi, ko ne delate vi.
        </p>
        <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary" className="gap-2 text-base">
            <a href="#demo">
              <ArrowRight className="h-4 w-4" /> Preizkusi živi demo
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
