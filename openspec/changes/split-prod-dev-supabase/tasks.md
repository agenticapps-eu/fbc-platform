# Tasks — Supabase trennen: neues PROD-Projekt, altes wird DEV/DEMO (AGE-496)

**Reihenfolge ist Absicht.** Alles, was das Repo betrifft, kommt vor allem, was
die Infrastruktur betrifft — insbesondere `config.toml` (Task 2) vor jedem
`config push` (Task 9). Das neue Projekt entsteht erst, wenn die Dateien, die
darauf angewendet werden, korrekt sind.

**Jeder Infrastrukturschritt wird einzeln ausgeführt und einzeln belegt.**
Nicht am Stück. Vor jedem schreibenden Befehl wird das Zielprojekt ausgegeben
und gezeigt.

**Zwei Haltepunkte, an denen nicht weitergearbeitet wird:**
Task 6 (kostenpflichtige Ressource) und Task 14 (Schreibzugriff auf Infisical
`prod`).

---

## 0. Sicherung — vor allem anderen

- [x] 0.1 Vollständiger Dump des bestehenden Projekts, außerhalb des Repos.
      **Erledigt vor der Planung.** `~/Backups/fbc-platform/`, Rechte 0600:
      `2026-08-05_prod_roles.sql` (13 Z.), `_prod_schema.sql` (3.156 Z.),
      `_prod_data.sql` (1.411 Z.), `_prod_auth_storage_data.sql` (452 Z.) —
      zusammen 5.032 Zeilen.
      _Falle, die ins Runbook gehört: `supabase db dump` lässt `auth` und
      `storage` standardmäßig aus. Der erste Dump enthielt **null** `auth.users`.
      Erst `--schema auth,storage` holt die echten Menschen. Beim Rollback
      schlägt dieselbe Falle zu._
- [x] 0.2 Live-Auth-Konfiguration als Rückrollpunkt sichern.
      **Erledigt.** `2026-08-05_auth-baseline-foelowldexkcqzewvrcf.json`,
      242 Felder, über `GET /v1/projects/{ref}/config/auth`.
- [x] 0.3 Drift-Scan wiederholen und als Ausgangsbefund im Runbook festhalten:
      welche Objekte stehen in der DB, aber in keiner Migration?
      **Erwartung: genau das Webhook-Paar, sonst nichts.** Weicht das ab, ist
      Task 12 größer als geplant — dann erst hier klären.
      **Erledigt 2026-08-05.** Über 27 Funktionen, 8 Trigger und 28 Tabellen
      genau zwei Meldungen: `notify_contact_request_webhook` und
      `contact_requests_email_webhook`. Keine dritte Abweichung → Task 12 bleibt
      im geplanten Umfang. Befund steht im Runbook, Abschnitt „Der Drift-Scan".

## 1. Feature-Branch

- [x] 1.1 `donald/age-496-c4-supabase-trennen-neues-prod-projekt-altes-wird-devdemo`
      von aktuellem `main`. Kein Commit auf `main`.
      _`git add -A` ist in diesem Repo verboten: der Arbeitsbaum trägt dauerhaft
      untracked Dateien mit Rechten 0600, und das Repo ist öffentlich. Dateien
      einzeln stagen._
      **Erledigt.** Commit `18203e9`, acht Dateien einzeln gestaged; die vier
      untracked 0600-Pfade sind nachweislich draußen geblieben.

## 2. `config.toml` produktionstauglich machen — vor jedem Push

**`config.toml` ist ab jetzt die Konfiguration von PROD, nicht von beiden**
(Entscheidung 12). Sie wird nie gegen DEV gepusht; DEV behält seine
Dashboard-Konfiguration.

