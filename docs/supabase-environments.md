# Supabase-Umgebungen — Runbook

> Gilt ab **AGE-496 / C4**. Löst den Zustand aus ADR-0003 ab (ein geteiltes
> Projekt für dev und prod). Entscheidungsgrundlage: `docs/decisions/0004-split-prod-dev-supabase.md`.
>
> **Stand dieses Dokuments:** 2026-08-20. Das PROD-Projekt existiert
> (`viwntbodrtqxgmqyxluh`), Auth- und Storage-Konfiguration sind angewendet
> und nachgemessen. Was noch aussteht, steht unter „Offene Nachläufe".
>
> **Seit dem 2026-08-20 trägt DEV einen Spiegel von PROD** (AGE-576) — echte
> Mitglieder statt Demo-Personas. Das ändert zwei Aussagen weiter unten
> materiell; beide sind an Ort und Stelle nachgezogen. Siehe „Der Spiegel
> DEV ← PROD".

## Die zwei Projekte

| | DEV/DEMO | PROD |
|---|---|---|
| Projekt-Ref | `foelowldexkcqzewvrcf` | `viwntbodrtqxgmqyxluh` |
| Region | `eu-central-1` | `eu-central-1` |
| Organisation | `factiv` | `factiv` |
| Inhalt | **Spiegel von PROD** (echte Mitglieder + erfundene Aktivität), seit 2026-08-20 — vorher Demo-Personas | **echte Mitglieder** |
| Infisical-Umgebung | `dev` | `prod` |
| Erreicht durch | Pull-Request-Previews, `pnpm dev` | Push auf `main` |
| Demo-Seed erlaubt | **nein, solange der Spiegel steht** — `demo:seed`/`demo:reset` räumen ihn weg | **nein, nie** |
| Auth-Konfiguration | Dashboard (bewusst nicht versioniert) | `supabase/config.toml` |
| DB-Zugangsdaten | eigene | **eigene** — nie geteilt |

> **Bis zum Mitglieder-Import zeigt Infisical `prod` weiterhin auf das
> DEV/DEMO-Projekt.** Das PROD-Projekt ist dann vollständig aufgesetzt, aber
> unbenutzt. Die Rollen in dieser Tabelle beschreiben den Zustand **nach** dem
> Umzug in der Go-Live-Woche.

**Die Rollen sind fest.** Es gibt keinen Schalter, der sie tauscht. Ein Wechsel
ist immer: zwei Werte in Infisical ändern (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) plus Re-Deploy. Der Rückweg ist derselbe Handgriff
rückwärts. Kein Anwendungscode kennt den Unterschied.

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
   └─ migrate-prod    workflow_dispatch (Freigabe-Regel zurückgestellt, s. u.)
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

> **Was DEV nicht fängt — und was sich am 2026-08-20 daran geändert hat.**
> Bis dahin trug DEV Demo-Personas: alles, was an der *Beschaffenheit* echter
> Daten hängt — Dubletten unter einem neuen Unique-Index, Kardinalitäten,
> gewachsene Altwerte, die ein neuer Check ablehnt — sah es nie. Der Satz
> endete mit „die eigentliche Antwort wäre ein Abgleich DEV←PROD; er ist ein
> eigener, noch offener Change". **Dieser Change ist gefahren (AGE-576), und
> DEV trägt jetzt echte Daten.**
>
> Damit fängt der automatische `migrate-dev`-Lauf genau die Klasse Fehler, für
> die es ihn gibt. **Zwei Einschränkungen bleiben, und sie sind nicht klein:**
> der Spiegel ist eine Momentaufnahme und altert ab dem Tag seiner Erzeugung,
> und PROD trägt Bestand, den DEV per Entscheidung nicht spiegelt (drei
> deklarierte Abweichungen, siehe unten). **Der `--dry-run` von `migrate-prod`
> wird deshalb weiter gelesen, nicht durchgeklickt**, und ein PROD-Lauf gehört
> nicht in die letzte Stunde vor einem Termin.

