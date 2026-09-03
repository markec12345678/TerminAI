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