- [x] 2.1 Auth-Block auf die Zielwerte bringen. **Die Schlüssel heißen in der
      Datei anders als in der Management-API** — hier gelten die
      `config.toml`-Namen:

      | Schlüssel | Zeile | vorher | nachher |
      |---|---|---|---|
      | `site_url` | 154 | `http://127.0.0.1:3000` | `https://fbc-platform.pages.dev` |
      | `additional_redirect_urls` | 156 | `["https://127.0.0.1:3000"]` | s. u. |
      | `minimum_password_length` | 175 | `6` | `10` |
      | `[auth.rate_limit] email_sent` | 189 | `2` | `30` |
      | `[auth.email] enable_confirmations` | 216 | `false` | **unverändert `false`** |

      Allow-List **strikt, ohne localhost**:
      `https://fbc-platform.pages.dev/**`, `https://app.fairbusinessclub.de`,
      `https://app.fairbusinessclub.de/**`.
      Die Custom Domain steht in der Liste, wird aber **nicht** `site_url`:
      AGE-256 ist blockiert (Entscheidung 6).
      _Kein `http://localhost:5173`, kein `*.fbc-platform.pages.dev`-Wildcard:
      auf einem Projekt mit echten Mitgliedern ist eine Loopback-Adresse in der
      Allow-List ein Abflussweg für Magic-Links, und der Preview-Wildcard
      gehört zu DEV, nicht zu PROD._

- [x] 2.2 Kopfkommentar über den Auth-Block: warum diese Werte, seit wann, dass
      `enable_confirmations = false` eine Entscheidung ist und kein Versehen
      (C3 baut den Aktivierungsweg über Resend), **und dass diese Datei PROD
      beschreibt** — damit niemand sie versehentlich gegen DEV pusht.
- [x] 2.3 **Verifikation:** `git diff supabase/config.toml` zeigt genau diese
      Felder und keine weiteren. Insbesondere kein `project_id`, keine Ports,
      kein `[functions.*]`-Block verändert.

## 3. `db:push:prod`

**Die Bestätigung ist zweistufig** (Entscheidung 11). Stufe 1 prüft maschinell,
Stufe 2 fragt den Menschen. Der erste Entwurf hatte nur Stufe 2 und hielt sie
für beides — das war zirkulär.

- [x] 3.1 `scripts/prod-project-ref.txt` mit dem PROD-Ref, committed. **Die vom
      Ziel unabhängige Quelle.** Kein Geheimnis: der Ref steht in jedem
      ausgelieferten Client-Bundle. Wird in Task 6 gefüllt; bis dahin trägt die
      Datei einen Platzhalter, den Stufe 1 als „noch nicht gesetzt" ablehnt.
- [x] 3.2 **RED zuerst.** `scripts/db-push-prod.test.ts` über die reine Logik.
      Prüffälle:
      fehlendes `SUPABASE_DB_URL_PROD` → Abbruch ·
      **URL zeigt auf den DEV-Ref, Sollwert ist der PROD-Ref → Abbruch in Stufe 1,
      ohne dass je eine Eingabe verlangt wird** (der Fall, den der erste Entwurf
      durchgelassen hätte) ·
      Platzhalter im Sollwert → Abbruch ·
      Ref stimmt, Eingabe ≠ Ref → Abbruch ·
      Ref stimmt, Eingabe = Ref → Freigabe ·
      `--include-seed` in den Argumenten → Abbruch.
      _Reine Funktionen in einer eigenen Datei, damit der Test kein `vi.mock`
      auf eigene Bausteine braucht — Mock-Zirkelschlüsse sind hier ein
      wiederkehrender Fehler._
- [x] 3.3 `scripts/db-push-prod.sh` + die getestete Logik. Ablauf:
      **Stufe 1** — Ref aus `SUPABASE_DB_URL_PROD` extrahieren, gegen
      `prod-project-ref.txt` halten, bei Abweichung abbrechen.
      **Stufe 2** — aufgelösten Host anzeigen → `--dry-run` → Migrationsliste →
      Ref tippen lassen → anwenden.
      `--include-seed` wird abgewiesen. Kein `supabase link`, nie.
      **Abweichung vom Plan, bewusst:** umgesetzt als `scripts/push-prod.ts`
      (via `tsx`), nicht als `.sh`. Grund: die geprüfte Logik ist TypeScript;
      ein Bash-Skript bräuchte für Stufe 1 ohnehin einen Brückenprozess.
      `tsx`-Skripte sind hier bereits Konvention (`demo:seed`). Task 3.4
      teilt sich dieselbe Datei — Ziel als erstes Argument (`db` | `config`).
- [x] 3.4 Dasselbe für `scripts/config-push-prod.sh` + `config:push:prod` —
      auch `config push` bestimmt sein Ziel sonst über den Link.
- [x] 3.5 `"db:push:prod"` und `"config:push:prod"` in `package.json`, mit
      `infisical run --env=prod`. Bestehendes `db:push` unverändert.
