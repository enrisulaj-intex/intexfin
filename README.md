# IntexFin

Sistemi financiar i brendshëm i **Intex Courier**. Ky version përmban **modulin e
shpenzimeve**: regjistrim, aprovim, pagesë dhe raportim i shpenzimeve të kompanisë,
me hyrje me email/fjalëkalim dhe role.

## Teknologjia

| Shtresa | Zgjedhja |
| --- | --- |
| Frontend / Backend | Next.js 15 (App Router) + React 19 + TypeScript |
| Stilizimi | Tailwind CSS 4 |
| Baza e të dhënave | PostgreSQL 16 + Prisma ORM |
| Autentikimi | Email + fjalëkalim (bcrypt), sesion JWT në cookie `httpOnly` |
| Validimi | Zod, në server (Server Actions) |

## Rolet

| Roli | Të drejtat |
| --- | --- |
| **ADMIN** | Akses i plotë. Menaxhon përdoruesit, kategoritë, furnitorët. Fshin çdo shpenzim. |
| **FINANCE** | Shikon të gjitha shpenzimet, aprovon/refuzon, shënon pagesat, menaxhon kategori e furnitorë. |
| **STAFF** | Regjistron shpenzimet e veta, i dërgon për aprovim, shikon vetëm të vetat. |

## Rrjedha e një shpenzimi

```
DRAFT ──dërgo──► SUBMITTED ──aprovo──► APPROVED ──pagesë──► PAID
                     │
                     └──refuzo──► REJECTED ──ndrysho & ridërgo──► SUBMITTED
```

- Referenca gjenerohet automatikisht: `SHP-2026-0001`.
- Ndryshimi lejohet vetëm në statusin `DRAFT` ose `REJECTED`.
- Çdo veprim regjistrohet në historikun e shpenzimit (audit log).

## Instalimi lokal

### 1. Kërkesat

- Node.js 20+ (testuar me 22)
- PostgreSQL 16 — lokal ose me Docker

### 2. Baza e të dhënave

Me Docker:

```bash
docker compose up -d
```

Ose me një Postgres lokal:

```bash
sudo -u postgres psql -c "CREATE USER intexfin WITH PASSWORD 'intexfin' CREATEDB;"
sudo -u postgres createdb -O intexfin intexfin
```

### 3. Konfigurimi

```bash
cp .env.example .env
# Gjenero një çelës të vërtetë për sesionet:
openssl rand -base64 32   # vendose te AUTH_SECRET
```

### 4. Skema dhe të dhënat fillestare

```bash
npm install
npm run db:push     # krijon tabelat
npm run db:seed     # përdoruesit bazë, kategoritë, furnitorët, shembuj
```

### 5. Ndiz aplikacionin

```bash
npm run dev         # http://localhost:3000
```

## Llogaritë fillestare (vetëm për zhvillim)

| Email | Fjalëkalim | Roli |
| --- | --- | --- |
| `admin@intexcourier.al` | `Intex2026!` | ADMIN |
| `financa@intexcourier.al` | `Financa2026!` | FINANCE |
| `staf@intexcourier.al` | `Staf2026!` | STAFF |

> **Ndryshoji këto fjalëkalime përpara se sistemi të kalojë në prodhim.**
> Fjalëkalimet e admin-it mund t'i caktosh edhe nga `SEED_ADMIN_EMAIL` dhe
> `SEED_ADMIN_PASSWORD` para `npm run db:seed`.

## Komandat

| Komanda | Përshkrimi |
| --- | --- |
| `npm run dev` | Serveri i zhvillimit |
| `npm run build` | Ndërtimi për prodhim (bën edhe `prisma generate`) |
| `npm run start` | Ndez versionin e ndërtuar |
| `npm run typecheck` | Kontroll i tipeve TypeScript |
| `npm run db:push` | Sinkronizon skemën me bazën (zhvillim) |
| `npm run db:migrate` | Krijon migrim të versionuar (rekomandohet për prodhim) |
| `npm run db:seed` | Mbush të dhënat fillestare |
| `npm run db:studio` | Prisma Studio — shfletues i bazës |

## Struktura

```
prisma/
  schema.prisma        Modelet: User, Category, Supplier, Expense, Attachment, AuditLog
  seed.ts              Të dhënat fillestare
src/
  actions/             Server Actions (auth, shpenzime, kategori, furnitorë, përdorues)
  app/
    (app)/             Faqet brenda sistemit (kërkojnë hyrje)
      dashboard/       Paneli me përmbledhje financiare
      shpenzime/       Lista, krijimi, detajet, ndryshimi
      kategori/        Kategoritë e shpenzimeve
      furnitore/       Regjistri i furnitorëve
      perdorues/       Menaxhimi i përdoruesve (vetëm ADMIN)
    api/
      dokumente/[id]/  Shkarkimi i dokumenteve (me kontroll aksesi)
      shpenzime/eksport CSV për Excel
    login/             Faqja e hyrjes
  components/          Komponentë të përbashkët
  lib/                 db, auth, session, validim, formatim, filtra
  middleware.ts        Mbrojtja e rrugëve
uploads/               Dokumentet e bashkëngjitura (jashtë git-it)
```

## Shënime për prodhim

- **`AUTH_SECRET`** duhet të jetë i rastësishëm dhe i fshehtë (min. 32 karaktere).
  Ndryshimi i tij shkëput të gjitha sesionet aktive.
- Për migrimet e bazës në prodhim përdor `prisma migrate deploy`, jo `db push`.
- Dokumentet ruhen lokalisht në `uploads/`. Në një deploy me disa instanca ose me
  disk të përkohshëm (Vercel, kontejnerë), kalo në ruajtje objekt (S3 / R2 /
  Azure Blob) dhe ndrysho `saveAttachments` në `src/actions/expenses.ts`.
- Kufizimet e dokumenteve: maks. 8 MB, vetëm PDF/JPG/PNG/WEBP.
- Kalo aplikacionin pas HTTPS — cookie-ja e sesionit vendoset `secure` automatikisht
  kur `NODE_ENV=production`.

## Hapat e mundshëm më tej

- Fatura & klientë, arkë/COD, raporte të zgjeruara
- Eksport PDF i një shpenzimi
- Njoftime me email kur një shpenzim pret aprovim
- Buxhete mujore sipas kategorisë me sinjalizim tejkalimi
