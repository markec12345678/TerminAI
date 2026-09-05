# TerminAI — pametni sistem za naročanje za frizerske in kozmetične salone

**TerminAI** je popolnoma delujoč sistem za naročanje terminov, zasnovan za frizerje, kozmetične in druge lokalne storitvene podjetnike. Deluje **100 % brez interneta** — vsi podatki ostanejo na računalniku lastnika (SQLite datoteka), zato je idealen za prodajo po principu **"enkrat namesti, deluje za vedno"**.

> Predstavljen z demo podatki frizerskega salona **Studio Aura, Ljubljana**.

---

## Ključne funkcije

### 🗓️ Naročanje terminov
- Interaktivni koledar s 30-minutnimi termini in samodejnim zaznavanjem **prekrivanja**
- Delovni čas po dnevih (nedelja–sobota), samodejni predlogi prostih terminov
- **Premor (kosilo)**: okno v delovnem času, v katerem terminov ni (npr. 12:00–13:00)
- **Priprava po storitvi** (razkuževanje): dodaten čas po vsaki storitvi, da se termini ne stikajo
- **Vrhovni doplaček**: sobote in delavniki po 15. uri se zaračunajo po višji ceni
- Statusi terminov: `pending → confirmed → completed / cancelled / no_show`

### 🎉 Zaprti dnevi — prazniki, dopust, kosilo
- **Uvoz slovenskih državnih praznikov** z enim klikom (fiksni + velikonočni za tekoče in naslednje leto)
- **Dopust z obsegom datumov** (od–do) in posamezni zaprti dnevi (šola, bolezen …)
- Stranke teh dni **ne morejo izbrati** v rezervacijskem traku; modul Sporočila ponudi prve proste dneve

### ❌ Odpoved z enim klikom (enkratna povezava)
- Vsak termin ima svojo **odpovedno povezavo** (`/?cancel=token`) — brez PIN-a, token je overitev
- Povezava je vključena v **WhatsApp spominik** („Če ne morete priti, termin odpovejte tukaj …“) in potrditev rezervacije
- Stranka klikne, vidi termin in ga odpove — **termin se takoj sprosti** za druge
- Lastnik lahko povezavo **kopira v odložišče** (gumb v koledarju) in jo pošlje po WhatsAppu

### 📱 Oddaljeno naročanje (brez plačljivih API-jeev)
- **WhatsApp gumb** — stranka s klikom odpre pogovor (`wa.me`), sporočilo se samodejno izpolni z izbrano storitvijo
- **QR koda** — natisnjena koda za ogledalo v salonu: stranka poskenira in se naroči sama
- **Ročni vnos** — lastnik ob telefonskem klicu vpiše naročilo v 30 sekundah (isti API, isto preverjanje prekrivanja)

### 💬 Pametna obravnava SMS/WhatsApp sporočil
- Strankino sporočilo (npr. *"naročam se na striženje plus barvanje"*) program **razčleni**:
  - prepozna storitve iz cenika in sešteje ceno (*striženje 25 € + barvanje 55 € = 80 €*)
  - ob zasedenem terminu ponudi **najbližje proste alternative**
  - ob povpraševanju pošlje **celoten cenik**
  - shrani **izvirno sporočilo** in pripravi osnutek odgovora za lastnika
- Predal "Sporočila" (inbox) z nameni (intent): `booking | price | cenik | availability`

### 🛠️ Lastnik vse ureja sam
- **Cenik** (storitve, trajanje, priprava, redna/vrhovna cena) — poljen CRUD
- **Podatki salona**: ime, naslov, telefon, delovni čas + premor
- **Baza strank** z zgodovino obiskov in **opombami** (formule barvanja, alergije)
- **Statistika**: prihodki, zasedenost, najbolj donosne storitve
- **Izvoz iCal (.ics)** — koledar terminov uvozite v Google/Apple Koledar ali telefon

### 🔒 GDPR — izvoz in izbris podatkov stranke
- Vsaka stranka ima gumb za **izvoz** (vsi njeni podatki in zgodovina v JSON datoteki — pravica dostopa)
- Gumb za **trajen izbris** izbriše stranko in vse njene termine (pravica do izbrisa) — s potrditvenim oknom
- Celoten lastniški prostor (telefoni, opombe, zgodovina) je za PIN-om