- [x] 3.6 **Verifikation:** Test rot → grün belegt, mit besonderem Augenmerk auf
      den Zirkelschluss-Fall. Dazu ein Trockenlauf, bei dem
      `SUPABASE_DB_URL_PROD` absichtlich auf das **alte** Projekt zeigt: er muss
      in Stufe 1 abbrechen und **nie nach einer Eingabe fragen**. Ausgabe zeigen.

## 4. AGE-257 — die drei Jobs

- [x] 4.1 `migrate-dev` in `deploy.yml`: `if: github.ref ==
'refs/heads/main'`, `supabase db push --db-url $SUPABASE_DB_URL_DEV`.
      **Nicht auf Pull Requests** — sonst mutiert jeder offene PR das
      DEV-Projekt mit ungereviewten Migrationen.
- [x] 4.2 `drift-gate`: vollständiger Vergleich der Migrationshistorie gegen
      PROD, **in beide Richtungen** — lokal-fehlend, remote-fehlend und
      abweichende Reihenfolge sind alle Drift (Entscheidung 15). Nur „lokal
      vorhanden, remote fehlend" zu prüfen ginge an dem Fall vorbei, den
      AGE-257 im Juni tatsächlich reparieren musste.
      **Muss fehlschlagen, wenn es nicht messen kann** (Secret fehlt, DB nicht
      erreichbar). Ein Gate, das bei Nichtwissen grün wird, baut die
      Juni-Havarie eine Ebene höher nach.
      **Nachgezogen 2026-08-05, aus Schaden:** die erste Fassung war ein
      `sed`-Parser in Bash. Die Supabase-CLI stellte zwischen 2.107.0 und
      2.111.0 von einer ASCII-Tabelle auf JSON um — der Parser fand danach
      **keine einzige Zeile**. Rot wurde das Gate nur wegen der Kreuzprobe
      gegen die Dateien im Repo; ohne sie hätte es „keine Abweichung"
      gemeldet, während auf PROD null von 40 Migrationen standen.
      Die Auswertung liegt jetzt geprüft in `scripts/migration-drift.logic.ts`
      (10 Fälle), das Format wird explizit angefordert, und die vier
      „wirft"-Tests sind gegen eine absichtlich nachlässige Variante
      gegengeprüft.
- [x] 4.3 `migrate-prod`: `workflow_dispatch`, `environment: production` mit
      Freigabepflicht (Entscheidung 13). Gibt **vor** dem Anwenden den
      aufgelösten Host und den `--dry-run` ins Log — die Freigabe wird auf
      etwas Lesbares erteilt. Bricht ab, wenn für denselben Commit kein
      erfolgreicher `migrate-dev`-Lauf vorliegt. Führt den Drift-Scan aus
      Task 12 mit aus.
      **Teilweise:** Der Drift-Scan aus Task 12 existiert noch nicht; der Job
      faehrt bereits das Migrations-Drift-Gate mit. Der Objekt-Drift-Scan
      (`scripts/db-drift-scan.sh`) wird in Task 12.2 nachgezogen.
      **Abweichung, bewusst:** eigener Workflow `migrate-prod.yml` statt eines
      Jobs in `deploy.yml`, und zwei Jobs (`plan` -> Freigabe -> `apply`).
      Grund: ein `workflow_dispatch` in `deploy.yml` loeste auch einen Deploy
      aus, dessen `cancel-in-progress: true` eine laufende PROD-Migration
      abbrechen duerfte. Und die Freigabe greift VOR dem Job — nur mit
      getrenntem `plan` steht der Dry-Run im Log, wenn freigegeben wird.
- [x] 4.4 `deploy` bekommt `needs: [migrate-dev, drift-gate]` — **beide**,
      damit ein Fehlschlag der Frühwarnung nicht lautlos bleibt.
- [x] 4.5 Alle neuen Jobs in die bestehende `concurrency`-Gruppe; `drift-gate`
      misst gegen denselben `github.sha`, den `deploy` ausliefert.
      **Abweichung, bewusst:** gilt für `migrate-dev` und `drift-gate` (sie
      liegen in `deploy.yml` und erben die Gruppe). `migrate-prod` bekommt eine
      **eigene** Gruppe mit `cancel-in-progress: false` — in der geteilten
      Gruppe dürfte ein neuer Deploy eine laufende PROD-Migration abbrechen.
