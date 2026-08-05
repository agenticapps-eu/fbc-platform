# Supabase-Umgebungen — Runbook

> Gilt ab **AGE-496 / C4**. Löst den Zustand aus ADR-0003 ab (ein geteiltes
> Projekt für dev und prod). Entscheidungsgrundlage: `docs/decisions/0004-split-prod-dev-supabase.md`.
>
> **Stand dieses Dokuments:** geschrieben während der Planung, bevor das
> PROD-Projekt existierte. Jede Zeile mit `<prod-ref>` wird beim Anlegen
> ausgefüllt. Wenn hier noch Platzhalter stehen, ist Task 6 nicht gelaufen.

## Die zwei Projekte

| | DEV/DEMO | PROD |
|---|---|---|
| Projekt-Ref | `foelowldexkcqzewvrcf` | `<prod-ref>` |
| Region | `eu-central-1` | `eu-central-1` |
| Organisation | `factiv` | `factiv` |
| Inhalt | Demo-Personas (`@demo.fbc.invalid`) | **echte Mitglieder** |
| Infisical-Umgebung | `dev` | `prod` |
| Erreicht durch | Pull-Request-Previews, `pnpm dev` | Push auf `main` |
| Demo-Seed erlaubt | ja | **nein, nie** |
| Auth-Konfiguration | Dashboard (bewusst nicht versioniert) | `supabase/config.toml` |
| DB-Zugangsdaten | eigene | **eigene** — nie geteilt |

> **Bis zum Mitglieder-Import zeigt Infisical `prod` weiterhin auf das
> DEV/DEMO-Projekt.** Das PROD-Projekt ist dann vollständig aufgesetzt, aber
> unbenutzt. Die Rollen in dieser Tabelle beschreiben den Zustand **nach** dem
> Umzug in der Go-Live-Woche.

