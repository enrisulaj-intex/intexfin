# IntexFin

Sistemi financiar i brendshëm i **Intex Courier**. Ky version përmban modulin e
**arkave dhe cash-flow-it**: çdo punonjës ka arkat e veta (Lek, Euro, Dollarë),
dhe të gjitha lëvizjet e parasë regjistrohen mbi to.

## Si ta shohësh te kompjuteri yt

### Me Docker — një komandë

```bash
git clone https://github.com/enrisulaj-intex/intexfin.git
cd intexfin
git checkout claude/ndihme-puna-u5enk2
docker compose up --build
```

Hape **http://localhost:3000** dhe hyr me `admin@intexcourier.al` / `Intex2026!`.
Baza krijohet dhe mbushet vetë herën e parë.

### Pa Docker

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

**Mënyra 1 — paneli i shpejtë**: te faqja kryesore, në krahun e djathtë.
Zgjedh llojin, monedhën, shkruan shumën dhe e shton. Paneli tregon gjendjen e
arkës përkatëse ndërsa shkruan, dhe kategoria krijohet vetë nëse nuk ekziston.

**Mënyra 2 — faqja `Ngarkim`**: një tab për çdo lloj, me dy rrugë secili.

*Hedhje manuale* — formulari i plotë: TVSH, nr. dokumenti, pala, shënime dhe
dokumente të bashkëngjitura.

*Ngarkim nga Excel* — ngarko `.xlsx` ose `.csv`:

1. Skedari lexohet dhe shfaqet rresht për rresht. **Asgjë nuk shkruhet** derisa
   ta konfirmosh.
2. Çdo rresht kontrollohet: data, monedha, shuma, punonjësi, llogaria. Rreshtat
   me gabime shënohen me kuq dhe nuk ngarkohen.
3. Rreshtat që përputhen me një lëvizje ekzistuese (e njëjta datë, shumë,
   monedhë dhe përshkrim) shënohen si **dyfishim i mundshëm** — paralajmërim,
   jo bllokim.
4. Konfirmimi shkruan të gjitha në një transaksion të vetëm: ose kalojnë të
   gjitha, ose asnjë.

Kolonat njihen nga emri, pa dallim shkronjash të mëdha apo theksash — `Përshkrimi`,
`pershkrimi` dhe `PERSHKRIMI` lexohen njësoj. Çdo tab ka **shabllonin e vet për
shkarkim**, me kolonat e sakta dhe një rresht shembull.

Formatet e pranuara: data si `25.09.2026`, `2026-09-25` ose datë Excel; shuma si
`14500,00`, `14500.00` ose `14.500,00`; monedha si `Lek`, `Lekë`, `ALL`, `EUR`,
`USD`, `€`, `$`. Punonjësi njihet nga emri ose email-i; bosh do të thotë vetja.
Kufiri është 2000 rreshta për ngarkim.

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
      ngarkim/         Tab-et me formularin e plotë dhe ngarkimin nga Excel
      arka/            Arkat e punonjësve dhe llogaritë bankare
      levizjet/        Lista, filtrat dhe detajet e lëvizjeve
      kategori/ furnitore/ perdorues/
    api/
      dokumente/[id]/  Shkarkimi i dokumenteve, me kontroll aksesi
      levizjet/eksport CSV për Excel
      ngarkim/shabllon Shabllonet CSV për çdo lloj lëvizjeje
  components/          QuickEntry dhe komponentë të përbashkët
  lib/                 db, auth, session, llogaritë, efektet, leximi i skedarëve, formatimi
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

- Integrimi me sistemin e Intex Courier për mbushjen automatike të arkave
- Këmbimi valutor midis arkave
- Raporte të zgjeruara dhe mbyllje periudhe
