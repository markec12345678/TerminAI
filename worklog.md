# Worklog

---
Task ID: 1
Agent: Z.ai Code (glavni agent)
Task: Izgradnja TerminAI — AI rezervacijski sistem za salone (fullstack demo produkt)

Work Log:
- Analiziral projekt (Next.js 16, shadcn/ui, Prisma/SQLite, z-ai-web-dev-sdk)
- Ustvaril Prisma shemo: Business, Service, Client, Appointment; `bun run db:push`
- Napisal src/lib/booking.ts: delovni časi, generacija terminskih slotov (30 min korak), vršne cene (po 15h + sobota), seed demo podatkov (salon Studio Aura, 5 storitev, 6 strank, termini za 3 dni)
- API ruti: /api/services (GET), /api/availability (GET), /api/appointments (GET/POST z validacijo Zod + race-safe preverjanje), /api/appointments/[id] (PATCH status), /api/stats (statistika dashboarda), /api/ai (klepet z Ano — z-ai-web-dev-sdk, slovenski sistem prompt)
- Popravil napako v /api/stats (napačno ime spremenljivke revenueCents) in izboljšal izračun zasedenosti (zasedene minute / odprte minute)
- Frontend (single page /): tema rose/burgundy + Playfair Display, navbar, hero z živim mockupom, demo sekcija (zavihki Stranka/Lastnik), rezervacijski widget (4 koraki: storitev → dan/termin → podatki → potrditev), AI klepet z predlogami vprašanj, nadzorna plošča (4 statistične kartice, recharts graf 7 dni, koledar z izbiro dneva, akcije Potrdi/Zaključi/Odpovej), funkcije, 3-korak delovanje, cene (Start/Rast/Pro), FAQ, CTA, sticky footer
- Preverjanje: `bun run lint` (čisto), E2E z agent-browser: celotni tok rezervacije (Tina Test, čet 09:00, striženje moški 22 €) → viden v nadzorni plošči → potrditev termina prek gumba deluje, AI odgovori v slovenščini, 0 napak v konzoli, VLM ocena dizajna 8,5/10, mobilna različica responsivna

