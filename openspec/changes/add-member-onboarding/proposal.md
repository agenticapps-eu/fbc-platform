## Why

AGE-538. Heute endet die Aktivierungsstrecke im Dashboard, und niemand wird je
gefragt, was er anbietet oder sucht.

Der Preis dafür steht im CSV-Export vom 13.08., gemessen an 70 Bestandsprofilen:

| fehlt | bei |
|---|---|
| Kompass-Kategorien für „Ich biete / Ich suche" | **70 von 70** |
| Berufsbezeichnung (`headline`) | 39 von 70 |
| FBC Standort (`region`) | 39 von 70 |
| Profilbild | 13 von 70 |

Die erste Zeile ist der Grund für diesen Change. Der Kategorienfilter im
Mitgliederverzeichnis ist gebaut (AGE-494) — **ohne diese Kategorien filtert er
ins Leere.** In WordPress sind „Biete" und „Suche" Fließtext („Erprobtes Wissen -
Individuelle Strategien - Die richtigen Kontakte"); daraus lassen sich die
Kategorien von keinem Skript verlässlich ableiten. Vom Mitglied selbst sind sie
in drei Klicks gesetzt.

Der Moment gleich nach der Aktivierung ist der einzige, in dem man diese Menschen
zuverlässig erreicht. Später erwischt man sie nicht mehr.

## What Changes

Eine geführte Strecke unter der neuen Route `/willkommen`. Sie beginnt mit
**einer kurzen Erklärung, was das dem Mitglied bringt** — nicht was die Plattform
davon hat —, dann höchstens **drei Schritte**:

1. **„Was machst du?"** — `headline`, vorbelegt mit dem, was schon dasteht.
2. **„Was bietest du, was suchst du?"** — Auswahl aus den Kompass-Kategorien,
   daneben der eigene Fließtext aus WordPress, sofern vorhanden.
3. **„Wie sollen dich andere sehen?"** — Profilbild und `region`, **nur wenn leer**.

**Zwei Auswege, nicht einer** (Donald, 2026-08-14). Beide stehen auf jedem
Schritt:

- **„Später"** vertagt. Der Merker wird **nicht** gesetzt, die Strecke erscheint
  beim nächsten Besuch der Startseite wieder und setzt beim ersten noch leeren
  Feld an.
- **„Überspringen"** beendet endgültig. Es **warnt vorher** — positiv formuliert,
  nicht drohend: ohne Kategorien findet einen der Kompass-Filter nicht, und das
  ist der Weg, auf dem die anderen Mitglieder einen finden.

Damit steht neben dem dauerhaften Ausgang ein Weg, der niemanden verliert, und
neben dem vertagenden ein Weg, der die Sache wirklich beendet.

**Sechs Befunde aus der Bestandsaufnahme, die den Zuschnitt gegenüber dem Issue
verschieben.** Alle an der Platte geprüft, nicht angenommen:

1. **Der Einstieg ist der Aufruf der Startseite, nicht „direkt nach dem
   Passwortsetzen".** Das Issue verlangt Letzteres — baulich unmöglich:
   `redeem-activation/index.ts:81` ruft `revoke_sessions`,
   `ActivationRedeemPage.tsx:167` meldet sich sofort ab und leitet nach zehn
   Sekunden auf `/login`. Es *gibt* nach dem Passwortsetzen keine Sitzung.
   `access-control` schreibt das als gewollt fest („alle Sitzungen widerrufen …
   das ist richtig und bleibt so"). Zwei Minuten später kommt derselbe Mensch
   über den Login auf `/` — dort greift die Weiche.
2. **Schritt 2 hebt `profile_completion` um null Prozent.** Der Trigger
   `set_profile_completion` zählt zwölf **Profilspalten** (`profile.ts:147-166`);
   `offers`/`needs` sind **nicht** darunter. Die Abnahme „`profile_completion`
   steigt messbar" trifft Schritt 1 (+8 %) und Schritt 3 (+16 %) — den
   wichtigsten Schritt trifft sie nicht. Dieser Change **ändert den Trigger
   nicht**: das verschöbe die Zahl jedes bestehenden Mitglieds, und zwar nach
   unten. Der Erfolg von Schritt 2 wird stattdessen dort gemessen, wo er zählt —
   **im Verzeichnisfilter**.
3. **Der Merker gehört nach `member_settings`, nicht in `profiles`.** Er muss
   gerätеübergreifend halten, also in die Datenbank; der vorhandene
   „übersprungen"-Merker (`compass.ts:363`) liegt in `localStorage` und ist
   gerätegebunden. Aber **nicht** in `profiles`: die Policy
   `profiles_select_self_or_discover` ist `id = auth.uid() or has_level(3)` — ab
   `discover` liest man fremde Vollzeilen, der Merker wäre öffentlich.
   `member_settings` ist „strictly own-profile only" (`member_settings_own`,
   `for all`, `profile_id = auth.uid()`) und trägt **Tabellen**-Grants. Eine neue
   Spalte braucht dort **weder Grant noch Policy** — Präzedenzfall
   `20260804120000_member_settings_theme.sql`, dessen Kopf genau das festhält.
4. **Die Strecke schreibt nicht über `saveProfile`.** `profile.ts:303` aktualisiert
   **alle** Profilspalten, upsertet bedingungslos `profile_contacts` und
   **löscht und ersetzt** `profile_interests` und `profile_goals`. Aus einem
   Ein-Feld-Schritt heraus aufgerufen räumte es Interessen und Kontaktzeile weg.
   Die Strecke schreibt **feldbezogen** auf die eigene Zeile und benutzt aus
   `profile.ts` **nur** den Bild-Upload.
5. **Schritt 2 ist rein additiv.** Ein Chip für eine bereits gesetzte Kategorie
   ist gesetzt und **nicht abwählbar**. Abwählen löscht in
   `saveCategorySelection` *alle* eigenen Zeilen dieser Kategorie — samt
   Beschreibung, Tags und Volumenband aus dem Suche-&-Biete-Editor. Das Abwählen
   bleibt dort, wo es hingehört: im Profil-Editor, der den Bestätigungsdialog
   dafür hat.
6. **Der Fließtext aus WordPress liegt erst nach AGE-534 vor.** Er landet dort in
   `offers.description` / `needs.description`. Bis dahin zeigt Schritt 2 die
   Chips ohne Beiwerk. Der Change ist **nicht** von C10 blockiert; er wird durch
   C10 nur vollständiger.

**Eine Genauigkeit, die das Issue nicht trägt:** „die elf Kompass-Kategorien" ist
als Gesamtzahl richtig — elf **verschiedene** Werte in `config/compass.ts` —, die
Oberfläche zeigt aber **sechs je Seite**, und `immobilien` kommt auf beiden vor.
Der Delta spricht deshalb von den Kategorien je Seite, nicht von elf.

**Nicht in diesem Change:** die geführte Tour (Teil 2 von AGE-538, eigener
Change, Zuschnitt-Entscheidung Donald 2026-08-14) · der Mini-Compass-Assistent —
`OnboardingPage.tsx` und `/onboarding` bleiben unangetastet, C2 hat sie bewusst
stehen lassen · Adressfelder · Erinnerungsmails an Abbrecher · das Abwählen von
Kategorien.

## Capabilities

### New Capabilities

- `member-onboarding`: Wann die Strecke erscheint, was sie erklärt, was sie
  fragt, was sie schreibt, und wie ihre zwei Auswege sich unterscheiden. Eigene
  Fähigkeit und keine Anforderung in `member-profiles`, weil sie einen
  **Lebenszyklus** hat statt eines Feldvertrags — und weil die Tour aus Teil 2
  hier andockt.

### Modified Capabilities

Keine. Die Strecke schreibt in bestehende Spalten, und der Merker entsteht in
`member_settings`, dessen Vertrag sich nicht ändert.

## Impact

**Datenbank — eine Migration, und zwar eine kleine:**

- `alter table public.member_settings add column onboarded_at timestamptz;`
- **Kein** neuer Grant: `member_settings` trägt `grant select, insert, update …
  to authenticated` auf **Tabellen**ebene (`20260630130000:17`, bestätigt in
  `20260715140000:85`), keine Spaltenliste wie `profiles`.
- **Keine** neue Policy: `member_settings_own` ist `for all` über
  `profile_id = auth.uid()`.
- **Kein** Eingriff in `supabase/tests/grants_test.sql`: der Golden-Snapshot
  bricht an neuen **Spalten-Grants**, und hier entsteht keiner.
- Die Zeile entsteht bei der Registrierung **nicht** — der Schreibweg muss
  `upsert` sein, nicht `update`. Dieselbe Stelle, an der `saveProfile` für
  `profile_contacts` schon einen `upsert` braucht.

**Betroffener Code:**

- **neu** `src/pages/WillkommenPage.tsx` (+ Test) — Nutzenerklärung, die
  Schritte, Fortschritt, „Später", „Überspringen".
- **neu** ein feldbezogener Schreibweg für `headline` bzw. `region` und
  `avatar_url` — bewusst **nicht** `saveProfile` (Befund 4).
- `src/components/HomeRedirect.tsx` — entscheidet wieder, mit einem
  ausgeschriebenen Lade-, Fehler- und Fertig-Zustand.
- `src/App.tsx` — Route `/willkommen`, außerhalb der `AppShell` wie `/onboarding`,
  hinter `RequireAuth` + `ActivationGate`.
- `src/lib/` — Lesen und Setzen des Merkers in `member_settings`; ein Lesepfad für
  die vorhandenen `description`-Werte, den `fetchCategorySelection` nicht liefert.
- `src/lib/database.types.ts` — regeneriert.

**Nicht betroffen:** `NARROW_ROUTES` (`AppShell.tsx:21`) — die Liste wird in
Zeile 268 *innerhalb* der Shell gelesen, und `/willkommen` liegt außerhalb. Ein
Eintrag dort wäre wirkungslos. Dass `/login` und `/onboarding` heute schon
wirkungslos darin stehen, ist ein Nachlauf und kein Teil dieses Diffs.

**Wiederverwendet statt neu gebaut:** `saveCategorySelection` +
`categoryOptionsForSide` (`profile-categories.ts`, gleicht **je Kategorie** ab),
der Bild-Upload aus `profile.ts`, `set_profile_completion` (Trigger, rechnet von
selbst), die Bausteine aus `components/ui/`.

**Kein Overlay, kein `useOverlay`.** Die Strecke ist eine eigene Seite wie
`/login` — es gibt nichts zu sperren und nichts einzufangen. Der Hook aus AGE-529
gehört in die Tour.

**Sicherheit:** Der Change gibt **keine** Daten frei — das ist nach Befund 3 eine
geprüfte Aussage und nicht mehr eine Annahme. Der Merker liegt in einer
Tabelle, die niemand außer dem Eigentümer liest. Geschrieben wird ausschließlich
auf die eigene Zeile.

**Was der Plan-Review beigetragen hat.** Beide Reviewer (gemini, codex) gaben
REQUEST-CHANGES; vier HIGH und sieben MEDIUM. Fünf Tatsachenbehauptungen wurden
vor der Übernahme an der Platte nachgeprüft, vier bestätigt und eine widerlegt —
siehe `REVIEWS.md`. Die Befunde 3, 4 und 5 oben stammen daraus und machen den
Change **kleiner**, nicht größer: eine Migration ohne Grant, ohne Policy und ohne
Snapshot-Bruch statt einer mit allen drei.

**Ausdrücklich abgenommen, nicht wegargumentiert** (Donald, 2026-08-14): Die
Strecke ist für den, der nach dem Login sein Dashboard erwartet, **faktisch eine
Unterbrechung**. Ein früherer Stand dieses Proposals hat das mit „eine
überspringbare Wand ist keine" umgedeutet; gemini hat die Umdeutung als solche
benannt und zu Recht. Der Ausgleich ist nicht die Formulierung, sondern die
Bauweise: eine Erklärung des Nutzens vorweg, zwei Auswege auf jedem Schritt, und
jede Route außer `/` bleibt unberührt.