- [x] 4.6 ~~`production`-Environment auf GitHub anlegen, mit Donald als
      erforderlichem Freigebenden.~~
      **ZURÜCKGESTELLT (Donald, 2026-08-05).** Entscheidung 16 eingeschränkt:
      Donald ist derzeit der einzige Entwickler, eine Freigabe an sich selbst
      ist keine zweite Instanz. `environment: production` bleibt im Workflow
      stehen, trägt aber keine Reviewer-Regel.
      _Was dadurch nicht mehr trägt: die Pause zwischen „Log gelesen" und
      „angewendet". `apply` läuft direkt hinter `plan` los — der Dry-Run steht
      im Log, aber niemand muss ihn angesehen haben. Es bleibt: Handauslöser,
      Beleg für `migrate-dev` desselben Commits, Host und Dry-Run im Log._
      **Sobald ein zweiter Mensch am Repo arbeitet, nachziehen** — Befehl im
      Runbook, Abschnitt „Migrationen von Hand auf PROD".
- [x] 4.7 **Verifikation:** `actionlint` bzw. `gh workflow view` parst die
      Datei. Der Beleg, dass das Gate greift, entsteht erst in Task 16 — hier
      wird nur die Syntax abgenommen, und das wird auch so gesagt.

## 5. DEV-Hinweis in der App

- [x] 5.1 **RED zuerst.** Test: bei `VITE_ENVIRONMENT !== 'prod'` ist der
      Hinweis im Dokument, bei `'prod'` nicht.
      _Assertion auf sichtbaren Text, nicht auf einen Klassennamen._
- [x] 5.2 Komponente + Einhängen in die Shell. Dauerhaft sichtbar, nicht
      wegklickbar, aber nicht im Weg.
      **Abweichung, bewusst:** gemountet in `App.tsx` statt in `AppShell` —
      sonst fehlte die Kennzeichnung ausgerechnet auf `/login` und
      `/onboarding`, wo sich entscheidet, gegen welches Projekt jemand
      arbeitet. Position: unten mittig. Unten links sitzt der Einklapp-Knopf
      der Sidebar, unten rechts die Toasts; der erste Entwurf verdeckte den
      Knopf — im Screenshot gesehen, nicht im Test.
- [x] 5.3 **Verifikation:** Test grün **und** ein Screenshot aus der laufenden
      lokalen App, einer mit und einer ohne Hinweis.
      _Regel aus AGE-492: grüne Tests haben dort ein visuell falsches Ergebnis
      durchgewunken. Erst zeigen, dann committen._

## 6. ⛔ HALTEPUNKT — neues Projekt anlegen

- [x] 6.1 `supabase projects list` ausgeben und zeigen, gegen welches Projekt
      gerade gearbeitet wird.
- [x] 6.2 Den geplanten Befehl **vorlegen und warten**: Organisation, Region,
      Plan, Projektname. Region `eu-central-1` wie das bestehende Projekt
      (DSGVO, gleiche Latenz). Organisation `factiv`.
      **Der Plan ist unbestätigt** — der Management-Token lag beim Erheben nicht
      als Datei vor. Indiz: `factiv` führt drei aktive Projekte, der Free-Tier
      deckelt bei zwei. Wird vor dem Anlegen bestätigt, nicht angenommen.
      **Hier wird nicht weitergearbeitet, bis das OK vorliegt.**
- [x] 6.3 Nach dem Anlegen: Ref notieren, `supabase projects list` erneut
      ausgeben.
- [x] 6.4 `scripts/prod-project-ref.txt` mit dem echten Ref füllen (Task 3.1)
      und den Test aus 3.2 erneut fahren — der Platzhalter-Fall ist danach
      grün, weil kein Platzhalter mehr dasteht.
- [x] 6.5 Eigenes DB-Passwort für PROD setzen.
      **Erledigt von Donald am 2026-08-05.** Projekt `fbc-platform-prod` =
      `viwntbodrtqxgmqyxluh`, Org `factiv`, `eu-central-1`, ACTIVE_HEALTHY.
      Der Plan der Org ist damit belegt statt vermutet: vier aktive Projekte
      in einer Org, der Free-Tier deckelt bei zwei. **Nicht das geteilte aus `dev`
      übernehmen** — getrennte Zugangsdaten sind eine Zusage dieses Changes.

## 6a. Messung: setzt `config push` unerwähnte Felder zurück?

