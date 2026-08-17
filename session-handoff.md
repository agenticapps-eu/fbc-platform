# Session Handoff — 2026-08-17

**Der Auftrag für die nächste Sitzung ist eindeutig: AGE-566 bauen.** Planung und
Plan-Review sind fertig, Donald schaut sich danach alles an. Nichts anderes ist
angefangen.

Ausgecheckt ist `donald/age-566-admin-mitgliederliste` (von `origin/main`, drei
Commits voraus, letzter `2b45618`) — **das ist der Arbeitsbranch.** Daneben liegt
`donald/age-534-c10-mitglieder-migration-aus-wordpress` (letzter `75ba90b`) mit
dem Import; dort ist nur noch die Berichtsaufbereitung offen, und die gehört
Donald. Beide Arbeitsbäume sauber, `openspec validate --all` 29/29.

## Next session: start here

`openspec/changes/add-admin-member-list/tasks.md`, **Aufgabe 1**. Die steht
bewusst zuerst: reine Spec-Arbeit, und sie verhindert eine Archivierungssperre,
die sonst erst ganz am Ende auffiele. Die vorliegende Fassung ist die
**überarbeitete** — Aufgabe 1 stand ursprünglich falsch herum (sie wollte in
`add-admin-console` das `REMOVED` löschen; das muss bleiben, weil dieser Change
`MODIFIED` benutzt und die Anforderung danach weiterbesteht).

Danach Gruppe 2 (die RPC, Test zuerst). `REVIEWS.md` vorher lesen — die
Auflösungstabelle sagt zu jedem Befund, was daraus wurde, und mehrere Aufgaben
sind nur mit diesem Kontext verständlich.

## Accomplished

**AGE-534 / 8.2 durch.** Schreibender Lauf gegen PROD: 69 angelegt, Detlev als
Merge, nichts gescheitert. An der Datenbank gegengezählt: 71 Konten / 71 Profile
/ 70 eindeutige Kennungen / 69 × `impact` / 53 Kontakte / 46 Angebote / 45
Bedarfe / 121 Interessen / 56 Avatare. `email_confirm: true` — es ging keine Post
an die 69.

Vorher zwei Eingriffe auf PROD: Migrationsstand begradigt (`20260814100000`
fehlte; über `migrate-prod` auf `main`, Lauf 31958225406, Dry-Run vorher
ausserhalb des Workflows gelesen) und `legacy_source_id = '3'` auf Detlevs
Profilzeile, gegen ein Doppel-Konto.

**8.5 steht:** `https://fbc-probe-a4664fb5.pages.dev`. Zufallsname mit Absicht.
An der Zeichenkette im Bündel belegt: Probe spricht PROD, `fbc-platform.pages.dev`
unverändert DEV. **8.6 war längst erledigt** — beide Admins standen schon in PROD.

**Detlevs Profil nachgefüllt** (17 Felder, 1 übersprungen), **Passwörter gesetzt**,
**beide Admins von `basic` auf `impact`**.

**AGE-566 angelegt**, Change `add-admin-member-list` geschrieben, von zwei
fremden Herstellern geprüft und danach überarbeitet.

## Decisions

**Kein admin-gesetztes Passwort als Produktfunktion** (Donald, 17.08.). Der Knopf
heisst „Zugangslink schicken". Ein Admin, der ein fremdes Passwort setzt, kann
sich als das Mitglied anmelden und dessen Nachrichten lesen, ohne dass es
irgendwo steht. Der gemeinsame Übergangswert auf den zwei eigenen Admin-Konten
ist davon unberührt — das ist eine Handlung des Eigentümers, keine Fähigkeit.

**Drei Sichten** (Tabelle, Admin-Karten, Verzeichnis-Ansicht), alle im
Admin-Bereich. **`login_email` ja, `profile_contacts` nein.** **Beide
Aktivierungswege**, getrennt beschriftet, direktes Aktivieren hinter einer
namentlichen Rückfrage.

**Neuer Lesepfad daneben statt Lockerung des bestehenden.** Die
Aktivierungsbedingung steht an vier Stellen, drei davon mitgliedersichtbar. Preis
ist eine zweite Verzeichnisprojektion, Gegenmittel ein Paritätstest über Spalten
**und** Inhalt.