### 📊 Mesečno poročilo + CSV za knjigovodstvo
- Zavihek **„Poročila“**: izbrani mesec — realizirani/pričakovani prihodki, povprečni obisk, odpovedi/izostanki
- **Graf prihodkov po dnevih** in top 5 storitev/strank meseca
- **CSV izvoz** z obračunanimi obiski (samo zaključeni): UTF-8 BOM, podpičja, decimalna vejica — Excel ga odpre brez pretvorb
- Navigacija po mesecih (samo meseci z podatki)

### ✨ Demo način (za prodajne obiske)
- Ena klik **„Obnovi demo podatke“** (vpis DEMO + PIN): Studio Aura z bogato zgodovino (~40 dni, ponavljanja, izostanki)
- Po predstavitvi sledi „Nastavi pravi salon“ — prehod na prave podatke

### ⚠️ Sledenje izostankov (no-show) — kot Zenoti "no-show recovery"
- En klik **„Ni prišla“** na pretekel termin (mesto klica odpovedi); če ima kdo čakalni seznam, toast ponudi **sproščen čas iz čakalne vrste**
- Na kartici izostanka ostane **WhatsApp gumb „Ponudi nov termin“** — pripravljeno sporočilo (»Žal vas danes nismo dočakali 💇‍♀️ Kdaj vam ustreza nov termin?«) spodbudi ponovno naročanje
- Izostanki se **samodejno štejejo pri stranki** — rdeča oznaka „2× ni prišla“ v bazi strank
- Izostanki se ne štejejo v obiske, prihodke ali zasedenost

### 🔁 Ponavljajoči obiski — "kdo je na vrsti"
- Termin dobi oznako ponavljanja (npr. **barvanje vsake 4 tedne**, striženje vsaka 3 tedna)
- Sistem sam izračuna, **katere stranke je treba poklicati** (rok je potekel / na vrsti / kmalu)
- En klik: **WhatsApp vabilo** s pripravljenim sporočilom ali **naročitev** termina
- Stranke, ki so že naročene, so ločeno označene

### 💾 Samodejne varnostne kopije + obnova
- Ob vsakem zagonu (največ 1× dnevno) se naredi **konsistenten snapshot** baze (`VACUUM INTO`)
- Zadnjih 14 kopij v mapi `db/backups` — brez ročnega dela
- Kartica "Varnostne kopije": seznam, ročna kopija, **prenos na USB** in **obnova z enim klikom**
- Obnova pred zamenjavo vedno naredi **zaščitno kopijo trenutnega stanja** — nič se ne more izgubiti

### 🔒 Zasebnost in offline način
- SQLite zbirka v **enki datoteki** → enostavna rezervacija (USB)
- Ni odvisnosti od oblaka, naročnin ali interneta
- Zaščita lastniškega območja s PIN-kodo

### 🌙 Izključno svetla znamka (temni način odstranjen)
- TerminAI je **vedno svetel** (kremna/burgundy znamka) — temnega načina ni mogoče prižgati ne pomotoma ne s temnim OS (`forcedTheme`, razred `.dark` nikoli nanesen)
- `color-scheme: light` na korenu — avtohteni vgradniki (datumi, poverljiva okna, scrollbars) ostanejo svetli tudi na temnih napravah
- Prejšnja različica je imela preklop svetlo/temno; odstranjen je bil po poročilu uporabnika, da se je temni način prižgal pomotoma (en pomotoma tapnjen mesec se je trajno zapisal v localStorage)

### ✨ Animacije (Framer Motion)
- Hero: postopni vstop besedila in **lebdeče kartice** ob strani
- Sekcije se prikažejo ob pomiku (scroll-reveal) — subtilno, enkrat na obisk
- Upošteva nastavitev `prefers-reduced-motion` (brez gibanja, če uporabnik tako želi)

### 🔍 Hitro iskanje v koledarju
- Iskalno polje nad koledarjem dneva — filtrira termine po **imenu ali telefonu**
- Slovenski števec zadetkov (1 zadetek / 2 zadetka / 5 zadetkov) in gumb za počiščenje
- Prazno stanje z jasnim sporočilom, ko ni zadetkov

