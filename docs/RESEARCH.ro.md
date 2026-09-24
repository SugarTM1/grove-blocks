# Cercetare: Grove Blocks — Garden Puzzle

Verificat la **24 septembrie 2026**. Au fost consultate paginile oficiale CrazyGames, datele structurate publice ale acelor pagini și documentația pentru dezvoltatori. Concluzia este o alegere de produs, nu o prognoză de trafic sau venit.

## Alegerea

**Grove Blocks — Garden Puzzle**: puzzle 2D cu piese pe o tablă 8×8, rânduri și coloane care se curăță, flori care alimentează abilitatea Bloom, colecție de grădină și provocare zilnică de 30 de mutări. Jocul combină o regulă ușor de înțeles cu obiective proprii și o prezentare botanică originală.

Motivul alegerii: dintre familiile comparate, block puzzle are un exemplu cu un semnal public foarte puternic de participare și permite să investim mai mult în control, animație, sunet și progresie decât în infrastructură. Aceasta este o evaluare de fezabilitate, nu o afirmație că toate jocurile din categorie performează bine.

## Comparația

Valorile de mai jos provin din `aggregateRating.ratingValue` și `aggregateRating.ratingCount` din JSON-LD-ul paginilor oficiale, citit direct în aceeași zi. Nota maximă este 10. Interfața paginilor descrie nota ca fiind bazată pe ultimele șase luni; câmpul JSON-LD `ratingCount` nu explică separat intervalul de numărare. Nu îl tratăm drept număr de jucători, sesiuni, venituri sau trafic organic. Datele se schimbă; rezultatele memorate de motoarele de căutare pot diferi de pagina curentă.

