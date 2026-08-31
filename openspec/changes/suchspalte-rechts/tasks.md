## 1. Das Raster folgt seinem Behälter

- [x] 1.1 RED: Test, der die Spaltenzahl an **Behälterbreiten** prüft, nicht an
      Fensterbreiten — bei 409 px eine Spalte, bei 657 px und 873 px drei, bei
      1376 px weiterhin drei. Muss vor der Umstellung fehlschlagen.
- [x] 1.2 `MemberDirectory.tsx:554` und `:658` — Behälter auf `@container`,
      Raster auf `grid-cols-1 @[27rem]:grid-cols-2 @[41rem]:grid-cols-3`.
- [x] 1.3 `EventsList.tsx:143` — dasselbe. Den Kommentarkopf von `CardGrid`
      nachziehen: die Meeting-Entscheidung „drei Kacheln" bleibt, nur ihr
      Auslöser wechselt.
- [x] 1.4 `AcademyPage.tsx:72` und `:273` — `grid-cols-1 @[35rem]:grid-cols-2`,
      Deckel 2.
- [x] 1.5 GREEN, und `pnpm vitest run src/components/ui/schmale-geraete.test.ts`
      bleibt grün (der Wächter gegen feste Spaltenbreiten).
- [x] 1.6 **Nicht geplant, beim Umbau gefunden:** der Filterblock
      (`MemberDirectory:216` und die verschachtelte Chip-Gruppe `:292`) trug
      dieselben Viewport-Schwellen — und genau er zieht in die 16rem-Spalte,
      wo `lg:grid-cols-3` drei Felder zu je 74 px ergäbe. Mit umgestellt, samt
      der drei `col-span`-Spannweiten, die sonst über Spalten spannten, die es
      nicht mehr gibt.

### Gemessen nach dem Umbau (31.08., Browser, `/events` und `/academy`)

**Kein heutiger Zustand hat sich geändert:**

| Fenster | Inhalt | `/events` vorher → nachher |
| --- | --- | --- |
| 1009 | 689 | 3 × 219 → 3 × 219 |
| 1265, Chat eingekl. | 873 | 3 × 280 → 3 × 280 |
| 1265, Chat offen | 657 | 3 × 208 → 3 × 208 |
| 1905, Chat eingekl. | 1376 | 3 × 448 → 3 × 448 |
| 1905, Chat offen | 1297 | 3 × 422 → 3 × 422 |

**Die verengten Fälle sind repariert:**

| Fenster + Suchspalte | Inhalt | vorher → nachher |
| --- | --- | --- |
| 1009 | 409 | 3 × 126 → **1 × 409** |
| 1265, Chat eingekl. | 593 | 3 × 187 → **2 × 289** |
| 1265, Chat offen | 377 | 3 × 115 → **1 × 377** |

`/academy`, Deckel 2, beide Regale gleich: 873 → 2 × 425, 657 → 2 × 317,
1024 → 2 × 333 (unverändert), mit Spalte 377 → 1 × 377. Überlauf überall 0.

**Deckel-Probe bestanden:** 1376 px Behälter → drei Kacheln, nicht sechs. Genau
dafür wurde `auto-fill` verworfen.

**Korrektur an der Ausgangsmessung:** die Randbemerkung, `xl` greife bei 1280 px
mit Scrollbar nicht, war falsch. `matchMedia` misst `window.innerWidth` (1280),
das Layout `clientWidth` (1265) — die Leiste dockt an. Die Breitenzahlen bleiben
richtig, die Aussage über die Kante nicht.

## 2. Die Spalte auf `/mitglieder`

- [x] 2.1 RED: Test, dass Suchfeld und Facetten ab `lg` in der rechten Spalte
      stehen und die erweiterten Filter offen sind.
- [x] 2.2 Raster `lg:grid-cols-[minmax(0,1fr)_16rem]` mit `gap-6`, Spalte mit
      den Sticky-Klassen aus `CommunityFeed.tsx:334`, Aufklapper aus `:561`.
- [x] 2.3 Erweiterte Filter dauerhaft offen; das bisherige Zuklappen entfällt
      nur ab `lg`.
