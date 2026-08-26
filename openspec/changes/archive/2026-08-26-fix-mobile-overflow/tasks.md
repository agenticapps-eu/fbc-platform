# Aufgaben — AGE-584

> Ueberarbeitet am 26.08. nach dem Plan-Review. Der erste Entwurf nannte die
> falsche Datei, setzte `min-w-0` an eine wirkungslose Stelle, beschrieb einen
> Waechter, der keinen der gemessenen Faelle sehen konnte, und verlangte einen
> Tabellenrahmen, den es schon gibt. Siehe `REVIEWS.md`.

## 1. Mindestbreite festschreiben

- [x] 1.1 320 px als Mindestbreite in `docs/design-system.md` dokumentieren,
      mit Grund und dem ausdruecklichen Verbot, `overflow-x: hidden` auf einem
      Seitencontainer als Erfuellung zu benutzen.

## 2. Den Defekt wegkonstruieren, statt ihn zu detektieren

Beide Reparaturen sind **vorab im Browser gemessen**, nicht vermutet.


      **Erledigt.** `docs/design-system.md` §8 — Mindestbreite, Messmethode je Element samt der zwei Ausnahmen, das Verbot von `overflow-x: hidden`, und die zwei Fallen mit den gemessenen Zahlen.
- [x] 2.1 `Card` (`src/components/ui/Card.tsx`) traegt `min-w-0` in seinen
      Grundklassen. Gemessen auf `/`: Karte 418 px in einem 288-px-Container,
      mit `min-width:0` faellt die Dokumentbreite 434 → **320**, zurueckgenommen
      wieder 434.

      **Erledigt und gemessen.** `Card.tsx` traegt `min-w-0`; Startseite bei 320 px von 114 px Ueberlauf auf **0**.
- [x] 2.2 `StaggerItem` (`src/components/ui/Motion.tsx`) traegt `min-w-0`.
      Gemessen auf `/mitglieder`: 359 → **320**. Dieselbe Eigenschaft auf der
      Karte statt auf dem Wrapper bewirkt dort **nichts** (359 → 359) — der
      Wrapper ist das Rasterkind, nicht die Karte.

      **Erledigt und gemessen.** `Motion.tsx`/`StaggerItem`; Verzeichnis von 39 px auf **0**.
- [x] 2.3 Beide zusammensetzen, nicht ersetzen: `className` des Aufrufers muss
      weiterhin gewinnen koennen. `cn()` ist hier ein blosser Join ohne
      tailwind-merge — die CSS-Reihenfolge entscheidet.

## 3. Regel 1 als Waechter — RED zuerst


      **Erledigt.** Beide ueber `cn(...)` vor dem `className` des Aufrufers.
- [x] 3.1 Test: keine Rasterdefinition mit fester Laenge (`rem`, `px`, `ch`)
      ohne Breakpoint-Praefix in `src/**/*.tsx`. **Muss zuerst ROT sein** —
      heute `ProfilPage.tsx:345` und `:390`.

      **Erledigt, RED belegt.** Erst rot mit `ProfilPage.tsx: grid-cols-[10rem_1fr_auto], grid-cols-[10rem_1fr_5rem_auto]`, nach 4.1 gruen.
- [x] 3.2 Verbiegungsprobe: eine korrekte Stelle absichtlich kaputtmachen und
      pruefen, dass der Test sie meldet. Ein Waechter, der nur die schon
      bekannten Zeilen findet, ist ein Vakuumtest.

      **Erledigt — und sie hat sofort einen Fehler IM WAECHTER gefunden.** Der Ausdruck erkannte den echten Verstoss nicht: `\b` hinter der Einheit, aber Tailwind trennt Spalten mit `_`, und `_` ist ein Wortzeichen. Ohne die Probe waere der Waechter gruen gewesen und haette nichts geprueft.
- [x] 3.3 Die Begrenzung auf `grid-cols-[…]` im Test festhalten — sonst faengt
      der Ausdruck Dinge wie `gap-px` mit.

## 4. Die festen Spalten reparieren


      **Erledigt.** Auf `grid-cols-[…]` begrenzt; `gap-px` ist als Gegenfall im Test.
- [x] 4.1 `ProfilPage.tsx:345` und `:390` hinter `sm:` legen, darunter stapeln.
      Pruefstein ist die **Benutzbarkeit**, nicht der Ueberlauf: heute loest es
      zu `160px 26px 91px` bzw. `160px 26px 80px 91px` auf — die 26 px sind das
      Eingabefeld.

## 5. Belegen — im Browser, nicht in jsdom


      **Erledigt und gemessen.** Beide Zeilen hinter `sm:`, darunter `grid-cols-1`.
- [x] 5.1 **Alle** Routen aus `App.tsx` bei 320 px messen, nicht eine
      Auswahl. Der erste Durchlauf deckte dreizehn ab; codex hat sieben weitere
      benannt: `/academy`, `/kompass`, `/meine-events`, `/kontakte`,
      `/intern/routing`, `/admin/feedback`, `/admin/mitglied/:id`. Die Liste
      SHALL aus `App.tsx` abgeleitet werden, nicht von Hand gepflegt — eine
      Handliste deckt nur ab, woran jemand gedacht hat.

      **Erledigt.** 20 Routen bei 320 px, Liste aus `App.tsx` und `nav.ts` abgeleitet. 18 vollstaendig sauber; die zwei uebrigen haben Dokument-Ueberlauf **0**, und jedes uebergrosse Element steckt nachweislich in einem `overflow-x-auto`, der auch scrollt (99/318/257 px).
