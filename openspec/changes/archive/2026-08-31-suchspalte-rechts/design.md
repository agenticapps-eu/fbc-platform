## Context

AGE-629, gemessen am 31.08. gegen `63f3237` im Browser (angemeldetes Konto,
Chrome-DevTools mit `emulate`).

Drei Flächen sollen eine rechte, mitlaufende Spalte für Suche und Filter
bekommen. Das Muster dafür ist **fertig vorhanden** — `CommunityFeed.tsx:313`
(Raster), `:334` (Sticky-Klassen) und `:561` (Aufklapper unterhalb `lg`). Es
abzuschreiben ist der einfache Teil.

Der schwierige Teil ist das Breitenbudget. Der Ist-Zustand, gemessen:

| Fenster (client) | Inhaltsbreite | Karten heute |
| --- | --- | --- |
| 1009 | 689 | 3 × 219 |
| 1265, Chat eingeklappt | 873 | 3 × 280 |
| 1265, Chat offen | 657 | 3 × 208 |
| 1425, Chat eingeklappt | 1033 | 3 × 334 |
| 1905 | 1376 (gedeckelt) | 3 × 448 |

`main` ist bei 1280 px Fenster nur **1265 px** breit — 15 px Scrollbar-Gutter.
Die rechte Spalte kostet **280 px** (16rem + `gap-6`), gemessen: 1545 px mit
Spalte liefert dieselbe Kartenbreite wie 1265 px ohne sie.

Alle drei Raster schalten am **Viewport** (`sm:grid-cols-2 lg:grid-cols-3`).
Mit Spalte fallen die Karten deshalb auf 126 px (1009) bzw. 115 px (1265, Chat
offen) — unter die ~128 px, die AGE-627 verworfen hat.

## Goals / Non-Goals

**Goals:**

- Jede der drei Flächen bekommt eine rechte Spalte, die auf jeder Datenlage
  trägt.
- Kein heute ausgelieferter Zustand ändert sich.
- Die Untergrenze je Karte ist eine gemessene Zahl, keine Meinung.
- Die feste Art-Liste kann nicht still vom Schema abdriften.

**Non-Goals:**

- Keine Migration, keine RLS-, Rechte- oder Sichtbarkeitsänderung. Die Spalten
  filtern nur, was der Aufrufer ohnehin sieht.
- Kein Umbau der angedockten Leisten (Navigation links, Nachrichten rechts).
- Keine Kapazitäts- oder Partner-Facette (auf PROD **und** DEV durchgehend
  leer).
- Keine Zeitraum-Facette auf `/events` — die Reiter leisten das bereits.
- Die drei kuratierten Academy-Lektionen bleiben, wo sie sind.

## Decisions

### 1 · Container-Schwellen, nicht `auto-fill`

**Gewählt:** `@container` auf dem Behälter, Schwellen in Containerbreiten:

| Fläche | neu | Deckel |
| --- | --- | --- |
| `MemberDirectory:554/658`, `EventsList:143` | `grid-cols-1 @[27rem]:grid-cols-2 @[41rem]:grid-cols-3` | 3 |
| `AcademyPage:72/273` | `grid-cols-1 @[35rem]:grid-cols-2` | 2 |

Die Schwellen sind gerechnet, nicht gewählt: 41rem = 3 × 208 px + 2 × 16 px
Abstand; 27rem = 2 × 208 px + 16 px. 208 px ist die schmalste heute
ausgelieferte Karte.

**Verworfen: `repeat(auto-fill, minmax(13rem, 1fr))`.** Im Browser probiert und
es tat bei 1024 und 1280 px genau das Richtige — aber es wächst nach oben
unbegrenzt. Bei 1905 px trägt die Inhaltsspalte 1376 px, und `auto-fill` machte
daraus **sechs** Spalten statt drei. Eine Dichteänderung auf breiten Schirmen
war nicht bestellt, und „drei Kacheln je Reihe" ist eine Meeting-Entscheidung
(03.08., AGE-531). `auto-fill` kennt keinen Deckel; Container-Schwellen schon.