Diese Frage ist offen und wird am leeren Projekt beantwortet, **bevor** je ein
Push ein Projekt mit Daten trifft (`design.md` Abschnitt C).

- [x] 6a.1 Auth-Baseline des neuen, noch unberührten Projekts ziehen.
- [x] 6a.2 `config push` gegen dieses Projekt.
- [x] 6a.3 Baseline erneut ziehen und beide Stände über **alle 242 Felder**
      diffen.
- [x] 6a.4 **Verifikation:** die Liste der Felder, die sich geändert haben,
      ohne in `config.toml` zu stehen. Ist sie leer, ist die Sorge ausgeräumt.
      Ist sie es nicht, gehört jedes Feld darin ins Runbook — und Task 9.2
      gegen ein Projekt mit Daten wird neu bewertet.

      **Gemessen 2026-08-05. Die Liste ist NICHT leer — die Sorge war
      berechtigt.** Geplant waren fünf Felder, bewegt haben sich **zehn**, und
      einer der fünf ist **nicht angekommen**:
      ungewollt verändert: `smtp_max_frequency` 60→1 · `mfa_totp_enroll_enabled`
      true→false · `mfa_totp_verify_enabled` true→false · `mailer_otp_length`
      8→6 · `password_required_characters` None→'' · `custom_oauth_max_providers`
      3→32767 (unerklärt, steht in keiner `config.toml`).
      **`rate_limit_email_sent` blieb auf 2.** Ein direkter PATCH über die
      Management-API antwortet `HTTP 401 Custom SMTP required to configure ...
      RATE_LIMIT_EMAIL_SENT` — der Wert ist ohne eigenen SMTP nicht erhöhbar.
      Volle Tabelle im Runbook, Abschnitt „Was `config push` wirklich anfasst".
      **Folge für Task 9.2:** vor jedem Push auf ein bewohntes Projekt derselbe
      Ablauf — Baseline, Push, Baseline, Diff über alle Felder. Der Diff, den
      die CLI selbst zeigt, reicht nicht: er nennt die Felder, aber nicht,
      welche davon niemand bewusst gesetzt hat.
      **Zwei Werte in `config.toml` daraufhin korrigiert:**
      `[auth.email] max_frequency` 1s→60s (der Push hatte 60→1 gesetzt) und
      `[auth.rate_limit] email_sent` 30→2, weil ein `30`, das still nicht
      greift, genau der Fehlerfall ist, den dieser Change abschaffen soll.

- [x] 6a.5 **Neu, aus der Messung:** `supabase config push` bricht nach dem
      Auth-Teil ab mit `failed to read Storage config: SchemaError(Missing key
at ["databasePoolMode"])`. Der Auth-Teil ist nachweislich angekommen (s.
      Diff oben), der Storage-Teil nicht. Verdacht: CLI 2.107.0 gegen eine
      neuere API — 2.111.0 ist verfügbar. Erst CLI aktualisieren, dann erneut
      pushen und **erneut diffen**, nicht annehmen.

## 7. Migrationen auf PROD

- [x] 7.1 Alle 40 Migrationen anwenden — über den in Task 3 gebauten Weg, nicht
      von Hand. Das ist zugleich dessen erster echter Lauf.
- [x] 7.2 **Verifikation:** `supabase migration list` gegen **beide** Projekte,
      Ausgabe je vollständig zeigen. Diff-frei.
      _Ausgangslage zum Vergleich: das bestehende Projekt ist heute diff-frei,
      40 lokale Dateien zu 40 Remote-Zeilen._

## 8. Storage

- [x] 8.1 Prüfen, dass der `avatars`-Bucket auf PROD existiert (kommt aus
      `20260613081627_profile_editor_storage.sql` mit `db push`).
- [~] 8.2 Einen Upload gegen PROD testen und danach **wieder löschen**.
- [~] 8.3 **Verifikation:** Bucket vorhanden, Upload in den eigenen Ordner
  erlaubt, Upload in einen fremden Ordner abgelehnt (die RLS-Policy ist der
  eigentliche Prüfgegenstand, nicht die Existenz des Buckets). Keine
  Demo-Avatare auf PROD — das ist gewollt.
  **Teilweise erledigt 2026-08-05.** Bucket `avatars` steht (`public = true`),
  und die drei Policies auf `storage.objects` sind da: `avatars_insert_own`
  (WITH CHECK), `avatars_update_own`, `avatars_delete_own` — jeweils nur für
  `authenticated` und nur im Ordner `(storage.foldername(name))[1] =
    auth.uid()`. **Der Upload-Versuch selbst wandert hinter Task 11**: er
  braucht eine echte Sitzung, und auf PROD gibt es noch keine Konten.

