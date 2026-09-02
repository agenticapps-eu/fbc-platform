# Tasks

## 1. Grundlinie messen, bevor etwas umgebaut wird

> **BLOCKIERT — kein anmeldefähiges Konto auf DEV.** `/academy` steht hinter der
> Mitglieder-Wand, und seit dem Spiegel DEV ← PROD (AGE-576) sind **alle 72
> übernommenen Hashes neutralisiert** (`docs/demo-zugang.md`, Kopf). Das
> QA-Konto aus AGE-629 hat kein bekanntes Passwort; ein neues zu setzen bräuchte
> `SUPABASE_SERVICE_ROLE_KEY`, der in Infisical `dev` fehlt. Die Zahlen aus §1
> und §5 sind deshalb **nicht erhoben** — nicht vergessen, sondern verwehrt.
> Ersatzbeleg: die Grundlinie steht in Donalds Screenshot vom 01.09., und die
> Ursachen sind an Tests festgenagelt (§2–§4).

- [ ] 1.1 `/academy` im Browser auf **1280** und **1920** px aufnehmen, je mit
      Nachrichten-Leiste zu und offen. Notieren: Höhe einer Redaktionskachel,
      Breite des Videos, y-Position, an der die Filterspalte heute beginnt.
      Das ist die Zahl, gegen die „kleiner" und „seitenweit" nachher belegt
      werden — geschätzt zählt nicht.
- [ ] 1.2 Dieselbe Aufnahme auf **375** px: heutiger Zustand, waagerechter
      Überlauf gemessen (nicht geschätzt).

## 2. Die Reiterzeile bekommt den dritten Reiter

- [x] 2.1 RED: Zusage, dass die Reiterzeile „Alle", „Meine Academy" und
      „Redaktion" **in dieser Reihenfolge** trägt und „Alle" ausgewählt ist.
- [x] 2.2 RED: Zusage, dass **oberhalb** der Reiterzeile kein Block mit
      kuratierten Lektionen mehr steht.
- [x] 2.3 GREEN: den `<section>`-Block als dritten Reitereintrag führen.
      Die Konstante `ACADEMY_LESSONS` bleibt, wo sie ist.

## 3. Die Spalte umspannt die Seite

- [x] 3.1 RED: Zusage, dass die Spalte auf **jedem** der drei Reiter steht —
      heute fehlt sie auf „Meine Academy" ganz.
- [x] 3.2 GREEN: `FilterSpalte` aus `GeteilteVideos` herausziehen und um
      Reiterzeile **und** Reiterinhalt legen. `FilterSpalte` selbst wird nicht
      angefasst.
- [x] 3.3 Die Felder folgen dem aktiven Reiter: Suche und Sortierung auf
      „Alle"; auf „Redaktion" ein Satz, warum hier nicht gefiltert wird. Die
      Spalte bleibt in **allen** Fällen stehen (sonst springt die Breite um
      16rem).
- [x] 3.4 Zusage, dass der Suchbegriff weiterhin in der **Anfrage** landet und
      nicht in einer Nachfilterung. **Kein neues RED, und das ist der Punkt:**
      die Zusage steht seit AGE-629 in `AcademyPage.filter.test.tsx` und prüft
      die Argumente von `fetchFeed`. Sie ist durch das Hochziehen des Zustands
      grün geblieben — ein Regressionswächter, der gehalten hat, nicht eine
      neu geschriebene Zusage.

## 4. Die Kachel wird ein Streifen

- [x] 4.1 Zusage über die Anordnung — **am Quelltext, nicht am Baum.** jsdom
      rechnet kein Layout und wertet keine Containerabfragen aus; ein Test, der
      „stehen nebeneinander" am gerenderten Baum behauptete, wäre grün, ohne
      etwas zu messen. Geprüft wird die Entscheidung dahinter: Behälter statt
      Fenster, mit einer Verbiegungsprobe aus sechs erfundenen Fällen. Nötig,
      weil `kartenraster.test.ts` nur `grid-cols-N` kennt — ein `lg:flex-row`
      liefe an ihm vorbei. Die Anordnung selbst gehört in die Sichtprobe §5.
- [x] 4.2 GREEN: Kachel umbauen. Die Schwelle **nur** als `@[…]` schreiben —
      `kartenraster.test.ts` zählt `AcademyPage.tsx` zu den Kartenflächen und
      wird bei jedem Viewport-Präfix an einer Spaltenzahl rot.
- [x] 4.3 `VideoEmbed` bleibt unangetastet. Sein `max-w-2xl` trägt einen
      eigenen, dokumentierten Grund.

## 5. Sichtprobe gegen die Grundlinie aus §1

