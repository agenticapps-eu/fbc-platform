# Supabase trennen: neues PROD-Projekt, altes wird DEV/DEMO

## Why

Am **17.08.2026** liegen ~70 echte Menschen mit Fotos, Kontaktdaten und
Zahlungshistorie in der Datenbank. Heute teilen sich dev und prod **ein**
Supabase-Projekt — das ist die praktische Ausprägung von ADR-0003, und ab dem
Import ist ein versehentliches `supabase db reset` ein Datenverlust mit
Meldepflicht.

Die Bestandsaufnahme hat das bestätigt, und zwar schärfer als vermutet. In
Infisical unterscheiden sich `dev` und `prod` in **genau einem** Wert:

|                          | dev                                        | prod      |
| ------------------------ | ------------------------------------------ | --------- |
| `VITE_SUPABASE_URL`      | `https://foelowldexkcqzewvrcf.supabase.co` | identisch |
| `VITE_SUPABASE_ANON_KEY` | sha256 `6f6fec21bb211d47`                  | identisch |
| `SUPABASE_DB_PASSWORD`   | sha256 `b8e8809f5c6f73c9`                  | identisch |
| `VITE_ENVIRONMENT`       | `dev`                                      | `prod`    |

Der einzige Unterschied zwischen „Entwicklung" und „Produktion" ist heute ein
Anzeige-String. Auch das DB-Passwort ist dasselbe — das ist kein Detail, sondern
der Grund, warum ein naives `db:push:prod` still auf das falsche Projekt
schreiben würde (Entscheidung 3).

Löst **ADR-0003** ab. Linear: **AGE-496**, schließt **AGE-257** mit.
Muss stehen, **bevor** C10 echte Personendaten importiert.

## What Changes

**Zwei echte Projekte, kein Umschalter.** Das neue Projekt wird PROD (leer, alle
Migrationen, alle Functions), das bestehende `foelowldexkcqzewvrcf` wird
DEV/DEMO und behält seine Demo-Personas. Die Umschaltmechanik existiert bereits
und wird nicht angefasst: `deploy.yml` setzt `INFISICAL_ENV` auf `prod` bei Push
auf `main` und auf `dev` bei Pull Requests, und Vite backt `VITE_SUPABASE_URL`
zur Build-Zeit ins Bundle. Cloudflare-Pages-Umgebungsvariablen sind dafür
irrelevant — der Build läuft in GitHub Actions, wrangler lädt nur fertige
Dateien hoch.

**`config.toml` wird vor jedem Push produktionstauglich gemacht.** Heute stünde
dort `site_url = "http://127.0.0.1:3000"`; live gilt
`https://fbc-platform.pages.dev`. Ein unbedachter Push setzte die Produktion auf
localhost — auf **jedem** Ziel, auch auf dem alten Projekt (Entscheidung 4).

**`db:push:prod` als eigener Weg mit getipptem Ziel**, nicht als Flag
(Entscheidung 3).

**AGE-257 wird mitgebaut**: DEV bekommt Auto-Apply auf `main`, PROD ein
Drift-Gate vor dem Deploy plus einen von Hand ausgelösten Apply-Job
(Entscheidung 5).

**Sichtbarer DEV-Hinweis** über das vorhandene `VITE_ENVIRONMENT`. Ab dem 17.08.
sehen beide Umgebungen gleich aus, aber nur eine enthält echte Menschen.

**Neuer ADR-0004**, der ADR-0003 ablöst; ADR-0003 bekommt einen
Superseded-Hinweis und bleibt stehen.

## Impact

- **Neue Capability `deployment-environments`** — welches Projekt welche Rolle
  trägt, wie eine Migration auf beide kommt, was die Auth-Konfiguration zusagt.
  Bisher stand davon nichts in einer Spec; es lebte in ADR-0003 als
  Zustandsbeschreibung, nicht als Zusage.
- **`access-control` erweitert** — die Mindestpasswortlänge und die
  Redirect-Allow-List sind Sicherheitsgrenzen und gehören dorthin, wo die
  übrigen stehen.
- **`.github/workflows/deploy.yml`** bekommt drei Jobs (`migrate-dev`,
  `drift-gate`, `migrate-prod`); `deploy` hängt neu an `drift-gate`.
- **`supabase/config.toml`** — Auth-Block auf Produktionswerte.
- **`package.json`** — `db:push:prod` plus `scripts/db-push-prod.sh`.
- **`docs/supabase-environments.md`** neu (Runbook), **`docs/secrets.md`** und
  **`docs/ci-cd.md`** auf zwei Projekte umgestellt.
