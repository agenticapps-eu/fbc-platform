# Tasks — Titelbild-Felder (AGE-596)

## 1. Beweisführung vor dem Fix

- [x] 1.1 Im Browser, je Bauteil und bei drei Fensterbreiten: Container-Maße
      per `getBoundingClientRect`, `naturalWidth`/`naturalHeight` des Bildes,
      daraus `s = min(bw/nw, bh/nh)` und der tatsächlich fehlende Anteil je
      Kante. Der Ist-Zustand MUSS die Verluste aus der Tabelle im Proposal
      zeigen — sonst misst die Probe die falsche Eigenschaft.
- [x] 1.2 Ein Fixture je Sorte: genau 3:1, ~2,7:1 (der Normalfall) und einer
      der vier Ausreißer unter 2,2:1.

## 2. Tests (RED vor GREEN)

- [x] 2.1 Struktur: die drei Bildfelder tragen 3:1. Ausdrücklich als
      strukturelle Zusage benannt — jsdom kann Einpassung nicht belegen.
- [x] 2.2 Struktur: der Profilkopf trägt keine feste Höhe mehr.
- [x] 2.3 Struktur: der Platzhalter-Verlauf liegt **auch dann** im Baum, wenn
      ein Bild vorhanden ist, und unter ihm.
- [x] 2.4 Die Datumsmarke hängt am Feld, nicht am Bild — auch mit freier
      Fläche.

## 3. Umsetzung

- [x] 3.1 `ProfileHero.tsx` — Feld auf 3:1, Höhenstufen raus, Einpassung, der
      Akzent-Verlauf bleibt als Untergrund stehen.
- [x] 3.2 `EventCover.tsx` — Kachel von 16:9 auf 3:1; Kopf bleibt 3:1;
      Einpassung; der Verlauf wandert aus dem „kein Bild"-Zweig unter das Bild.
- [x] 3.3 Die Kommentare in beiden Dateien fortschreiben: der Teil über
      `object-cover` und über die Höhenstufen beschreibt nach dieser Änderung
      nicht mehr den Code.

## 4. Abnahme

Belege: `MESSUNG.md` in diesem Ordner.

- [x] 4.1 Dieselbe Messung wie 1.1, nachher. Kein fehlender Anteil an keiner
      Kante, bei keiner der drei Breiten, für alle drei Fixtures.
- [x] 4.2 Sichtprobe: sieht der Rand beim 2,7:1-Normalfall nach Rahmung aus
      oder nach Fehler? Das ist eine Geschmacksfrage und geht an Donald, nicht
      an einen Test. — Abgenommen von Donald am 25.08.: Event-Felder auf 3:1
      und der Profilkopf ohne Deckel bleiben so.
- [x] 4.3 `pnpm test` grün, `tsc` sauber, `eslint` ohne Fehler.
- [x] 4.4 Mindestens eine Mutation je neuem Test.
