# Suche und Filter stehen jetzt rechts und laufen beim Blättern mit

Linear: **AGE-629**

## Why

AGE-629. Suche und Filter stehen heute über der Liste und nehmen dem Inhalt
Höhe; auf `/events` und `/academy` gibt es sie gar nicht. Sie sollen in eine
rechte, mitlaufende Inhaltsspalte ziehen — wie auf `/aktivitaet`.

Die Messung am 31.08. gegen `63f3237` hat gezeigt, dass das so nicht baubar ist:
alle drei Kartenraster schalten ihre Spaltenzahl am **Viewport**
(`sm:grid-cols-2 lg:grid-cols-3`), nicht an der Breite ihrer eigenen Spalte. Eine
rechte Spalte kostet 280 px, das Raster merkt davon nichts und bleibt
dreispaltig. Gemessen: bei 1024 px schrumpfen die Karten auf **126 px**, bei
1280 px mit offener Chat-Leiste auf **115 px** — beides unter den ~128 px, die
AGE-627 bereits ausdrücklich verworfen hat („Namen auf EIN Zeichen gekürzt").

Der Mangel besteht schon heute, ohne diese Änderung: bei 1280 px mit offener
Chat-Leiste liefert die Anwendung 208-px-Karten, weil drei Spalten in eine
Fläche gezwungen werden, die keine drei trägt.

## What Changes

- **Die Kartenraster folgen ihrer Spalte statt dem Fenster.** Fünf
  Rasterdefinitionen bekommen einen `@container`-Behälter und Schwellen in
  Containerbreiten. Die Schwellen sind so gewählt, dass **jeder heute
  ausgelieferte Zustand unverändert bleibt**; nur die durch eine rechte Spalte
  verengten Fälle brechen um, statt sich zu quetschen.
- **`/mitglieder`**: die vorhandene Suche samt Facetten zieht in die rechte
  Spalte; die erweiterten Filter stehen dort dauerhaft offen statt zugeklappt.
- **`/events`**: neue rechte Spalte mit Volltextsuche (Titel · Beschreibung ·
  Ort), Facette **Art** aus den fünf Werten des `events_type_check`-Constraints
  und Facette **Themen** aus dem Bestand.
- **`/academy`**: neue rechte Spalte mit Volltextsuche über den Beitragstext,
  Facette **Hashtags** aus dem Bestand und Sortierung (Neueste · Beliebteste).
- **Eine Facettenkarte ohne Werte rendert nicht** — das ist bereits das Muster
  der `/aktivitaet`-Spalte und wird übernommen, nicht erfunden. Suche und
  Sortierung stehen dagegen immer, damit jede Spalte auf jeder Datenlage trägt.
- **Ein Test bindet die feste Art-Liste an den CHECK-Constraint.** Weichen sie
  voneinander ab, wird er rot; die Liste kann nicht still auslaufen, wenn jemand
  einen sechsten Typ migriert.

Keine Änderung an Migrationen, RLS, Rechten oder Sichtbarkeit. Die Spalten
filtern ausschließlich, was der Aufrufer ohnehin schon sehen darf.

## Capabilities

### New Capabilities

Keine. Alle vier betroffenen Fähigkeiten bestehen bereits.

### Modified Capabilities

- `design-system`: neue Anforderung, dass ein Kartenraster seine Spaltenzahl an
  der Breite seines Behälters bemisst und eine Untergrenze je Karte einhält,
  statt sie am Viewport zu schalten.
- `directory-search`: die Suche und ihre Facetten stehen in der rechten
  Inhaltsspalte statt über der Liste; erweiterte Filter dauerhaft offen.
- `events`: die Eventliste bekommt Suche, Facetten und eine rechte Spalte. Die
  bestehende Anforderung „The events overview shows three tiles per row" wird auf
  die Spaltenbreite umgestellt.
- `academy-library`: die Academy bekommt Suche, Hashtag-Facette und Sortierung in
  einer rechten Spalte.

## Impact

**Code**

- `src/components/community/MemberDirectory.tsx` — Suche/Filter in die Spalte,
  Raster (2 Stellen)
- `src/components/events/EventsList.tsx` — neue Spalte, Raster (1 Stelle)
- `src/pages/AcademyPage.tsx` — neue Spalte, Raster (2 Stellen)
- neue Tests je Fläche; ein Test gegen `events_type_check`

**Nicht betroffen**

- `supabase/` — keine Migration. (Eine parallele Sitzung arbeitet dort an
  AGE-642; dieser Change fasst das Verzeichnis nicht an.)
- Rechte, RLS, Sichtbarkeit, `profiles_public`.

**Bekannte Grenze**

Auf PROD stehen heute 1 künftiges Event mit einem einzigen `type`-Wert und
1 Video ohne Hashtags. Die Facettenkarten dort werden also zunächst leer bleiben
und nicht rendern; Suche und Sortierung tragen die Spalten bis dahin. Das ist
gemessen und bewusst so entschieden (Donald, 31.08.).