**Sortierung entschieden, nicht vertagt:** unbestätigte zuerst, dann `name`, dann
`id` als Stichentscheid.

**Paging gehört in jede Liste von Anfang an** (Donald, generell).

## Files modified

- `openspec/changes/add-admin-member-list/` (dieser Branch) — proposal, design,
  specs/admin/spec.md, tasks, REVIEWS.md
- `openspec/changes/add-wordpress-member-import/tasks.md` (AGE-534-Branch) —
  8.2/8.5/8.6 mit Messwerten, Befunden und den Rückbauschritten
- Scratchpad (ausserhalb des Repos): `detlev-kennung-setzen.mts`,
  `detlev-profil-fuellen.mts`, `admins-passwort-und-stufe.mts` — alle drei mit
  Ziel-Wächter gegen das falsche Projekt

## Open questions

- **Der Bericht** `wp-import-bericht-2026-08-16T18-36-24-901Z.md` (neben der CSV)
  ist noch nicht zur Datenanforderung an Detlev aufbereitet. Ich darf ihn nicht
  lesen: 70 Klarnamen, der Klassifikator blockt ihn — das ist Donalds Teil.
- **Die 69 sind noch nicht aktiviert**, das Verzeichnis ist also leer. Donald
  wollte das bewusst nicht vorziehen, sondern über die neue Fläche machen.
- **Vor dem Go-Live zurückzunehmen:** Pages-Projekt `fbc-probe-a4664fb5` löschen ·
  Probe-Adresse aus `uri_allow_list` · `APP_URL` auf die echte Domain ·
  `mailer_autoconfirm` zurück auf `true` · **das Übergangspasswort ändern**.
- **Infisical `prod` ist gespalten:** `VITE_SUPABASE_URL` zeigt auf DEV. Muss vor
  dem echten Go-Live umgestellt werden — und **erst dann**, weil `deploy.yml` die
  Live-Seite mit derselben Umgebung baut.
- **Secrets im Klartext:** am 16.08. versehentlich `infisical secrets --plain`
  ausgegeben. DB-Passwort, Cloudflare-, Sentry- und Axiom-Token stehen im Verlauf
  jener Sitzung. Rotieren ist Donalds Entscheidung.
- Unverändert: AGE-497 · AGE-541 · AGE-258 · AGE-522 · AGE-512 · AGE-561 ·
  `paid_until` (3.5) · `infos_16`-Bedeutung · `demo_seed.lib.ts` trägt die
  überholte „dev und prod sind dasselbe Projekt"-Annahme.

## Was beim Bauen auffiel

- **`has_level()` kennt keine Admin-Ausnahme.** Beide Admins standen auf `basic`
  (Rang 1), das Verzeichnis verlangt Rang 3 — sie hätten sich angemeldet und ein
  leeres Verzeichnis gesehen, was wie ein fehlgeschlagener Import aussieht.
  „Kein Verzeichnis" hat zwei ununterscheidbare Ursachen: der Rang des Aufrufers
  und `activated_at` der Zielzeilen. Immer beide messen.
- **Die Kennung, die das Doppel-Konto verhinderte, schaltete die Datenübernahme
  ab** (`wp_import.ts:469` → `wp_import.lib.ts:827`). Ein vorab bestehendes Konto
  kann über den Importeur grundsätzlich keine WP-Daten bekommen: ohne Kennung
  Totalabbruch, mit Kennung Merge-Sperre.
- **Der Plan-Review hat sich bezahlt gemacht.** Beide Prüfer REQUEST-CHANGES,
  dreizehn Befunde, fünf davon überprüfbare Behauptungen über den Bestand — alle
  fünf trafen zu, darunter ein Verstoss gegen eine **bestehende** Anforderung
  (`admin_audit`), den ich zuvor selbst falsch eingeordnet hatte.
- **`REVIEWER_TIMEOUT=900` von vornherein setzen.** Mit den voreingestellten
  300 s endet codex hier regelmässig als Ausgang 4 und zählt dann nicht.
- **Der Supabase-MCP liest PROD read-only** — `list_migrations` und
  `execute_sql`, ohne Infisical und ohne Bash. Ein `insert` scheitert mit `25006`.
  Der kürzeste Leseweg, den dieses Projekt hat.
