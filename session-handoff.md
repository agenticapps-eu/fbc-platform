# Session Handoff — 2026-08-05 (8. Session)

## Stand in einem Satz

**C4 / AGE-496 ist gebaut, ausgerollt und als PR #112 offen.** 24 Commits auf
`donald/age-496-c4-supabase-trennen-neues-prod-projekt-altes-wird-devdemo`,
CI grün. **7 Task-Punkte offen**, davon 5 erst nach dem Merge machbar.

## Accomplished

**PROD (`viwntbodrtqxgmqyxluh`, `eu-central-1`, Org `factiv`) steht vollständig:**
40 Migrationen (diff-frei gegen beide Projekte) · Auth- und
Storage-Konfiguration nachgemessen · `avatars`-Bucket mit belegter RLS ·
3 Edge Functions, 22 Secrets, alle drei lehnen nachweislich korrekt ab ·
Webhook-Funktion und -Trigger · 2 Admin-Konten (`donald@factiv.eu`,
`detlev.krause@dkrealinvest.com`), `is_admin()` beidseitig `true`,
`anon` darf die Funktion nicht einmal ausführen · **0 Demo-Personas**.

**Repo:** `config.toml` beschreibt PROD · `db:push:prod`/`config:push:prod` mit
zweistufiger Zielprüfung · Migrations-Drift-Gate **und** Objekt-Drift-Scan,
beide unter Test · drei CI-Jobs + eigener `migrate-prod`-Workflow ·
DEV-Kennzeichnung in der App · ADR-0004, Runbook, `secrets.md`, `ci-cd.md`,
`.env.example` · `DB-AUDIT.md`.

387 Tests · `openspec validate --all` 26/26 · GitHub-Secrets gesetzt.

**Die Kernzusage hält, am Bundle gemessen:** Preview und Produktiv-Auslieferung
enthalten beide **nur** `foelowldexkcqzewvrcf`. PROD ist aufgesetzt, aber
unbenutzt, bis die Go-Live-Woche zwei `VITE_*`-Werte umstellt.

## Next session: start here

**1. `/cso` → `SECURITY.md` (Task 15.1).** Der letzte Task, der ohne Merge
geht. Der Change fasst Auth-Konfiguration, Secrets und Storage-Policies an.
`DB-AUDIT.md` (Task 15.2) liegt schon vor und sollte als Eingabe dienen, nicht
noch einmal erhoben werden.

**2. Mergen.** Danach laufen `migrate-dev` und `drift-gate` zum ersten Mal
echt. Erwartung: beide grün, weil beide Projekte 40/40 abweichungsfrei sind.
Erwartung, kein Beleg — wären die GitHub-Secrets vertauscht, fiele es genau
dort auf.

**3. Die Abnahmen, die den ganzen Change tragen (16.2 / 16.2a / 16.2b).**
Ein grünes Gate beweist nichts, ein rotes beweist alles:

- **16.2** Wegwerf-Migration lokal anlegen, **nicht** auf PROD anwenden →
  `drift-gate` muss rot werden und `deploy` verhindern. Danach zurücknehmen.
- **16.2a** andere Richtung: eine Migration remote verzeichnen, die lokal
  fehlt → ebenfalls rot. **Gegen DEV proben, nicht gegen PROD.**
- **16.2b** `migrate-dev` gezielt scheitern lassen → `deploy` darf nicht
  starten, obwohl PROD abweichungsfrei ist.

**4.** Dann 16.4 (`openspec validate`), 16.5 (Code-Review in unabhängigem
Kontext), 16.6 (Linear — erst `get_issue` lesen, die GitHub-Automation schaltet
selbst), `openspec archive`, Merge.

## Was beim Bauen schiefging — die fünf Sachen, die den Change erklären

1. **`config push` überträgt die ganze Datei, nicht die Absicht.** Am _leeren_
   PROD-Projekt gemessen: geplant fünf Felder, bewegt **zehn**. Ungewollt u. a.
   `smtp_max_frequency` 60→1 und MFA/TOTP aus. Genau dafür lief die Messung am
   leeren Projekt.
2. **Die Auth-Mail-Rate lässt sich nicht erhöhen.** `HTTP 401 Custom SMTP
required`. Ohne eigenen SMTP: **2 Mails/Stunde projektweit**. „Passwort
   vergessen" ist bis C3 kein verlässlicher Weg. `email_sent` steht deshalb auf
   `2` statt auf einem `30`, das still nicht greift.
3. **Das Drift-Gate wäre blind geworden.** Die Supabase-CLI stellte zwischen
   2.107.0 und 2.111.0 von ASCII-Tabelle auf JSON um; der `sed`-Parser fand
   keine Zeile. Rot wurde es nur wegen der Kreuzprobe gegen die Repo-Dateien —
   sonst hätte es „keine Abweichung" gemeldet, während **0 von 40** Migrationen
   auf PROD standen. Auswertung liegt jetzt unter Test.
