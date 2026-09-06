## Why

Wiederkehrende Formate — der monatliche Stammtisch, der Dienstagabend — müssen
heute jedes Mal von Hand neu eingestellt werden: Titel, Typ, Ort, Beschreibung,
Kapazität, Sichtbarkeit und Cover, bei jedem Termin erneut. Gemessen am
05.09. gibt es dafür **keinerlei Unterbau**: `grep -riE 'vorlage|serientermin|
recurrence|rrule|wiederkehrend'` über `supabase/migrations` und `src` findet im
Event-Zusammenhang genau einen Treffer, und der ist ein Migrationskommentar, der
das Wort „Vorlage" im Sinne von „Blaupause dieser Datei" benutzt
(`20260812100200_event_covers_storage.sql:4`). Positivkontrolle: dasselbe Muster
findet `vorlage` 26× an anderer Stelle, der Negativbefund ist also gemessen und
nicht das Ergebnis eines kaputten Suchausdrucks.

Linear-Issue: AGE-630.

## What Changes

- **Neu: `event_vorlagen`.** Ein Host legt die inhaltlichen Felder eines Events
  einmal ab (Titel, Typ, Ort, Beschreibung, Kapazität, Sichtbarkeit, Topics,
  Cover) und erzeugt daraus wiederholt Termine.
- **Neu: Wiederholungsregel an der Vorlage.** Drei Formen, Donalds Beispiele:
  `jeden 1. des Monats`, `jeden Dienstag`, `jeden ersten Dienstag im Monat`.
  Die dritte ist die nicht-triviale (`BYDAY=1TU` aus RFC 5545) — sie ist keine
  feste Tagesdifferenz.
- **Neu: Termine werden materialisiert.** Die Regel erzeugt echte
  `public.events`-Zeilen im Voraus, nicht eine zur Laufzeit berechnete Liste.
  Ein erzeugter Termin ist danach ein gewöhnliches Event und erbt Kapazität,
  Warteliste, Check-in und Anmeldung unverändert.
- **Neu: Serienzugehörigkeit an `events`.** Eine Spalte verweist auf die
  Vorlage, aus der ein Termin entstanden ist; sie ist `null` für alle bisherigen
  und alle einzeln angelegten Events.
- **Cover wird je Termin kopiert.** Jeder erzeugte Termin bekommt eine eigene
  Datei im `{uid}/`-Präfix des Hosts. `events_cover_path_key` bleibt
  unangetastet — siehe Impact, das ist eine Sicherheitszusage, keine Kosmetik.
- **Ausnahmen brauchen kein eigenes Modell.** Weil Termine echte Zeilen sind,
  ist „einzelnen Termin verschieben" das Bearbeiten dieser Zeile und „absagen"
  das Löschen. Kein `EXDATE`, kein Override-Begriff.
- **Rechte bleiben, wie sie bei Events sind.** Wer heute ein Event einstellen
  darf, darf eine Vorlage anlegen und daraus Termine erzeugen. Keine neue
  Stufenregel, keine Admin-Sonderrolle.
- **Begrenzte Vorausschau.** Eine Erzeugung schreibt eine ausdrücklich genannte
  Anzahl Termine bzw. bis zu einem Enddatum, mit einer harten Obergrenze. Ohne
  Grenze wäre „jeden Dienstag" unendlich.

Kein **BREAKING**: alle Änderungen sind additiv. Bestehende Events, Anmeldungen
und Policies behalten ihr Verhalten.

## Capabilities

### New Capabilities

Keine. Vorlagen und Serientermine sind Verhalten *von Events* und gehören in den
bestehenden Spec-Slot; ein eigener Slot würde die Anmelde- und Sichtbarkeits-
regeln von den Terminen trennen, für die sie gelten.

### Modified Capabilities

- `events`: neue Requirements für Vorlagen, die Wiederholungsregel, die
  Materialisierung samt Obergrenze, das Kopieren des Covers je Termin und die
  Zeitzonenregel. Die bestehenden Requirements zu Anmeldung, Kapazität,
  Check-in und Cover-Sichtbarkeit werden **nicht** angefasst.

## Impact

**Datenmodell** (`supabase/migrations/`, forward-only)
- neue Tabelle `event_vorlagen` samt RLS, ausdrücklichen Grants und Kommentaren
- neue Spalte an `public.events` für die Serienzugehörigkeit
- eine `SECURITY INVOKER`-RPC, die aus einer Vorlage Termine erzeugt — sie braucht
  kein geliehenes Recht, weil `events_write_host` dem Host das Anlegen eigener
  Events bereits erlaubt (Begründung: design.md D2)

**Zwei Fallen, die diese Änderung im Bestand berührt**

1. **`events_cover_path_key` ist UNIQUE und das ist eine Sicherheitszusage.**
   `20260812100000_events_content.sql:18–35` begründet sie: `event_cover_lesbar()`
   schlägt das Event über genau diese Spalte nach, und die Eindeutigkeit
   schließt einen HIGH-Befund aus dem AGE-531-Fremdreview — einen verwaisten
   fremden `cover_path` an ein eigenes `public`-Event hängen, wonach `anon` ein
   nie öffentliches Bild signiert. **Die Eindeutigkeit fällt nicht.** Deshalb
   die Kopie je Termin.
2. **Anmeldungen laufen seit AGE-605 ausschließlich über die RPCs.**
   `20260904160000_anmeldung_nicht_an_den_rpcs_vorbei.sql` hat das Tabellenrecht
   entzogen und nur einzelne Spalten zurückgegeben; `checked_in` ist für
   `authenticated` nicht schreibbar. Alles, was hier Termine erzeugt, erzeugt
   **Events, keine Anmeldungen** — die bleiben Sache von `register_for_event`.

**Frontend** (`src/`)
- Vorlagenverwaltung und Erzeugen-Dialog; das bestehende `EventForm` und der
  Cropper werden wiederverwendet, nicht ersetzt

**Wächter, die diese Änderung erfahrungsgemäß rot machen**
- `supabase/tests/grants_test.sql` trägt einen Golden-Snapshot: **jede neue
  Tabelle bricht ihn**, die Liste muss nachgezogen werden
- neue Tabellen erben **keine** Grants; sie müssen ausdrücklich erteilt werden
- `src/lib/database.types.ts` ist **handgepflegt**; `supabase gen types` darf
  nicht darüberlaufen
