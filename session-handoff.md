# Session Handoff — 2026-08-17

Zwei Branches im Spiel. `donald/age-534-c10-mitglieder-migration-aus-wordpress`
(letzter Commit `9b9cedd`) trägt den Import; `donald/age-566-admin-mitgliederliste`
(von `origin/main`, letzter Commit `2b45618`) trägt den neuen Change. Beide
Arbeitsbäume sauber, `openspec validate --all` grün.

## Accomplished

**AGE-534 / 8.2 — Probelauf gegen PROD gefahren, erfolgreich.** 70 Datensätze:
69 angelegt, Detlev als Merge, nichts gescheitert. Gegengezählt an der Datenbank:
71 Konten / 71 Profile / 70 eindeutige Kennungen / 69 × `impact` / 53 Kontakte /
46 Angebote / 45 Bedarfe / 121 Interessen / 56 Avatare. `activated_at` nur bei
den zwei Admins — die 69 stehen hinter dem Gate. `email_confirm: true`, also
ging keine Post an sie raus.

**Vorher zwei Eingriffe auf PROD.** Migrationsstand begradigt (es fehlte
`20260814100000_member_settings_onboarded_at`; über `migrate-prod` auf `main`,
Lauf 31958225406, Dry-Run vorher ausserhalb des Workflows gelesen). Und
`legacy_source_id = '3'` auf Detlevs Profilzeile gesetzt, um ein Doppel-Konto zu
verhindern.

**AGE-534 / 8.5 — zweites Deployment steht:** `https://fbc-probe-a4664fb5.pages.dev`.
Zufallsname mit Absicht. Belegt an der Zeichenkette im Bündel: Probe spricht
PROD, `fbc-platform.pages.dev` unverändert DEV. **8.6 war längst erledigt** —
beide Admins standen schon in PROD.

**AGE-566 angelegt** (Linear, Go-Live-Projekt) und der Change
`add-admin-member-list` geschrieben, plan-reviewed und überarbeitet.

## Decisions

**Kein admin-gesetztes Passwort** (Donald, 17.08.). Der Knopf heisst „Zugangslink
schicken". Ein Admin, der ein fremdes Passwort setzt, kann sich als das Mitglied
anmelden und dessen Nachrichten lesen, ohne dass es irgendwo steht.

**Drei Sichten** — Tabelle, Admin-Karten, Verzeichnis-Ansicht — im Admin-Bereich,
nicht im Mitgliederverzeichnis. **`login_email` ja, `profile_contacts` nein.**
**Beide Aktivierungswege**, getrennt beschriftet.

**Neuer Lesepfad daneben statt Lockerung des bestehenden.** Die
Aktivierungsbedingung steht an vier Stellen, drei davon mitgliedersichtbar. Preis
ist eine zweite Verzeichnisprojektion, Gegenmittel ein Paritätstest über Spalten
**und** Inhalt.

**Sortierung entschieden statt vertagt:** unbestätigte zuerst, dann `name`, dann
`id` als Stichentscheid.

## Files modified

- `openspec/changes/add-wordpress-member-import/tasks.md` (AGE-534-Branch) —
  8.2/8.5/8.6 mit Messwerten, Befunden und den vier Rückbauschritten
- `openspec/changes/add-admin-member-list/` (AGE-566-Branch) — proposal, design,
  specs/admin/spec.md, tasks, REVIEWS.md
- `scratchpad/detlev-kennung-setzen.mts` — das Skript, das die Kennung gesetzt
  hat; liegt ausserhalb des Repos, mit Ziel-Wächter

## Next session: start here

**Zuerst die zwei Dinge, die Donald offen gelassen hat**, bevor irgendein Code
entsteht. Erstens: **Detlevs Profil ist leer geblieben.** Die Kennung, die das
Doppel-Konto verhindert hat, setzt zugleich `bereitsImportiert` und schaltet
damit jedes Profil- und Kontaktfeld ab (`wp_import.ts:469`,
`wp_import.lib.ts:827`). Durchgekommen sind nur `member_since`, `legacy_tier`,
Avatar und Cover. Der Weg dorthin: Adresse in WordPress korrigieren, sein leeres
PROD-Konto löschen, importieren, `staff_roles` neu setzen. Ob jetzt oder erst
beim Go-Live, entscheidet Donald. Zweitens: **er und Detlev wollen sich ein
Passwort setzen** — das geht heute schon über `/passwort-vergessen` auf der
Probe-Adresse, und es schliesst zugleich die offenen Aufgaben 6.3/6.4 von
`password-reset-flow`.

**Dann AGE-566 Schritt 3 (`apply`), beginnend mit Aufgabe 1** — der Entflechtung
von `add-admin-console`. Die steht bewusst zuerst: sie ist reine Spec-Arbeit und
verhindert eine Archivierungssperre, die sonst erst am Ende auffiele.

## Open questions

- **Detlevs Profil** — jetzt füllen oder beim Go-Live? Siehe oben.
- **Der Bericht** `wp-import-bericht-2026-08-16T18-36-24-901Z.md` (neben der CSV)
  ist noch nicht zur Datenanforderung an Detlev aufbereitet. Ich darf ihn nicht
  lesen: 70 Klarnamen, der Klassifikator blockt ihn.
- **Vor dem Go-Live zurückzunehmen:** Pages-Projekt `fbc-probe-a4664fb5` löschen ·
  Probe-Adresse aus `uri_allow_list` · `APP_URL` auf die echte Domain ·
  `mailer_autoconfirm` zurück auf `true`.
- **Infisical `prod` ist gespalten:** `VITE_SUPABASE_URL` zeigt auf DEV. Muss vor
  dem echten Go-Live umgestellt werden — und **erst dann**, weil `deploy.yml` die
  Live-Seite mit derselben Umgebung baut.
- **Secrets im Klartext:** ich habe am 16.08. versehentlich `infisical secrets
  --plain` ausgegeben. DB-Passwort, Cloudflare-, Sentry- und Axiom-Token stehen
  im Verlauf jener Sitzung. Rotieren ist Donalds Entscheidung.
- Unverändert: AGE-497 · AGE-541 · AGE-258 · AGE-522 · AGE-512 · AGE-561 ·
  `paid_until` (3.5) · `infos_16`-Bedeutung · `demo_seed.lib.ts` trägt die
  überholte „dev und prod sind dasselbe Projekt"-Annahme.

## Was beim Bauen auffiel

- **Der Supabase-MCP liest PROD read-only** — `list_migrations` und
  `execute_sql`, ohne Infisical und ohne Bash. Ein `insert` scheitert mit
  `25006`. Der kürzeste Leseweg, den dieses Projekt hat.
- **Der Plan-Review hat sich bezahlt gemacht.** Beide Prüfer REQUEST-CHANGES,
  dreizehn Befunde, fünf davon überprüfbare Behauptungen über den Bestand — alle
  fünf trafen zu. Darunter ein Verstoss gegen eine **bestehende** Anforderung
  (`admin_audit`), den ich selbst zuvor falsch eingeordnet hatte.
- **`REVIEWER_TIMEOUT=900` von vornherein setzen.** Mit den voreingestellten
  300 s endet codex hier regelmässig als Ausgang 4 und zählt nicht.