- **Keine Migration.** Dieser Change ändert kein Schema. Das einzige DB-Objekt,
  das er anfasst, ist der Webhook-Trigger auf dem neuen Projekt — und der ist
  bewusst keine Migration (Entscheidung 2).
- **Kosten**: ein zweites Supabase-Projekt. Plan und Organisation werden vor dem
  Anlegen bestätigt, nicht angenommen.

## Decisions taken during scoping

1. **Es sind drei Edge Functions, nicht vier** (Befund, korrigiert AGE-496).
   AGE-496 zählt `create-checkout-session`, `stripe-webhook`,
   `notify-contact-request` **und `send-activation`** auf.
   `supabase/functions/` enthält die ersten drei; `send-activation` existiert
   nicht. Sie entsteht in C3, und C3 läuft nach C4. Die Abnahme „alle vier
   Functions deployed" ist in diesem Change nicht erfüllbar und wird auf drei
   zugeschnitten. Das Deployen der vierten wird eine C3-Aufgabe — im Runbook
   als offener Nachlauf vermerkt, damit sie nicht zwischen den Changes verloren
   geht.

2. **Der Contact-Request-Webhook wandert nicht mit `db push` und muss von Hand
   nachgezogen werden** (Befund, in AGE-496 nicht erwähnt). `docs/secrets.md`
   hält fest, dass der `pg_net`-Trigger **bewusst nicht** als Migration
   existiert: er trägt den Bearer-Token inline, und das Repo ist öffentlich.
   Ein Drift-Scan des Schema-Dumps gegen `supabase/migrations/` findet genau
   dieses eine Paar und sonst nichts:

   ```
   prod public functions: 27
   --- functions NOT mentioned anywhere in supabase/migrations/ ---
     DRIFT: notify_contact_request_webhook
   --- triggers on public NOT in migrations ---
     DRIFT: contact_requests_email_webhook
   --- tables NOT in migrations ---
   (Ende)
   ```

   Das ist die gute Nachricht darin: **ein** Objekt, nicht viele. Ohne diesen
   Schritt wäre auf PROD der Mailversand für Kontaktanfragen still tot — grün in
   jeder Prüfung, kaputt im Betrieb. Die URL im Trigger trägt den Projekt-Ref
   hart codiert, muss also umgeschrieben und nicht kopiert werden. Der
   Drift-Scan selbst wird Teil des Runbooks: er ist die einzige Prüfung, die
   „was steht in der DB, das in keiner Migration steht" überhaupt beantwortet.

3. **`db:push:prod` trägt sein Ziel explizit, weil `db push` am verlinkten
   Projekt hängt und nicht an der Infisical-Umgebung** (Befund, korrigiert die
   naheliegende Lesart von AGE-496). `pnpm db:push` ist
   `infisical run --env=dev -- supabase db push`; Infisical liefert dabei nur
   `SUPABASE_DB_PASSWORD`, das Ziel bestimmt `supabase/.temp/project-ref`. Ein
   `db:push:prod`, das sich nur durch `--env=prod` unterscheidet, schriebe
   weiter auf das **alte** Projekt — und weil beide Passwörter heute identisch
   sind, ohne Fehlermeldung. Deshalb: ein Skript, das aus einem eigenen
   `SUPABASE_DB_URL_PROD` baut, den aufgelösten Host anzeigt, `--dry-run`
   vorwegschickt und den Projekt-Ref **tippen** lässt. Getippt statt gesetzt,
   weil ein Flag genau das nicht prüft, worum es geht — und weil das Repo dieses
   Muster schon kennt (`DEMO_SEED_CONFIRM=fbc-demo`, ADR-0003). `supabase link`
   scheidet aus: es wechselt das Ziel still.