- [x] 2.4 GREEN.

## 3. Die Spalte auf `/events`

- [x] 3.1 RED: Test, dass die Art-Facette genau die Werte aus
      `events_type_check` anbietet. Der Test SHALL den Constraint lesen
      (Migration oder Katalog), nicht die Liste gegen sich selbst prüfen.
- [x] 3.2 Feste Art-Liste aus dem Constraint, Themen-Facette aus dem Bestand,
      Volltext über Titel · Beschreibung · Ort.
- [x] 3.3 Spalte wie 2.2. Suche und Facetten wirken **innerhalb** des gewählten
      Reiters.
- [x] 3.4 RED→GREEN: eine Facette ohne Werte rendert nicht, Volltextfeld steht
      trotzdem.

## 4. Die Spalte auf `/academy`

- [x] 4.1 RED: Test, dass ohne Hashtags im Bestand keine Hashtag-Karte
      erscheint, Volltextfeld und Sortierung aber stehen.
- [x] 4.2 Volltext über den Beitragstext, Hashtag-Facette aus dem Bestand.
- [x] 4.3 Sortierung über die **vorhandenen** Ordnungen von `fetchFeed`
      („Neueste", „Beliebteste"). Keine eigene Ordnung, kein zweiter
      Cursorvertrag.
- [x] 4.4 Die drei kuratierten Lektionen bleiben oberhalb der geteilten Videos.
- [x] 4.5 GREEN.

## 5. Abnahme im Browser (qa-Gate)

Die Spaltenzahlen sind CSS; jsdom kann sie nicht messen. Abgenommen wird an
denselben Breiten wie die Ausgangsmessung, je Fläche, und die **gemessenen
Zahlen werden hier eingetragen** — nicht „sieht gut aus".

- [x] 5.1 `/mitglieder`, `/events`, `/academy` bei 1024 · 1280 · 1440 · 1920 px,
      je mit Chat-Leiste eingeklappt und offen.
- [ ] 5.2 Gegenprobe, dass **kein heutiger Zustand** sich geändert hat:
      1009→3×219, 1265 eingekl.→3×280, 1265 offen→3×208, 1425→3×334,
      1905→3×448.
- [x] 5.3 Kein waagerechter Überlauf auf 375 px (`scrollWidth` allein genügt
      nicht — im Bild ansehen).
- [ ] 5.4 Gemessene Werte in diesen Abschnitt eintragen.

### Sichtprobe an den echten Spalten (31.08.)

`/events` bei 1265 px: Spalte 256 px, Listenspalte **593 px**, Karten **2 × 289**,
Ueberlauf 0. Die vier Sticky-Bedingungen greifen alle — `position: sticky`,
`top: 80px`, `align-self: flex-start`, `max-height` + `overflow-y: auto`. Der
Aufklapper ist ab `lg` ausgeblendet, die Filterflaeche sichtbar.

`/events` und `/academy` bei 375 px: Spalte im Fluss, zugeklappt, Karten
1 × 343, Ueberlauf **0**.

**Dabei einen echten Fehler gefunden — im Bild, nicht im Test.** Bei 375 px lief
das Dokument um **31 px** zur Seite: das Raster der `FilterSpalte` hatte
unterhalb von `lg` nur eine implizite `auto`-Spalte, und die waechst auf
`max-content`; beide Kinder wurden 389 px breit in einem 343-px-Behaelter.
Behoben mit `grid-cols-1` als Grundfall (Tailwind setzt das als
`minmax(0, 1fr)`). 2315 gruene Tests sahen das nicht.

Ein zweiter Kandidat war keiner: der dritte Reiter steht rechts heraus, sitzt
aber in einer Leiste mit `overflow-x: auto` und schiebt das Dokument nicht.
Bestehendes Verhalten der `Tabs`.

**Positivkontrolle zur Facettenregel:** auf DEV rendert die Hashtag-Karte der
Academy (dort gibt es Hashtags), auf der Datenlage der Produktion nicht — der
leere Fall ist als Unit-Test belegt, der volle im Bild. Ein Negativbefund allein
haette nicht unterschieden, ob die Karte fehlt oder die Facette kaputt ist.

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
