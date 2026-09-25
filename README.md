# IntexFin

Sistemi financiar i brendshëm i **Intex Courier**. Ky version përmban modulin e
**arkave dhe cash-flow-it**: çdo punonjës ka arkat e veta (Lek, Euro, Dollarë),
dhe të gjitha lëvizjet e parasë regjistrohen mbi to.

## Si ta shohësh te kompjuteri yt

### Mënyra 1 — me Docker (një komandë)

```bash
git clone https://github.com/enrisulaj-intex/intexfin.git
cd intexfin
git checkout claude/ndihme-puna-u5enk2
docker compose up --build
```

Hape **http://localhost:3000** dhe hyr me `admin@intexcourier.al` / `Intex2026!`.
Baza krijohet dhe mbushet vetë herën e parë.

### Mënyra 2 — pa Docker

Duhet Node.js 20+ dhe një PostgreSQL lokal.

```bash
npm install
cp .env.example .env        # vendos DATABASE_URL dhe AUTH_SECRET
npm run setup               # krijon tabelat dhe të dhënat fillestare
npm run dev                 # http://localhost:3000
```

## Arkat

- Çdo punonjës merr automatikisht **tri arka**: Lek, Euro, Dollarë. Krijohen kur
  krijohet përdoruesi; butoni *Krijo arkat që mungojnë* te faqja **Arkat** i
  plotëson ato që mungojnë.
- Llogaritë **bankare** janë të kompanisë, jo të një punonjësi, dhe krijohen nga
  financa ose admini.
- Gjendja e një llogarie = gjendja e hapjes + shuma e të gjitha lëvizjeve mbi të.
  Nuk ruhet si numër më vete, ndaj nuk mund të dalë jashtë sinkronit.
- Kur hedh një shpenzim, zgjedh **monedhën** — sistemi e gjen vetë arkën e saktë
  të atij punonjësi. Nuk zgjidhet arka me dorë.

## Llojet e lëvizjeve

| Lloji | Efekti |
| --- | --- |
| **Shpenzim** | Ul arkën (ose bankën) e zgjedhur |
| **Arkëtim** | Mbush arkën — këtu hyjnë arkëtimet nga sistemi i Intex Courier |
| **Depozitim** | Arkë → bankë |
| **E drejtë për arkëtim** | Regjistrohet, por nuk prek gjendjen derisa arkëtohet |
| **Transfertë** | Midis dy llogarive të së njëjtës monedhë |
| **Diferencë** | Korrigjim i gjendjes: tepricë (+) ose mungesë (−) |

Një **arkëtim** mund të mbyllë një **të drejtë** të hapur — zgjidhet te paneli
dhe e drejta shënohet si e arkëtuar.

Kutia **"Vetëm për PASH"** te shpenzimet: lëvizja hyn në pasqyrën e rezultatit,
por nuk e ul gjendjen e arkës — për kosto periudhash të shkuara ku paraja ka
dalë në një kohë tjetër.

## Hedhja e lëvizjeve

**Mënyra 1 — paneli i shpejtë** (e ndërtuar): te faqja kryesore, në krahun e
djathtë. Zgjedh llojin, monedhën, shkruan shumën dhe e shton. Paneli tregon
gjendjen e arkës përkatëse ndërsa shkruan, dhe kategoria krijohet vetë nëse nuk
ekziston.

**Mënyra 2 — faqja me tab-e për ngarkim**: ende e pandërtuar. Modeli i të
dhënave e mbështet tashmë (fusha `source` ndan hedhjen me dorë nga ngarkimi dhe
nga integrimi me Intex Courier), ndaj do të shtohet vetëm ndërfaqja.

## Rolet

| Roli | Të drejtat |
| --- | --- |
| **ADMIN** | Gjithçka, përfshirë përdoruesit dhe llogaritë bankare |
| **FINANCE** | Sheh arkat e të gjithë punonjësve, hedh lëvizje për këdo, menaxhon kategoritë, furnitorët dhe bankat |
| **STAFF** | Punon vetëm me arkat e veta; nuk sheh gjendjet e bankës dhe nuk dërgon para në arkën e një kolegu |