Stage Summary:
- Delujoč produkt TerminAI na portu 3000: baza + API + AI + frontend, vse testirano E2E
- Datoteke: prisma/schema.prisma, src/lib/booking.ts, 6 API rut, src/components/terminai/* (10 komponent), page.tsx, layout.tsx, globals.css
- Naslednji možni koraki: plačilni tok (Stripe), avtentikacija lastnikov (NextAuth), SMS integracija, multi-salon podpora

---
Task ID: 2
Agent: Z.ai Code (glavni agent)
Task: Offline/USB distribucija — fizična namestitev pri stranki (brez AI stroškov)

Work Log:
- Dodan AI_ENABLED flag: /api/ai vrne 503 offline odgovor; AiAssistantOffline komponenta (build-time NEXT_PUBLIC_AI_ENABLED) — USB build = 0 AI stroškov
- Lokalni favicon (src/app/icon.svg), odstranjen CDN ikona iz metadata — preverjeno: bundle brez CDN referenc
- CRUD storitve: POST /api/services, PATCH/DELETE /api/services/[id] (brisanje blokirano pri prihodnjih terminih, sicer arhivacija active=false)
- POST /api/setup (mode=fresh): transakcijski reset baze + nov salon (ime, telefon, naslov)
- ServicesManager komponenta: dialog za dodajanje/urejanje (ime, trajanje select, redna/vršna cena, kategorija), AlertDialog "Nastavi pravi salon", vgrajen kot zavihek "Storitve & salon" v Dashboard
- Popravek živega osveževanja: onServicesChanged callback → DemoSection reloada storitve takoj (testirano E2E: dodajanje/brisanje takoj vidno v okviru stranke)
- export-usb.sh: ustavi dev → build (AI off) → sestavi dist-usb/TERMINAI (standalone app + custom.db demo + bun-linux + bun.exe iz GitHub releases + bat/sh skripte + navodila) → offline test na portu 3456 → restart dev
- usb-template/: ZAGON.bat (port 3456, izpis LAN IP, avto-odprtje brskalnika), NAMESTI.bat (C:\TerminAI + desktop bližnjica), NAREDI-REZERVO.bat (backup baze na USB), start.sh, NAVODILA.txt (stranka), ZA-TEBE.txt (namestitelj)
- CRITICAL FIX: dev server padel po 2. exportu (turbopack cache corrupted) + procesi ubiti ob koncu bash klica. Diagnoza: original dev zagnan iz /start.sh (init), moj pkill ga ubil. REŠITEV: start-dev.sh — python double-fork daemon (reparent na init PID 1), preživi vse klice; export-usb.sh sedaj uporablja ta pristop. RM -rf .next za corrupted cache.
- E2E (agent-browser): services CRUD (dodaj Pedicuro → vidna; izbriši → izgine), čist start reset (Salon Lepota, prazen seznam), AI odgovarja pravilno, 0 konzolnih napak
- Po testih povrnjena demo baza (Studio Aura, 5 storitev) iz backupa

Stage Summary:
- USB paket: /home/z/my-project/dist-usb/TERMINAI (325 MB) — skopiraj na USB, pri stranki NAMESTI.bat, offline delovanje preverjeno (HTTP 200, API OK, 0 CDN)
- Postopek pri stranki: NAMESTI.bat → "Nastavi pravi salon" (reset) → vnos NJIHOVIH storitev prek UI → test na telefonih (isti WiFi, http://IP:3456) → NAREDI-REZERVO.bat pred odhodom
- Dev server: teče kot daemon (start-dev.sh) — stabilen čez klice
- Še online faza (kasneje): prenos baze na strežnik, vklop AI, SMS integracija

---
Task ID: 3
Agent: Z.ai Code (glavni agent)
Task: Rebranding strani z SaaS/AI-centričnega na offline/USB model — AI kot neobvezen dodatek

Work Log:
- Hero: badge "AI recepcionarka" → "Deluje tudi brez interneta · podatki ostanejo pri vas"; kop omenja Ano izključno kot dodatek; kartica "SMS spominik poslan" → "Brez interneta · offline"
- Features: dodani kartici "Deluje brez interneta" (WifiOff) in "Podatki ostanejo pri vas" (HardDrive); Ana AI pomaknjena na zadnje mesto z oznako "dodatek"; odstranjeni SMS/Baza kartici
- Kako deluje: 3 koraki preoblikovani v zgodbo namestitve (USB ključek pri stranki → stranke rezervirajo prek WiFi → sistem je vaš, nihče ga ne more izklopiti)
- Cene: SaaS (Start 0€/Rast 29€/Pro 59€ mesečno) zamenjano z offline modelom: Osnovni paket 199 € enkrat (izpostavljen, "Najbolj priljubljen") + Vzdrževanje 19 €/mes neobvezno + Dodatek Ana AI 39 €/mes; vsak paket dobi ikono, CTA-ji povezani na #demo/#faq
- FAQ: nova vprašanja o offline delovanju, lokaciji podatkov, prenehanju vzdrževanja; Ana izključno kot dodatek
- FinalCta/footer/layout metadata: "AI rezervacijski sistem" → "rezervacijski sistem (deluje tudi offline)"
- Demo opis: Ana označena kot "neobvezen AI dodatek — tu vključena samo za predstavitev"
- Lint čist; E2E: nova cena/FQ/features/koraki se pravilno prikazujejo, CTA navigacija #demo deluje, FAQ harmonika deluje, celoten rezervacijski tok (storitev → PON 14, 09:30 → Maja Test → "Termin potrjen!") uspešen, termin v bazi prek API, testni termin izbrisan (baza čista), footer prilepljen na dno, 0 konzolnih napak, mobilni 375px OK

Stage Summary:
- Celotna stran zdaj prodaja enako zgodbo kot USB paket: offline zmogljivost, lastništvo kode, 199 € enkrat + neobvezna 19 €/39 €
- AI (Ana) povsde označena kot dodatek — skladno z AI_ENABLED=false v USB buildu
- Naslednji možni koraki: online faza (prenos na strežnik), SMS integracija, avtentikacija lastnika

---
Task ID: 4
Agent: Z.ai Code (glavni agent)
Task: Odprava "frontend se ni spremenil" — čist restart dev serverja

Work Log:
- Diagnoza: strežnik je že postregel novo vsebino (curl potrdil "Deluje tudi brez interneta", "Enkrat plačate"), vzrok stale vsebine = predpomnilnik (turbopack/brskalnik)
- Ustavil dev procese, pobrisal .next (turbopack cache), zagnal start-dev.sh daemon (2 neuspelna poskusa — port 3000 je bil še v odmiranju, tretji uspešen: HTTP 200)
- Verifikacija: HTML vsebuje novo vsebino, agent-browser (sveža seja) potrdi badge "Deluje tudi brez interneta · podatki ostanejo pri vas" in ceno "Enkrat plačate. Sistem je vaš.", 0 napak
- API sanity: /api/services 200 (Studio Aura, 5 storitev), dev.log čist

Stage Summary:
- Dev server teče sveže (clean cache) na portu 3000 z novo vsebino; uporabnik mora osvežiti predogled (reload / Open in New Tab)

---
Task ID: 5
Agent: Z.ai Code (glavni agent)
Task: Rezervacija strank izven salona — WhatsApp (zastonj), ročni vnos termina, QR koda

Work Log:
- Nov datoteka src/components/terminai/whatsapp.tsx: WhatsAppIcon (simple-icons SVG), waNumber (normalizacija +386 40 123 456 → 38640123456, vodilna 0 → 386), waLink (wa.me klik-za-klepet), waBookingText (izpolnjeno sporočilo, po želji z izbrano storitvijo) — BREZ API-ja, 0 stroškov
- BookingWidget: nova footer vrstica pod vsemi koraki — gumb POKLICI (tel:) + WHATSAPP (zelen, #25D366) z vnaprej izpolnjenim sporočilom; vidno v vseh korakih, tudi na mobilni
- Nova datoteka manual-booking-dialog.tsx: "Dodaj termin" dialog (ime, telefon, storitev Select, 14-dnevni trak dni, termini iz /api/availability z vršnimi oznakami, opomba, povzetek z ceno) → POST /api/appointments (isti API kot javni widget, race-safe prekrivanja)
- Dashboard: gumb "Dodaj termin" v glavi koledarja (predizbran trenutni dan) + osvežitev statistike/koledarja po vnosu; nova kartica ShareQrCard (qrcode.react, QRCodeSVG trenutnega window.location.origin — v USB buildu http://IP:3456; useSyncExternalStore za SSR varnost, odpravljen lint react-hooks/set-state-in-effect)
- Popravek React opozorila: Select value ?? '' (controlled)
- FAQ: novo vprašanje "Kako stranka rezervira, kadar ni v salonu?" (WhatsApp/klic → Dodaj termin → online faza 24/7)
- USB predloga (NAVODILA.txt, ZA-TEBE.txt): dodana navodila za WhatsApp gumb, ročni vnos, QR kodo in nadgradnjo
- E2E: WhatsApp href pravilen (38640123456, besedilo se dopolni z izbrano storitvijo), ročni vnos celoten tok (Petra WhatsApp, tor 09:00, Barvanje 85 € → toast + API potrditev + prikaz) — testni termin izbrisan; QR prikazuje localhost:3000; 0 konzolnih napak/opozoril; lint čist; mobilna preverjena

Stage Summary:
- Stranka od doma: WhatsApp gumb (zastonj, brez API-ja) → lastnik vpiše v 30 s z "Dodaj termin"
- Stranka v salonu: QR koda (natisnjena na ogledalu) → WiFi → samostojna rezervacija
- qrcode.react@4.2.0 nameščen (offlne komponenta)
- Naslednji možni koraki: online faza (Strežnik + domena + Ana + SMS), WhatsApp Business API avtomatizacija kot del Ane

---
Task ID: 6
Agent: Z.ai Code (glavni agent)
Task: Pametni modul "Sporočila" — stranka piše (SMS/WhatsApp/e-pošta), program razume, odgovori in vpiše termin

Work Log:
- Prisma: nov model Message (name, phone, email, body, intent, reply, createdAt) + db:push
- src/lib/message-parser.ts: normalizacija brez šumnikov; prepoznavanje namena (booking/price/cenik/availability/unknown); ujemanje storitev po ključnih besedah iz imen v bazi z dedupliciranjem različic (ženski/moški striženje); slovenski datumi (danes/jutri/v soboto — vključno s sklanjatvami sobot-, sred-, cetrt-, ponedelje-) in ure (ob 10, 10:30, 14h); composeReply sestavi WhatsApp-prijazen odgovor (cene posamično + skupaj, prosti termini iz prave baze, "termin ob 10 je prost/zaseden", alternativni dnevi če zasedeno, cel cenik na zahtevo, podpis salona)
- POST /api/messages: validacija Zod → parse → generateSlots (najdaljša storitev za naročila, najkrajša za povpraševanja) → requestedFree check → altDays (2 dneva naprej) → composeReply → shrani; GET: zadnjih 50
- PATCH /api/setup (mode:edit): urejanje podatkov salona brez brisanja (ime, telefon, naslov, mesto, e-pošta, tagline)
- message-inbox.tsx: obrazec (ime/telefon/e-pošta/sporočilo) + 3 primeri za hitri demo; pogovorne balončke (stranka + programov odgovor); badge namena + čipi razčlenjenih storitev/datuuma/ure; status zahtevane ure (PROST/ZASEDEN); akcije: Pošlji po WhatsAppu (wa.me na STRANKIN telefon z odgovorom), Pošlji po e-pošti (mailto) oz. Kopiraj; "Vpiši termin za to stranko" → predizpolnjen dialog; zgodovina z max-h-96 scroll
- ManualBookingDialog: refaktor v nadzorovan dialog (open/onOpenChange) + prefill (name, phone, serviceId, date, note) — odprt s koledarja ALI iz Sporočil
- Dashboard: 3. zavihek "Sporočila"; ManualBookingDialog dvignjen na nivo plošče (deluje iz vseh zavihkov)
- ServicesManager: nova kartica "Podatki salona" (ime, telefon, naslov, e-pošta) → PATCH, takoj viden strankam
- FAQ posodobljen (modul Sporočila); USB predloga (NAVODILA + ZA-TEBE) dopolnjena
- POPRAVKI TUDI ČESE: turbopack corrupted cache po db:push (dev restart + rm .next — znana težava); Prisma client reload zahteva restart dev serverja
- E2E: 4 scenariji parserja (naročilo s 2 storitvami + sobota → 120 € seštevek; koliko stane barvanje → 85 €; cenik → celoten; jutri ob 10h → PROST/zaseden status) vsi pravilni; UI: primer → razčleni → odgovor → WhatsApp href (wa.me/38640555111 z odgovorom) → Vpiši termin (predizpolnjeno: Ana Novak/040 555 111/Striženje ženske/SOB 5.9) → vnos v bazo ✓ (testni termin izbrisan); urejanje naslova salona ✓ (povrnjen demo); 0 konzolnih napak; lint čist; mobilni layout OK

Stage Summary:
- Celoten workflow "stranka piše → program razume → odgovor s cenami in termini → WhatsApp/e-pošta/kopija → termin vnešen" deluje 100% offline in brez AI stroškov
- Zgodovina sporočil v bazi (dolg sled) — online faza: isti modul + WhatsApp Business API = avtomatska recepcija (39 € dodatek)
- Upsell zgodba za prodajo: danes človek pritisne "pošlji", jutri stroj

---
Task ID: 7
Agent: Z.ai Code (glavni agent)
Task: Analiza vrzeli + 5 kritičnih popravkov — PIN zaščita, delovni čas iz baze, baza strank, tiskanje dnevnega reda, pošteni spomniki

Work Log:
- ANALIZA: (1) ni zaščite lastniškega območja 🔴, (2) delovni časi hardkodirani 🔴, (3) baza strank nevidna 🟠, (4) ni tiskanja 🟠, (5) "SMS poslani" izmišljeno 🟡
- Prisma: Business.pinHash + model WorkingHours (dayOfWeek 0-6, open, close, unique [businessId, dayOfWeek]) + db:push
- src/lib/pin.ts: hashPin (sha256 slug:pin), checkPin (no-pin/ok/wrong), pinAllows; src/lib/owner-fetch.ts: sessionStorage terminai_pin → glava x-owner-pin
- booking.ts: DEFAULT_HOURS (fallback + seed), getBusinessHours/getHoursForDayAsync (avto-sejanje), generateSlots(service, date, blocks, hours?) — vsi klicoči posodobljeni (availability, appointments POST, messages POST x2, stats); seedDefaultHours brez skipDuplicates (SQLite ne podpira — popravljen PrismaClientValidationError)
- API: GET/PUT /api/hours (validacija open<close), GET/POST /api/pin (set/verify/change), GET /api/clients (obiski, prihodki, zadnji/naslednji termin, priljubljena storitev); PIN zaščita na: setup POST+PATCH, services POST/PATCH/DELETE, appointments [id] PATCH/DELETE, messages GET+POST, stats GET, hours PUT (POST /api/appointments ostaja javen za stranke!)
- Dashboard: PIN vrata (lock kartica, verify, sessionStorage, loadStats po odklepu — popravljen hrošč), 4. zavihek Stranke (iskanje, badge "zvesta stranka" 5+ obiskov), gumb Natisni + #print-area (dnevni red: ura/stranka/storitev/telefon, print CSS v globals.css), kartica "Jutri pred vami" + RemindersDialog (WhatsApp osnutki za jutrišnje termine, "poslano" oznake)
- ServicesManager: kartici Delovni čas (7 dni, Switch + time inputi, PUT z validacijo) in Zaščita PIN (set/change, setStoredPin po menjavi — popravljen robni primer); ownerFetch povsod; Input value ?? '' (popravljen React value null)
- clients-tab.tsx + reminders-dialog.tsx (setData vzorec namesto setState v effect — lint pravilo)
- E2E: PIN cikel (nastavi 1234 → 401 brez/napačnega → 200 pravilnega → setup POST 401 brez PIN), delovni čas (ponedeljek 08-20 → sloti 08:00-19:30 ✓, nedelja zaprta ✓, UI toggle tor → zaprto v bazi ✓), stranke (10 strank, 8 obiskov, iskanje), spomniki (wa.me s personaliziranim besedilom "…jutri ob 15:30 — Striženje"), PIN menjava (1234→4321→verify ✓, session posodobljen), print-area z dnevnom redom, Tina Test termin počiščen, PIN ponastavljen na nedoločen za demo (dashboard odprt, nastavi se v kartici), 0 konzolnih napak, lint čist, mobilna OK
- Restart strežnika: port 3000 TIME_WAIT zamik (start-dev.sh ponovni poskusi), .next čist

Stage Summary:
- Varnostna zgodba za prodajo: "nadzorna plošča zaklenjena s PIN-om, stranke rezervirajo prosto" — 401 zaščita vseh lastniških poti
- Delovni čas popolnoma nastavljiv (vsak salon svoj urnik) — vpliva na termine, sporočila, statistiko
- Baza strank z zgodovino + tiskanje dnevenga reda + WhatsApp spomniki = popolna dnevna rutina frizerke offline
- Kasneje (online faza): več storitev v terminu, več izvajalcev, SMS API, odpoved stranke prek povezave

---
Task ID: github-push
Agent: main
Task: Push projekta TerminAI na GitHub + ustvarjanje README.md

Work Log:
- Pregledal stanje repozitorija (382 sledenih datotek, ~180M, brez remote)
- Preveril občutljive/velike datoteke: .env sleden → odstranjena iz gita; največji datoteki (bun runtime 88M/85M) pod GitHub omejitvijo 100M
- Ustvaril README.md v slovenščini: funkcije, tehnični sklad, namestitev, USB predloga, struktura projekta, podatkovni model, slike, poslovni model (199 € osnovni paket)
- Dodal .env in *.log v .gitignore
- Commit "docs: dodan README.md, odstranjen .env iz sledenja" (2bce829)
- Dodal remote origin (github.com/markec12345678/TerminAI) z žetonom, pushal main vejo
- Preveril: remote HEAD == local HEAD (2bce829) — push potrjen

Stage Summary:
- Projekt je javno dostopen na https://github.com/markec12345678/TerminAI (veja main)
- README.md vsebuje popolno dokumentacijo izdelka v slovenščini, vključno s screenshots/ referencami
- .env ni več v repotu (lokalno še vedno obstaja za delovanje)
- Opozorilo GitHub-a o velikih datotekah (bun binarne) — pod mejo, sprejeto; po želji se lahko kasneje prestavi v Git LFS

---
Task ID: 8
Agent: Z.ai Code (glavni agent)
Task: Ponavljajoči termini ("kdo je na vrsti") + samodejne varnostne kopije

Work Log:
- Prisma: Appointment.recurWeeks Int? (2–8 tednov) + db:push
- src/lib/labels.ts: RECURRENCE_OPTIONS + recurrenceLabel (slovenske oblike: "vsaka 2 tedna", "vsake 4 tedne", "vsakih 6 tednov") — skupno strežniku in odjemalcu
- src/lib/recurrence.ts: getRecurrenceOverview — zadnji termin vsakega (stranka, storitev) para z recurWeeks; rolanje ciklov nazaj; pokritost = novejši termin za isto storitev; statusi overdue/due/upcoming; obzorje 21 dni; razvrstitev po nujnosti
- API: POST /api/appointments sprejme recurWeeks — PIN zaščiten (pinAllows: javni obrazec in napačen PIN → vrednost se tiho odstrani); GET vrne recurWeeks; GET /api/appointments/recurrence (PIN 401)
- src/lib/backup.ts: createBackup (VACUUM INTO — atomaren snapshot), listBackups, ageLabel, startBackupScheduler (ob zagonu po 5 s, če zadnja > 24 h; interval 6 h, unref), MAX_BACKUPS 14
- src/instrumentation.ts: register() → startBackupScheduler (Next.js 16 stabilno, brez configa)
- API: GET /api/backup (seznam + ?file= prenos z Content-Disposition), POST /api/backup (ročna kopija) — vse PIN
- UI: recurrence-card.tsx (kartica v desnem stolpcu koledarja: statusni badgeji, WhatsApp vabilo z besedilom "prišel je čas za vaš X", gumb Naroči → predizpolnjen dialog, pokrite stranke zadaj, max-h-72 scroll); backup-card.tsx (v zavihku Storitve & salon: samodejno-varovanje obvestilo, seznam, Naredi kopijo zdaj, Prenesi prek blob → datoteka)
- ManualBookingDialog: Select "Ponavljajoči obisk" (Brez/2/3/4/6/8), badge v povzetku, prefill.recurWeeks, ownerFetch (PIN glava), toast z oznako
- Dashboard: RecurrenceCard + recurrenceKey refresh po vnosu, BackupCard, Repeat badge na terminih, recurrenceLabel import
- Seed: demo zgodovina (Petra Zupan barvanje −28 dni @4 tedne, Marko Kovač striženje −21 dni @3 tedne) + enaki vrstici vstavljeni v trenutno demo bazo (node skripta)
- Git higiena: db/custom.db odstranjen iz sledenja (runtime), .gitignore + db/backups/, tool-results/
- Restart dev: rm .next, start-dev.sh (port TIME_WAIT zamik), instrumentation potrdjen v logu ("Vzdrževalne naloge zagnane"), samodeja kopija 2026-09-03_2206.db ustvarjena ob zagonu
- E2E (agent-browser): kartica prikazuje Petra "na vrsti" + Marko "že naročena" (pravilno — Marko ima novejši termin); WhatsApp href wa.me/38651333256 z vabilom; Naroči → dialog predizpolnjen (Petra/telefon/Barvanje/vsake 4 tedne/danes) → vnos PET 10:00 → toast "· vsake 4 tedne" → badge na koledarju; Petra po vnosu izgine iz "na vrsti" (rok +4 tedne) ✓; PIN test: brez glave recurWeeks=None, napačen PIN=None, pravilen 9999=4; recurrence/backup API 401 brez PIN; ročna kopija + toast; prenos = HTTP 200, veljavna SQLite datoteka (odc "SQLite format 3"); testni termini/stranke/PIN počiščeni; mobilni 375px OK; 0 konzolnih napak; lint čist; screenshoti (recurrence-card, recurrence-mobile, backup-card)
- Push: commit f1c893a na github.com/markec12345678/TerminAI (remote == local)

Stage Summary:
- Dve novi prodajni funkciji: "kdo je na vrsti" (ponavljajoči obiski) in samodejno varovanje baze
- Upsell zgodba: papirni koledar ne zna "vsake 4 tedne" — sistem pokliče stranke namesto lastnice; samodejni backup zmanjša podporo
- Naslednji možni koraki: no-show sledenje, iCal izvoz, odpoved prek povezave, pilot namestitev pri pravem salonu

---
Task ID: 9
Agent: Z.ai Code (glavni agent)
Task: No-show sledenje + odpoved prek povezave + iCal izvoz (nadaljevanje seznama funkcij)

Work Log:
- Prisma: Appointment.cancelToken (unikatna 12-mestna koda, @unique) + db:push; status dobi vrednost no_show
- NOV API /api/appointments/cancel: GET (podatki termina po žetonu, brez imena/telefona) + POST (odpoved, validacija: 404 neznano, 409 že odpovedan/čas minil) — javna pot, žeton = overitev
- NOV API /api/appointments/ical (PIN): VCALENDAR/VEVENT z CRLF, escape \; , DTSTART/DTEND UTC, STATUS TENTATE/CONFIRMED, obdobje -30 dni do +6 mesecev; Content-Disposition .ics
- POST /api/appointments: generira cancelToken; GET: zdaj PIN-zaščiten (telefoni strank niso več javni) + vrni cancelToken
- PATCH /api/appointments/[id]: enum + no_show
- Clients: izostanki se štejejo ločeno (groupBy no_show), ne v obiske/prihodke; vsi statusni filtri po API-jih notIn [cancelled, no_show]
- CancelDialog (nova komponenta na /?cancel=token, mount v page.tsx): stanja loading/ready/cancelling/cancelled/error, URL počiščen po odprtju
- BookingWidget potrditev: prikaz odpovedne povezave + Kopiraj (lib/clipboard.ts — Clipboard API z timeoutom 1,5 s + execCommand fallback za http LAN)
- RemindersDialog: WhatsApp besedilo vsebuje "Če ne morete priti, termin odpovejte tukaj: <povezava>"
- Dashboard: gumb "Ni prila" (UserX) na preteklih terminih; gumb za kopiranje odpovedne povezave (Link2) na prihodnjih; iCal gumb (CalendarArrowDown — CalendarDown ne obstaja v lucide!) v glavi; print brez no_show
- ClientsTab: rdeča oznaka "N× ni prišla" (AlertTriangle)
- POPRAVKI NAJDENI Z E2E: (1) loadAppointments 401 med zaklenjenostjo → efekti zdaj čakajo na !locked; (2) samodejni odklep s shranjenim PIN-om po osvežitvi; (3) clipboard obesitev → timeout race; (4) mobilni preliv demo zavihkov → kratke oznake (Stranka/Lastnik) pod sm
- Demo: vsi termini dobili cancelToken (backfill), Maja Kos današnji 10:00 = no_show (demo rdeče oznake); seed mk() generira žetone
- Restart dev (turbopack): rm .next + start-dev.sh; instrumentacija OK, samodejna varnostna kopija ustvarjena
- E2E (agent-browser): celoten strankin tok (rezervacija → prikaz povezave → obisk /?cancel= → dialog s podatki → Odpovej → "Termin je odpovedan" → DB status=cancelled); PIN: 401 brez/napačnega, 200 pravi; koledar naložen po odklepu; "Ni prila" gumb → oznaka + števec pri stranki; copy-link gumb → toast; spomniki → wa.me href vsebuje ?cancel=; iCal gumb → toast + veljavna .ics (CRLF); 409 ob ponovni odpovedi; mobilni 375px: brez preliva, noga na dnu; 0 konzolnih napak; lint čist
- Testni podatki počiščeni (Odpoved Test, Test Niprisla), PIN ponastavljen (demo odprta)
- README (nove funkcije, poti API-jev, podatkovni model) + usb-template NAVODILA/ZA-TEBE dopolnjeni
- Push: commit 698da5f na github.com/markec12345678/TerminAI (remote == local)

Stage Summary:
- Tri nove prodajne funkcije: odpoved z enim klikom (stranka sama), no-show evidenca (kdo nastavlja), iCal izvoz (koledar v telefonu)
- Varnostna zgoda: seznam terminov (telefoni!) zdaj za PIN-om, javna rezervacija pa ostaja odprta
- Naslednji možni koraki: pilot namestitev pri pravem salonu, demo skript za prodajo, online faza (WhatsApp Business API = samodejna odpoved/spomniki)
