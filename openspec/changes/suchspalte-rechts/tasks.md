## 1. Das Raster folgt seinem Behälter

- [ ] 1.1 RED: Test, der die Spaltenzahl an **Behälterbreiten** prüft, nicht an
      Fensterbreiten — bei 409 px eine Spalte, bei 657 px und 873 px drei, bei
      1376 px weiterhin drei. Muss vor der Umstellung fehlschlagen.
- [ ] 1.2 `MemberDirectory.tsx:554` und `:658` — Behälter auf `@container`,
      Raster auf `grid-cols-1 @[27rem]:grid-cols-2 @[41rem]:grid-cols-3`.
- [ ] 1.3 `EventsList.tsx:143` — dasselbe. Den Kommentarkopf von `CardGrid`
      nachziehen: die Meeting-Entscheidung „drei Kacheln" bleibt, nur ihr
      Auslöser wechselt.
- [ ] 1.4 `AcademyPage.tsx:72` und `:273` — `grid-cols-1 @[35rem]:grid-cols-2`,
      Deckel 2.
- [ ] 1.5 GREEN, und `pnpm vitest run src/components/ui/schmale-geraete.test.ts`
      bleibt grün (der Wächter gegen feste Spaltenbreiten).

## 2. Die Spalte auf `/mitglieder`

- [ ] 2.1 RED: Test, dass Suchfeld und Facetten ab `lg` in der rechten Spalte
      stehen und die erweiterten Filter offen sind.
- [ ] 2.2 Raster `lg:grid-cols-[minmax(0,1fr)_16rem]` mit `gap-6`, Spalte mit
      den Sticky-Klassen aus `CommunityFeed.tsx:334`, Aufklapper aus `:561`.
- [ ] 2.3 Erweiterte Filter dauerhaft offen; das bisherige Zuklappen entfällt
      nur ab `lg`.
- [ ] 2.4 GREEN.

## 3. Die Spalte auf `/events`

- [ ] 3.1 RED: Test, dass die Art-Facette genau die Werte aus
      `events_type_check` anbietet. Der Test SHALL den Constraint lesen
      (Migration oder Katalog), nicht die Liste gegen sich selbst prüfen.
- [ ] 3.2 Feste Art-Liste aus dem Constraint, Themen-Facette aus dem Bestand,
      Volltext über Titel · Beschreibung · Ort.
- [ ] 3.3 Spalte wie 2.2. Suche und Facetten wirken **innerhalb** des gewählten
      Reiters.
- [ ] 3.4 RED→GREEN: eine Facette ohne Werte rendert nicht, Volltextfeld steht
      trotzdem.

## 4. Die Spalte auf `/academy`

- [ ] 4.1 RED: Test, dass ohne Hashtags im Bestand keine Hashtag-Karte
      erscheint, Volltextfeld und Sortierung aber stehen.
- [ ] 4.2 Volltext über den Beitragstext, Hashtag-Facette aus dem Bestand.
- [ ] 4.3 Sortierung über die **vorhandenen** Ordnungen von `fetchFeed`
      („Neueste", „Beliebteste"). Keine eigene Ordnung, kein zweiter
      Cursorvertrag.
- [ ] 4.4 Die drei kuratierten Lektionen bleiben oberhalb der geteilten Videos.
- [ ] 4.5 GREEN.

## 5. Abnahme im Browser (qa-Gate)

Die Spaltenzahlen sind CSS; jsdom kann sie nicht messen. Abgenommen wird an
denselben Breiten wie die Ausgangsmessung, je Fläche, und die **gemessenen
Zahlen werden hier eingetragen** — nicht „sieht gut aus".

- [ ] 5.1 `/mitglieder`, `/events`, `/academy` bei 1024 · 1280 · 1440 · 1920 px,
      je mit Chat-Leiste eingeklappt und offen.
- [ ] 5.2 Gegenprobe, dass **kein heutiger Zustand** sich geändert hat:
      1009→3×219, 1265 eingekl.→3×280, 1265 offen→3×208, 1425→3×334,
      1905→3×448.
- [ ] 5.3 Kein waagerechter Überlauf auf 375 px (`scrollWidth` allein genügt
      nicht — im Bild ansehen).
- [ ] 5.4 Gemessene Werte in diesen Abschnitt eintragen.

## 6. Vor dem Archivieren

- [ ] 6.1 Jede Klausel der beiden `MODIFIED`-Blöcke erneut am Code nachlesen —
      ein `MODIFIED` bekräftigt alle Klauseln unter neuem Datum, nicht nur die
      geänderte.
- [ ] 6.2 `openspec validate --all` grün.
- [ ] 6.3 Code-Review auf dem **Diff** (nicht auf dem Plan).
- [ ] 6.4 `pnpm vitest run` vollständig grün, Zahl notieren.

## Nicht in diesem Change

- Migrationen, RLS, Rechte, Sichtbarkeit. `supabase/` wird nicht angefasst —
  eine parallele Sitzung arbeitet dort an AGE-642.
- Kapazitäts-, Partner- und Zeitraum-Facetten.
- Umbau der beiden angedockten Leisten.
