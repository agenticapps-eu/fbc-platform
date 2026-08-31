# Tasks — `titelbild-anforderung-nachziehen`

Dieser Change fasst **keinen Code** an. Die Arbeit ist das Nachmessen; das
Ergebnis ist ein `MODIFIED`-Block, der wieder stimmt.

## 1. Jede Klausel gegen die Wirklichkeit lesen

Ein `MODIFIED`-Block stellt die Anforderung ganz neu aus — jede stehengelassene
Zeile erscheint unter neuem Datum. Deshalb wird nicht nur das Geänderte
geprüft, sondern alles.

- [x] Beide Zuschneider legen Cover auf `aspect = 3`, `outWidth = 1500`
      (`ProfilPage.tsx:463-464`, `EventCoverPicker.tsx:156-157`)
- [x] Profilkopf trägt `aspect-[3/1]` (`ProfileHero.tsx:88`) und **keinen**
      Höhendeckel — `grep max-h|maxHeight` ist dort leer, der AGE-566-Rückbau
      steht also noch
- [x] Event-Kachel und Event-Kopf über `EventCover.tsx:45` auf `aspect-[3/1]`
- [x] Beide Zuschnitt-Vorschauen auf `aspect-[3/1]` + `object-contain`
      (`ProfilPage.tsx:304,311`, `EventCoverPicker.tsx:119,121`)
- [x] Verzeichnis-Karte auf `aspect-[3/1]` + `object-contain`
      (`MemberDirectory.tsx:720,723`) und Material aus `covers`
      (`MemberDirectory.tsx:691`)
- [x] Feed auf `aspect-[3/1]`, aber `object-cover` (`CommunityFeed.tsx:1351`);
      Material über `signEventCovers` aus `event-covers`
      (`CommunityFeed.tsx:222-233`)
- [x] Seed schneidet an **beiden** Aufrufstellen zu
      (`import_world_seed.ts:700`, `demo_event_covers.ts:145`,
      `event_cover_zuschnitt.ts:38-39` → 1500 × 500)
- [x] Beide Seed-Stellen schicken `x-upsert: false`
      (`demo_event_covers.ts:97`, `import_world_seed.ts:694`) — der Bestand
      wird also nicht ersetzt
- [x] Die 25-%-Zahl nachgerechnet: ein 1,50:1-Motiv füllt in einem 3:1-Feld die
      halbe Breite, also 25 % frei **je Seite**; bei 1,33:1 sind es 27,8 %
- [x] Bucket-Zahlen **nicht** nachgemessen — Zugang fehlt (nur `cparx` sichtbar,
      Infisical-Login braucht ein TTY). Deshalb als Stand 25.08. datiert statt
      neu behauptet

## 2. Das Delta schreiben

- [x] `MODIFIED`-Block aus dem Original erzeugt, damit die Szenarien nicht
      abschreiben werden
- [x] Alle **neun** Szenarientitel maschinell auf Zeichengleichheit geprüft
      (`diff` über die `#### Scenario:`-Zeilen — identisch)
- [x] Alle **15** Zeilen, die nur in der alten Fassung stehen, einzeln
      durchgegangen; alle gehören zu den vier bewusst ersetzten Absätzen
- [x] Für die verschwindenden Wendungen geprüft, ob sie anderswo hängen
      (`Werkzeug-Oberfläche`, `genau drei Bauteile`, `benannte Ausnahme`) —
      stehen ausschließlich in dieser Anforderung

## 3. Abnahme

- [x] `openspec validate --all` grün — 32 von 32
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` grün — 204 Dateien, 2259 Tests (der Change fasst keinen
      Code an; der Lauf belegt, dass er es auch wirklich nicht tut)
- [x] `git diff --stat` zeigt **ausschließlich** Dateien unter
      `openspec/changes/titelbild-anforderung-nachziehen/`

## 4. Archivieren und ausliefern

- [ ] `openspec archive titelbild-anforderung-nachziehen` — faltet das Delta in
      `openspec/specs/design-system/spec.md`
- [ ] Nach dem Falten: Aufzählung steht auf vier Bauteilen, die Vorschau-Klausel
      steht, der Feed ist die einzige Ausnahme, neun Szenarien unverändert
- [ ] PR, CI grün, mergen
