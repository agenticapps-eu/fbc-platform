# Aufgaben

## 1. RED

- [x] 1.1 `WEB_DATEIEN.bandQuer` und `QUER_SCHWELLE` in `scripts/splash.logic.ts`
      eintragen, mit Begründung im Kommentar
- [x] 1.2 `src/boot-flaeche.test.ts`: die Zahl der `url()` an `WEB_DATEIEN`
      binden statt sie mit `2` zu behaupten, und die Schwelle gegen das CSS
      halten
- [x] 1.3 RED belegen — drei Zusagen rot, ohne dass eine neue Behauptung
      geschrieben wurde

## 2. GREEN

- [x] 2.1 `regelnMitUrl` auf `[^{}]*` umstellen, damit ein `@media`-Block nicht
      als Selektor gelesen wird
- [x] 2.2 Die `@media`-Regel in `src/index.css`, unter `html[data-boot="nativ"]`,
      mit derselben Rampe und `url("/brand/splash-band-quer.webp")`
- [x] 2.3 `scripts/splash.ts`: das quere Band als WebP nach `public/brand/`
      ausleiten
- [x] 2.4 `scripts/stempel.logic.ts`: die neue Datei in `ERGEBNISSE`

## 3. Belege

- [x] 3.1 `pnpm splash` läuft, schreibt die Datei; Grösse messen und in
      `design.md` eintragen
- [x] 3.2 `pnpm test` · `typecheck` · `lint` grün, Zahlen notiert
- [x] 3.3 Sichtprobe im Browser: quer unter der Schwelle das Querband, quer
      darüber das Hochkantband, hochkant unverändert
- [x] 3.4 Der Stempel kennt die Datei (`pnpm splash:stempel` oder gleichwertig)

## 4. Abschluss

- [x] 4.1 Diff gegen die Aufgaben und das Spec-Delta lesen
- [ ] 4.2 Archivieren, PR, AGE-716 nachziehen
- [ ] 4.3 **Offen und ausdrücklich: der Gerätebeleg quer am Pixel steht aus.**
      Belegt ist die Auswahl am GEBAUTEN Artefakt im Browser (drei Flächen,
      Vorher-/Nachher-Paar bei 918x411), nicht am Gerät.