> **BLOCKIERT, gleicher Grund wie §1.** Was ohne Browser belegt ist: die
> Reiterfolge, dass die Redaktion nicht mehr über der Zeile steht, und dass die
> Spalte auf JEDEM Reiter steht (`AcademyPage.reiter.test.tsx`, 7 Zusagen, vor
> dem Bauen rot). Was **nicht** belegt ist: Höhen und Breiten in Pixeln, also
> genau die Aussage „die Kachel ist flacher". Die gehört nachgeholt, sobald ein
> Konto anmeldefähig ist.

- [ ] 5.1 Dieselben vier Aufnahmen wie in §1.1, Zahlen danebengestellt.
      Belegen: die Kachel ist **flacher** als vorher, und die Spalte beginnt
      auf Höhe der Reiterzeile.
- [ ] 5.2 375 px: Überlauf weiterhin 0, Spalte zugeklappt im Fluss.
- [ ] 5.3 Alle drei Reiter durchklicken, je mit Leiste zu und offen.

## 6. Vor dem Archivieren

- [x] 6.1 Jede Klausel der beiden `MODIFIED`-Blöcke am Code nachgelesen, keine
      Abweichung. **Zwei Reiter:** die Reiterzeile führt „Alle" und „Meine
      Academy" neben „Redaktion"; kein eigenes Datenmodell und kein zweites
      Sichtbarkeitsprädikat (`fetchFeed({ nurVideos: true })` unverändert);
      Keyset-Blätterung über `useInfiniteQuery` mit `FeedCursor`; der
      unterscheidende leere Zustand steht weiter an beiden Regalen von
      `MeineAcademy`. **Spalte:** Masse und Umbruch kommen unverändert aus
      `FilterSpalte` (nicht angefasst); sie umspannt jetzt Reiterzeile und
      Inhalt; Volltextfeld, Hashtag-Facette und Sortierung stehen in
      `AcademyFilter`, die Facettenkarte rendert bei leerem Bestand nicht; die
      Ordnungen sind weiter die der Feed-Schicht.
- [x] 6.2 `REMOVED` klauselweise gegen die neue Anforderung gehalten: alle vier
      erhaltenswerten Klauseln stehen wörtlich in „Die Redaktion ist der dritte
      Reiter und ihre Kachel ein Streifen" (feste Liste im Code; kein
      Selbst-Hosten; Einwilligungstor ohne Ausnahme; Konstante statt Datenbank
      samt Begründung), ebenso die beiden fortbestehenden Szenarien. Entfallen
      ist allein die Ortsangabe „oben".
- [x] 6.3 `openspec validate --all` grün — 31/31.
- [x] 6.4 Code-Review auf dem **Diff**. Drei Befunde, alle behoben:
      (a) **Ein bestehender Test wurde durch diesen Change still schwächer.**
      `MembershipGate.test.tsx` belegte „anon sieht die Academy nicht" am Titel
      einer kuratierten Lektion — der liegt jetzt hinter einem Reiter und fehlte
      damit auch dann, wenn die Seite sehr wohl gerendert hätte. Beide Fälle
      messen jetzt an der Reiterzeile, die der Seite selbst gehört.
      (b) **Zwei Aufgaben waren zu großzügig abgehakt** (3.4, 4.1) — für den
      Streifen gab es gar keinen Test. Nachgetragen als Quelltext-Wächter mit
      Verbiegungsprobe, weil `kartenraster.test.ts` nur `grid-cols-N` kennt und
      ein `lg:flex-row` an ihm vorbeiliefe.
      (c) **Die Verneinung des neuen Wächters hatte zuerst keine
      Positivkontrolle.** Beim Nachrüsten fiel auf, dass der Treffer das
      führende Zeichen mitschleppte (`"lg:flex-row`) — dieselbe Falle, die
      `kartenraster.test.ts` beschreibt. Behoben über eine Fanggruppe.
      Geprüft und ohne Befund: keine `mitFilter`-Reste, `Card` bringt keine
      eigenen Fluss-Klassen mit (kein Konflikt mit `flex-col`), die drei übrigen
      `Tabs`-Aufrufer bleiben ungesteuert.
- [x] 6.5 **2353 Tests in 215 Dateien** grün; `typecheck` Exit 0, `lint` Exit 0.
- [ ] 6.6 `openspec archive` — **die einzige Kontrolle**, die eine kaputte
      Szenario-Zuordnung fängt. `yes y | …`, danach am Dateisystem prüfen.

## Nicht in diesem Change

- Migrationen, RLS, Rechte, Sichtbarkeit.
- Ein Kurs-/Lektionsschema (AGE-262).
- Die Facetten und Ordnungen selbst — sie wechseln nur den Platz.
- Der allgemeine Deckel von `VideoEmbed`.