## Teknologjia

| Shtresa | Zgjedhja |
| --- | --- |
| Frontend / Backend | Next.js 15 (App Router) + React 19 + TypeScript |
| Stilizimi | Tailwind CSS 4 |
| Baza e të dhënave | PostgreSQL 16 + Prisma ORM |
| Autentikimi | Email + fjalëkalim (bcrypt), sesion JWT në cookie `httpOnly` |
| Validimi | Zod, në server (Server Actions) |

## Llogaritë fillestare (vetëm për zhvillim)

| Email | Fjalëkalim | Roli |
| --- | --- | --- |
| `admin@intexcourier.al` | `Intex2026!` | ADMIN |
| `financa@intexcourier.al` | `Financa2026!` | FINANCE |
| `arjan.hoxha@intexcourier.al` | `Staf2026!` | STAFF |
| `elona.brahimi@intexcourier.al` | `Staf2026!` | STAFF |

> **Ndryshoji këto fjalëkalime përpara se sistemi të kalojë në prodhim.**

## Komandat

| Komanda | Përshkrimi |
| --- | --- |
| `npm run dev` | Serveri i zhvillimit |
| `npm run setup` | Krijon tabelat dhe mbush të dhënat fillestare |
| `npm run build` / `npm run start` | Ndërtimi dhe nisja për prodhim |
| `npm run typecheck` | Kontroll i tipeve TypeScript |
| `npm run db:migrate` | Krijon migrim të versionuar (për prodhim) |
| `npm run db:studio` | Prisma Studio — shfletues i bazës |

## Struktura

```
prisma/
  schema.prisma        User, Account, Transaction, Category, Supplier, Attachment, AuditLog
  seed.ts              Përdoruesit me arkat e tyre, bankat, kategoritë, lëvizje shembull
src/
  actions/             Server Actions (auth, lëvizjet, llogaritë, kategoritë, furnitorët, përdoruesit)
  app/
    (app)/
      dashboard/       Arka & Cash-Flow + paneli i shpejtë
      arka/            Arkat e punonjësve dhe llogaritë bankare
      levizjet/        Lista, filtrat dhe detajet e lëvizjeve
      kategori/ furnitore/ perdorues/
    api/
      dokumente/[id]/  Shkarkimi i dokumenteve, me kontroll aksesi
      levizjet/eksport CSV për Excel
  components/          QuickEntry dhe komponentë të përbashkët
  lib/                 db, auth, session, llogaritë, efektet, filtrat, formatimi
  middleware.ts        Mbrojtja e rrugëve
uploads/               Dokumentet e bashkëngjitura (jashtë git-it)
```

## Shënime

- **Nuk ka këmbim valutor** ende: një transfertë kërkon që të dyja llogaritë të
  jenë në të njëjtën monedhë, dhe raportet i mbajnë monedhat të ndara pa
  konvertim.
- **Nuk ka rrjedhë aprovimi**: lëvizjet regjistrohen menjëherë. Çdo veprim
  regjistrohet në historik me përdoruesin dhe orën.
- Gjendja e një arke mund të dalë **negative** — sistemi nuk e bllokon hedhjen,
  sepse radha e hedhjes shpesh nuk përputhet me radhën e ngjarjeve; vlerat
  negative shfaqen me të kuqe.
- **`AUTH_SECRET`** duhet i rastësishëm dhe i fshehtë (min. 32 karaktere) në
  prodhim; ndryshimi i tij shkëput të gjitha sesionet.
- Dokumentet ruhen në `uploads/`. Për deploy me disa instanca, kalo në ruajtje
  objekt (S3 / R2) dhe ndrysho `saveAttachments` në `src/actions/transactions.ts`.

## Hapat e ardhshëm

- Mënyra 2: faqja me tab-e (Shpenzime, Diferenca, E drejtë, Arkëtim, Depozitim, Transfertë)
- Integrimi me sistemin e Intex Courier për mbushjen automatike të arkave
- Këmbimi valutor midis arkave
- Raporte të zgjeruara dhe mbyllje periudhe
