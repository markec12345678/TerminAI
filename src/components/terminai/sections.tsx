'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Reveal } from './reveal'
import {
  Clock,
  Bot,
  Flame,
  LayoutDashboard,
  Smartphone,
  ArrowRight,
  Store,
  Users,
  Wallet,
  Check,
  WifiOff,
  HardDrive,
  Wrench,
  CalendarX2,
} from 'lucide-react'

const FEATURES = [
  {
    icon: <Clock className="h-5 w-5" />,
    title: 'Rezervacije 24/7',
    text: 'Stranke rezervirajo kadar koli — tudi ob 23. uri, ko vi že spite. Vsak prosti termin je na voljo.',
  },
  {
    icon: <WifiOff className="h-5 w-5" />,
    title: 'Deluje brez interneta',
    text: 'Sistem teče na računalniku v salonu. Stranke rezervirajo prek telefona v vašem omrežju — internetne povezave sploh ne potrebujete.',
  },
  {
    icon: <HardDrive className="h-5 w-5" />,
    title: 'Podatki ostanejo pri vas',
    text: 'Baza strank, termini in prihodki so shranjeni na vašem računalniku — ne v oblaku tretje osebe. Rezervna kopija na USB s klikom.',
  },
  {
    icon: <Flame className="h-5 w-5" />,
    title: 'Pametne vršne cene',
    text: 'Sobota in popoldnevi samodejno dražji, tihi termini cenejši. Zasedenost se izenači — več prometa.',
  },
  {
    icon: <CalendarX2 className="h-5 w-5" />,
    title: 'Prazniki, dopust, kosilo',
    text: 'Slovenske praznike uvozite s klikom, dopust zaprete z obsegom datumov, kosilo kot premor — stranke vidijo, kdaj ste res odprti.',
  },
  {
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: 'Nadzorna plošča v živo',
    text: 'Koledar, prihodki, zasedenost in baza strank na enem zaslonu. Tudi na telefonu.',
  },
  {
    icon: <Bot className="h-5 w-5" />,
    title: 'Ana AI — dodatek',
    text: 'AI recepcionarka v slovenščini odgovarja na vprašanja o cenah in terminih. Opcijski dodatek, ko sistem povežete na splet.',
  },
]

const STEPS = [
  {
    icon: <Store className="h-6 w-6" />,
    step: '1',
    title: 'Namestitev pri vas',
    text: 'Prinesem sistem na USB ključku, na vašem računalniku ga namestim in skupaj vnesemo vaše storitve in cene. Uro kasneje vse deluje — brez interneta, brez naročnine.',
  },
  {
    icon: <Users className="h-6 w-6" />,
    step: '2',
    title: 'Stranke rezervirajo same',
    text: 'Stranke odprejo rezervacijsko stran na telefonu (dovolj je vaš WiFi). Ko bo čas, sistem po želji povežemo na splet — isti podatki, isto izkušnja.',
  },
  {
    icon: <Wallet className="h-6 w-6" />,
    step: '3',
    title: 'Sistem je vaš',
    text: 'Vsako jutro pregled dneva na telefonu. Manj praznih terminov, več prihodkov — in ko enkrat plačate, izdelka nihče ne more izklopiti.',
  },
]

