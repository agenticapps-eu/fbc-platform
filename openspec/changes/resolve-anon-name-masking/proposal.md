## Why

`directory-search/spec.md` führt seit AGE-239 die Anforderung **„Author name
masking is only partially resolved"**. Sie sagt, die anonyme Maskierung stehe,
das **stufenweise Auflösen von Namen nach Mitgliedsstufe** (AGE-291) sei aber
„pending and is not present in the code".

Der Rest davon ist inzwischen gebaut, und die Anforderung ist damit die einzige
Stelle, die AGE-291 noch offen hält. Vier Tage vor dem Go-Live ist zu
entscheiden, ob das Fehlende gebaut oder gestrichen wird — nicht, ob es weiter
als „pending" stehen bleibt. Eine Anforderung, die auf ein Vorhaben zeigt, das
niemand mehr verfolgt, ist keine laufende Wahrheit, sondern eine Notiz.

Entscheidung Donald, 2026-08-13: **gestrichen.** Die RLS gattert die Daten
bereits nach Stufe (`profiles_select_self_or_discover`, `has_level(3)`; Beiträge
`members` ab Rang 4). Eine Anzeige-Maskierung nach Stufe obendrauf wäre eine
zweite, schwächere Kopie derselben Grenze — Kulisse vor einem Gate, das schon
hält, und damit genau die Bauweise, vor der `profiles_public` warnt.

## What Changes

Reine Spec-Arbeit. **Kein Produktionscode, keine Migration, keine Testdatei** —
das Verhalten steht bereits vollständig und ist bereits festgenagelt:

- `src/lib/displayAuthor.ts` — Ausgeloggte sehen „Ein Mitglied" ohne Avatarbild.
  Festgenagelt in `displayAuthor.test.ts` (drei Fälle, Gegenprobe eingeloggt).
- `src/lib/feed.ts` `fetchAuthors` — ohne Session wird `profiles_public` gar
  nicht erst angefragt (AGE-530). Festgenagelt in `anon-anreicherung.test.ts`,
  und zwar **als Regel**: die Positivliste `ANON_DARF_LESEN` lässt ausgeloggt
  nur Relationen zu, die `anon` laut `20260715140000_explicit_grants.sql`
  überhaupt lesen darf. Ein vierter Verstoß fiele dort auf, ohne dass ihn jemand
  vorher erraten muss.
- `PublicHome` (`HomePage.tsx`) zeigt Gästen Events, öffentliche Beiträge,
  Testimonials und Kennzahlen — **keine Mitgliederliste**. Es gibt heute keine
  Fläche, auf der ein Gast einen Namen sähe.

Geändert wird deshalb nur, was der Spec behauptet:

- Die Anforderung „Author name masking is only partially resolved" **entfällt**.
- An ihre Stelle tritt eine Anforderung, die den erreichten Zustand als
  laufende Wahrheit führt und das stufenweise Auflösen **ausdrücklich als
  verworfen** benennt, mit Begründung — damit es nicht als vergessene Lücke
  wieder aufschlägt.
- Zusätzlich wird die Regel für **neue** anon-Flächen ausgesprochen: keine neue
  ausgeloggt erreichbare Fläche gibt Mitgliedsnamen preis. Das ist das
  Geländer, gegen das AGE-540 (Kopfzeilen-Suche) baut — dort ist entschieden,
  das Suchfeld für Ausgeloggte auszublenden, statt eine für `anon` lesbare
  DEFINER-RPC zu bauen.

**Kein BREAKING.** Nichts am Verhalten ändert sich.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `directory-search`: Die Anforderung zur Autor-Maskierung wird von „teilweise
  gelöst / stufenweises Auflösen ausstehend" auf „gelöst; stufenweises Auflösen
  verworfen" umgestellt, und die Regel für neue anon-Flächen kommt hinzu.

## Impact

**Betroffene Dateien:** ausschließlich `openspec/specs/directory-search/spec.md`
(beim Archivieren).

**Nicht betroffen:** kein Produktionscode, kein Test, keine Migration, keine
Edge Function. Das ist die zentrale Aussage dieses Changes und zugleich die
Behauptung, die die Aufgaben belegen müssen — nicht durch „es sieht so aus",
sondern indem die bestehenden Tests einmal rot gemacht und wieder grün gesehen
werden.

**Verwandt:** AGE-540 baut die Kopfzeilen-Suche und stützt sich auf das hier
festgeschriebene Geländer. Getrennter Change, getrennter Branch.

**Anschlussrisiko, benannt statt behoben:** `HomePage.tsx:81` trägt erfundene
Kennzahlen (`120+ Mitglieder`, `24 Events 2026`) und zwei erfundene
Testimonials. Dieselbe Klasse, die AGE-539 aus dem Profil geworfen hat, auf der
öffentlichen Startseite. Gehört nicht in diesen Change — hier steht es, damit es
nicht wieder verloren geht.
