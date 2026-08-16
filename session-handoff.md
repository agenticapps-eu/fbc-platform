# Session Handoff — 2026-08-16 (AGE-534: Gruppe 8 bis auf den PROD-Lauf fertig)

Branch `donald/age-534-c10-mitglieder-migration-aus-wordpress`, letzter Commit
`ab65391`. Arbeitsbaum sauber. **1169 Tests grün** (vorher 1162), `typecheck`,
`typecheck:seed` und `lint` sauber (4 Altwarnungen, fremde Dateien),
`openspec validate --all` 29/29.

Quelldatei (70 Datensätze, ausserhalb des Arbeitsbaums):
`/Users/donald/Documents/Claude/Projects/Fair Business Club/user-export-318-6a7da0ec0d721.csv`
Daneben `wp-import-bilder/` mit 110 Originalen und 109 WebP-Fassungen.

## Accomplished

**8.1, 8.3 und 8.4 sind fertig.** Offen sind 8.2 (Probelauf gegen PROD), 8.5
(zweites Deployment) und 8.6 (Admins) — alles Handlungen im Terminal, keine
Diffs.

- **8.1** — Suiten grün. `format:check` läuft **nicht** ganz: es war schon an der
  Basis `c648a41` rot. Pro Datei gegen die Basis-Fassung gemessen: von 11
  Warnungen sind 6 Altlast auf `main`, 5 hat dieser Branch angelegt — die sind
  formatiert. Nie `pnpm format`.
- **8.3** — belegt, und nicht nur am Befehl: `--ignored` faltet Verzeichnisse
  zusammen. Zusätzlich gegen Dateinamen und gegen die Export-Kennung
  `6a7da0ec0d721` in `dist/`, `.wrangler/`, `supabase/.temp/`, `.env*` und
  `.claude/` gesucht — null Treffer.
- **8.4** — codex: 2 HIGH, 4 MEDIUM, 4 LOW. Acht behoben, einer begründet
  abgelehnt, einer als Nachlauf offen. gemini: vier Befunde, **keiner hält**,
  alle einzeln mit Fundstelle widerlegt.

## Decisions

**Der Probelauf geht schreibend gegen PROD statt als Trockenlauf gegen DEV**
(Donald, 16.08.). Ein Trockenlauf prüft die Hälfte nicht, an der es hier bisher
gescheitert ist: `service_role` ohne Tabellenrechte, ES256 in der
GoTrue-Admin-Schnittstelle, Storage-Policies auf abweichenden
Default-Privileges, der Trigger vor dem Import. Und ein schreibender Lauf gegen
DEV legte 70 Klarnamen in die Datenbank, die das ausgelieferte Frontend liest
(AGE-536). Billig wird das durch die **Wegwerf-Erlaubnis: PROD darf vor dem
Go-Live geleert und neu importiert werden.**

**Kein Datenbank-Umschalter in der ausgelieferten App** (Donald, 16.08.). Am
Aufwand lag es nicht — Singleton, acht Importeure, Storage-Key ohnehin pro Ref.
Verworfen, weil offene Selbstregistrierung + abgeschaltete E-Mail-Bestätigung +
der C3-Befund (jedes eingeloggte Konto sieht das ganze Verzeichnis) zusammen
einen Dreischritt für Fremde ergeben, sobald 70 echte Datensätze in PROD liegen.
Stattdessen ein **zweites, unverlinktes Pages-Deployment** — das verschwindet,
indem man es löscht, während temporärer Code hier seine Frist überlebt (der
Design-Umschalter aus AGE-237 ist sieben Wochen später noch drin).

**HIGH-1 wurde mit einer Nachschau behoben, nicht mit einem Merker in den
Auth-Metadaten.** codex schlug beides vor. Die Nachschau schliesst das
30-Sekunden-Fenster, in dem der Fehler entsteht; der Merker deckte zusätzlich
das Millisekunden-Fenster „Prozess zwischen POST und Nachschau getötet" ab.
Dieser Rest fällt als blockierender Kollisionsbefund auf, der den Datensatz
benennt — sichtbar und von Hand behebbar, so wie das Design Kollisionen ohnehin
behandelt.

**Die Nachschau läuft NUR aus dem `catch`, nicht bei `email_exists`.** Ein
`email_exists` ist zweideutig: dahinter kann eine Selbstregistrierung stehen,
die der Bestandsabzug noch nicht kannte. Sie zu übernehmen hiesse, ihr `impact`
zu geben und fremde Daten darüberzuschreiben — der Fall, den 7.3 ausschliesst.

**`echterPfad` ist Pflichtparameter ohne Vorgabewert.** Ein Identitäts-Default
liesse jeden Aufrufer, der ihn vergisst, still in die Symlink-Lücke
zurückfallen. Der Typprüfer hat daraufhin alle drei Aufrufer benannt — einer
davon war eine Sonde, an die ich nicht gedacht hätte.

## Files modified

- `supabase/seed/wp_schreiben.ts` — `sucheKonto`; `legeKontoAn` sieht aus dem
  `catch` nach, mit Gleichheitsprüfung der Adresse (GoTrues `filter` ist eine
  Teilzeichenkette)