**Verworfen: Breakpoints nur nachjustieren.** Ein Viewport-Breakpoint kann die
Spaltenbreite grundsätzlich nicht kennen — dieselbe Fensterbreite trägt je nach
Zustand der beiden Leisten 657 oder 1057 px Inhalt. Jede Nachjustierung wäre für
einen der Zustände falsch.

Tailwind 4 bringt `@container` ohne Zusatzpaket mit; im Repo ist es heute an
keiner Stelle im Einsatz (0 Treffer in `src/`). Der Wächter aus
`schmale-geraete.test.ts` greift nur bei `grid-cols-[…]` ohne
Breakpoint-Präfix und wird von diesen Klassen nicht berührt.

### 2 · Feste Liste, wo das Schema eine hat; abgeleitet, wo nicht

Entscheidung Donald, 31.08. `events.type` bekommt die fünf Werte aus
`events_type_check` (`online`, `presence`, `dinner`, `workshop`, `mastermind`)
fest verdrahtet. Hashtags und `events.topics` sind Freitext ohne Schema-Liste
und werden aus dem Bestand abgeleitet.

Der Einwand gegen die feste Liste — sie läuft aus dem Ruder, sobald jemand einen
sechsten Typ migriert — wird nicht überstimmt, sondern **festgenagelt**: ein
Test liest den Constraint und vergleicht ihn mit der Liste. Weichen sie ab, ist
der Lauf rot.

### 3 · Eine leere Facettenkarte rendert nicht

Übernommen, nicht erfunden: `CommunityFeed.tsx:576` zeigt die Tag-Karte nur bei
`zaehler.length > 0`. Volltextfeld und Sortierung stehen dagegen immer. Damit
trägt jede Spalte auch auf dünnem Bestand — auf PROD stehen heute 1 künftiges
Event mit einem `type`-Wert und 1 Video ohne Hashtags.

### 4 · Die Academy-Sortierung wird freigelegt, nicht gebaut

`fetchFeed` führt bereits drei Ordnungen samt Keyset-Cursor, in „Beliebteste"
mit `like_count` im Cursor (`feed.ts:520`). Die Academy ist eine gefilterte
Sicht auf `posts` und erbt das. Eine eigene Ordnung hier hiesse, den
Cursorvertrag ein zweites Mal zu bauen — und AGE-655 und AGE-667 haben gezeigt,
was ein Cursor kostet, der nicht zur Ordnung passt.

## Risks / Trade-offs

- **Ein `MODIFIED` bekräftigt alle Klauseln seiner Anforderung.** Zwei Blöcke
  sind betroffen (`directory-search` Galerie-Karte, `events` Kacheln). Jede
  Klausel wurde vor dem Schreiben am Code nachgeprüft: `bildUrl("covers", …)`,
  `aspect-[3/1]` mit `object-contain`, `short_bio`, Branche,
  `offer_categories`/`need_categories` im RPC-Rückgabesatz, `registeredCount`
  aus `event_registration_counts`, Platzhalter gleicher Höhe. → Nachweis steht
  in tasks.md und wird vor dem Archivieren erneut gelesen.
- **Spaltenzahlen sind CSS und in jsdom nicht messbar.** Ein Test, der nur
  Klassenketten vergleicht, wäre ein Vakuumtest. → Die Zahlen werden im Browser
  abgenommen (qa-Gate) an denselben Breiten wie die Ausgangsmessung, und die
  gemessenen Werte kommen in den Change.
- **Die Spalte kostet 280 px, auch wenn sie wenig zeigt.** Auf PROD sind das
  heute ein Suchfeld und eine Sortierung. → Bewusst so entschieden; die
  Alternative (Flächen zurückstellen) wurde am 31.08. verworfen.
- **`@container` ist neu im Repo.** Der erste Einsatz eines Mechanismus ist die
  Stelle, an der man ihn falsch versteht. → Die Abnahme misst
  Behälterbreiten, nicht Fensterbreiten, und die Ausgangsmessung liefert die
  Vergleichszahlen für jeden Zustand.

## Open Questions

Keine offen. Die zwei Entscheidungen, die aussenstehend waren — Verhalten leerer
Facetten und Umgang mit Freitext-Facetten — sind am 31.08. entschieden.