4. **`migrate-prod.yml` hätte bei jedem Lauf abgebrochen** — eigene Regex auf
   `db.<ref>.supabase.co`, unsere URLs sind Pooler-URLs.
5. **Der Pooler-Host ist pro PROJEKT verschieden**, nicht pro Region (alt
   `aws-1`, neu `aws-0`), und `db.<ref>.supabase.co` löst nur auf IPv6 auf —
   aus CI nicht erreichbar.

Dazu zwei eigene Messfehler, beide korrigiert und im jeweiligen Dokument
benannt: das Drift-Gate wurde anfangs aus dem falschen Grund rot
(Spaltentrennzeichen ging verloren), und die erste Sichtbarkeitsmessung im
DB-Audit zählte alle Tabellen in _einer_ Transaktion — nach der ersten
Verweigerung meldete jede weitere Zeile „verweigert", was sich wie „anon sieht
nichts" las.

## Decisions (alle von Donald, 2026-08-05)

- **Task 4.6 zurückgestellt:** kein `production`-Environment mit
  Freigabepflicht, er ist der einzige Entwickler. Folge: `apply` läuft direkt
  hinter `plan`, der Dry-Run steht im Log, aber niemand muss ihn gelesen haben.
  Befehl zum Nachziehen im Runbook.
- **Resend/SMTP kommt in C3, nicht in C4.** Folge siehe oben, Punkt 2.
- **MFA/TOTP bleibt aus** — die App hat keine MFA-Oberfläche.
- **DB-AUDIT Befund 1 auf C3 vertagt** (siehe Offene Fragen).
- **`email_sent` von 30 auf 2 zurück**, weil ein Wert, der still nicht greift,
  genau der Fehlerfall ist, den dieser Change abschafft.

## Open questions

- **DB-AUDIT Befund 1 — in C3 prüfen, nicht abnicken.** Ein frisch
  registriertes Konto ohne Profil und Stufe sieht 36 von 37 Profilen über
  `profiles_public` und alle `members`-Events. E-Mail-Bestätigung hebt die
  Hürde nur von „nichts" auf „eine Wegwerf-Adresse" und ändert **nichts**
  daran, dass die View für jedes `authenticated`-Konto lesbar ist. Drei
  Prüffragen stehen in `DB-AUDIT.md`, inkl. der Falle, dass
  `mailer_autoconfirm` **invertiert** zu `enable_confirmations` steht.
- **Supabase-CA fehlt.** Der Objekt-Drift-Scan läuft mit
  `DB_SCAN_TLS_INSECURE=1` (verschlüsselt, Server nicht authentifiziert). CA
  liegt im Dashboard unter Settings → Database → SSL configuration; danach
  `DB_SCAN_CA_CERT` setzen und das Flag entfernen. Sichtbar im Workflow
  vermerkt, nicht versteckt.
- **Echt-Link-Probe (Task 9.3) erst in der Go-Live-Woche.** Ein
  Zurücksetzungs-Link des neuen Projekts zeigt auf `site_url` =
  `fbc-platform.pages.dev`, und diese Auslieferung spricht noch mit dem alten
  Projekt. Steht in der Go-Live-Checkliste.
- **`custom_oauth_max_providers` sprang 3 → 32767** beim ersten `config push`.
  Steht in keiner `config.toml`. Ungeklärt, harmlos.
- **`avatars`-Bucket ist public** (DB-AUDIT Befund 2, NIEDRIG). Umstellung auf
  signierte URLs ist ein Frontend-Eingriff, gehört nicht in C4.
- **Nachläufe aus AGE-494**, unverändert offen: „Meine Communities" auf
  `/kontakte` · `NUR_REDIRECT` handgepflegt · `ChipGroup`/`ChipFilterGroup`
  dupliziert · roher `23505` beim Kategoriewechsel · Preview-Abnahme durch
  Detlev.

## Fallen, die weiter gelten

- **`git add -A` ist in diesem Repo verboten** — der Arbeitsbaum trägt dauerhaft
  untracked Dateien mit Rechten 0600, und das Repo ist öffentlich.
- **`psql` gibt es auf dieser Maschine nicht.** DB-Zugriff über `pg` +
  `SUPABASE_DB_URL_*` aus Infisical.
- **`supabase test db` ohne Dateiliste meldet FAIL, obwohl grün** — die elf
  `probe_*.sql` sind kein pgTAP. CI ruft bewusst nur drei Dateien auf.
- **Der lokale Vite läuft ggf. auf IPv6** (`http://[::1]:PORT`), wenn ein
  fremder Prozess die IPv4-Adresse desselben Ports hält. Sonst wirkt ein
  fremder 404 wie ein Fehler der App.