- `supabase/seed/wp_import.ts` — `zeilenZahl`, `echterPfadAufPlatte`,
  Stufen-UPDATE auf getroffene Zeile geprüft, Berichtsplatz vor dem ersten
  Schreibvorgang belegt
- `supabase/seed/wp_import.lib.ts` — `pruefeQuellPfad` kanonisch, beide Seiten
- `supabase/seed/wp_bilder.ts` — `BILDSPALTEN`, `fehlendeBildspalten`,
  `schreibeFertig` (Zwischenname + `renameSync`), `istLesbaresBild`
- `supabase/seed/wp_bilder_holen.ts` — Kopfzeilenprüfung vor dem Abruf
- `scripts/probe-c10-bestandsabfrage.ts` — `uid` in `ERWARTET` **und** im Wert
- `scripts/probe-c10-gotrue-trigger.ts` — fährt `stufeFuerNeuesKonto`, Ausgang 1
- `scripts/probe-c10-parser-paritaet.ts` — `echterPfad`
- `openspec/changes/add-wordpress-member-import/` — `REVIEWS.md` (Abschnitt
  „Diff-Review"), `design.md` (zwei Entscheidungen, Non-Goals, Migration Plan),
  `tasks.md` (8.1/8.3/8.4 abgehakt, 8.2 neu gefasst, 8.5/8.6 neu)

## Next session: start here

**8.2, und die erste Handlung ist LESEN, nicht schreiben:** den Migrationsstand
von PROD prüfen. `migrate-prod` zu dispatchen heisst anwenden — `apply` startet
direkt hinter `plan` —, also den Dry-Run ausserhalb des Workflows lesen.
Danach der schreibende Lauf **in Donalds Terminal**, nicht aus Claude Code
heraus: Infisical braucht ein TTY, und schreibende Prod-Wege blockt der
Klassifikator hier ohnehin. Der Aufruf ist
`npx tsx supabase/seed/wp_import.ts <quelle> --ziel=prod --schreiben` unter
`infisical run --env=prod`; `SUPABASE_DB_URL_PROD` und
`SUPABASE_SERVICE_ROLE_KEY` kommen von dort, die GoTrue-Basis leitet das Script
aus der geprüften Kennung ab. Erst den Lauf OHNE `--schreiben` lesen.

Danach 8.5 (zweites, unverlinktes Deployment gegen die Infisical-Umgebung
`prod`; E-Mail-Bestätigung in PROD für die Dauer der Probe an) und 8.6 (Donald
und Detlev in `staff_roles`, **nach** dem Import und erst nachdem geprüft ist,
ob einer von beiden in der CSV steht).

## Was beim Bauen auffiel

- **Gemini versagt still, mit Exit-Code 0** — dreimal: unbekanntes Flag
  (`--approval-mode plan`), und zweimal gar keine Ausgabe bei Diff auf `stdin`
  (507 kB und 137 kB). Der einzige produktive Lauf erfand eine Datei. Es liest
  richtig, gibt aber falsche Zeilennummern (324 statt 374). Beim nächsten Mal
  von vornherein datei-einzeln mit kurzem Auftrag.
- **Ein bestehender Test WAR der Befund.** „überspringt ein bereits gewandeltes
  Bild" legte als Zieldatei die Zeichenkette „SCHON DA" ab — kein Bild. Er
  sicherte damit genau ab, dass blosse Existenz als Erfolg gilt.
- **Ein Test-Doppel, das JEDEN Pfad abbildet, trifft auch die Repo-Wurzel** —
  dann vergleicht die Prüfung den Pfad mit sich selbst und meldet „im
  Arbeitsbaum". Grün war der Code, rot der Test.
- **`perl -0pi` mit `[^}]*?` über verschachtelte Klammern zerlegt Dateien.** Es
  traf zwei `${repoWurzel}`-Template-Literale mitten im Ausdruck. Zurücksetzen
  ging nicht, weil im selben File ungesicherte neue Tests lagen.

## Open questions

- **Das Admin-Werkzeug als Löschweg** (`admin-profile.ts:170-171`). Die
  Entscheidung vom 15.08. („ein späterer Lauf holt das Importbild zurück, wenn
  die Spalte `null` ist") wurde getroffen, als nur das Mitglied die Spalte
  leeren konnte. codex nennt den Admin-Weg. Nicht angefasst — eigener Nachlauf.
- **LOW aus dem Diff-Review, bewusst offen:** `PublicProfilePage.tsx:347-358`,
  Überlaufmessung nur bei Textwechsel, kein `ResizeObserver`, offener Zustand
  überlebt den Profilwechsel.
- **Header-Grössen nach der ersten Migration prüfen** (Donald, 15.08.).
- **`paid_until` (3.5)** — hängt weiter an Detlevs Zahlungsständen.
- **Was sollte in „Mitgliedschaft" (`infos_16`) stehen?** Bestätigen lassen.
- **`demo_seed.lib.ts` trägt die überholte Annahme** „dev and prod are the SAME
  Supabase project" — eigener Nachlauf.
- Unverändert: AGE-497 · AGE-541 · AGE-258 · AGE-522 · AGE-512 · AGE-561 ·
  `finish-ui-polish` trägt AGE-291 und AGE-258 · `add-academy-content`
  unarchivierbar.