## 9. Auth-Konfiguration auf PROD

Erledigt Task 6a bereits den Push; hier wird abgenommen, nicht wiederholt.

- [x] 9.1 `config:push:prod` (Task 3.4) statt `config push` direkt — dieselbe
      Ref-Prüfung wie beim Migrations-Push. **Ohne `--yes`**, damit der Diff vor
      der Bestätigung sichtbar ist. Der Diff wird gezeigt.
- [x] 9.2 **Nicht gegen DEV pushen.** `config.toml` beschreibt PROD
      (Entscheidung 12). DEVs Auth-Konfiguration bleibt im Dashboard.
- [~] 9.3 **Verifikation:** `GET /v1/projects/<prod-ref>/config/auth` erneut
  abrufen und die fünf Zielfelder gegen die Tabelle aus Task 2.1 halten.
  Ausdrücklich prüfen, dass `uri_allow_list` **keine** Loopback-Adresse
  enthält.
  **Konfigurationsteil erledigt 2026-08-05:** `site_url`,
  `password_min_length` 10, `mailer_autoconfirm` true, `smtp_max_frequency`
  60 — alle wie geplant; `uri_allow_list` trägt **keine** Loopback-Adresse.
  `rate_limit_email_sent` steht bei 2 und ist ohne eigenen SMTP nicht
  erhöhbar (6a.4).
  **Offen: die Echt-Link-Probe.** Sie braucht ein Konto und wandert deshalb
  hinter Task 11.
  Dazu ein **echter Link**: eine Passwort-Zurücksetzung anfordern und
  prüfen, dass die Zieladresse in der `site_url`-Domain liegt und der Link
  einlösbar ist. Ein Konfigurationswert, der richtig aussieht, ist kein
  Beleg — der Link ist einer.
- [x] 9.4 Alle Baseline-Dateien liegen außerhalb des Repos mit Rechten 0600.
      _Nachgemessen für das alte Projekt: die Datei enthält keine Zugangsdaten
      (57 Felder mit sensiblem Namen, sechs nicht leer, alle Einstellungen oder
      Mail-Vorlagen). Auf einem Projekt mit eigenem SMTP wäre das anders —
      deshalb gilt die Regel unabhängig vom Messergebnis._

## 10. Edge Functions auf PROD

- [x] 10.1 **Drei** Functions deployen: `create-checkout-session`,
      `stripe-webhook`, `notify-contact-request`.
      **Nicht vier** — `send-activation` existiert nicht und entsteht in C3
      (Entscheidung 1). Als offener Nachlauf ins Runbook.