### 🔔 Zvočna opozorila v živo (Web Audio, 100 % offline)
- Ko je nadzorna plošča odprta, sistem **samodejno zazna** novo rezervacijo ali odpoved (polling na 12 s)
- Nova rezervacija → prijeten zvonec »ding-dong« + obvestilo z imenom, storitvijo, dnevom in uro; odpoved → mehek padajoči ton
- Zvoki so **generirani v brskalniku** (Web Audio API) — brez datotek, delujejo popolnoma brez interneta
- Stikalo za vklop/izklop v glavi koledarja — nastavitev se zapomni; stranka ob rezervaciji sliši mehek potrditveni zvonec
- Lastnikove lastne spremembe se **ne** oglšajo — zvoki samo za dogodke strank

### 🚶 Celoten workflow termina (kot vodilni svetovni sistemi)
- **Rezervacija → Potrdi → Prišla je → Zaključi** — nov status *checked_in* (»Prišla«, turkizna oznaka) ob prihodu stranke v salon
- **15-minutno pravilo zamujanja:** termin se je začel, stranke ni → rumen indikator »zamuja X min«, spomin, da pokličete ali zabeležite izostanek
- Izkupnja: isti statusni potek kot Fresha/Booksy (»Arrived«), prirejen enoosebnemu salonu brez odvečnih korakov

### 🎨 Formule in zgodovina obiskov (po zgledu Zenotija)
- Ob zaključku obiska dialog **»Kaj je bilo narejeno?«** — frizerka zapiše formulo barvanja, količine, posebnosti (max 500 znakov)
- Formula se shrani **pri terminu** (zasebna opomba — za PIN-om) in se prikaže na kartici termina ter v **zgodovini obiskov stranke**
- Zgodovina obiskov (ura ikona v bazi strank): vsi obiski kronološko — datum, storitev, cena, status, formula, strankina opomba
- Formula **ni podatek stranke** — v GDPR izvoz ne gre (samo lastnica jo vidi)

### 🔄 Rebooking ob zaključku (kot Zenoti »rebooking nudges«)
- Takoj po zaključku obiska dialog ponudi **»Naroči naslednji obisk?«** — stranka je še v salonu, to je trenutek, ko reče »ja«
- **Motor zvestobe predlaga datum**: »Predlagam Sobota, 12. sep (običajno vsak teden)« — po ritemu stranke (interval ponavljanja ali mediana njenih obiskov), pripet na njen običajni dan v tednu
- Ročni vnos se **predizpolni** z imenom, telefonom, storitvijo in **predlaganim datumom**; če je ta dlje kot 14-dnevni trak dni, se trak razširi in čip sam pomakne v vidno polje
- Veliko frizerk takoj dogovori naslednji termin → manj praznih lukenj v koledarju

### ⏳ Čakalni seznam (kot Zenoti »Automated Waitlist«)
- Stranke, ki želijo termin »kdaj se kaj sprosti«, so na **čakalnem seznamu** (ime, telefon, za katero storitev, opomba)
- Ko stranka **odpove**, obvestilo samodejno pove: *»2 stranki čakata na termin — morda želi kdo ta čas«*
- Vsaka stranka na seznamu ima **gumb WhatsApp** z vnaprej izpolnjenim povabilom; »čaka X dni/tednov« pri vsaki
- Ko dobijo termin, jih z enim klikom odstranite s seznama

### 💚 »Dolgo jih ni bilo« — motor zvestobe (pametni win-back)
- **Ni fiksnih 8 tednov**: vsaka stranka ima svoj ritem (mediana razmikov med njenimi obiski, padec na interval ponavljanja). Ana, ki pride na 5 tednov, se odkrije po ~7 tednih — ne šele po 8
- Nova kartica na nadzorni plošči: kdo je zamudil svoj ritem, zadnja storitev, **predlagan nov termin** (zarolan naprej), gumb **VABI** (osebno WhatsApp sporočilo z zadnjo storitvijo) in **NAROI** (vnos že predizpolnjen z datumom)
- Prag: 1,45× osebnega ritma (min. 4 tedne); brez vzorca 8 tednov; najprej 2 tedna „milosti“
- Zavihek Stranke: filter »Dolgo jih ni bilo« zdaj enako pameten — oznaka pokaže njen ritem (»običajno vsake 4 tedne«)
- API: `GET /api/loyalty` (win-back), `GET /api/loyalty/rebook?appointmentId=…` (predlog rebookinga) — oba pod PIN
- Kot Zenoti »AI Retention Manager« (450 $/mesec), a z osebnim pristopom — vračanje strank = najcenejši prihodek

