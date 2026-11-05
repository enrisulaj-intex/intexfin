# Vendimet dhe arsyet

Çdo vendim këtu u mor nga Enri gjatë ndërtimit. Nuk janë parazgjedhje teknike —
janë zgjedhje pune. **Mos i ndrysho pa e pyetur**, sepse arsyeja shpesh nuk
duket nga kodi.

---

## 1. Pa rrjedhë aprovimi

**Vendimi:** lëvizjet regjistrohen menjëherë.

**Historia:** versioni i parë kishte `DRAFT → SUBMITTED → APPROVED → PAID` me
refuzim e arsye. Kur u pa pamja e sistemit referencë, ku shtypet një buton dhe
lëvizja hyn drejtpërdrejt, pyetja u bë: a mbetet aprovimi? Përgjigjja ishte
"Regjistrim i menjëhershëm, pa aprovim". I gjithë kodi i aprovimit u hoq.

**Pasoja:** kontrolli mbahet nga historiku — çdo veprim regjistrohet me
përdoruesin dhe orën — jo nga bllokimi përpara.

---

## 2. Një model i vetëm për gjashtë llojet

**Vendimi:** `Transaction` me fushën `type`, jo gjashtë modele.

**Arsyeja:** paneli i shpejtë duhej të mbulonte disa lloje njëherësh, dhe
mënyra 2 do të shtonte tab-e për të njëjtat lloje. Me një model të vetëm,
mënyra 2 shtoi vetëm ndërfaqe, jo strukturë të re — gjë që doli e saktë kur
erdhi radha e saj.

---

## 3. Arkat janë për punonjës, një për çdo monedhë

**Kërkesa e Enrit, fjalë për fjalë:**

> Fillimisht duhet të ndërtojmë arkat. Secili punonjës do të ketë arkat e tij:
> Arka në Lek, Arka në Euro, Arka në USD.

**Zbatimi:** `ensureCashBoxes()` krijon tri arka sa herë krijohet një përdorues.
Llogaritë bankare janë të kompanisë — `ownerId` bosh.

---

## 4. Monedha zgjidhet, arka jo

**Kërkesa e Enrit, fjalë për fjalë:**

> Shpenzimet duhet të hidhen në të gjitha monedhat; te vlera do të vendosësh
> monedhën dhe sistemi do e marrë automatikisht këtë nga arka e caktuar sipas
> monedhës.

**Zbatimi:** përdoruesi zgjedh monedhën; `resolveAccounts()` gjen arkën e atij
punonjësi në atë monedhë.

**Mos shto zgjedhës arke.** Kjo ishte kërkesë e qartë dhe e qëllimshme — një
hap më pak për punonjësin që hedh dhjetëra lëvizje në ditë.

---

## 5. Pa këmbim valutor

**Vendimi:** transferta kërkon që të dyja llogaritë të jenë në të njëjtën
monedhë. Raportet i mbajnë monedhat të ndara, pa konvertim.

**Historia:** u pyet shprehimisht nëse do të kishte këmbim EUR → Lekë.
Përgjigjja: "Jo për momentin".

**Nëse kërkohet më vonë:** do të duhet një lëvizje me dy shuma dhe një kurs, që
sot nuk ekziston në model. Kontrolli që e bllokon ndodhet te `resolveAccounts()`
dhe te `normalizeRow()`.

---

## 6. Mbushjet hidhen me dorë tani

**Kërkesa e Enrit:**

> Vlerat për mbushjet e arkave do të vijnë nga sistemi i Intex Courier sipas
> arkëtimeve që bëjmë për secilin punonjës.

**Vendimi i marrë:** "Hedhje manuale tani, integrim më vonë."

**Përgatitja:** mbushjet hidhen si `ARKETIM`. Fusha `source` ndan `MANUAL` nga
`INTEX` nga `IMPORT`, kështu që kur të vijë integrimi nuk ndryshon struktura —
mbushet vetëm ajo fushë.

---

## 7. Formatimi i numrave me `de-DE`

**Problemi:** Intl-i për `sq-AL` i ndan mijëshet me hapësirë: `1 234 567,50`.

**Vendimi:** u kalua te `de-DE`, që jep `1.234.567,50` — formati që pret
kontabiliteti shqiptar dhe Excel-i me lokalizim shqip. Datat mbeten `sq-AL`.

Po ashtu, CSV-ja del me `;`, presje dhjetore dhe BOM, që Excel-i t'i hapë
kolonat dhe shkronjat shqipe saktë.

---

## 8. Gjendja negative nuk bllokohet

**Vendimi:** një arkë mund të dalë në minus; shfaqet me të kuqe, nuk ndalohet.

**Arsyeja:** radha e hedhjes shpesh nuk përputhet me radhën e ngjarjeve — një
shpenzim mund të hidhet para mbushjes që e mbulon. Bllokimi do të pengonte punë
të ligjshme.

---

## 9. Dyfishimet paralajmërohen, nuk bllokohen

**Vendimi:** te ngarkimi, një rresht që përputhet me një lëvizje ekzistuese në
datë, shumë, monedhë dhe përshkrim shënohet si dyfishim i mundshëm.

**Arsyeja:** ngarkimi dy herë i të njëjtit raport është gabimi më i lehtë për
t'u bërë. Por mund të ketë edhe dy shpenzime të njëjta në të njëjtën ditë, ndaj
vendimi i mbetet përdoruesit.

---

## 10. Gjendja llogaritet, nuk ruhet

**Vendimi:** asnjë kolonë `balance`. Çdo lëvizje ruan efektin e vet me shenjë;
gjendja është `openingBalance + SUM(efektet)`.

**Arsyeja:** një total i ruajtur veçmas del herët a vonë jashtë sinkronit — pas
një fshirjeje, një ndryshimi, një gabimi. Kështu nuk ka si të ndodhë.

**Çmimi:** gjendja kërkon mbledhje në çdo lexim. Me volumin e një kompanie
korriere kjo nuk është problem; nëse një ditë bëhet, zgjidhja është një tabelë
përmbledhëse për periudha të mbyllura, jo kolonë gjendjeje.
