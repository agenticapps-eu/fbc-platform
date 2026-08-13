## Why

`directory-search/spec.md` führt seit AGE-239 die Anforderung **„Author name
masking is only partially resolved"**. Sie sagt zwei Dinge, und **beide stimmen
nicht**:

1. Die anonyme Maskierung sei ein Rückfall auf den Namen „Mitglied", wenn eine
   Profilzeile nicht lesbar ist. Tatsächlich greift sie seit AGE-530 eine Ebene
   früher: ohne Session wird `profiles_public` **gar nicht erst angefragt**.
2. Das stufenweise Auflösen von Namen nach Mitgliedsstufe sei „pending". Es ist
   nicht nur ausstehend, sondern in einem **anderen, aktiven Change** geplant —
   `finish-ui-polish` trägt AGE-291 mit vier Aufgaben und baut den Resolver in
   der Datenbank.

Und die Anforderung verschweigt das, was heute wirklich gilt: **jedes aktivierte
Konto — auch ein frei registriertes `basic` — kann jeden öffentlichen
Mitgliedsnamen lesen.** `profiles_public` läuft mit `security_invoker = off`
(`20260612082726:64`) und trägt `grant select … to authenticated`
(`20260715140000:118`); die Stufen-Policy der Basistabelle wird dort **nicht**
ausgewertet. Diese Preisgabe steht in **keiner** Spec.

Das ist der Anlass. Vier Tage vor dem Umzug, mit 70 echten importierten
Mitgliedern, ist eine undokumentierte PII-Lage schlimmer als eine unbequeme
dokumentierte.

> **Korrektur an einem früheren Stand dieses Vorschlags.** Er begründete die
> Streichung des stufenweisen Auflösens damit, „die RLS gattert die Daten
> bereits nach Stufe". Für **Zeilen** über `search_directory` stimmt das
> (`has_level(3)`), für **Namen** über `profiles_public` nicht. Ein
> stufenweises Auflösen wäre also keine zweite Kopie einer bestehenden Grenze,
> sondern eine echte neue. Der Plan-Review hat das aufgedeckt; die Streichung
> ist zurückgenommen.

## What Changes

Entscheidung Donald, 2026-08-13, nach dem Plan-Review: **vertagen und ehrlich
benennen** — nicht streichen und nicht jetzt bauen. Die Produktfrage („sehen frei
registrierte Konten alle Namen?") gehört Detlev, und ein Resolver quer durch
`profiles_public`, `search_directory` und jede namenstragende Fläche ist vier
Tage vor dem Umzug der falsche Eingriff.

Dieser Change ersetzt deshalb eine **falsche** Anforderung durch **wahre**:

- Die anonyme Verdeckung wird als das beschrieben, was sie ist — **zwei Ebenen**,
  Daten und Anzeige, mit der Datenebene als der tragenden.
- Die **tatsächliche Preisgabe an eingeloggte Konten** wird ausgesprochen: volle
  Namen sind heute Verzeichnisdaten für jedes aktivierte Konto, `basic`
  eingeschlossen. Bisher stand das nirgends.
- Das stufenweise Auflösen bleibt **benannt offen**, mit Zeiger auf
  `finish-ui-polish`, statt als „pending" ohne Adresse zu schweben.
- Das Geländer für neue anon-Flächen wird auf das zurückgenommen, was der
  vorhandene Test **wirklich** hält.

**`finish-ui-polish` wird nicht angefasst.** Es bleibt aktiv und behält AGE-291.
Damit entfernen zwei Changes dieselbe Anforderung — deshalb entfernt **dieser**
sie nicht, sondern **ändert** sie. Wer später zuerst archiviert, macht den
anderen nicht unarchivierbar.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `directory-search`: Die Anforderung zur Autor-Maskierung wird von einer
  falschen Beschreibung („Rückfall auf einen Namen", „pending") auf den
  tatsächlichen Zustand umgestellt und um die bisher nirgends festgehaltene
  Preisgabe voller Namen an alle aktivierten Stufen ergänzt.

## Impact

**Betroffene Dateien:**

- `openspec/specs/directory-search/spec.md` (beim Archivieren).
- `src/lib/displayAuthor.ts` — der Kopfkommentar sagt „Folgeschritt (nicht
  hier): stufenweise Auflösung je Mitgliedsstufe" und ist die einzige Stelle im
  Produktionscode, die diesen Folgeschritt benennt, **ohne** zu sagen wo er
  liegt. Er bekommt die Adresse (`finish-ui-polish`, AGE-291).
- `src/lib/anon-anreicherung.test.ts` — ein Kommentar über `ANON_DARF_LESEN`,
  der seine Rolle **und seine Grenze** benennt.

> Ein früherer Stand behauptete „kein Produktionscode". Der Plan-Review hat den
> Kommentar in `displayAuthor.ts` gefunden; die Behauptung ist korrigiert statt
> gerettet.

**Nicht betroffen:** kein Verhalten, keine Migration, keine Policy, keine RPC,
keine Edge Function, kein Test-**Ergebnis**.

**Bewusst nicht mitgenommen:**

- `HomePage.tsx:81` trägt erfundene Kennzahlen (`120+ Mitglieder`, `24 Events
  2026`) und zwei erfundene Testimonials — dieselbe Klasse, die AGE-539 aus dem
  Profil geworfen hat, auf der öffentlichen Startseite. Gehört in ein eigenes
  Issue.
- Die `.rpc`-Lücke im anon-Wächter (siehe unten) wird **benannt**, nicht
  geschlossen. Sie zu schließen hieße, ein repositoriumsweites Mittel zu bauen
  (zentrales anon-Lesetor oder Lint-Regel) — ein eigener Change.

**Für AGE-540 wichtig:** Der frühere Stand versprach, `anon-anreicherung.test.ts`
sei das Geländer, gegen das die Kopfzeilen-Suche baut. **Das Versprechen ist
hinfällig.** Der Test ruft vier importierte Funktionen auf und zeichnet nur
`.from(...)` auf; `.rpc(...)` ist gemockt, **ohne den Namen festzuhalten**. Eine
neue Datei mit eigenem Supabase-Aufruf — und erst recht eine anon-DEFINER-RPC —
liefe durch. AGE-540 braucht seinen **eigenen** negativen Test.