**Drift heißt Abweichung in beide Richtungen.** Nicht nur „lokal vorhanden,
remote fehlend": auch remote-only oder umsortierte Historie ist Drift. Das ist
keine Theorie — AGE-257 musste im Juni genau so eine History-Reparatur von Hand
fahren (`20260613081749_avatars_drop_public_listing_policy`).

**Das Gate schweigt nicht bei Nichtwissen.** Fehlt das Secret oder ist die DB
nicht erreichbar, schlägt `drift-gate` fehl. Ein Gate, das bei Nichtwissen grün
wird, baut die Juni-Havarie eine Ebene höher nach.

### Das Gate ist abgenommen, nicht angenommen

Am 2026-08-05 an `main` durchgespielt (AGE-496 Task 16.2, PR #113 → Revert #114).
Ein grünes Gate beweist nichts; diese drei Läufe beweisen etwas:

| Fall | `migrate-dev` | `drift-gate` | `deploy` |
|---|---|---|---|
| Migration lokal, auf PROD fehlend | success | **failure** | **skipped** |
| Migration remote auf DEV, lokal fehlend | — | **failure** (gegen DEV geprüft) | — |
| `migrate-dev` scheitert, PROD sauber | **failure** | success | **skipped** |

Die dritte Zeile entstand ungeplant: der Revert ließ `migrate-dev` scheitern,
weil DEVs Historie noch den Wegwerf-Eintrag trug. Der Ausweg steht in der
Fehlermeldung der CLI selbst:

```bash
supabase migration repair --status reverted <version> --db-url "$SUPABASE_DB_URL_DEV"
```

**Merke für den Alltag:** Wird eine Migration zurückgenommen, nachdem
`migrate-dev` sie schon angewendet hat, ist DEVs Historie voraus. `migrate-dev`
scheitert dann bei jedem weiteren Merge, bis jemand repariert. Das ist kein
Fehler des Gates, sondern seine Aufgabe — aber man muss wissen, wo der Schalter
sitzt.

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

> **Der Pooler-Host ist pro Projekt verschieden, nicht pro Region.** Am
> 2026-08-05 gemessen: das alte Projekt liegt auf
> `aws-1-eu-central-1.pooler.supabase.com`, das neue auf `aws-0-…`. Wer die URL
> eines Projekts als Vorlage für das andere nimmt, bekommt
> `FATAL (ENOTFOUND) tenant/user postgres.<ref> not found` — die Verbindungs-URL
> gehört aus dem Dashboard des jeweiligen Projekts kopiert, nicht abgeleitet.
> Die Anzeige von `pnpm db:push:prod` zeigt deshalb den **tatsächlichen** Host
> aus der URL, nicht einen aus dem Ref zusammengesetzten.
>
> **Und nicht die direkte Verbindung nehmen.** `db.<ref>.supabase.co` löst nur
> auf IPv6 auf; GitHub-Actions-Runner sind IPv4. `migrate-dev` und `drift-gate`
> könnten damit nicht messen — und ein Gate, das nicht messen kann, wird hier
> rot.

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

## Der Spiegel DEV ← PROD

Seit AGE-576 (2026-08-20) gibt es einen Weg, DEV mit dem Bestand von PROD zu
überschreiben. Er beantwortet den Nachlauf „DEV regelmäßig aus PROD auffrischen",
der in diesem Dokument seit dem 05.08. als offen stand.

```bash
pnpm sync:dev          # infisical run --env=prod -- tsx scripts/sync-dev-ruecklauf.ts --ziel=dev
```

**Zwei Werkzeuge, nicht eines.** Der Auszug liest PROD, der Rücklauf schreibt
das Ziel:

| | Befehl | Wirkung |
|---|---|---|
| Auszug | `infisical run --env=prod -- npx tsx scripts/sync-dev-auszug.ts` | **liest nur**; öffnet keine Verbindung zu DEV |
| Rücklauf | `npx tsx scripts/sync-dev-ruecklauf.ts --ziel=lokal\|dev <ablage>` | **löscht** und ersetzt `auth`, `public` und alle Buckets des Ziels |

Der Auszug landet **ausserhalb des Arbeitsbaums** (`~/.fbc-spiegel/…`,
Verzeichnis `0700`, Dateien `0600`) — er trägt echte Anschriften, und das
Repository ist öffentlich. `manifest.json` wird als letztes geschrieben und ist
damit das Vollständigkeitszeichen: ein Verzeichnis ohne Manifest ist ein
abgebrochener Lauf und darf nicht eingespielt werden.

### Keine Anonymisierung — Entscheidung, nicht Versäumnis

Entschieden gegen zwei HIGH-Reviews. Der Ausgleich sind zwei Dinge, und sie
sind Teil des Werkzeugs, nicht der Disziplin: **alle Passwort-Hashes werden
neutralisiert** (4.13), und die Demo-Zugänge sind entschärft. Nach einem
`--ziel=dev`-Lauf kann sich auf DEV **niemand** anmelden.

### Was DEV danach ist — drei deklarierte Abweichungen

Die Abnahme ist ein **Manifestvergleich mit benannten Abweichungen**, nicht
„gleiche Zeilenzahlen wie PROD". Am 2026-08-20 unabhängig nachgerechnet:
36 Tabellen, 858 Zeilen (857 aus dem Auszug + eine), 125 Objekte mit **allen
125 eTags gleich**, und genau drei Abweichungen:

| Tabelle | Abweichung | Warum |
|---|---|---|
| `auth.users` | Zeilenhash | 4.13 neutralisiert die Hashes |
| `public.profiles` | Zeilenhash | eine Handvoll `tier`-Zuweisungen — PROD trägt ausschliesslich `impact`, ohne sie liesse sich Stufen-Gating auf DEV nicht mehr prüfen |
| `public.staff_roles` | 3 → 4 | `matching_manager`; PROD kennt die Rolle nicht |

**Verglichen wird gegen `manifest.json` des Auszugs, nie gegen „PROD jetzt".**
Zwischen 11:18 und 15:38 desselben Tages wichen `auth.users` und
`public.profiles` im Zeilenhash ab, bei unveränderter Zeilenzahl — drei Zeilen
hatten sich bewegt. Ein frischer PROD-Vergleich misst also Bewegung auf PROD,
nicht die Güte des Rücklaufs.

### `--sicherung` — wann der Auszug „Sicherung" heissen darf

`--sicherung` lässt **zwei** Dinge aus: die Hash-Neutralisierung (4.13) **und**
den DEV-eigenen Bestand (4.9/4.10). Das Ergebnis ist genau der Bestand des
Manifests — anmeldefähig, ohne Dekoration. Nur mit diesem Schalter ist der
Auszug ein Rückweg.

**Gegen `--ziel=dev` ist der Schalter abgelehnt, nicht abgeraten**, und der
Abbruch kommt vor jedem Verbindungsaufbau: neutralisierte Hashes sind einer der
zwei Ausgleiche für „keine Anonymisierung", und die gefährliche Fassung
unterscheidet sich von der harmlosen um ein Wort in einer kopierten
Befehlszeile.

Belegt am 2026-08-20 gegen den lokalen Stack, dreiteilig: ohne Schalter stehen
**0/72** Hashes wie im Auszug und die Anmeldung antwortet HTTP 400; mit Schalter
**72/72 byteweise** und die Abnahme meldet **null** Abweichungen; und dass die
Anmeldung überhaupt am Hash hängt, ist eigens kontrolliert (bekannter
bcrypt-Hash per SQL → HTTP 200 mit Token).

### Zwei Fallen, die Läufe gekostet haben

**`auth` wird per Regel geleert, nicht per Namensliste.** Der erste DEV-Lauf
räumte nur `auth.users` und `auth.identities`; stehen blieben 13 `sessions`,
81 `refresh_tokens`, 13 `mfa_amr_claims` und ein `one_time_token`. Alle diese
Fremdschlüssel sind `ON DELETE CASCADE` — das trug nicht, weil
**`session_replication_role = replica` die Cascade-Trigger mit stilllegt**. Im
replica-Modus verschwindet nur, was benannt wird. Eine Namensliste wäre die
falsche Bauform gewesen: `oauth_consents` und `webauthn_*` sind neu und stünden
in keiner handgepflegten Liste.

**Startup-Optionen verschluckt der Pooler lautlos.** `session_replication_role`
geht nur per `SET` in der Sitzung und wird nachgelesen, nicht angenommen. Ein
Schalter, den man setzt und nicht nachsieht, schreibt hier mit lebenden
Triggern.

### Was der Spiegel nicht mitbringt

`profiles.avatar_url` und `profiles.cover_url` tragen **absolute URLs mit der
PROD-Projektkennung** (56 bzw. 53 Zeilen, keine einzige relativ). Die 111
Objekte in `avatars`/`covers` werden korrekt nach DEV kopiert — dasselbe Objekt
liefert auf beiden Seiten byteweise dieselbe Größe — **aber nie gelesen**: der
Browser holt sie von PROD. `event-covers` und `post-media` laufen über Pfade und
signierte URLs und lesen tatsächlich aus DEV.

Folgenlos, solange beide Projekte bestehen und beide Buckets öffentlich sind.
**Nicht folgenlos bei einem Neuaufbau unter neuer Kennung** — siehe
`docs/prod-neuaufbau-plan.md`.

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
| Der Push-Webhook und `push_wiederholung()` | von Hand, siehe unten |
| Die zwei cron-Zeitplanungen | von Hand, siehe unten |

Storage-**Buckets** kommen dagegen mit: `avatars` wird in
`20260613081627_profile_editor_storage.sql` per `insert into storage.buckets`
angelegt und wandert mit. Die Dateien darin nicht — Demo-Avatare sollen nicht
nach PROD.

### Objekte, die bewusst keine Migration sind

> **Hier stand bis zum 01.09.2026 „Genau eines".** Das war seit dem 28.08.
> falsch: mit dem Push-Fundament (AGE-641) kamen drei weitere Namen dazu und
> mit den geplanten Beiträgen (AGE-667) eine zweite Zeitplanung. Der Satz ist
> nie nachgezogen worden, und die maßgebliche Liste stand derweil im Code.
> Gefunden hat es die Plan-Review zu AGE-679.

Es sind **vier Objekte mit fünf Namen in `public`**, dazu **zwei
Zeitplanungen** im Schema `cron`. Jedes davon ist eine bewusste Entscheidung,
kein Versäumnis.

**Die drei mit inline gespeichertem Bearer.** Sie können nicht ins Repository,
weil es öffentlich ist, und nicht in den Vault: Supabase Vault ist auf diesen
Projekten permission-locked (`_crypto_aead_det_noncegen` gehört
`supabase_admin`).

| Objekt | Namen |
|---|---|
| Kontaktanfrage → `notify-contact-request` | `notify_contact_request_webhook()`, Trigger `contact_requests_email_webhook` auf `public.contact_requests` |
| Hinweis → `send-push` | `notify_push_webhook()`, Trigger `notifications_push_webhook` auf `public.notifications` |
| Wiederholungslauf der Push-Zustellung | `push_wiederholung()` |

**Die zwei Zeitplanungen.** Ihre *Funktionen* liegen in Migrationen — nur die
Zeitplanung nicht, weil ein `cron.schedule` in einer Migration den CI-Lauf
gegen eine frische Datenbank bräche.

| Eintrag | Zeitplan | Befehl |
|---|---|---|
| `push-wiederholung` | `* * * * *` | `select public.push_wiederholung()` |
| `beitrag-ankuendigen` | `* * * * *` | `select public.beitrag_ankuendigen()` |

Vorlagen und Begründungen stehen in `docs/secrets.md`; die maßgebliche Liste
für die Prüfung ist `ERWARTET_OHNE_MIGRATION` und `ERWARTETE_ZEITPLAENE` in
`scripts/db-drift-scan.logic.ts`.

**Beim Aufsetzen eines Projekts müssen sie von Hand angelegt werden**, mit dem
Projekt-Ref *dieses* Projekts in der Ziel-URL. Vergisst man eines, stirbt sein
Weg still: grün in jeder Prüfung, kaputt im Betrieb. Genau das ist am
28.–31.08.2026 geschehen — nur lag die Ursache dort in fehlenden Secrets, nicht
in einem fehlenden Objekt.

### Der Drift-Scan

Die einzige Prüfung, die „was steht in der Datenbank, das in keiner Migration
steht" überhaupt beantwortet. Sie liegt als `scripts/db-drift-scan.ts` vor
(hier stand `.sh`; die Datei hat es nie gegeben) und verlangt seit AGE-679 die
Seite als Pflichtangabe:

```bash
pnpm tsx scripts/db-drift-scan.ts <dev|prod>
```

Sie **läuft bei jedem `migrate-prod` mit** — nicht nur beim Aufsetzen — und
seit AGE-679 zusätzlich **stündlich gegen beide Projekte**
(`.github/workflows/push-waechter.yml`). Bis dahin sah sie DEV nie: ein
`supabase db reset` dort nahm Webhooks, Funktion und Zeitplanungen still mit.

Sie prüft seither auch, was **dasteht und trotzdem nicht läuft**: eine
Zeitplanung mit richtigem Namen und ausgehöhltem Befehl, und einen Trigger, der
per `disable trigger` abgeschaltet wurde und weiter im Katalog steht. Was sie
weiterhin **nicht** sieht, steht im Kopf von `db-drift-scan.logic.ts` — allen
voran veränderte Funktionsrümpfe.

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

### Was `config push` wirklich anfasst — gemessen, nicht vermutet

Am 2026-08-05 am **leeren** PROD-Projekt `viwntbodrtqxgmqyxluh` gemessen:
Auth-Baseline über die Management-API ziehen → `config push` → Baseline erneut
→ über alle 242 Felder diffen.

**Geplant waren fünf Felder. Bewegt haben sich zehn — und einer der fünf war
nicht dabei.**

| Feld | vorher | nachher | geplant? |
|---|---|---|---|
| `site_url` | `http://localhost:3000` | `https://fbc-platform.pages.dev` | ja |
| `uri_allow_list` | `''` | die drei Einträge | ja |
| `password_min_length` | 6 | 10 | ja |
| `mailer_autoconfirm` | false | true | ja (`enable_confirmations = false`) |
| **`rate_limit_email_sent`** | **2** | **2** | **ja — aber NICHT angekommen** |
| `smtp_max_frequency` | 60 | 1 | **nein** |
| `mfa_totp_enroll_enabled` | true | false | **nein** |
| `mfa_totp_verify_enabled` | true | false | **nein** |
| `mailer_otp_length` | 8 | 6 | **nein** |
| `password_required_characters` | `None` | `''` | **nein** (kosmetisch) |
| `custom_oauth_max_providers` | 3 | 32767 | **nein** (unerklärt, s. u.) |

**Die Antwort auf die offene Frage lautet also: ja.** `config push` überträgt
die *ganze* Datei, nicht die Absicht. Jeder Wert, den man nie angefasst hat —
also jede CLI-Vorgabe für die lokale Entwicklung — wird zur Aussage über PROD.
`smtp_max_frequency` von 60 auf 1 herunterzusetzen war niemandes Absicht und
wäre auf einem Projekt mit echten Mitgliedern ein Verstärker.

**Konsequenz für Task 9.2 (Push gegen ein Projekt mit Daten):** vor jedem
`config push` auf ein bewohntes Projekt gilt derselbe Ablauf wie hier —
Baseline, Push, Baseline, Diff über alle Felder. Der Diff, den die CLI selbst
anzeigt, reicht nicht: er zeigt die Felder, aber nicht, welche davon niemand
bewusst gesetzt hat.

`custom_oauth_max_providers` sprang auf denselben Wert, den das alte Projekt
trägt (32767). Ob das der Push war oder die Provisionierung des frischen
Projekts, ist **nicht geklärt** — der Wert steht in keiner `config.toml`.
Harmlos (mehr erlaubte Provider), aber hier als offen vermerkt statt
weggeschrieben.

### Die E-Mail-Rate lässt sich ohne eigenen SMTP nicht erhöhen

Der Versuch, `rate_limit_email_sent` direkt über die Management-API zu setzen,
beantwortet, warum der Push ihn ausgelassen hat:

```
PATCH /v1/projects/<ref>/config/auth   {"rate_limit_email_sent": 30}
→ HTTP 401
  Custom SMTP required to configure SMTP_SENDER_NAME or RATE_LIMIT_EMAIL_SENT.
  Missing SMTP_ADMIN_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
```

**Ohne eigenen SMTP deckelt die Plattform bei 2 Auth-Mails pro Stunde —
projektweit, nicht pro Nutzer.** Das betrifft „Passwort vergessen" und
E-Mail-Änderungen; der Transaktionsversand über Resend/Edge Functions ist
davon unberührt. Mit ~70 Mitgliedern ab dem 17.08. heißt das: zwei
Zurücksetzungen in einer Stunde, danach bekommt niemand mehr eine.

Das ist **kein Konfigurationsfehler, sondern eine fehlende Zutat**. Der Weg
ist ein eigener SMTP (Resend, kommt mit C3), und danach wird der Wert
gemessen, nicht angenommen.

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
| `site_url` | `https://app.effbeezee.com` | `site_url` | kanonische Domain seit 2026-09-01 (AGE-256) |
| `additional_redirect_urls` | `app.effbeezee.com`, `…/**`, `fbc-platform.pages.dev/**` | `uri_allow_list` | **kein localhost, kein Preview-Wildcard**; Stand 2026-09-01 (AGE-256) |
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
infisical secrets set VITE_SUPABASE_URL=https://viwntbodrtqxgmqyxluh.supabase.co --env=prod
infisical secrets set VITE_SUPABASE_ANON_KEY=<anon-key>                          --env=prod
# dann Re-Deploy von main
```

Rückweg: dieselben zwei Werte zurück auf `foelowldexkcqzewvrcf`, Re-Deploy.

> **Es sind zwei Werte, nicht drei.** Ein früherer Entwurf nannte hier auch
> `SUPABASE_DB_PASSWORD`. Seit C4 bestimmt `SUPABASE_DB_URL_PROD` die
> Datenbankverbindung, und die zeigt bereits auf das neue Projekt — der Umzug
> betrifft nur noch das Frontend. `SUPABASE_DB_PASSWORD` in `prod` trägt
> weiterhin das Passwort des **alten** Projekts und hat dort keinen
> Verbraucher; der Demo-Seed liest es aus `dev`. Wer es aufräumt, prüfe
> vorher `grep -rn SUPABASE_DB_PASSWORD`.

**Verifiziert wird am Bundle, nicht an der Absicht** — die im Bundle gebackene
`VITE_SUPABASE_URL` ist der Beleg. Ein Cache-Buster allein reicht nicht, ein 404
tarnt sich als Bundle (2 kB statt 1,2 MB), und die Apex-URL hinkt der
Deploy-URL hinterher.

## Offene Nachläufe

| Was | Wohin | Status |
|---|---|---|
| **Stripe-Live-Keys nur auf PROD setzen** | **Go-Live-Woche** | 12 von 15 Function-Secrets sind noch auf beiden Projekten identisch — ein Live-Key läge sonst auch auf DEV |
| **Eigener SMTP (Resend) als Auth-Mailer** | **C3** | **Vorbedingung für den 17.08., nicht optional — siehe unten** |
| **Verzeichnis-Sichtbarkeit für frisch registrierte Konten** | **C3** | DB-AUDIT Befund 1 — bewusst angenommen, in C3 erneut prüfen (E-Mail-Bestätigung allein löst es **nicht**) |
| ~~`send-activation` deployen~~ | C3 | **erledigt 07.08.** — es wurden drei: `send-`, `resend-` und `redeem-activation`, auf PROD deployt und per `ezbr_sha256` gegen DEV gegengemessen. PROD trägt jetzt **sechs** Functions |
| `notify-contact-request` auf PROD ist ein älterer Stand | 11.4 | `ezbr_sha256` weicht von DEV ab — vor dem Umzug klären |
| Stripe-Webhook-URL auf `viwntbodrtqxgmqyxluh` umstellen | Phase 2 | für den Go-Live irrelevant, vorher nicht vergessen |
| Custom Domain `app.effbeezee.com` | AGE-256 | ✅ erledigt 2026-09-01; `site_url` ist umgestellt |
| Umzug der zwei prod-Frontend-Werte | Go-Live-Woche | siehe oben |
| ~~DEV regelmäßig aus PROD auffrischen~~ | AGE-576 | **erledigt 2026-08-20** — `pnpm sync:dev`, **ohne** Anonymisierung (entschieden gegen zwei HIGH-Reviews; der Ausgleich sind neutralisierte Passwort-Hashes und entschärfte Demo-Zugänge) |
| **DEV trägt 72 echte Adressen und einen lebenden E-Mail-Webhook** | Rücknahmeliste vor Go-Live | neu seit dem Spiegel; der Resend-Zugang ist zu PROD byte-identisch. Heute verstellt durch neutralisierte Hashes und `contact_requests = 0`, aber die Selbstregistrierung ist offen |

### Warum der eigene SMTP kein Nice-to-have ist

Entschieden am 2026-08-05 (Donald): **Resend kommt in C3, nicht in C4.** Diese
Reihenfolge ist in Ordnung — die Konsequenz muss aber jemand kennen, solange
sie gilt.

Ohne eigenen SMTP deckelt Supabase den Auth-Mailversand bei **2 Mails pro
Stunde, projektweit**. Nicht pro Nutzer. Gemessen, nicht vermutet: der Versuch,
den Wert über die Management-API zu heben, antwortet
`HTTP 401 Custom SMTP required to configure ... RATE_LIMIT_EMAIL_SENT`.

Betroffen ist alles, was Supabase selbst verschickt — „Passwort vergessen" und
E-Mail-Änderung. **Nicht** betroffen ist der Transaktionsversand über Resend in
den Edge Functions; der läuft an Supabase vorbei.

Mit ~70 Mitgliedern ab dem 17.08. heißt das konkret: zwei Zurücksetzungen in
einer Stunde, danach bekommt die dritte Person keine Mail mehr — ohne
Fehlermeldung im Frontend. Zwei Dinge dämpfen das, keines löst es:

- `enable_confirmations = false` — Registrierungen lösen keine Mail aus, das
  Kontingent geht also nicht schon beim Anmelden drauf.
- `max_frequency = 60s` — ein einzelner Nutzer kann das Stundenkontingent nicht
  mehr in zwei Sekunden aufbrauchen (vor der Korrektur stand der Wert auf 1s).

**Bis C3 gilt: „Passwort vergessen" ist am Launch-Tag kein verlässlicher Weg.**
Wer am 17.08. jemanden aussperrt, setzt das Passwort im Dashboard zurück statt
auf die Mail zu warten.

### MFA bleibt aus — Entscheidung, nicht Nebenwirkung

`mfa_totp_enroll_enabled` und `mfa_totp_verify_enabled` stehen auf `false`.
Supabase liefert neue Projekte mit `true` aus; der erste `config push` hat sie
abgeschaltet, weil `config.toml` die lokalen CLI-Vorgaben trug.

Bestätigt am 2026-08-05 (Donald): **so gewollt.** Die App hat keine
MFA-Oberfläche — ein per API angelegter Faktor wäre ein Weg, sich selbst
auszusperren, ohne dass die Anwendung ihn je abfragt. Wenn MFA kommt, kommt es
mit Oberfläche und dann als eigene Entscheidung.