### 🏃 Walk-in — stranka je tu brez termina
- Gumb **»Walk-in«** v glavi koledarja: izbor stranke (dopolni se po telefonu) + storitev + **prosti sloti od zdaj naprej**
- Termin se vpiše **takoj kot prijavljen** (status »Prišla«) — brez koraka »potrdi«, ker stranka že stoji pred vami
- Telefon samodejno poišče stranko v bazi in dopolni ime — vpis v 10 sekundah

### 📸 Fotografije strank — lokalni »Photo Manager« (kot Zenoti, a brez oblaka)
- Ob **zaključku obiska** dialog sprejme fotografijo **pred / po / rezultat**: pomanjša se v brskalniku (~1200 px JPEG) in shrani **lokalno v SQLite** — nikoli v oblak
- V **zgodovini stranke** galerija sličic: en klik → povečava (velika slika se naloži šele takrat), brisanje z gumbom
- **Deljenje s stranko:** v povečavi gumb **»Pošlji stranki«** — na telefonu se odpre sistemsko deljenje (fotografija gre neposredno v WhatsApp), na računalniku se slika prenese + odpre WhatsApp pogovor s pripravljenim sporočilom; gumb **»Prenesi«** shrani JPEG na disk (objava, arhiv)
- Gumb **»Dodaj referenco«** — slika, ki jo prinese stranka (»šlosa, ki si jo želi«), shranjena pri njenem profilu
- Fotografije so **osebni podatek**: GDPR izvoz vsebuje prave slike, GDPR izbris jih izbriše; varnostne kopije (VACUUM INTO) jih zajamejo samodejno
- Zenoti za Photo Manager zaračuna 225–500 USD/mesec in slike hranijo v njihovem oblaku — TerminAI jih hrani pri vas

### 🎂 Rojstni dnevi — čestitka z enim klikom
- Kartica **»Rojstni dnevi«** v dashboardu: kdaj ima rojstni dan v naslednjih 14 dneh (»danes 🎉«, »jutri«, »čez 3 dni«); prazna kartica vseeno pove, kdaj je naslednji rojstni dan
- Rojstni dan se vpiše pri stranki (**brez leta** — GDPR minimalno, samo za čestitko); sprejme »5. 3.« ali »05-03« (z mesečno preverbo veljavnosti)
- Čestitka je **osebna**: omeni strankino najpogostejo storitev (izračunano iz obiskov) in je podpisana z imenom salona
- **Ugodnost nastavljiva** (zobnik na kartici): npr. »−20 % na obisk« — privzeto PRAZNA, da plošča ne obljublja popusta, ki ga salon ne nudi
- **Brez dvojnih čestitk**: klik na WhatsApp stranko označi (»poslano«), oznaka se shranjuje lokalno in se sama ponastavi naslednje leto; gumb »Ponastavi oznake«
- Gumb **Naroči**: vnos termina predizpolnjen s stranko, njeno priljubljeno storitev in dnem rojstnega dne
- Kot Zenoti »birthday campaigns«, a osebno, brez naročnine in brez obljub, ki jih niste odobrili

### 📄 Prodajni letak (PDF) — orodje za pilot pri salonu
- **5 strani (A4-podobno)**: naslovnica z 3 statistikami (199 € enkrat / 0 € naročnine / 100 % pri vas) → koristi → delovni dan s TerminAIjem (časovnica 8 korakov) → primerjava s Zenoti/Fresha → cene + FAQ → temna zaključna stran s CTA
- Blagovna znamka skladna s stranjo: burgundy paleta + Playfair Display/Inter; **vektorski PDF** (besedilo izberljivo, ostro pri povečavi)
- Gumb **»Prenesi prodajni letak (PDF)«** na koncu cenovne sekcije (odpre `public/terminai-letak.pdf`)
- Vir: `sales-flyer/terminai-letak.html` (urediv HTML) → `html2pdf-next.js`; kopija za USB: `dist-usb/TERMINAI/PRODAJNI-LETA.pdf` — namestitelj ga natisne in pusti frizerki