export function Features() {
  return (
    <section id="funkcije" className="scroll-mt-16 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Vse, kar salon potrebuje. <span className="italic text-primary">Nič, česar ne.</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Zasnovano za frizerje, kozmetike, masažerje, trenerje in vse, ki živijo od terminov.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={0.05 * i}>
              <Card className="group h-full border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    {f.icon}
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        {/* Kako deluje */}
        <Reveal className="mt-16 rounded-3xl border bg-gradient-to-br from-secondary/60 to-background p-6 sm:p-10">
          <h3 className="text-center font-display text-2xl font-semibold sm:text-3xl">Kako deluje — trije koraki</h3>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={0.12 * i}>
                <div className="relative">
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
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const PLANS = [
  {
    icon: <HardDrive className="h-4 w-4" />,
    name: 'Osnovni paket',
    price: '199 €',
    period: 'enkrat',
    desc: 'Sistem postane vaš.',
    features: [
      'Namestitev na vašem računalniku',
      'Vnos vaših storitev in cen skupaj z vami',
      'Deluje popolnoma offline',
      'Rezervna kopija baze na USB',
      'Brez naročnine — plačate enkrat',
    ],
    cta: 'Preizkusi živi demo',
    ctaHref: '#demo',
    highlight: true,
  },
  {
    icon: <Wrench className="h-4 w-4" />,
    name: 'Vzdrževanje',
    price: '19 €',
    period: 'na mesec · neobvezno',
    desc: 'Mir in podpora, ko jo potrebujete.',
    features: [
      'Posodobitve sistema',
      'Tehnična pomoč v slovenščini',
      'Pregled rezervnih kopij',
      'Preklic kadar koli',
    ],
    cta: 'Dogovorimo se',
    ctaHref: '#demo',
    highlight: false,
  },
  {
    icon: <Bot className="h-4 w-4" />,
    name: 'Dodatek Ana AI',
    price: '39 €',
    period: 'na mesec · ko greste na splet',
    desc: 'AI recepcionarka in spomniki.',
    features: [
      'Ana odgovarja strankam v slovenščini',
      'SMS & e-mail spomniki na termine',
      'Povezava sistema na splet',
      'Vklop / izklop kadar koli',
    ],
    cta: 'Preberi več',
    ctaHref: '#faq',
    highlight: false,
  },
]

export function Pricing() {
  return (
    <section id="cene" className="scroll-mt-16 bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Enkrat plačate. <span className="italic text-primary">Sistem je vaš.</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Brez naročnine za osnovni sistem, brez skritega, brez tveganja: namestitev pri vas, preizkus na vaših
            strankah, plačilo šele ko ste zadovoljni. Vzdrževanje in Ana AI sta neobvezna.
          </p>
        </Reveal>

        <div className="mt-10 grid items-start gap-6 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={0.08 * i} className="h-full">
              <Card
                className={`relative h-full border-border/60 ${
                  p.highlight
                    ? 'border-primary/50 shadow-xl shadow-primary/15 md:-mt-4 md:scale-[1.02]'
                    : 'hover:border-primary/30'
                }`}
              >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow">
                  Najbolj priljubljen
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {p.icon}
                  </span>
                  <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                </div>
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
                  asChild
                  className={`mt-6 w-full gap-1.5 ${p.highlight ? 'shadow-lg shadow-primary/25' : ''}`}
                  variant={p.highlight ? 'default' : 'outline'}
                  size="lg"
                >
                  <a href={p.ctaHref}>
                    {p.cta} <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" /> Preizkus brez stroškov: namestim sistem pri vas, stranke ga
          preizkusijo, plačate šele po odločitvi.
        </p>
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: 'Kako stranka rezervira, kadar ni v salonu?',
    a: 'Stranka vam piše po WhatsAppu (gumb na rezervacijski strani odpre pogovor z pripravljenim sporočilom). Njen odgovor prilepite v modul "Sporočila": program ga razume, preveri proste termine in sestavi odgovor s cenami — s klikom ga pošljete nazaj in vpišete termin. Ko sistem kasneje povežemo na splet, bo odgovarjal sam, 24/7.',
  },
  {
    q: 'Ali sistem deluje brez interneta?',
    a: 'Da. TerminAI teče na računalniku v vašem salonu — internetne povezave ne potrebuje. Stranke rezervirajo prek telefona, ki je povezan v vaš WiFi. Na splet ga po želji povežemo kasneje, brez prenosa podatkov.',
  },
  {
    q: 'Koliko časa traja uvedba?',
    a: 'Približno eno uro: namestim sistem na vaš računalnik in skupaj vnesemo vaše storitve, cene in delovni čas. Že isti dan ga lahko preizkusijo vaše stranke.',
  },
  {
    q: 'Kje so shranjeni moji podatki?',
    a: 'Na vašem računalniku — baza strank, termini in prihodki ne gredo v noben oblak. Rezervno kopijo naredite na USB ključek z enim klikom, tako so podatki varni tudi ob okvari računalnika.',
  },
  {
    q: 'Kaj če prenehate z vzdrževanjem ali odjavim Ana AI?',
    a: 'Nič se ne izklopi. Osnovni sistem je vaš in deluje naprej — tudi brez vzdrževanja in brez Anje. Dodatka sta neobvezna in ju lahko kadar koli prekličete ali znova vklopite.',
  },
  {
    q: 'Kaj če stranka ne more priti na termin?',
    a: 'Vsak termin ima svojo odpovedno povezavo: WhatsApp spominik, ki ga pošljete dan prej, jo vsebuje — stranka klikne in termin odpove sama, termin se takoj sprosti. Če ne pride in ne odpove, z enim klikom označite "ni prišla" in izostanki se samodejno štejejo pri stranki v bazi.',
  },
  {
    q: 'Kako dobim podatke za knjigovodstvo?',
    a: 'V zavihku „Poročila“ izberete mesec in s klikom prenesete CSV datoteko z obračunanimi obiski (datum, stranka, storitev, cena). Datoteka se odpre v Excelu brez pretvorb — pošljete jo knjigovodji ali prenesete na USB. Na istem mestu vidite tudi prihodke po dnevih in najboljše stranke meseca.',
  },
  {
    q: 'Kaj pa prazniki, dopust in kosilo?',
    a: 'Praznike uvozite z enim klikom (vsak državni praznik za tekoče in naslednje leto), dopust zaprete z obsegom datumov, vsak dan pa lahko zaprete posebej. Stranke teh dni ne morejo rezervirati — modul Sporočila sam ponudi prve proste dneve. Kosilo ali počitek nastavite kot premor v delovnem času: v tem oknu terminov ni.',
  },
  {
    q: 'Kaj če grem na dopust, nekdo pa že ima rezervacijo?',
    a: 'Zaprite dan (ali obseg) v zavihku „Salon“ — novi termini se takoj nehajo ponujati. Obstoječe rezervacije za te dneve vidite v koledarju in jih odpovete ali prestavite posamično; odpovedna povezava naredi odpoved nebolečo.',
  },
  {
    q: 'Kako izbrišem podatke stranke (GDPR)?',
    a: 'V zavihku „Stranke“ ima vsaka stranka gumb za izvoz (vsi njeni podatki in zgodovina v eni datoteki) in gumb za trajen izbris — slednji izbriše stranko in vse njene termine. Prav tako se ob izbrisu ne pusti telefonskih številk v seznamih: vsi lastniški podatki so za PIN-om.',
  },
  {
    q: 'Kaj če stranka nima telefona s pametnim zaslonom?',
    a: 'Rezervacijska stran deluje na vsakem telefonu z brskalnikom — brez namestitve aplikacije. Starejše stranke lahko seveda pokličejo, vi pa termin vpišete v nadzorno ploščo.',
  },
  {
    q: 'Kako Ana AI zmanjša moj telefon?',
    a: 'Ana je dodatek za obdobje, ko sistem povežete na splet: odgovarja na ponavljajoča vprašanja (cene, trajanje, delovni čas) strankam na vaši strani. Saloni poročajo o 60–80 % manj klicih in sporočilih.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Pogosta vprašanja</h2>
          <p className="mt-3 text-muted-foreground">Odgovori, ki jih lastniki salonov največkrat sprašujejo.</p>
        </Reveal>

        <Reveal delay={0.1}>
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
        </Reveal>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-20">
      <Reveal>
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-primary-foreground shadow-2xl shadow-primary/30 sm:p-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <h2 className="relative font-display text-3xl font-semibold sm:text-4xl">
          Vaš nasledji termin je že <span className="italic">rezerviran.</span>
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/85">
          Prinesem ga na USB ključku, namestim pri vas in vaše stranke ga preizkusijo — plačate šele, ko vidite, da
          deluje. Brez naročnine, brez odvisnosti od interneta, brez tveganja.
        </p>
        <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary" className="gap-2 text-base">
            <a href="#demo">
              <ArrowRight className="h-4 w-4" /> Preizkusi živi demo
            </a>
          </Button>
        </div>
        </div>
      </Reveal>
    </section>
  )
}