**Die Rollen sind fest.** Es gibt keinen Schalter, der sie tauscht. Ein Wechsel
ist immer: drei Werte in Infisical ändern (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`) plus Re-Deploy. Der Rückweg
ist derselbe Handgriff rückwärts. Kein Anwendungscode kennt den Unterschied.

**Cloudflare-Pages-Umgebungsvariablen sind irrelevant.** Der Build läuft in
GitHub Actions unter `infisical run`; Vite backt die `VITE_*`-Werte zur
Build-Zeit ins Bundle, und wrangler lädt nur fertige Dateien hoch. Wer an den
CF-Variablen dreht, ändert nichts.

## Wie eine Migration auf beide Projekte kommt

`supabase/migrations/` ist die einzige Quelle beider Schemata. Die Reihenfolge
ist immer **erst DEV, dann PROD** — und sie ist nicht mehr Konvention, sondern
die einzige mögliche.

```
Merge auf main
   │
   ├─ migrate-dev     automatisch   db push  →  DEV      (die Generalprobe)
   │
   ├─ drift-gate      automatisch   Historie beidseitig vergleichen  →  PROD
   │                                Abweichung? → exit 1
   │
   └─ deploy          needs: [migrate-dev, drift-gate]

Von Hand, wenn DEV es getragen hat:
   └─ migrate-prod    workflow_dispatch + Freigabe (environment: production)
                      zeigt Host + Dry-Run VOR dem Anwenden
                      bricht ab, wenn migrate-dev für denselben Commit fehlt
                      führt den Drift-Scan mit aus
```

**Warum DEV automatisch und PROD nicht.** `ci.yml` belegt mit `supabase db
reset`, dass eine Migration auf eine **leere** Datenbank passt. Ein `not null`
ohne Default auf einer gefüllten Tabelle, ein Typwechsel an Bestandswerten —
das ist in CI grün und scheitert erst an Daten. Genau das fängt der automatische
DEV-Lauf ab, wo es folgenlos ist. Auf PROD bleibt es eine Entscheidung, weil ein
DDL-Rollback kein `git revert` ist.

> **Was DEV nicht fängt.** DEV trägt Demo-Personas. Alles, was an der
> *Beschaffenheit* echter Daten hängt — Dubletten unter einem neuen
> Unique-Index, Kardinalitäten, gewachsene Altwerte, die ein neuer Check
> ablehnt — sieht es nie. **Der `--dry-run` von `migrate-prod` wird deshalb
> gelesen, nicht durchgeklickt**, und ein PROD-Lauf gehört nicht in die letzte
> Stunde vor einem Termin. Die eigentliche Antwort wäre ein anonymisierter
> Abgleich DEV←PROD; er ist ein eigener, noch offener Change.

**Drift heißt Abweichung in beide Richtungen.** Nicht nur „lokal vorhanden,
remote fehlend": auch remote-only oder umsortierte Historie ist Drift. Das ist
keine Theorie — AGE-257 musste im Juni genau so eine History-Reparatur von Hand
fahren (`20260613081749_avatars_drop_public_listing_policy`).

**Das Gate schweigt nicht bei Nichtwissen.** Fehlt das Secret oder ist die DB
nicht erreichbar, schlägt `drift-gate` fehl. Ein Gate, das bei Nichtwissen grün
wird, baut die Juni-Havarie eine Ebene höher nach.

### Kein Break-Glass — bewusst

Sobald ein Merge eine Migration enthält, blockiert `drift-gate` **jeden**
Frontend-Deploy, bis jemand `migrate-prod` freigibt — auch einen eiligen Fix,
der mit der Migration nichts zu tun hat.

**Das ist gewollt, und es gibt keinen Weg daran vorbei.** Der Ausweg ist immer
derselbe: `migrate-prod` freigeben, dann deployen. Ein Skip-Flag mit
Pflichtbegründung wäre bequemer und öffnete genau den Weg, auf dem im Juni
Frontend und Migrationen auseinanderliefen. Eine Zusage, die man im Eilfall
umgehen darf, ist im Eilfall keine.

### Von Hand auf PROD

```bash
pnpm db:push:prod
```

Zwei Stufen, und die erste ist die wichtige:

1. **Maschinell, ohne Menschen.** Der aus `SUPABASE_DB_URL_PROD` abgeleitete Ref
   wird gegen `scripts/prod-project-ref.txt` gehalten. Ungleich → Abbruch,
   bevor überhaupt etwas angezeigt wird.
2. **Durch den Menschen.** Aufgelöster Zielhost, `--dry-run`, dann den
   Projekt-Ref tippen. Kein Flag, kein `y`.

> Stufe 1 ist nicht optional und nicht kosmetisch. Ohne sie wäre die Prüfung
> zirkulär: eine falsch hinterlegte URL zeigte einen falschen Host, der Mensch
> tippte den falschen Ref ab, und alles wäre grün. Der erwartete Ref muss aus
> einer Quelle kommen, die **nicht** die geprüfte ist — deshalb steht er im
> Repo. Ein Geheimnis ist er nicht: er liegt in jedem ausgelieferten
> Client-Bundle.

`--include-seed` weist das Skript ausdrücklich ab.

**`supabase link` niemals zum Umschalten benutzen.** Es wechselt das Ziel still,
und danach arbeitet *jeder* folgende Befehl gegen das neue — auch die, die man
gedankenlos eintippt. `pnpm db:push` (ohne Suffix) hängt am verlinkten Projekt
und ist deshalb ausschließlich für DEV.

### Die Freigabe-Regel, die (noch) nicht gesetzt ist

`migrate-prod.yml` trägt `environment: production`, aber die Umgebung hat
**keine Reviewer-Regel** — zurückgestellt am 2026-08-05, weil Donald der
einzige Entwickler ist und eine Freigabe an sich selbst keine zweite Instanz
wäre.

Konkret heißt das: `apply` startet direkt hinter `plan`. Der Zielhost und der
Dry-Run stehen im Log, aber **niemand muss sie angesehen haben**, bevor
angewendet wird. Was weiter trägt: der Handauslöser, der Nachweis, dass
`migrate-dev` für denselben Commit grün war, und die Ausgabe selbst.

Sobald ein zweiter Mensch am Repo arbeitet, gehört die Regel nachgezogen:

```bash
gh api -X PUT repos/agenticapps-eu/fbc-platform/environments/production \
  -f "wait_timer=0" -F "prevent_self_review=false" \
  -f "reviewers[][type]=User" -F "reviewers[][id]=<GitHub-User-ID>"
```

## Rollback

### Eine Migration auf PROD zurücknehmen

Es gibt keinen generischen Weg. DDL ist nicht revertierbar. Der Ablauf:

1. **Erst messen, dann handeln.** `supabase migration list --db-url $PROD` —
   was ist tatsächlich angewendet?
2. Eine **neue** Migration schreiben, die den Schaden aufhebt. Nicht die alte
   editieren: sie steht bereits in der Historie beider Projekte, und ein
   nachträglich geänderter Inhalt lässt die Projekte auseinanderlaufen, ohne
   dass `migration list` es sieht.
3. Erst auf DEV, dann auf PROD.

### Die ganze Datenbank zurückholen

Aus dem Dump (siehe unten). Das ist ein Notfallweg mit Datenverlust seit dem
Dump-Zeitpunkt, kein Routinevorgang.

### Auth-Konfiguration zurückholen

`auth-baseline-<ref>.json` neben dem Dump enthält den Stand vor dem ersten
`config push` (242 Felder). Zurückschreiben per
`PATCH /v1/projects/<ref>/config/auth`.

## Sicherung

```bash
# Zielhost auflösen (nie das Passwort ins Terminal echoen)
URL="postgresql://postgres.<ref>:<pwd>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

supabase db dump --db-url "$URL" -f backup_roles.sql  --role-only
supabase db dump --db-url "$URL" -f backup_schema.sql
supabase db dump --db-url "$URL" -f backup_data.sql   --data-only
supabase db dump --db-url "$URL" -f backup_auth.sql   --data-only --schema auth,storage
```

> ⚠️ **Die vierte Zeile ist nicht optional.** `supabase db dump` lässt `auth` und
> `storage` standardmäßig aus. Ohne `--schema auth,storage` enthält die Sicherung
> **null `auth.users`** — also gerade die echten Menschen nicht. Das ist beim
> Anlegen dieses Runbooks tatsächlich passiert und fiel nur auf, weil danach
> gezählt wurde. Beim Rollback schlägt dieselbe Falle zu.

Dateien **außerhalb des Repos** ablegen (`~/Backups/fbc-platform/`) und auf
`0600` setzen: der Schema-Dump enthält den inline gespeicherten
Webhook-Bearer-Token, und das Repo ist öffentlich.

## Was `db push` **nicht** mitnimmt

`db push` überträgt Migrationen — sonst nichts. Beim Aufsetzen eines Projekts
fehlen danach:

| | Wie es hinkommt |
|---|---|
| Edge Functions | `supabase functions deploy` |
| Function-Secrets | aus Infisical, siehe `docs/secrets.md` |
| Auth-Einstellungen | `supabase config push --project-ref <ref>` |
| `auth.users` | projektgebunden — Konten neu registrieren |
| Storage-**Dateien** | gar nicht, und das ist gewollt |
| Der Contact-Request-Webhook | von Hand, siehe unten |

Storage-**Buckets** kommen dagegen mit: `avatars` wird in
`20260613081627_profile_editor_storage.sql` per `insert into storage.buckets`
angelegt und wandert mit. Die Dateien darin nicht — Demo-Avatare sollen nicht
nach PROD.

### Objekte, die bewusst keine Migration sind

**Genau eines**, und es ist eine bewusste Entscheidung, kein Versäumnis:

- `public.notify_contact_request_webhook()` und der Trigger
  `contact_requests_email_webhook` auf `public.contact_requests`.

Der Trigger trägt den `CONTACT_WEBHOOK_SECRET` als Bearer **inline** — Supabase
Vault ist auf diesen Projekten permission-locked (`_crypto_aead_det_noncegen`
gehört `supabase_admin`), und das Repo ist öffentlich. Vorlage und Begründung
stehen in `docs/secrets.md`.

**Beim Aufsetzen eines Projekts muss er von Hand angelegt werden**, mit dem
Projekt-Ref *dieses* Projekts in der Ziel-URL. Vergisst man ihn, ist der
Mailversand für Kontaktanfragen still tot: grün in jeder Prüfung, kaputt im
Betrieb.

### Der Drift-Scan

Die einzige Prüfung, die „was steht in der Datenbank, das in keiner Migration
steht" überhaupt beantwortet. Sie liegt als `scripts/db-drift-scan.sh` vor und
**läuft bei jedem `migrate-prod` mit** — nicht nur beim Aufsetzen. Wird der
Webhook-Trigger später versehentlich gelöscht, stirbt der Mailversand sonst
wieder still, und das ist genau der Havarie-Modus, den dieses Runbook an anderer
Stelle beschreibt.

Die Logik, zum Nachvollziehen:

```bash
# gegen einen frischen Schema-Dump des Zielprojekts
grep -oE 'CREATE (OR REPLACE )?FUNCTION "public"\."[a-z_0-9]+"' backup_schema.sql \
  | grep -oE '"[a-z_0-9]+"$' | tr -d '"' | sort -u \
  | while read -r f; do
      grep -rqi "\b$f\b" supabase/migrations/ || echo "DRIFT: $f"
    done
```

Dasselbe für `CREATE TRIGGER` und `CREATE TABLE`. Auf einem korrekt
aufgesetzten Projekt meldet er **das Webhook-Paar und sonst nichts**. Meldet er
mehr, ist jemand am Dashboard gewesen.

**Ausgangsbefund, 2026-08-05** — gemessen gegen `2026-08-05_prod_schema.sql`
(Dump des bestehenden Projekts `foelowldexkcqzewvrcf`), 27 Funktionen,
8 Trigger, 28 Tabellen:

```
=== FUNCTIONS ===
DRIFT: function notify_contact_request_webhook
=== TRIGGERS ===
DRIFT: trigger contact_requests_email_webhook
=== TABLES ===
```

Genau das erwartete Paar, keine dritte Abweichung. Das ist die Zahl, gegen die
jeder spätere Scan gehalten wird: **zwei Meldungen sind der Normalzustand,
solange Task 12 nicht gefahren ist — danach null.** Wächst die Liste, ohne dass
eine Migration dazukam, ist jemand am Dashboard gewesen.

## Auth-Konfiguration

`supabase/config.toml` ist die Quelle der Wahrheit. Werte, die nur im Dashboard
stehen, gelten als Abweichung.

```bash
pnpm config:push:prod     # prüft den Ref maschinell, zeigt dann den Diff
```

> ⚠️ **`config push` überschreibt jeden im Dashboard gesetzten Wert — auf jedem
> Ziel, nicht nur auf PROD.** Deshalb vorher immer die Baseline sichern:
> `GET /v1/projects/<ref>/config/auth` (braucht einen Management-PAT).
> Bei der Erhebung für C4 hätte ein unbedachter Push `site_url` von
> `https://fbc-platform.pages.dev` auf `http://127.0.0.1:3000` gesetzt und die
> Allow-List um `https://*.fbc-platform.pages.dev` **verkürzt** — auf dem
> laufenden Projekt.

> ⚠️ **`config.toml` beschreibt PROD, nicht beide Projekte.** Sie wird
> ausschließlich gegen PROD gepusht. **DEVs Auth-Konfiguration lebt im
> Dashboard und ist bewusst nicht versioniert** — wer DEV ändert, ändert es
> dort. Eine gemeinsame Datei ginge nicht: PROD darf keine Loopback-Adresse in
> der Redirect-Allow-List tragen (Abflussweg für Magic-Links), DEV braucht sie
> für `pnpm dev`.

Zielwerte. **Die Schlüssel in der Datei heißen anders als die Felder der
Management-API** — links steht, was in `config.toml` gehört:

| `config.toml`-Schlüssel | Wert | API-Feld (beim Nachprüfen) | Warum |
|---|---|---|---|
| `site_url` | `https://fbc-platform.pages.dev` | `site_url` | Custom Domain ist blockiert (AGE-256) |
| `additional_redirect_urls` | `fbc-platform.pages.dev/**`, `app.fairbusinessclub.de`, `…/**` | `uri_allow_list` | **kein localhost, kein Preview-Wildcard** |
| `minimum_password_length` | `10` | `password_min_length` | echte Mitgliederkonten |
| `[auth.rate_limit] email_sent` | `30` | `rate_limit_email_sent` | bei `2` blockieren zwei gleichzeitige Zurücksetzungen den Versand für alle |
| `[auth.email] enable_confirmations` | `false` | `mailer_autoconfirm` (invertiert) | **Entscheidung, kein Versehen** — C3 baut den Aktivierungsweg über Resend |

> ⚠️ **Offen, bis gemessen:** ob `config push` Felder, die die Datei nicht
> führt, auf Vorgabewerte zurücksetzt. Live sind 242 Felder, `config.toml`
> deckt eine Teilmenge. Die Messung läuft am leeren PROD-Projekt (Baseline →
> Push → Baseline → Diff über alle Felder), bevor je ein Push ein Projekt mit
> Daten trifft.

Ein Konfigurationswert, der richtig aussieht, ist kein Beleg. **Nach jedem Push
einen echten Link einlösen** (Passwort-Zurücksetzung anfordern, Zieladresse
prüfen, Link öffnen).

## Admin-Rollen

`supabase/seed/admin_roles.sql` weist Rollen zu, es legt **keine Konten** an.
Reihenfolge: erst über die App registrieren, dann die Datei fahren. Läuft sie
vorher, findet der Lookup niemanden und tut nichts.

Die Datei dokumentiert einen `psql`-Aufruf. Steht `psql` nicht zur Verfügung,
leistet der `pg`-Weg über die Seed-Helfer (`resolveDatabaseUrl` in
`supabase/seed/demo_seed.lib.ts`) dasselbe. Die echten Adressen werden
**übergeben**, nie in die Datei geschrieben — das Repo ist öffentlich.

Abnahme: `is_admin()` liefert für beide Konten `true`, und die Kontrollabfrage
am Ende der Datei zeigt **genau zwei** Zeilen.

## Der Umzug in der Go-Live-Woche

Nicht Teil von C4. Der Handgriff:

```bash
infisical secrets set VITE_SUPABASE_URL=https://<prod-ref>.supabase.co --env=prod
infisical secrets set VITE_SUPABASE_ANON_KEY=<anon-key>                --env=prod
infisical secrets set SUPABASE_DB_PASSWORD=<pwd>                       --env=prod
# dann Re-Deploy von main
```

Rückweg: dieselben drei Werte zurück auf `foelowldexkcqzewvrcf`, Re-Deploy.

**Verifiziert wird am Bundle, nicht an der Absicht** — die im Bundle gebackene
`VITE_SUPABASE_URL` ist der Beleg. Ein Cache-Buster allein reicht nicht, ein 404
tarnt sich als Bundle (2 kB statt 1,2 MB), und die Apex-URL hinkt der
Deploy-URL hinterher.

## Offene Nachläufe

| Was | Wohin | Status |
|---|---|---|
| `send-activation` deployen | C3 | existiert noch nicht — C4 deployt **drei** Functions, nicht vier |
| Stripe-Webhook-URL auf `<prod-ref>` umstellen | Phase 2 | für den Go-Live irrelevant, vorher nicht vergessen |
| Custom Domain `app.fairbusinessclub.de` | AGE-256 | blockiert (Domain-Zugang); danach `site_url` umstellen |
| Umzug der drei prod-Werte | Go-Live-Woche | siehe oben |
| DEV regelmäßig aus PROD auffrischen | offen | bräuchte Anonymisierung — eigener Change |