- [x] 5.2 Dieselbe Messung bei 375 px und 414 px.

      **Erledigt.** 375 px: 20 Routen, **null** Probleme. 414 px: ebenso.
- [x] 5.3 `/profil/bearbeiten` **mit** je einer Interessen- und Zielzeile —
      ohne Daten ist die Seite auch heute sauber und der Beleg wertlos.

      **Erledigt und gemessen.** Mit je einer Interessen- und Zielzeile: vorher 320 → 334 → **422** (102 px Ueberlauf), nachher 320 → 320 → **320**. Spalten loesen zu einer einzigen `238px`-Spur auf; schmalstes Eingabefeld **238 px** statt 26 px — die Zusage lautet ≥ 200 px.
- [x] 5.4 Beide Themes (`data-variant`, nicht `prefers-color-scheme`).

      **Erledigt.** Vier Design-Varianten (`data-variant` A–D) auf `/` bei 414 px: je 0 Ueberlauf, 0 ungerahmte Elemente.
- [x] 5.5 Ein Profil mit sehr langem Firmennamen und langer Adresse sprengt
      keine Karte.

      **Erledigt.** 64-Zeichen-Firmenname OHNE Leerzeichen plus lange Adresse in drei Karten eingesetzt: Dokument bleibt 320, Karten bleiben 288 px. Zuruecknehmen stellt den Ausgangszustand her.
- [x] 5.6 Die Admin-Tabelle: der Rahmen (`AdminMitgliederPage.tsx:488`) ist
      vorhanden — belegen, dass er **scrollt** und jede Spalte durch Schieben
      erreichbar ist. Keine Aenderung ohne Befund.

      **Erledigt, ohne Aenderung.** Der Rahmen (`AdminMitgliederPage.tsx:488`) existiert und scrollt tatsaechlich — gemessen 257 px Scrollweg fuer die Tabelle, 318 px fuer die Reiterleiste. Kein Befund, also kein Diff.
- [x] 5.7 **Bei 1440 px gegenmessen**, dass die bestehende Zusage nicht kippt:
      das Dashboard bekommt seine Spalten, kein Kartentitel wird aus Platzmangel
      gekuerzt. `min-width: 0` sollte dort wirkungslos sein — sollte, gemessen
      ist besser.

      **Erledigt — mit einem offengelegten Nebeneffekt.** Bei 1440 px loest das Kachelraster jetzt `376,5 / 376,5 / 320,0` auf, also wie definiert. OHNE den Fix waren es `354,2 / 417,7 / 301,1`: die mittlere Spalte blaehte sich auf, um einen `nowrap`-Untertitel unterzubringen, und nahm den Nachbarn die Breite — das Raster loeste nie so auf, wie es geschrieben steht. Der Preis: ein als `truncate` markierter **Untertitel** kuerzt jetzt um 42 px. Kein Kartentitel kuerzt; die bestehende Zusage spricht von Titeln.
- [x] 5.8 Gegenprobe je Fund: Eigenschaft setzen, Fehler weg; zuruecknehmen,
      Fehler zurueck. Ohne die zweite Haelfte ist es ein Zufall daneben.

## 6. Abschluss


      **Erledigt.** Jeder Fund wurde in drei Schritten gemessen — Fehler feststellen, Eigenschaft setzen, Eigenschaft zuruecknehmen. In allen Faellen kam der Fehler beim Zuruecknehmen wieder.
- [x] 6.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` gruen.

      **Erledigt.** typecheck 0, test 0 (148 Dateien / 1711 Zusagen), build 0. `pnpm lint` ist lokal rot — ausschliesslich wegen untrackter Dateien in `.gstack/`, die in einem frischen Checkout gar nicht existieren; nur auf getrackte Dateien angewandt (also das, was CI sieht): **exit 0, 0 Fehler**, vier vorbestehende react-refresh-Warnungen.
- [x] 6.2 Code-Review auf dem **Diff**.

      **Erledigt, und er hat etwas gefunden.** Der erste Durchgang meldete zu Recht, dass die Waechter-Datei gar nicht im Diff stand (neue Datei). Nachgereicht kam der eigentliche Befund: `toContain("min-w-0")` auf den rohen Dateiinhalt ist zu schwach — und hier buchstaeblich, weil **beide Bausteine die Klasse im Kommentar woertlich nennen**. Gemessen: Klasse entfernt, Kommentar stehen gelassen → alle vier Tests gruen. Behoben, indem Kommentare vor der Pruefung entfernt werden; die Verbiegung ist jetzt rot (5 gruen / 1 rot / 5 gruen).
- [x] 6.3 Folge-Issue: browsergestuetzte Ueberlaufmessung in CI. Der Review hat
      gezeigt, dass eine statische Pruefung die gemessenen Faelle strukturell
      nicht sieht — das gehoert festgehalten, nicht vergessen.

      **Erledigt.** AGE-607 angelegt, mit der Begruendung aus dem Plan-Review und der Huerde (ein eingeloggter Zustand muss in CI herstellbar sein, sonst deckt der Lauf keine der drei gemessenen Stellen ab).
- [x] 6.4 `openspec archive` erst, wenn 5.1–5.7 gemessen sind.

      **Erledigt.** 5.1–5.8 sind gemessen, nicht hergeleitet: 20 Routen bei
      320/375/414 px, vier Themes, das Bearbeiten-Formular MIT Daten, ein
      Belastungstest mit einem Namen ohne Leerzeichen, die 1440-px-Gegenprobe
      und je Fund eine Ruecknahme, die den Fehler wiederherstellt.
