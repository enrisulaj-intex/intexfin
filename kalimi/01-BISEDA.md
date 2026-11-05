# Historiku i ndërtimit të IntexFin

Regjistrim i bisedës midis Enri Sulaj (Intex Courier) dhe Claude, nga repo-ja
bosh deri te sistemi i sotëm. I shkruar që dikush pa akses te biseda origjinale
ta kuptojë jo vetëm **çfarë** u ndërtua, por **pse**.

Dega: `claude/ndihme-puna-u5enk2` · Repo: `enrisulaj-intex/intexfin`

---

## Faza 1 — Nisja

**Enri:** Dua të krijoj disa gjëra për punën time dhe më duhet ndihma jote.
Fillojmë ta krijojmë.

Repo-ja `intexfin` ishte krejt bosh — asnjë commit.

**Pyetjet dhe përgjigjet:**

| Pyetja | Përgjigjja |
| --- | --- |
| Çfarë të ndërtojmë? | Aplikacion web financiar |
| Çfarë teknologjie? | Next.js + TypeScript + Postgres |
| Cilat module në fillim? | Shpenzime |
| Si funksionon hyrja? | Email + fjalëkalim, me role |

## Faza 2 — Versioni i parë: shpenzime me aprovim

U ndërtua një modul shpenzimesh me rrjedhë aprovimi:

```
DRAFT → SUBMITTED → APPROVED → PAID
            └── REJECTED → (ndrysho) → SUBMITTED
```

Përfshinte: referencë automatike `SHP-2026-0001`, llogaritje TVSH-je, dokumente
të bashkëngjitura, filtra, eksport CSV, kategori, furnitorë, menaxhim
përdoruesish, historik veprimesh.

**Provat:** hyrja me kredenciale të gabuara, rrjedha e plotë e aprovimit, dhe
kontrolli se stafi nuk shihte shpenzimet e të tjerëve — as në listë, as në
detaje, as në CSV.

**Rregullim i bërë gjatë punës:** Intl-i për `sq-AL` i ndan mijëshet me
hapësirë (`1 234 567,50`), ndërsa kontabiliteti shqiptar pret pikë
(`1.234.567,50`). U kalua te `de-DE`. CSV-ja u bë me presje dhjetore dhe `;`,
që Excel-i shqip t'i lexojë kolonat saktë.

Commit: `0c4d4d2`

---

## Faza 3 — Kthesa: dy mënyra hedhjeje

**Enri:** Atëherë do fillojmë me shpenzimet. Metoda e hedhjes së shpenzimeve do
të jetë në dy mënyra.

Mesazhi u ndërpre. Claude pyeti cilat ishin dy mënyrat; Enri e mbylli pyetjen
dhe u kthye me një pamje ekrani nga një sistem tjetër (Lunoor POS, faqja
CASH-FLOW) si **referencë vizuale**, bashkë me shpjegimin:

> **1.** Metodë e thjeshtuar: në faqen kryesore një tabelë e vogël në krahun e
> djathtë, e tillë si në foton bashkangjitur.
>
> **2.** Tab për ngarkim do të jenë: Shpenzime, Diferenca, E drejtë për
> arkëtim, Arkëtim, Depozitim, Transfertë.

Pamja e referencës tregonte një panel anësor "Shto Shpenzim" me zgjedhës lloji,
datë, kategori, shumë dhe mënyrë pagese, plus një kuti "Ngarko nga Excel" dhe
një përmbledhje cash-flow me bilanc arke dhe lëvizje banke.

**Pyetjet dhe përgjigjet:**

| Pyetja | Përgjigjja |
| --- | --- |
| Çfarë do të thotë saktësisht "tab për ngarkim"? | E ndërtojmë pak më vonë mënyrën e dytë |
| A mbetet rrjedha e aprovimit? | **Jo — regjistrim i menjëhershëm** |
| A të llogaritet bilanci i arkës dhe i bankës veçmas? | **Po — arkë dhe bankë veja** |

## Faza 4 — Kthesa e dytë: arkat për punonjës

Ndërsa puna ishte në vazhdim, Enri shtoi kërkesën vendimtare:

> Fillimisht duhet të ndërtojmë arkat. Secili punonjës do të ketë arkat e tij:
> Arka në Lek, Arka në Euro, Arka në USD.
>
> Vlerat për mbushjet e arkave do të vijnë nga sistemi i Intex Courier sipas
> arkëtimeve që bëjmë për secilin punonjës.
>
> Gjithashtu shpenzimet duhet të hidhen në të gjitha monedhat; te vlera do të
> vendosësh monedhën dhe sistemi do e marrë automatikisht këtë nga arka e
> caktuar sipas monedhës.

Kjo ndryshoi strukturën nga rrënja. Pyetjet që u bënë:

| Pyetja | Përgjigjja |
| --- | --- |
| Si do të vijnë mbushjet nga sistemi i Intex Courier? | **Hedhje manuale tani, integrim më vonë** |
| A do të ketë këmbim valutor midis arkave? | **Jo për momentin** |

Enri kërkoi gjithashtu një mënyrë ta shihte zhvillimin në localhost. Meqë
mjedisi cloud nuk nxjerr URL publike, u shtua `Dockerfile` dhe shërbimi i
aplikacionit në `docker-compose.yml`, që sistemi të ngrihet me një komandë të
vetme te kompjuteri i tij.