4. **`config.toml` wird korrigiert, bevor es irgendwohin geht — und die Gefahr
   ist größer als die vier Zeilen aus AGE-496.** Die Live-Konfiguration wurde
   über die Management-API als Rollback-Basis gesichert
   (`auth-baseline-<ref>.json`, 242 Felder). Der Vergleich:

   Die Spalten sprechen zwei Namensräume — links die Felder der Management-API,
   in der Mitte und rechts die Schlüssel aus `config.toml`. Sie heißen
   unterschiedlich und werden hier getrennt genannt, damit niemand einen
   API-Namen in die Datei schreibt (Befund aus dem Plan-Review):

   | API-Feld (live)         | live heute                                               | `config.toml`-Schlüssel             | heute                        | Ziel                             |
   | ----------------------- | -------------------------------------------------------- | ----------------------------------- | ---------------------------- | -------------------------------- |
   | `site_url`              | `https://fbc-platform.pages.dev`                         | `site_url`                          | `http://127.0.0.1:3000`      | `https://fbc-platform.pages.dev` |
   | `uri_allow_list`        | `http://localhost:5173,https://*.fbc-platform.pages.dev` | `additional_redirect_urls`          | `["https://127.0.0.1:3000"]` | strikt, **ohne localhost**       |
   | `password_min_length`   | 6                                                        | `minimum_password_length`           | 6                            | **10**                           |
   | `mailer_autoconfirm`    | `true`                                                   | `[auth.email] enable_confirmations` | `false`                      | unverändert                      |
   | `rate_limit_email_sent` | **2**                                                    | `[auth.rate_limit] email_sent`      | 2                            | **30**                           |

   Zwei Dinge, die AGE-496 nicht sagt. Erstens trifft ein Push **jedes** Ziel:
   auch auf dem alten Projekt überschriebe er die im Dashboard gesetzten Werte,
   die in keiner Datei stehen. Deshalb die Baseline vor dem ersten Push.
   Zweitens ist `rate_limit_email_sent = 2` **kein Push-Risiko, sondern der
   heutige Live-Zustand**: zwei Mails pro Stunde projektweit. Mit ~70
   Mitgliedern ist „Passwort vergessen" damit ab dem 17.08. praktisch
   unbenutzbar, und das unabhängig von diesem Change. Es wird hier
   mitgehoben, weil dieser Change ohnehin der ist, der die Auth-Konfiguration
   anfasst.

   `enable_confirmations` bleibt `false`: C3 baut den Aktivierungsweg über
   Resend, nicht über Supabase Auth.

5. **AGE-257 wird mitgebaut, mit auto-apply auf DEV und Handauslöser auf PROD**
   (Donald, 2026-08-05). Die Juni-Havarie war nicht „jemand hat vergessen zu
   pushen", sondern: CI grün, Frontend live, drei Migrationen fehlten, drei
   Features kaputt — und nichts hat widersprochen. Mit zwei Projekten verdoppelt
   sich die Fläche. Der gewählte Weg macht das DEV-Projekt zur Generalprobe auf
   echtem gehostetem Postgres **mit Daten drauf**, bevor ein Mensch dasselbe auf
   PROD auslöst. Das ist der Unterschied, den CI nicht abdeckt: `db reset` in
   `ci.yml` beweist, dass eine Migration auf eine **leere** Datenbank passt —
   ein `not null` auf einer gefüllten Tabelle fällt genau dort nicht durch.
   Der unumkehrbare Schritt bleibt eine Entscheidung; „live und unmigriert"
   fällt trotzdem sofort auf, weil `deploy` an `drift-gate` hängt.

6. **`site_url` bleibt vorerst `https://fbc-platform.pages.dev`** (Donald,
   2026-08-05). `app.fairbusinessclub.de` ist als Custom Domain vorgesehen, aber
   AGE-256 ist als blockiert dokumentiert (Domain-Zugang). Die Domain kommt in
   die Allow-List, wird aber erst `site_url`, wenn sie wirklich auflöst — sonst
   zeigen alle C3-Aktivierungslinks ins Leere, und zwar erst, nachdem die
   Rundmail raus ist. Der Umstieg ist ein zweiter `config push` in der
   Go-Live-Woche und steht als solcher im Runbook.

7. **Die Infisical-`prod`-Umgebung bleibt in diesem Change unverändert.** Sie
   zeigt weiter auf das alte Projekt. Nur `dev` wird auf das alte Projekt
   **festgenagelt** — heute ist es dieselbe Adresse, aber danach ist es eine
   Zusage statt eines Zufalls. Der finale Umzug der drei prod-Werte ist ein
   eigener, bewusster Schritt in der Go-Live-Woche.

8. **Admin-Rollen werden über `pg` gesetzt, nicht über `psql`.** `admin_roles.sql`
   dokumentiert einen `psql`-Aufruf; `psql` steht auf diesem Rechner nicht zur
   Verfügung. Der Weg über die vorhandenen Seed-Helfer (`pg` +
   `resolveDatabaseUrl`) leistet dasselbe. Die Datei selbst bleibt unverändert —
   ihr `psql`-Beispiel gilt weiter für jeden, der es hat; das Runbook nennt die
   Alternative.