- [x] 10.2 Die 15 von Hand gesetzten Secrets aus Infisical übertragen. Die 7
      plattform-injizierten (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`,
      `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`) **nicht** setzen.
      `APP_URL`/`APP_URLS` bekommen die PROD-Adresse, nicht die von DEV.
- [x] 10.3 **Verifikation:** je ein Smoke-Test.
      `create-checkout-session` ohne JWT → 401 (`verify_jwt = true`).
      `stripe-webhook` mit falscher Signatur → Ablehnung.
      `notify-contact-request` mit falschem Bearer → 401.
      Alle drei prüfen die Ablehnung, nicht den Erfolgsfall: dass eine Function
      antwortet, sagt nichts darüber, ob ihr Secret gesetzt ist — dass sie
      **richtig ablehnt**, schon.
      _`getUser()`/`getClaims()` scheitern hier projektweit an den asymmetrischen
      Signing Keys; die Functions lesen `sub` aus dem Gateway-verifizierten JWT.
      Ein 401 aus dieser Ecke wäre eine andere Ursache als ein fehlendes Secret._

      **Erledigt 2026-08-05, alle drei lehnen korrekt ab:**
      `create-checkout-session` ohne JWT → `401 UNAUTHORIZED_NO_AUTH_HEADER`
      (Gateway, `verify_jwt = true` greift) ·
      `stripe-webhook` mit falscher Signatur → `400 Bad signature` (die Prüfung
      ist gelaufen, das Secret liegt also an) ·
      `notify-contact-request` mit falschem Bearer → `401 Unauthorized`.
      Secrets: 22 auf beiden Projekten, je 15 selbst gesetzt + 7
      plattform-injiziert. `APP_URL`/`APP_URLS` tragen auf PROD
      `https://fbc-platform.pages.dev` — kein localhost, gleiche Begründung
      wie bei der Auth-Allow-List.

## 11. Admin-Konten und Rollen

- [ ] 11.1 Donald und Detlev registrieren sich auf PROD über die App. Passwörter
      setzen sie selbst; sie liegen nie im Repo.
      _Detlev hat zwei Accounts (mit und ohne Bindestrich in der Adresse) — vor
      dem Rollenlauf klären, welcher gilt, sonst sitzt der Admin wieder auf dem
      falschen._
- [ ] 11.2 `admin_roles.sql` gegen PROD ausführen, über `pg` statt `psql`
      (Entscheidung 8). Die echten Adressen werden übergeben, nicht in die Datei
      geschrieben.
- [ ] 11.3 **Verifikation:** `is_admin()` liefert für **beide** Konten `true`,
      und die Kontrollabfrage am Ende von `admin_roles.sql` zeigt genau zwei
      Zeilen — nicht mehr. Ausgabe zeigen.

## 12. Der Webhook, der nicht mitwandert

- [ ] 12.1 `notify_contact_request_webhook()` + Trigger
      `contact_requests_email_webhook` auf PROD anlegen, mit dem **PROD**-Ref in
      der Ziel-URL und dem `CONTACT_WEBHOOK_SECRET` als Bearer. Vorlage:
      `docs/secrets.md`.
- [ ] 12.2 Den Drift-Scan als Skript ablegen (`scripts/db-drift-scan.sh`), nicht
      nur als Runbook-Prosa — er läuft ab jetzt bei jedem `migrate-prod` mit
      (Task 4.3). Wird der Trigger später gelöscht, stirbt der Mailversand
      sonst wieder still (Entscheidung 15).
- [ ] 12.3 **Verifikation:** Drift-Scan gegen PROD wiederholen — er muss jetzt
      **leer** sein, während er vor diesem Schritt genau dieses Paar meldet.
      Rot vor grün, mit beiden Ausgaben.
- [ ] 12.4 Gegenprobe, dass der Scan im laufenden Betrieb greift: den Trigger
      auf **DEV** kurz entfernen, Scan zeigt ihn an, wiederherstellen, Scan ist
      leer. Auf DEV, nicht auf PROD.

## 13. Doku

- [ ] 13.1 `docs/decisions/0004-split-prod-dev-supabase.md` — löst ADR-0003 ab.
      Kontext, Entscheidung, verworfene Alternativen (die drei aus `design.md`),
      Konsequenzen.
- [ ] 13.2 ADR-0003 bekommt oben einen Superseded-Hinweis mit Datum und Verweis.
      **Nicht löschen**, nichts anderes darin ändern.
- [ ] 13.3 `docs/supabase-environments.md` als Runbook: welches Projekt welche
      Rolle trägt · wie eine Migration auf beide kommt · wie der Rollback geht ·
      die `auth`/`storage`-Falle beim Dump · der Drift-Scan · die Objekte, die
      bewusst keine Migration sind · die offenen Nachläufe (`send-activation` →
      C3, Stripe-Webhook-URL → Phase 2, Custom Domain → AGE-256, der Umzug der
      drei prod-Werte → Go-Live-Woche).
- [ ] 13.4 `docs/secrets.md`: zwei Projekte statt einem, `SUPABASE_DB_URL_DEV`
      und `SUPABASE_DB_URL_PROD` dokumentieren — **und den falschen Satz
      streichen**, die produktiven `VITE_*`-Werte kämen aus der
      Cloudflare-Pages-Build-Umgebung (Entscheidung 10).
- [ ] 13.5 `docs/ci-cd.md`: die drei neuen Jobs, das Gate, der Handauslöser.
- [ ] 13.6 `.env.example` um die beiden neuen Schlüssel ergänzen.

## 14. ⛔ HALTEPUNKT — Infisical

- [ ] 14.1 `dev` auf das **alte** Projekt festnageln. Heute ist es dieselbe
      Adresse — danach ist es eine Zusage statt eines Zufalls.
- [x] 14.2 `SUPABASE_DB_URL_DEV` in `dev`, `SUPABASE_DB_URL_PROD` in `prod`.
      **Vorgezogen und erledigt am 2026-08-05**, weil Task 6a ohne die
      PROD-URL nicht messbar ist. `prod` hat Donald selbst gesetzt (der
      Haltepunkt blieb gewahrt); `SUPABASE_DB_URL_DEV` in `dev` hat Claude
      angelegt, ohne den Wert je auszugeben — über eine 0600-Datei, damit er
      nicht in der Prozessliste steht.
      _Befund dabei: der erste Versuch trug **nur das Passwort** im Schlüssel
      `SUPABASE_DB_URL_PROD`. Stufe 1 hat das beim ersten echten Kontakt
      abgewiesen („kein Ref ableitbar") — der Guard hat sich selbst belegt._
      _Zweiter Befund: `db.<ref>.supabase.co` löst **nur auf IPv6** auf.
      GitHub-Actions-Runner sind IPv4 — beide URLs müssen der Session-Pooler
      sein (`aws-1-eu-central-1.pooler.supabase.com:5432`), sonst wären
      `migrate-dev` und `drift-gate` von CI aus nicht messfähig._
      **Der Schreibzugriff auf `prod` wird vorher vorgelegt.** Er ist additiv:
      kein bestehender Wert ändert sich, `VITE_SUPABASE_URL` in `prod` bleibt
      auf dem alten Projekt (Entscheidung 7).
- [ ] 14.3 Beide DB-URLs als GitHub-Secrets für die Jobs aus Task 4.
- [ ] 14.4 **Verifikation:** `VITE_SUPABASE_URL` in `prod` zeigt **weiterhin**
      auf `foelowldexkcqzewvrcf`. Das ist die Zusage dieses Changes: der Umzug
      passiert nicht hier.

## 15. Sicherheitsabnahmen

- [ ] 15.1 `/cso` → `SECURITY.md`. Der Change fasst Auth-Konfiguration, Secrets
      und Storage-Policies an.
- [ ] 15.2 `database-sentinel:audit` gegen **beide** Projekte → `DB-AUDIT.md`.
      Critical + High blockieren.

## 16. Gesamtabnahme

- [ ] 16.1 Preview-Deploy eines PR zeigt nachweislich auf DEV; `main` zeigt
      weiterhin auf das alte Projekt. Beleg: die im Bundle gebackene
      `VITE_SUPABASE_URL`, nicht die Absicht.
      _Cache-Buster allein reicht nicht; ein 404 tarnt sich als Bundle (2 kB
      statt 1,2 MB), und die Apex-URL hinkt der Deploy-URL hinterher._
- [ ] 16.2 **Das Gate wird echt geprüft, nicht angenommen.** Eine Wegwerf-
      Migration lokal anlegen, ohne sie auf PROD anzuwenden → `drift-gate` muss
      rot werden und `deploy` verhindern. Danach zurücknehmen.
      Das ist die einzige Abnahme, die belegt, dass AGE-257 wirklich geschlossen
      ist — ein grünes Gate beweist nichts, ein rotes beweist alles.
- [ ] 16.2a Die **andere** Drift-Richtung ebenso: eine Migration remote
      verzeichnen, die lokal fehlt → Gate muss ebenfalls rot werden. Gegen DEV
      proben, nicht gegen PROD.
- [ ] 16.2b Fehlschlag von `migrate-dev` hält `deploy` an: einen Lauf gezielt
      scheitern lassen und zeigen, dass `deploy` nicht startet, obwohl PROD
      abweichungsfrei ist.
- [ ] 16.3 Keine Demo-Personas auf PROD: Zählung über `profiles` und
      `auth.users` gegen die `@demo.fbc.invalid`-Adressen. Erwartung: null.
- [ ] 16.4 `openspec validate --all` grün.
- [ ] 16.5 `superpowers:requesting-code-review` in unabhängigem Kontext.
- [ ] 16.6 Linear AGE-496 und AGE-257 auf den Stand bringen.
      _Die GitHub-Automation schaltet In Progress/Done bei PR-Öffnung und
      -Merge selbst — erst `get_issue` lesen, dann entscheiden, ob überhaupt
      geschrieben werden muss._
