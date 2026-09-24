# Verificări Grove Blocks

Verificat la **24 septembrie 2026**, Windows, Node.js 22.12.0, Microsoft Edge / Chromium headless.

## Rezultate

- **31/31 teste de motor, SDK și salvare simulate:** plasare imutabilă, intersecții, serii, reproductibilitate Daily, limita de 30 de mutări, Bloom, stări imposibile și recuperarea după erori SDK. Motorul este verificat și prin 320 de jocuri cu semințe fixe.
- **16/16 verificări în browser**, executate atât pe surse, cât și pe buildul final servit sub `/dist/`. Nicio eroare JavaScript de pagină.
- Build final: **8 fișiere, aproximativ 90 KB necomprimate**; fără dependențe de runtime, fonturi sau media externe în standalone.

### Actualizarea 1.0.2 — CrazyGames Data Module

Cele 12 teste unitare noi acoperă așteptarea inițializării, încărcarea salvării SDK înainte de orice scriere, prioritatea cloud față de salvarea standalone, utilizarea SDK pentru oaspeți, erori de citire, modul indisponibil, date cloud corupte sau cu versiune necunoscută, erori de scriere și recuperare, eliminarea scrierilor duplicate și păstrarea funcționării standalone.

**12/12 verificări Data Module în browser**, atât pe surse, cât și pe `/dist/`, cu SDK simulat: inițializare întârziată, salvare existentă în cloud, partidă reluată după refresh, oaspete, erori și protecția datelor, inclusiv la ascunderea sau închiderea paginii. Fără erori JavaScript sau cereri externe. Comandă: `npm run test:data`.

Test efectuat și cu **SDK-ul v3 real în mediul său `local`**: prima linie a produs scorul 220, Data Module a stocat partida, iar reîncărcarea a restaurat scorul 220. Nicio eroare JavaScript. Acest test nu verifică sincronizarea cu un cont CrazyGames real sau între dispozitive.

### Corecția 1.0.1 — previzualizare la margini

**45/45 verificări suplimentare de plasare**, trecute atât pe surse, cât și pe build: piese de cinci pătrate pe orizontală și verticală, pătrat 3×3 și piesă în L la toate colțurile; previzualizare completă și plasare identică prin click și drag; suprapunere peste blocuri existentă marcată integral cu roșu; ieșire și reintrare pe tablă; eliberare în afara tablei fără folosirea unei previzualizări vechi; limite corecte la tastatură; tap și drag touch cu offsetul vizual păstrat. Nicio eroare JavaScript. Captura de colț a fost inspectată vizual. Comandă: `npm run test:placement`.

## Verificări în browser efectuate

Plasare prin click, drag cu mouse și touch emulat; prima linie și punctajul; mutări invalide fără modificarea stării; Hint; tastatură; Undo și restaurarea florilor; Bloom fără recompense duplicate; final Classic; Daily la mutarea 30; rejucare deterministă; păstrarea rezultatului dacă este deschis un alt dialog; schimbarea modului; reîncărcare; colecție și palete; setarea sunetului; salvări corupte; stocare locală blocată; funcționare după deconectarea rețelei; reduced motion; absența cererilor externe în standalone.

Layout și piese lungi verificate la **1440×1000, 1216×684, 1077×606, 907×510, 390×844, 320×740, 844×390**. Tabla și comenzile principale rămân în fereastră; piesele încap în sloturi; nu există scroll orizontal. Capturi desktop, iframe și mobil inspectate vizual. Gesturile mobile au fost emulate în Chromium, nu testate pe un telefon fizic.

Comenzi reproductibile:

```sh
npm test
npm run build
npm start
npm run test:browser
```

Testele de browser folosesc implicit Microsoft Edge instalat. Pentru Chromium Playwright se poate seta `BROWSER_CHANNEL=chromium` după instalarea acelui browser. Pentru buildul livrat, setează `TEST_URL=http://localhost:4173/dist/` înainte de test. Rezultatele și capturile se scriu în `artifacts/` (exclus din Git).

## Materiale de trimitere

- Coperte PNG inspectate vizual: landscape **1920×1080**, portrait **800×1200**, square **800×800**.
- Două clipuri MP4 H.264 / 30 fps, fără audio: landscape **1920×1080, 11,33 secunde**, portrait **1080×1920, 10,93 secunde**. Fiecare arată 12 plasări reale, șase linii curățate și un Bloom, cu scor de la 2715 la 3975. Metadatele și cadrele de verificare sunt în `marketing/videos/`.
- Scripturi de regenerare pentru coperte, video și arhive. Kitul include separat buildul, copertele, clipurile și documentația.

## Ce rămâne pentru lansarea pe platformă

Integrarea și evenimentele în iframe trebuie verificate în preview-ul Developer Portal cu opțiunea Data Module activată. Testează un oaspete, autentificarea într-un cont existent, ieșirea din cont și reluarea progresului pe un al doilea dispozitiv. SDK-ul real a fost testat doar în mediul său local; sincronizarea cloud reală nu este încă verificată. Jocul nu a fost trimis sau acceptat pe CrazyGames de către agent. Nu s-au efectuat teste pe Safari / iOS fizic. Nu există rezultate reale de retenție, trafic sau venituri. Versiunea este pregătită pentru evaluarea Basic Launch; pentru Full Launch trebuie revizuite cerințele suplimentare din [CRAZYGAMES.md](CRAZYGAMES.md).