9. **Kein `supabase/seed.sql` — und das bleibt so.** `config.toml` verweist auf
   `./seed.sql`, die Datei existiert nicht. Damit kann `db push` Demo-Personas
   gar nicht nach PROD schleppen, auch nicht versehentlich mit `--include-seed`.
   Das ist eine Sicherheitseigenschaft und wird als Anforderung festgeschrieben,
   damit sie niemand später „repariert".

10. **`docs/secrets.md` wird bei der Gelegenheit richtiggestellt.** Dort steht,
    die produktiven `VITE_*`-Werte kämen aus der Cloudflare-Pages-Build-Umgebung.
    Das ist falsch und genau die Annahme, die AGE-496 korrigiert: der Build läuft
    in GitHub Actions unter `infisical run`. Fremder Boden wäre es nicht — die
    Datei wird in diesem Change ohnehin auf zwei Projekte umgestellt, und ein
    Leser, der dem falschen Satz folgt, dreht an Variablen ohne jede Wirkung.

## Entscheidungen aus dem Plan-Review

Drei Reviewer haben den Plan vor jeder Codezeile geprüft: **gemini APPROVE,
codex REQUEST-CHANGES, opencode REQUEST-CHANGES** (`REVIEWS.md`). Die Einwände
wurden einzeln nachgeprüft, nicht übernommen. Was daraus folgte:

11. **Die getippte Bestätigung war zirkulär und ist es nicht mehr** (opencode,
    bestätigt). Der erste Entwurf leitete den erwarteten Projekt-Ref aus genau
    der `SUPABASE_DB_URL_PROD` ab, die er prüfen sollte: falsche URL → falscher
    Host angezeigt → falscher Ref abgetippt → grün. Die Bestätigung schützte
    damit gegen ein gedankenloses `y`, aber nicht gegen eine falsch hinterlegte
    URL — und das war ihr einziger Zweck. Der erwartete Ref steht jetzt als
    Konstante im Repo (`scripts/prod-project-ref.txt`; der Ref ist kein
    Geheimnis, er liegt in jedem Client-Bundle). Die Prüfung läuft **maschinell
    vor** der menschlichen Bestätigung. Siehe `design.md` Abschnitt B.

12. **`config.toml` gilt nur für PROD** (Donald, 2026-08-05, nach codex).
    Eine Datei für beide Projekte hätte entweder DEV auf PROD-Adressen
    umgeleitet oder — der schlimmere Fall — `http://localhost:5173` in der
    Redirect-Allow-List von PROD stehen lassen. Auf einem Projekt mit echten
    Mitgliedern ist das ein Abflussweg für Magic-Links. DEV behält seine
    Dashboard-Konfiguration; dass sie damit unversioniert bleibt, steht als
    benannter Preis im Runbook. Verworfen: `env()`-Substitution (gilt nicht für
    jedes Feld, und das wäre eine ungeprüfte Annahme unter einer
    Sicherheitsgrenze) und zwei Dateien (laufen auseinander, ohne dass etwas
    widerspricht).

13. **`migrate-prod` bekommt eine geschützte Umgebung, und DEV-vor-PROD wird
    erzwungen** (codex, bestätigt). Ein `workflow_dispatch` zeigte weder Host
    noch Dry-Run und verlangte nichts — die Zusage aus Entscheidung 3 galt also
    nur lokal. Der Job läuft jetzt in einer GitHub-Umgebung mit Freigabepflicht,
    gibt Host und Dry-Run vorher ins Log und bricht ab, wenn für denselben
    Commit kein erfolgreicher `migrate-dev`-Lauf vorliegt. `deploy` hängt an
    **beiden** vorgelagerten Jobs, damit ein Fehlschlag der Frühwarnung nicht
    lautlos bleibt (opencode).

14. **Was DEV als Generalprobe leistet, war überzeichnet** (codex und opencode
    unabhängig, bestätigt). `design.md` behauptete, DEV schließe die Prüflücke
    aus Alternative B. DEV trägt Demo-Personas: es fängt Migrationen, die an
    _irgendwelchen_ Zeilen scheitern, aber nicht, was an der Beschaffenheit
    echter Daten hängt — Dubletten unter einem neuen Unique-Index,
    Kardinalitäten, gewachsene Altwerte. Der Anspruch ist entsprechend
    zurückgenommen; die Antwort wäre ein anonymisierter Abgleich DEV←PROD und
    bleibt ein eigener Change.