## Faza 5 — Rindërtimi rreth arkave

Moduli i shpenzimeve u zëvendësua me një modul arkash dhe cash-flow-i:

- Çdo punonjës merr **tri arka** automatikisht: Lek, Euro, Dollarë.
- Llogaritë bankare janë të kompanisë, të ndara nga arkat.
- Një model i vetëm `Transaction` për gjashtë llojet.
- Te shpenzimi zgjidhet **monedha**; sistemi gjen vetë arkën e punonjësit.
- Rrjedha e aprovimit u hoq.
- Paneli i shpejtë (mënyra 1) u vendos në krahun e djathtë të faqes kryesore.

**Provat me të dhëna reale:** 531 $ − 31 $ = 500 $ · 41.500 L + 50.000 L =
91.500 L · depozitim 40.000 L → arka −40.000, banka +40.000.

**Dy vrima sigurie të gjetura dhe të mbyllura gjatë provave:**

1. Stafi shihte gjendjen e llogarisë bankare te lista e depozitimit. Tani
   gjendjet e bankës nuk i kalohen fare stafit.
2. Stafi mund të dërgonte para në arkën e një kolegu duke ndërtuar kërkesën me
   dorë, jashtë ndërfaqes. Kontrolli u shtua **në server**.

Commit: `34162ed`

---

## Faza 6 — Mënyra 2: ngarkimi

**Enri:** Të dyja. — pra çdo tab të ketë formular manual **dhe** ngarkim nga
Excel.

U ndërtua faqja `/ngarkim` me gjashtë tab-e, secili me të dyja rrugët:

**Hedhje manuale** — formulari i plotë: TVSH, nr. dokumenti, pala, shënime,
dokumente të bashkëngjitura.

**Ngarkim nga Excel** — `.xlsx` ose `.csv`:

1. Skedari lexohet dhe shfaqet rresht për rresht. **Asgjë nuk shkruhet** derisa
   të konfirmohet.
2. Çdo rresht validohet veç. Ata me gabime shënohen me kuq dhe lihen jashtë;
   pjesa e vlefshme mund të ngarkohet.
3. Rreshtat që përputhen me një lëvizje ekzistuese në datë, shumë, monedhë dhe
   përshkrim shënohen si **dyfishim i mundshëm** — paralajmërim, jo bllokim.
4. Shkrimi bëhet në një transaksion të vetëm: ose kalojnë të gjitha, ose asnjë.

Formatet janë të buta me qëllim, sepse raportet vijnë të ndryshme: datat si
`25.09.2026`, `2026-09-25` ose datë Excel; shumat si `14500,00`, `14500.00` ose
`14.500,00`; monedhat si `Lek`, `Lekë`, `ALL`, `EUR`, `USD`, `€`, `$`. Kolonat
njihen pa dallim shkronjash të mëdha apo theksash. Çdo tab ka shabllonin e vet
CSV për shkarkim.

**Një defekt i gjetur gjatë provave:** zbulimi i dyfishimeve nuk punonte fare.
Prisma e kthen shumën si `17400`, ndërsa llogaritja jepte `17400.00`, ndaj
çelësat nuk përputheshin kurrë. U rregullua dhe u riprovua.

**Provat:** import CSV me 3 rreshta të vlefshëm nga 5 (njëri me monedhë `GBP`,
tjetri me punonjës që s'ekziston), import XLSX në tri monedha, diferencë
manuale, transfertë midis dy arkave. Gjendjet u kontrolluan para dhe pas çdo
veprimi. U provua edhe se stafi nuk ngarkon dot rreshta për arkën e një kolegu.

Commit: `f63694d`

---

## Faza 7 — Kalimi në kompjuter tjetër

**Enri:** Dua që të gjithë bisedën dhe ndërtimin e IntexFin ta kaloj në një
kompjuter të ri.

U shtua `CLAUDE.md` në rrënjë të projektit — skedar që Claude Code e lexon vetë
kur hapet folderi, me vendimet, invariantet dhe graçkat. U verifikua që një
klonim i pastër ndërtohet: `npm install` → `npm run setup` → `typecheck` →
`build` → hyrje në browser.

Commit: `94b22c8`

Meqë llogaria te kompjuteri i ri është tjetër dhe linku i bisedës nuk hyn në
punë, u krijua ky folder `kalimi/`.

---

## Rendi i commit-eve

| Commit | Çfarë solli |
| --- | --- |
| `0c4d4d2` | Moduli i parë i shpenzimeve, me rrjedhë aprovimi |
| `34162ed` | Kalimi te arkat për punonjës dhe paneli i shpejtë |
| `f63694d` | Faqja e ngarkimit: formular i plotë dhe import nga Excel |
| `94b22c8` | `CLAUDE.md` me kontekstin e projektit |

## Mënyra e punës që u ndoq

Ia vlen të ruhet, sepse i zuri defektet herët:

- Çdo rrjedhë parash u provua **në browser**, duke hedhur lëvizje të vërteta dhe
  duke kontrolluar gjendjet para e pas — jo vetëm me `typecheck`.
- Kufizimet e aksesit u provuan duke u futur si staf dhe duke parë çfarë
  shihej e çfarë jo.
- `npm run typecheck` dhe `npm run build` para çdo commit-i.
- Të dhënat e testit u fshinë pas çdo prove.