| Familie | Exemplu oficial | Notă / ratingCount | Fezabilitate pentru acest proiect | Compromis |
|---|---|---:|---|---|
| Block puzzle | [Block Blaster](https://www.crazygames.com/game/block-puzzle-master) | 8,8 / 56.758 | Foarte bună: reguli deterministe, grafică vectorială, fără server | Concurență mare; o copie simplă nu este suficientă |
| Water sort | [Cups — Water Sort Puzzle](https://www.crazygames.com/game/cups---water-sort-puzzle) | 9,0 / 2.642 | Bună: control simplu, scene compacte | Necesită multe niveluri rezolvabile și o curbă de dificultate verificată |
| Parking / tap escape | [Parking Jam](https://www.crazygames.com/game/parking-jam-dqq) | 8,4 / 4.874 | Bună pentru 2D, medie pentru 3D | Generarea puzzle-urilor și coliziunile sporesc munca |
| Merge drop | [Watermelon Fruit Merge Saga](https://www.crazygames.com/game/watermelon-fruit-merge-saga) | 8,5 / 5.230 | Bună, cu fizică testată | Fizica și echilibrarea sunt mai fragile; reskin-urile sunt greu de diferențiat |
| Survivor | [Vampire Pixel Survivors](https://www.crazygames.com/game/vampire-pixel-survivors) | 9,1 / 227 | Medie | Mai multe arme, inamici, efecte și combinații de echilibrat; performanță mobilă mai dificilă |

Două verificări suplimentare: [Drop & Merge the Numbers](https://www.crazygames.com/game/drop-merge-the-numbers) avea 8,8 / 1.049, iar [Unpuzzle: Tap Away Puzzle Game](https://www.crazygames.com/game/unpuzzle-tap-away-puzzle-game) avea 9,0 / 206. Acestea confirmă existența publicului pentru mecanici simple, dar eșantionul nu reprezintă întreaga categorie. Nu avem distribuția completă a rezultatelor și nici date interne comparabile despre trafic.

Block Blaster este prezent din martie 2024 și a fost actualizat în iulie 2026. Watermelon Fruit Merge Saga a apărut în mai 2026. Observăm atât titluri menținute în timp, cât și lansări noi. Nu deducem că un proiect nou va reproduce rezultatele lor.

Pagina [Hot Games](https://www.crazygames.com/hot), verificată în aceeași zi, includea genuri diferite: Progress Knight, TileMan.io, Rocket Fling, Paper.io 2 și My Castle: Merge & Story. Este o selecție dinamică pentru ultimele 24 de ore, nu o dovadă că un singur gen domină sau că block puzzle este acum numărul unu.

## De unde poate veni descoperirea organică

CrazyGames explică faptul că selecția depinde de dispozitiv, țară, sistem de operare și, în unele poziții, istoricul jucătorului. Jocurile noi pot primi expunere inițială. Vizibilitatea continuă depinde de implicare: timp de joc, retenție, conversie și feedback. Prin urmare, ipoteza noastră este: **intrare rapidă în joc + control bun pe mobil + un motiv clar de revenire pot ajuta distribuția în platformă**. Nu există un volum garantat. [Sursă: FAQ oficial](https://docs.crazygames.com/faq/)

Traficul din recomandările CrazyGames și traficul din căutarea Google sunt canale diferite. Această cercetare nu măsoară volume SEO și nu promite poziții în Google. Titlul distinct, subtitlul descriptiv și pagina publică pot susține găsirea jocului; efectul trebuie măsurat după publicare. Simplul upload pe GitHub nu înseamnă acceptare pe CrazyGames.

## Ce construim pentru această ipoteză

- **Prima mutare imediat:** tabla și piesele apar direct; explicația esențială este scurtă și vizuală.
- **Regulă familiară, decizie suplimentară:** curățarea liniilor recoltează florile; acestea încarcă Bloom, care eliberează o zonă de 3×3. Jucătorul alege când consumă puterea.
- **Două motive de revenire:** scor personal în modul clasic și o provocare zilnică reproductibilă de 30 de mutări.
- **Progres vizibil:** colecție de grădină, salvată local. Colecția susține scopul jocului fără a cere cont sau infrastructură de server.
- **Finisare:** preview valid/invalid la plasare, animații de curățare, feedback sonor, opțiune mute, salvare și layout adaptabil.

CrazyGames cere originalitate și indică faptul că jocurile-clonă ori asset flip-urile pot fi respinse. Schimbarea temei grafice singură nu garantează diferențierea; mecanica florilor, utilizarea Bloom și progresia trebuie să fie vizibile în experiență. [Sursă: criteriile de evaluare](https://docs.crazygames.com/faq/)

## Validarea prin Basic Launch

Ghidul oficial spune că Basic Launch se încheie după minimum 7 zile și minimum 500 de sesiuni de joc; dacă nu se ating 500, testul se termină automat după 21 de zile. Sunt repere de evaluare, nu promisiuni de distribuție.

Documentația descrie drept repere observate la titluri puternice: timp mediu de joc de peste 10 minute, retenție în ziua următoare de 10–15%, conversie la minimum un minut de peste 80%, încărcare sub 10 secunde și build sub 20 MB. **Nu sunt rezultate măsurate pentru Grove Blocks și nici garanții de acceptare.** Datele reale vor apărea în dashboard după lansare. SDK-ul este opțional în Basic Launch, iar monetizarea este dezactivată în această etapă. [Sursă: Basic Launch Guide](https://docs.crazygames.com/resources/basic-launch-metrics/)

Testăm în special: prima plasare înțeleasă fără ajutor, lipsa blocajelor după restart, reluarea corectă a progresului, atingerea pieselor pe mobil, lizibilitatea în iframe și lipsa erorilor când SDK-ul nu este disponibil. Dacă jucătorii pleacă în primul minut, îmbunătățim introducerea și controlul înainte să adăugăm conținut.

Pentru implementare, limita oficială de download inițial este 50 MB, iar eligibilitatea pentru homepage pe mobil cere maximum 20 MB. Cerințele de gameplay enumeră dimensiuni desktop precum 907×510, 1216×684 și 1077×606 și solicită lizibilitate la devicePixelRatio 1. [Cerințe tehnice](https://docs.crazygames.com/requirements/technical/), [cerințe gameplay](https://docs.crazygames.com/requirements/gameplay/)

## Metadate propuse pentru trimitere

**Title:** Grove Blocks — Garden Puzzle

**Short description:** Place blocks, harvest flowers, and grow your garden in a relaxing puzzle with a fresh daily challenge.

**Description:** Make room for something beautiful. Place colorful blocks on an 8×8 board and complete rows or columns to clear them. Harvest flowers to charge Bloom, then choose the perfect moment to clear a 3×3 patch. Chase your best score in Classic, take on a seeded 30-move Daily Challenge, and build your garden collection as you play. Your progress is saved automatically.

**Controls:** Drag a piece onto the board, or select it and tap a valid position. Complete a row or column to clear it. When Bloom is ready, activate it and choose a patch of the board.

**Suggested category and tags:** Puzzle; Block, Logic, Casual, Mobile, Mouse. Etichetele finale depind de opțiunile portalului și de validarea editorială.

**Cover direction:** tabla reală cu o plasare lizibilă, câteva flori și efectul Bloom; titlu scurt, contrast bun. Coperta trebuie să arate mecanicile implementate și să rămână distinctă de concurenți. [Sursă: Quality Guidelines](https://docs.crazygames.com/requirements/quality/)

Metadatele se verifică față de buildul final înainte de trimitere. Nu se pretind clasamente online, conturi cloud sau alte funcții care nu există în joc.