15. **Drift heißt Abweichung in beide Richtungen** (codex, bestätigt). Nur
    „lokal vorhanden, remote fehlend" zu prüfen, ginge an dem Fall vorbei, den
    AGE-257 im Juni tatsächlich von Hand reparieren musste
    (`20260613081749_avatars_drop_public_listing_policy`). Dazu: der Drift-Scan
    für Objekte außerhalb der Migrationen war nur eine Setup-Prozedur — wird der
    Webhook-Trigger später gelöscht, stirbt der Mailversand wieder still
    (opencode). Er läuft jetzt bei jedem `migrate-prod` mit.

16. **Kein Break-Glass für das Gate** (Donald, 2026-08-05, nach opencode). Dass
    jede ausstehende Migration auch einen eiligen, unabhängigen Fix blockiert,
    ist eine Betriebsfolge und wird als solche benannt statt geerbt. Ein
    Skip-Flag mit Pflichtbegründung wäre bequemer und öffnete genau den Weg, auf
    dem im Juni Frontend und Migrationen auseinanderliefen.

Kleinere, gleich mit erledigte Befunde: `db:push:prod` **weist `--include-seed`
ausdrücklich ab**, statt sich auf das Verhalten der CLI bei konfigurierter, aber
fehlender `seed.sql` zu verlassen (codex) · die Mail-Ratengrenze wird als
**Zahl** festgeschrieben statt als „nicht einstellig" (codex) · alle vier neuen
Jobs teilen die `concurrency`-Gruppe, und das Gate misst gegen denselben
`github.sha`, den `deploy` ausliefert (codex) · die Edge-Function-Bereitstellung
stand nur in den Tasks und steht jetzt auch in der Spec (codex) · die Behauptung
„drei Infisical-Werte schalten ein Projekt um" gilt nur für das Frontend-Routing
und wird entsprechend eingegrenzt (codex) · der Ablageort der Auth-Baseline ist
festgeschrieben (codex, opencode).

**Zwei Einwände bleiben ohne Änderung, mit Begründung:**

- **codex: den Webhook-Token in Vault statt inline.** Vault ist auf diesen
  Projekten permission-locked — `_crypto_aead_det_noncegen` gehört
  `supabase_admin`, was in `docs/secrets.md` dokumentiert ist und der Grund für
  den Inline-Token war. Der Vorschlag ist richtig und hier nicht ausführbar.
  Die zweite Hälfte des Einwands stimmt und wurde übernommen: der Token landet
  im Schema-Dump, die Dump-Hygiene steht jetzt im Runbook.
- **codex und opencode: die Auth-Baseline könnte Secrets enthalten.**
  Nachgemessen: 57 Felder mit sensibel klingendem Namen, davon **sechs nicht
  leer**, und alle sechs sind Einstellungen oder Mail-Vorlagen
  (`rate_limit_token_refresh`, `mailer_templates_…_content`,
  `password_min_length` u. a.). SMTP-Zugang und OAuth-Secrets sind leer, weil
  nichts davon konfiguriert ist. Die Datei enthält heute keine Zugangsdaten.
  Die Anforderung, den Ablageort festzulegen, wurde trotzdem aufgenommen — auf
  einem Projekt mit eigenem SMTP wäre die Vermutung zutreffend.

**Eine Frage bleibt offen und wird gemessen statt beantwortet** (opencode): ob
`supabase config push` Felder, die nicht in `config.toml` stehen, auf Defaults
zurücksetzt. Live sind es 242 Felder, die Datei deckt eine Teilmenge. Die
Messung läuft gegen das neue, leere Projekt, bevor je ein Push ein Projekt mit
Daten trifft.

## Non-goals

Der Mitglieder-Import (→ C10) · der finale Umzug der Production-Variablen (→
Go-Live-Woche) · die Stripe-Webhook-URL auf dem neuen Projekt (erst Phase 2, nur
im Runbook erwähnt) · `send-activation` (→ C3, siehe Entscheidung 1) · die
Custom Domain `app.fairbusinessclub.de` (→ AGE-256, blockiert) · das Kopieren
von Storage-Dateien nach PROD (ausdrücklich unerwünscht: Demo-Avatare bleiben
auf DEV).