---

## Tehnični sklad

| Plast | Tehnologija |
|---|---|
| Ogrodje | **Next.js 16** (App Router) + React 19 |
| Jezik | TypeScript 5 |
| Baza | **Prisma ORM + SQLite** |
| UI | shadcn/ui (New York), Tailwind CSS 4, Lucide ikone |
| Grafi | Recharts |
| QR kode | qrcode.react |
| Med seboj povezani podatki | TanStack Query |

---

## Namestitev (razvoj)

```bash
# 1. Namesti odvisnosti
bun install

# 2. Ustvari .env z DATABASE_URL
echo 'DATABASE_URL="file:/home/z/my-project/db/custom.db"' > .env

# 3. Ustvari shemo baze
bun run db:push

# 4. Zaženi razvojni strežnik
bun run dev          # http://localhost:3000
```

> Zaženi `bun run setup` API klic ali odpri aplikacijo — demo podatki (Studio Aura) se naložijo samodejno ob prvem zagonu.

### Koristni ukazi

```bash
bun run dev        # razvojni strežnik (port 3000)
bun run lint       # preverjanje kakovosti kode (ESLint)
bun run db:push    # sinhronizacija Prisma sheme z SQLite
bun run db:generate # generiranje Prisma klienta
```

---

## Zagon kot offline "USB izdelek"

Projekt vsebuje pripravljeno **USB predlogo** (`usb-template/`) za prodajo:

```
usb-template/
├── ZAGON.bat        # zaženi aplikacijo
├── NAMESTI.bat      # prva namestitev
├── NAREDI-REZERVO.bat  # rezervacija baze na USB
├── NAVODILA.txt     # navodila za lastnika salona
└── ZA-TEBE.txt      # opombe za prodajalca/namestilca
```

Baza (`db/custom.db`) je prenosljiva datoteka — rezervacija na USB in prenos na drug računalnik delujeta brez posegov.

---

## Struktura projekta

```
prisma/schema.prisma        # Business, Service, Client, Appointment, Message, WorkingHours
src/app/api/                # REST API
├── appointments/           # CRUD termini + prekrivanja
│   ├── recurrence/         # "kdo je na vrsti" (ponavljajoči obiski)
│   ├── cancel/             # odpoved prek enkratne povezave (GET/POST, token)
│   └── ical/               # izvoz koledarja (.ics)
├── availability/           # prosti termini
├── services/               # cenik (CRUD)
├── clients/                # baza strank (+ števec izostankov)
├── messages/               # SMS/WhatsApp sporočila + razčlenjevanje
├── stats/                  # statistika
├── reports/                # mesečno poročilo + CSV izvoz (?month=YYYY-MM&format=csv)
├── hours/                  # delovni čas
├── backup/                 # varnostne kopije (seznam, ustvari, prenos)
├── setup/                  # inicializacija: mode=fresh (pravi salon) | mode=demo (obnova dema)
└── pin/                    # zaščita lastniškega območja
src/components/terminai/    # UI komponente (hero, koledar, cenik, inbox …)
src/lib/recurrence.ts       # logika ponavljajočih obiskov
src/lib/backup.ts           # samodejni backup (VACUUM INTO)
src/lib/clipboard.ts        # kopiranje v odložišče (tudi http:// LAN)
src/instrumentation.ts      # vzdrževalne naloge ob zagonu strežnika
db/custom.db                # SQLite baza (prenosljiva)
db/backups/                 # samodejne varnostne kopije (zadnjih 14)
usb-template/               # predloga za USB prodajo
```

---

## Podatkovni model

```
Business 1─n Service 1─n Appointment n─1 Client
Business 1─n WorkingHours
Message (neodvisna tabela za sprejeta sporočila strank)
```

- termini shranjeni v **UTC**, prikaz v lokalnem času
- cene v **centih** (natančnost, brez plavajoče vejice)
- vsak termin: `startAt`, `endAt`, `priceCents` (zamrznjena cena ob naročilu), `recurWeeks` (ponavljanje), `cancelToken` (odpovedna povezava), `status` vključno z `no_show` (izostanek)

