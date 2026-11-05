# Fillo këtu

Ky folder mban gjithçka që të duhet për ta vazhduar IntexFin-in në një llogari
dhe kompjuter tjetër, pa pasur akses te biseda origjinale.

## Çfarë ka brenda

| Skedari | Përmbajtja |
| --- | --- |
| `00-FILLO-KETU.md` | Ky skedar — hapat dhe teksti për t'ia dhënë Claude-it të ri |
| `01-BISEDA.md` | E gjithë biseda, hap pas hapi: çfarë u kërkua, çfarë u ndërtua, çfarë u provua |
| `02-VENDIMET.md` | Vendimet e marra dhe arsyet — pjesa që nuk duket nga kodi |
| `03-KONTEKSTI-TEKNIK.md` | Arkitektura, invariantet, konventat, graçkat |
| `pamje/` | Pamjet e ekranit të sistemit siç është sot |

## Hapi 1 — merre kodin

Kodi i plotë është në GitHub, dega `claude/ndihme-puna-u5enk2`:

```bash
git clone https://github.com/enrisulaj-intex/intexfin.git
cd intexfin
git checkout claude/ndihme-puna-u5enk2
```

Nëse llogaria e re e GitHub-it nuk e hap dot atë repo, kopjo folderin e tërë
të projektit me USB ose disk — brenda tij është edhe historia e git-it.

## Hapi 2 — ngrije sistemin

```bash
docker compose up --build
```

Hape **http://localhost:3000** dhe hyr me `admin@intexcourier.al` / `Intex2026!`.

Pa Docker:

```bash
npm install
cp .env.example .env     # vendos AUTH_SECRET: openssl rand -base64 32
npm run setup
npm run dev
```

## Hapi 3 — jepi kontekstin Claude-it të ri

Projekti ka një `CLAUDE.md` në rrënjë, të cilin Claude Code e lexon vetë kur
hapet folderi. Pra konteksti teknik merret automatikisht.

Për bisedën dhe vendimet, hap një sesion të ri në folderin e projektit dhe
ngjit këtë tekst si mesazh të parë:

---

> Po vazhdoj projektin IntexFin — sistemi financiar i brendshëm i Intex
> Courier. Është ndërtuar në një llogari tjetër dhe e kam kaluar këtu me kod
> dhe dokumentacion.
>
> Përpara se të nisim, lexo këta skedarë për kontekstin e plotë:
> - `CLAUDE.md` — arkitektura, invariantet, konventat
> - `kalimi/01-BISEDA.md` — historiku i ndërtimit
> - `kalimi/02-VENDIMET.md` — vendimet e marra dhe pse
>
> Pastaj më thuaj me fjalët e tua ku ndodhet projekti dhe cili është hapi i
> ardhshëm, që të jem i sigurt se e ke kuptuar saktë. Mos ndrysho asgjë derisa
> të ta kërkoj.

---

Pyetja e fundit ka qëllim: nëse përmbledhja që të kthen nuk përputhet me atë
që di ti, atëherë kontekstin nuk e ka marrë mirë dhe nuk ia vlen t'i besosh
ndryshimet.

## Çfarë nuk kalon vetvetiu

- **`uploads/`** — dokumentet e bashkëngjitura janë jashtë git-it me qëllim.
  Nëse ke ngarkuar fatura reale, kopjoji veçmas.
- **`.env`** — nuk është në git, siç duhet. Krijoje nga `.env.example` dhe
  gjenero një `AUTH_SECRET` të ri.
- **Baza e të dhënave** — nuk ka nevojë të kalojë. `npm run setup` e rikrijon
  me të dhënat shembull. Nëse ke futur të dhëna reale, merri me
  `pg_dump intexfin > intexfin.sql`.

## Ku ndodhet projekti sot

Gati: arkat për punonjës në tri monedha, gjashtë llojet e lëvizjeve, paneli i
shpejtë te faqja kryesore, faqja `/ngarkim` me formular manual dhe import nga
Excel për çdo lloj.

Hapi i ardhshëm: **integrimi me sistemin e Intex Courier**, që arkëtimet e çdo
punonjësi të mbushin arkat vetë. Vendimi për rrugën — API, lidhje me bazën e
të dhënave, apo eksport i rregullt — nuk është marrë ende.
