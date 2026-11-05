# IntexFin — konteksti i projektit

Sistemi financiar i brendshëm i **Intex Courier**. Ndërfaqja, kodi dhe
komentet janë **në shqip** — vazhdo kështu.

Ky skedar lexohet automatikisht nga Claude Code sa herë hapet projekti.
Mban vendimet që nuk duken nga kodi.

## Gjendja

| Moduli | Gjendja |
| --- | --- |
| Arkat për punonjës (Lek, EUR, USD) | Gati |
| Lëvizjet: shpenzim, arkëtim, depozitim, e drejtë, transfertë, diferencë | Gati |
| Mënyra 1 e hedhjes — paneli i shpejtë te faqja kryesore | Gati |
| Mënyra 2 e hedhjes — faqja `/ngarkim`, manual + Excel | Gati |
| Integrimi me sistemin e Intex Courier | **Hapi i ardhshëm** |
| Këmbimi valutor midis arkave | I shtyrë me vendim |

## Vendimet e marra — mos i rikthe pa pyetur

1. **Pa rrjedhë aprovimi.** Lëvizjet regjistrohen menjëherë. Pati një version
   me `DRAFT → SUBMITTED → APPROVED → PAID`; u hoq me kërkesë të përdoruesit.
2. **Një model i vetëm `Transaction`** për të gjashtë llojet, jo një model për
   lloj. Lloji është fushë (`type`).
3. **Arkat janë për punonjës, një për çdo monedhë.** Krijohen automatikisht kur
   krijohet përdoruesi (`ensureCashBoxes`). Llogaritë bankare janë të
   kompanisë — `ownerId` bosh.
4. **Monedha zgjidhet, arka jo.** Te një shpenzim përdoruesi zgjedh monedhën;
   sistemi gjen vetë arkën e atij punonjësi në atë monedhë. Kjo ishte kërkesë e
   qartë — mos shto zgjedhës arke.
5. **Pa këmbim valutor.** Transferta kërkon që të dyja llogaritë të jenë në të
   njëjtën monedhë. Raportet i mbajnë monedhat të ndara, pa konvertim.
6. **Mbushjet e arkave hidhen me dorë tani**, si `ARKETIM`. Fusha `source`
   (`MANUAL` / `INTEX` / `IMPORT`) është gati për integrimin e ardhshëm.

## Invariantet e arkitekturës

**Gjendja nuk ruhet si numër.** Çdo lëvizje ruan efektin e vet me shenjë në
`accountEffect` dhe `toAccountEffect`, të llogaritur një herë nga
`computeEffects()` në `src/lib/transactions.ts`. Gjendja e një llogarie është
`openingBalance + SUM(efektet)` — shih `getBalances()` në `src/lib/accounts.ts`.
Kështu nuk mban dot një total jashtë sinkronit. Mos shto kolonë `balance`.

**Kufizimet e aksesit zbatohen në server, jo në ndërfaqe.** Stafi:
- sheh vetëm arkat dhe lëvizjet e veta — `visibleTransactionWhere()` dhe
  `visibleAccountWhere()` në `src/lib/scope.ts`;
- nuk sheh gjendjet e llogarive bankare (u kalohet `balance: null`);
- nuk dërgon para në arkën e një kolegu — kontrolli te `resolveAccounts()` në
  `src/actions/transactions.ts` dhe te `normalizeRow()` në `src/actions/import.ts`.

**Ngarkimi ka një rrugë të vetme validimi.** `normalizeRow()` përdoret njësoj te
shikimi paraprak dhe te konfirmimi. Mos shkruaj rrugë të dytë — ndryshimi i të
dhënave midis dy hapave do të kalonte pa kontroll.

**Shkrimi i ngarkimit bëhet në një `$transaction` të vetme**: ose kalojnë të
gjitha, ose asnjë.

## Konventat

- **Mutacionet me Server Actions**, validim me Zod në server. Asnjë mutacion
  nuk mbështetet te validimi i browser-it.
- **Formatimi i numrave përdor `de-DE`**, jo `sq-AL`. Intl-i për `sq-AL` i ndan
  mijëshet me hapësirë (`1 234 567,50`), ndërsa praktika kontabël shqiptare
  pret pikë (`1.234.567,50`). Datat përdorin `sq-AL`. Shih `src/lib/format.ts`.
- **CSV-ja del me `;` dhe presje dhjetore, me BOM** — që Excel-i me lokalizim
  shqip t'i lexojë kolonat dhe shkronjat saktë.
- **Shumat janë `Decimal(14,2)`** në bazë. Kalohen në numër me `toNumber()`.
- Komponentët e formularëve janë `"use client"` me `useActionState`; faqet janë
  server components.

## Gracka të hasura

- **`Decimal.toString()` jep `"17400"`, jo `"17400.00"`.** Kjo prishi zbulimin e
  dyfishimeve te ngarkimi. Kur krahason shuma si tekst, përdor
  `toNumber(x).toFixed(2)` në të dy anët.
- **Tailwind 4 nuk e njeh `@apply` mbi një klasë të `@layer components`.** Klasa
  bazë `btn` është deklaruar me `@utility` te `src/app/globals.css` pikërisht
  për këtë.
- **Next.js shton një `<p role="alert">` bosh** (route announcer). Te testet,
  shëno `form [role="alert"]`, jo `[role="alert"]`.
- **Alert-et e suksesit kanë `role="status"`**, jo `"alert"` — shih
  `src/components/Alert.tsx`.
- **Gjendja e arkës mund të dalë negative** dhe nuk bllokohet: radha e hedhjes
  shpesh nuk përputhet me radhën e ngjarjeve. Shfaqet me të kuqe.

## Ndërtimi dhe prova

```bash
npm install
cp .env.example .env     # DATABASE_URL dhe AUTH_SECRET
npm run setup            # prisma generate + db push + seed
npm run dev              # http://localhost:3000
```

Ose e gjitha me një komandë: `docker compose up --build`.

Para çdo commit-i: `npm run typecheck` dhe `npm run build`.

Llogaritë e zhvillimit (nga seed-i): `admin@intexcourier.al` / `Intex2026!`,
`financa@intexcourier.al` / `Financa2026!`,
`arjan.hoxha@intexcourier.al` dhe `elona.brahimi@intexcourier.al` / `Staf2026!`.

**Provoje në browser, jo vetëm me typecheck.** Rrjedhat e parasë janë provuar
duke hedhur lëvizje dhe duke kontrolluar gjendjet para e pas. Chromium dhe
Playwright janë të instaluar në mjedisin cloud (`PLAYWRIGHT_BROWSERS_PATH`).

## Hapi i ardhshëm

Integrimi me sistemin e Intex Courier, që arkëtimet e çdo punonjësi të mbushin
arkat vetë në vend që të hidhen me dorë. Mungon ende vendimi për rrugën: API,
lidhje me bazën e të dhënave, ose eksport i rregullt. Struktura është gati —
duhet mbushur `source: INTEX` dhe shmangur dyfishimi.