---

## Slike

| Namizni pogled | Mobilni pogled |
|---|---|
| ![Nadzorna plošča](screenshots/dashboard.png) | ![Mobilni demo](screenshots/mobile-demo.png) |
| ![Hero](screenshots/hero.png) | ![Mobilni hero](screenshots/mobile-hero.png) |

---

## Poslovni model (offline izdelek)

| Paket | Vsebina | Cena |
|---|---|---|
| **Osnovni** | namestitev na računalnik lastnika, offline delovanje, rezervacija na USB | **199 € enkratno** |
| Vzdrževanje | posodobitve, tehnična podpora | 19 €/mes. |
| Ana AI (dodatek) | pametno odgovarjanje na sporočila z AI, spletne nadgradnje | 39 €/mes. |

*Povezava na splet ni potrebna — vse osnovne funkcije delujejo lokalno.*

---

## 🌐 Spletni demo (Vercel)

Repozitorij je povezan z Vercelom — vsak push na `main` samodejno objavi novo različico.

**Javna povezava dema:** `https://terminai-eight.vercel.app`

- **Serverless SQLite**: Vercelove funkcije dovoljujejo pisanje le v `/tmp`, zato se baza ob vsakem "cold startu" prepiše iz demo predloge `db/demo-template.db` (770 KB, vsebuje Studio Aura: 6 strank, 103 termine, 2 fotografiji).
- **Rumen trak "Spletni demo"** se prikaže samodejno (env `NEXT_PUBLIC_DEMO_MODE`) in pošilja jasno sporočilo: spremembe niso trajno shranjene. Lokalna/USB različica traku nikoli ne vidi.
- **Ključne datoteke**: `src/lib/vercel-db.ts` (priprava baze v `/tmp`), `src/lib/db.ts` (izbira URL-ja), `next.config.ts` (`outputFileTracingIncludes` spravi predlogo v funkcijo), `src/components/demo-banner.tsx`.
- **Varnostne opombe**: demo je odprt (brez PIN-a) — kdorkoli lahko spremeni ali ponastavi demo podatke (vpliv je omejen na eno instanco funkcije). Za trajno spletno različico bi bila potrebna prava baza (npr. Postgres/Turso) in WhatsApp Business API.
- `postinstall: prisma generate` poskrbi, da Vercel vedno zgenerira Prisma klienta.

*Namenjeno predstavitvam in pilotu — pravi izdelek ostaja offline namestitev.*

### 🎯 3 ravni predstavitve stranki (prodajna strategija)

| Raven | Kdaj | Orodje |
|---|---|---|
| **1. Povezava** | prvi stik, po WhatsAppu | `terminai-eight.vercel.app` — vedno svež demo (ogledna različica) |
| **2. Sestanek** | 15-min vodena predstavitev | **laptop z namestitvijo** + njen telefon prek WiFi (QR na nadzorni plošči) — zvok, WhatsApp, odpovedi delujejo "produkcijsko" |
| **3. Pilot** | odločitev | **USB 14 dni** pri njej — njene prave stranke, plača šele po odločitvi |

**Zakaj ne "testna" spletna različica?** Vercel serverless instanca se lahko zamenja sredi obiska (razrezaljen demo) — spletni demo je za OGLED, pravi doživetje pa je lokalna namestitev (to je tudi prodajni argument: "vaši podatki pri vas").

- **DEMO-VODIK.pdf** (3 strani, `public/demo-vodic.pdf` + USB): zlata pot sestanka v 8 korakih z oznakami [ONA]/[VI], priprava, pilot ponudba, ugovori z odgovori in 30-sekundni zaključek. Gumb za prenos je pod cenovno sekcijo spletne strani.
- **QR koda na nadzorni plošči** (`ShareQrCard`): na laptopu pokaže **WiFi naslov računalnika** (`/api/network` → `http://192.168.x.x:3000`), na spletu pa javni naslov — stranka oslika in rezervira z lastnim telefonom (deluje tudi brez interneta, na salonskem omrežju).

---

## Licenca

Vse pravice pridržane — komercialni izdelek.
