# Aufgaben — AGE-584

> Ueberarbeitet am 26.08. nach dem Plan-Review. Der erste Entwurf nannte die
> falsche Datei, setzte `min-w-0` an eine wirkungslose Stelle, beschrieb einen
> Waechter, der keinen der gemessenen Faelle sehen konnte, und verlangte einen
> Tabellenrahmen, den es schon gibt. Siehe `REVIEWS.md`.

## 1. Mindestbreite festschreiben

- [ ] 1.1 320 px als Mindestbreite in `docs/design-system.md` dokumentieren,
      mit Grund und dem ausdruecklichen Verbot, `overflow-x: hidden` auf einem
      Seitencontainer als Erfuellung zu benutzen.

## 2. Den Defekt wegkonstruieren, statt ihn zu detektieren

Beide Reparaturen sind **vorab im Browser gemessen**, nicht vermutet.

- [ ] 2.1 `Card` (`src/components/ui/Card.tsx`) traegt `min-w-0` in seinen
      Grundklassen. Gemessen auf `/`: Karte 418 px in einem 288-px-Container,
      mit `min-width:0` faellt die Dokumentbreite 434 → **320**, zurueckgenommen
      wieder 434.
- [ ] 2.2 `StaggerItem` (`src/components/ui/Motion.tsx`) traegt `min-w-0`.
      Gemessen auf `/mitglieder`: 359 → **320**. Dieselbe Eigenschaft auf der
      Karte statt auf dem Wrapper bewirkt dort **nichts** (359 → 359) — der
      Wrapper ist das Rasterkind, nicht die Karte.
- [ ] 2.3 Beide zusammensetzen, nicht ersetzen: `className` des Aufrufers muss
      weiterhin gewinnen koennen. `cn()` ist hier ein blosser Join ohne
      tailwind-merge — die CSS-Reihenfolge entscheidet.

## 3. Regel 1 als Waechter — RED zuerst

- [ ] 3.1 Test: keine Rasterdefinition mit fester Laenge (`rem`, `px`, `ch`)
      ohne Breakpoint-Praefix in `src/**/*.tsx`. **Muss zuerst ROT sein** —
      heute `ProfilPage.tsx:345` und `:390`.
- [ ] 3.2 Verbiegungsprobe: eine korrekte Stelle absichtlich kaputtmachen und
      pruefen, dass der Test sie meldet. Ein Waechter, der nur die schon
      bekannten Zeilen findet, ist ein Vakuumtest.
- [ ] 3.3 Die Begrenzung auf `grid-cols-[…]` im Test festhalten — sonst faengt
      der Ausdruck Dinge wie `gap-px` mit.

## 4. Die festen Spalten reparieren

- [ ] 4.1 `ProfilPage.tsx:345` und `:390` hinter `sm:` legen, darunter stapeln.
      Pruefstein ist die **Benutzbarkeit**, nicht der Ueberlauf: heute loest es
      zu `160px 26px 91px` bzw. `160px 26px 80px 91px` auf — die 26 px sind das
      Eingabefeld.

## 5. Belegen — im Browser, nicht in jsdom

- [ ] 5.1 Alle **vierzehn** Routen bei 320 px messen: kein Ueberlauf.
      `/intern/routing` gehoert dazu; es fehlte im ersten Durchlauf.
- [ ] 5.2 Dieselbe Messung bei 375 px und 414 px.
- [ ] 5.3 `/profil/bearbeiten` **mit** je einer Interessen- und Zielzeile —
      ohne Daten ist die Seite auch heute sauber und der Beleg wertlos.
- [ ] 5.4 Beide Themes (`data-variant`, nicht `prefers-color-scheme`).
- [ ] 5.5 Ein Profil mit sehr langem Firmennamen und langer Adresse sprengt
      keine Karte.
- [ ] 5.6 Die Admin-Tabelle: der Rahmen (`AdminMitgliederPage.tsx:488`) ist
      vorhanden — belegen, dass er **scrollt** und jede Spalte durch Schieben
      erreichbar ist. Keine Aenderung ohne Befund.
- [ ] 5.7 Gegenprobe je Fund: Eigenschaft setzen, Fehler weg; zuruecknehmen,
      Fehler zurueck. Ohne die zweite Haelfte ist es ein Zufall daneben.

## 6. Abschluss

- [ ] 6.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` gruen.
- [ ] 6.2 Code-Review auf dem **Diff**.
- [ ] 6.3 Folge-Issue: browsergestuetzte Ueberlaufmessung in CI. Der Review hat
      gezeigt, dass eine statische Pruefung die gemessenen Faelle strukturell
      nicht sieht — das gehoert festgehalten, nicht vergessen.
- [ ] 6.4 `openspec archive` erst, wenn 5.1–5.7 gemessen sind.
