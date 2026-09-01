# Tasks

## 1. Grundlinie messen, bevor etwas umgebaut wird

- [ ] 1.1 `/academy` im Browser auf **1280** und **1920** px aufnehmen, je mit
      Nachrichten-Leiste zu und offen. Notieren: Höhe einer Redaktionskachel,
      Breite des Videos, y-Position, an der die Filterspalte heute beginnt.
      Das ist die Zahl, gegen die „kleiner" und „seitenweit" nachher belegt
      werden — geschätzt zählt nicht.
- [ ] 1.2 Dieselbe Aufnahme auf **375** px: heutiger Zustand, waagerechter
      Überlauf gemessen (nicht geschätzt).

## 2. Die Reiterzeile bekommt den dritten Reiter

- [ ] 2.1 RED: Zusage, dass die Reiterzeile „Alle", „Meine Academy" und
      „Redaktion" **in dieser Reihenfolge** trägt und „Alle" ausgewählt ist.
- [ ] 2.2 RED: Zusage, dass **oberhalb** der Reiterzeile kein Block mit
      kuratierten Lektionen mehr steht.
- [ ] 2.3 GREEN: den `<section>`-Block als dritten Reitereintrag führen.
      Die Konstante `ACADEMY_LESSONS` bleibt, wo sie ist.

## 3. Die Spalte umspannt die Seite

- [ ] 3.1 RED: Zusage, dass die Spalte auf **jedem** der drei Reiter steht —
      heute fehlt sie auf „Meine Academy" ganz.
- [ ] 3.2 GREEN: `FilterSpalte` aus `GeteilteVideos` herausziehen und um
      Reiterzeile **und** Reiterinhalt legen. `FilterSpalte` selbst wird nicht
      angefasst.
- [ ] 3.3 Die Felder folgen dem aktiven Reiter: Suche und Sortierung auf
      „Alle"; auf „Redaktion" ein Satz, warum hier nicht gefiltert wird. Die
      Spalte bleibt in **allen** Fällen stehen (sonst springt die Breite um
      16rem).
- [ ] 3.4 RED→GREEN: Zusage, dass der Suchbegriff weiterhin in der **Anfrage**
      landet und nicht in einer Nachfilterung — die Zusage aus AGE-629 darf
      beim Verschieben nicht verlorengehen.

## 4. Die Kachel wird ein Streifen

- [ ] 4.1 RED: Zusage, dass ab der Behälter-Schwelle Video und Text
      **nebeneinander** stehen, darunter gestapelt.
- [ ] 4.2 GREEN: Kachel umbauen. Die Schwelle **nur** als `@[…]` schreiben —
      `kartenraster.test.ts` zählt `AcademyPage.tsx` zu den Kartenflächen und
      wird bei jedem Viewport-Präfix an einer Spaltenzahl rot.
- [ ] 4.3 `VideoEmbed` bleibt unangetastet. Sein `max-w-2xl` trägt einen
      eigenen, dokumentierten Grund.

## 5. Sichtprobe gegen die Grundlinie aus §1

- [ ] 5.1 Dieselben vier Aufnahmen wie in §1.1, Zahlen danebengestellt.
      Belegen: die Kachel ist **flacher** als vorher, und die Spalte beginnt
      auf Höhe der Reiterzeile.
- [ ] 5.2 375 px: Überlauf weiterhin 0, Spalte zugeklappt im Fluss.
- [ ] 5.3 Alle drei Reiter durchklicken, je mit Leiste zu und offen.

## 6. Vor dem Archivieren

- [ ] 6.1 Jede Klausel der beiden `MODIFIED`-Blöcke am Code nachlesen — ein
      `MODIFIED` bekräftigt alle Klauseln unter neuem Datum, nicht nur die
      geänderte.
- [ ] 6.2 Den `REMOVED`-Block klauselweise gegen die neue Anforderung halten:
      trägt sie **jede** Klausel, die wahr geblieben ist? Die Tabelle dafür
      steht in `design.md`.
- [ ] 6.3 `openspec validate --all` grün.
- [ ] 6.4 Code-Review auf dem **Diff**.
- [ ] 6.5 `pnpm vitest run` vollständig grün, Zahl notieren; dazu `typecheck`
      und `lint` je mit Exit-Code.
- [ ] 6.6 `openspec archive` — **die einzige Kontrolle**, die eine kaputte
      Szenario-Zuordnung fängt. `yes y | …`, danach am Dateisystem prüfen.

## Nicht in diesem Change

- Migrationen, RLS, Rechte, Sichtbarkeit.
- Ein Kurs-/Lektionsschema (AGE-262).
- Die Facetten und Ordnungen selbst — sie wechseln nur den Platz.
- Der allgemeine Deckel von `VideoEmbed`.
