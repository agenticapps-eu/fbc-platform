# Secret Management (Infisical)

All secrets for the FBC platform are managed centrally in
[Infisical](https://infisical.com). The repo contains **no real secret values** —
only placeholders (`.env.example`) and the project reference (`.infisical.json`,
which holds an ID, not a secret).

At runtime, `infisical run` fetches the secrets for the chosen environment and
injects them as environment variables into the wrapped command. That is why the
`dev`, `db:push`, and `build:prod` scripts in `package.json` are wrapped in
`infisical run --env=<env> -- …`.

`build` itself is **not** wrapped — it stays a plain `tsc && vite build` so CI
(and any environment without the Infisical CLI) can compile and bundle. Use
`build:prod` for a local build with prod secrets pulled from Infisical.

> **Korrigiert 2026-08-05 (AGE-496).** Hier stand, die produktiven `VITE_*`-Werte
> kämen aus der **Cloudflare-Pages-Build-Umgebung**. Das ist falsch und war es
> immer: `deploy.yml` baut in GitHub Actions unter `infisical run`, Vite backt
> die Werte dort ins Bundle, und `wrangler` lädt nur fertige Dateien hoch. Wer
> an den Cloudflare-Variablen dreht, ändert nichts. Der Satz hätte in der
> Go-Live-Woche Stunden gekostet.

## Environments

One Infisical project (`fbc-platform`) with two environments mirroring our
deployment stages:

| Environment | Slug   | Supabase-Projekt              | Used by                                             |
| ----------- | ------ | ----------------------------- | --------------------------------------------------- |
| Development | `dev`  | `foelowldexkcqzewvrcf` (DEMO) | `pnpm dev`, `pnpm db:push`, PR-Previews, local work  |
| Production  | `prod` | `viwntbodrtqxgmqyxluh`        | `pnpm build:prod`, `pnpm db:push:prod`, prod deploys |

> **Seit AGE-496 (2026-08-05) sind das zwei verschiedene Supabase-Projekte.**
> Vorher zeigten beide Umgebungen auf dasselbe (ADR-0003). Details:
> `docs/supabase-environments.md`, Entscheidung: ADR-0004.
>
> ⚠️ **Bis zur Go-Live-Woche zeigt `VITE_SUPABASE_URL` in `prod` weiterhin auf
> das ALTE Projekt.** Das ist Absicht: das neue Projekt ist vollständig
> aufgesetzt, aber unbenutzt. Die Spalte oben beschreibt die Rollen **nach** dem
> Umzug — für die Datenbank-Zugriffe (`SUPABASE_DB_URL_*`) gilt sie schon jetzt.

### Die beiden Verbindungs-URLs

| Key                    | Env    | Zeigt auf              |
| ---------------------- | ------ | ---------------------- |
| `SUPABASE_DB_URL_DEV`  | `dev`  | `foelowldexkcqzewvrcf` |
| `SUPABASE_DB_URL_PROD` | `prod` | `viwntbodrtqxgmqyxluh` |

Beide sind **Session-Pooler**-URLs
(`postgres.<ref>@aws-N-eu-central-1.pooler.supabase.com:5432`), nicht die
direkte Verbindung. Zwei Gründe, beide gemessen:

- `db.<ref>.supabase.co` löst **nur auf IPv6** auf. GitHub-Actions-Runner sind
  IPv4 — `migrate-dev` und `drift-gate` könnten damit nicht messen.
- **Das `aws-N` ist pro Projekt verschieden, nicht pro Region.** Das alte
  Projekt liegt auf `aws-1`, das neue auf `aws-0`. Wer die eine URL als Vorlage
  für die andere nimmt, bekommt
  `FATAL (ENOTFOUND) tenant/user postgres.<ref> not found`.

Dieselben zwei Werte gehören als **GitHub-Secrets** hinterlegt — ohne sie
werden `migrate-dev` und `drift-gate` auf `main` rot. Das ist gewollt (das Gate
schweigt nicht bei Nichtwissen), heißt aber: erst die Secrets, dann der Merge.

### `SUPABASE_ACCESS_TOKEN` — für den Functions-Deploy (AGE-506)

Ein **Supabase Personal Access Token**. Er liegt **in Infisical, env `dev`**, und
**nicht** als GitHub-Secret — der Job `functions` in `deploy.yml` zieht ihn zur
Laufzeit über `infisical run`, genau wie der `deploy`-Job seine Build-Secrets.

- **Wozu:** `supabase functions deploy <name> --project-ref <ref>` gegen beide
  Projekte. Die Refs kommen aus `scripts/dev-project-ref.txt` und
  `scripts/prod-project-ref.txt`, nicht aus einem Secret — ein Ziel, das nur im
  Secret steht, ist im Review unsichtbar.
- **Warum `dev`, obwohl der Job auch auf PROD ausliefert:** ein PAT
  authentifiziert den **Betreiber** gegen die Management-API und gilt kontoweit.
  Er ist kein dev- und kein prod-Wert. Ihn zusätzlich nach `prod` zu legen hieße,
  dieselbe Zugangsdatei an zwei Stellen zu führen — und bei der nächsten
  Rotation würde eine davon vergessen. Eine Kopie, eine Wahrheit.
- **Reichweite, benannt statt beschwiegen:** ein PAT kann mehr als Functions
  deployen. Deshalb umschließt `infisical run` im Job **nur** den
  `supabase`-Aufruf und nicht den ganzen Schritt: der Wert lebt im Prozess, der
  ihn braucht, und in keinem anderen.
- **Verhalten ohne ihn:** der Job schlägt **nur dann** fehl, wenn ein Merge
  tatsächlich eine Function verändert hat — und sagt dann, was fehlt. Geprüft
  wird über den **Exit-Code**, nie über eine Ausgabe. Genau dieser Fall war
  vorher der stille.
- **Was CI dafür braucht:** nur `INFISICAL_TOKEN`, das ohnehin schon als
  GitHub-Secret existiert. Es kommt **kein** neues GitHub-Secret dazu.

> On the free tier, per-environment access control isn't available. Splitting
> `dev`/`prod` into separate projects (for restricted prod visibility) is a
> later, paid-plan concern — for the prototype, two environments in one project
> is enough.

## First-time setup

The repo already ships `.infisical.json` (the project reference — an ID, not a
secret), so a new contributor only needs to authenticate:

1. Install the CLI: `brew install infisical/get-cli/infisical`.
2. Log in: `infisical login` (opens the browser; select the org that owns the
   `fbc-platform` project).
3. Verify: `pnpm dev` should start Vite with secrets injected, even while the app
   is still empty.

## Where each secret belongs

> **Rule:** anything prefixed `VITE_` is compiled into the **public** browser
> bundle. Never give a `VITE_` prefix to a value that must stay private.

### Client-exposed (`VITE_*`)

Stored in Infisical. **Nicht** in der Cloudflare-Pages-Build-Umgebung — siehe
die Korrektur oben: der Build läuft in GitHub Actions unter `infisical run`,
Vite backt die Werte dort ins Bundle.

| Key                     | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`     | Supabase project URL                     |
| `VITE_SUPABASE_ANON_KEY`| Supabase anon (public) key — RLS-gated   |
| `VITE_SENTRY_DSN`       | Sentry DSN for browser error reporting   |
| `VITE_ENVIRONMENT`      | `dev` / `staging` / `prod` runtime label |

### Server-only (never `VITE_`)

Stored in Infisical and consumed only by Pages Functions, Supabase, or CI. These
must **never** reach the client.

| Key                         | Purpose                                       |
| --------------------------- | --------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Full-access Supabase key (bypasses RLS)       |
| `SENTRY_AUTH_TOKEN`         | Sentry CI token (source-map upload)           |
| `CLOUDFLARE_API_TOKEN`      | Cloudflare API token (Pages deploy)           |
| `RESEND_API_KEY`            | Resend API key for transactional email (`notify-contact-request`) |
| `FROM_EMAIL`                | Sender address for transactional email — `FBC <noreply@effbeezee.com>` (see the sender-domain note below; **must not** be `onboarding@resend.dev`) |
| `CONTACT_WEBHOOK_SECRET`    | Shared secret the contact-request DB webhook sends as `Authorization: Bearer …` |
| `APP_URL` _(optional)_      | Base URL for the "Zum Chat"/"Anfrage ansehen" link in emails |
| `PUSH_WEBHOOK_SECRET`       | Shared secret the `notifications` DB webhook sends to `send-push` (AGE-641) |
| `APNS_KEY_P8`               | Der APNs-Auth-Key als PEM. **Nicht** der gleichnamige App-Store-Connect-Schlüssel — siehe unten |
| `APNS_KEY_ID`               | Kennung ebendieses Schlüssels (steht in Apples Dateinamen `AuthKey_<KEYID>.p8`) |
| `APNS_TEAM_ID`              | Apple-Team, fährt als `iss` im Provider-JWT mit |
| `APNS_BUNDLE_ID`            | `apns-topic` — die Bundle-ID der App (`com.effbeezee.app`) |
| `APNS_SANDBOX`              | `1` fragt Apples Sandbox-Host **zuerst**. Nur eine Vermutung — den Host erkennt `send-push` an der Antwort (siehe unten) |
| `FCM_SERVICE_ACCOUNT`       | Dienstkonto-JSON des Firebase-Projekts (Android). Die Projekt-ID liest der Code daraus — kein eigenes Secret |

## Setting and reading secrets

```bash
# Set a secret in a specific environment
infisical secrets set VITE_SUPABASE_URL=https://xyz.supabase.co --env=dev

# Set a server-only secret
infisical secrets set SUPABASE_SERVICE_ROLE_KEY=sk_xxx --env=prod

# List the secrets available in an environment (values masked unless you pass --plain)
infisical secrets --env=dev

# Run any command with secrets injected
infisical run --env=dev -- <command>
```

## Rules

- **Never commit real values.** Only `.env.example` (placeholders) and
  `.infisical.json` (project reference) are tracked. `.env` / `.env.*` are
  gitignored.
- **One source of truth.** Add a new secret in Infisical first, document the key
  here and in `.env.example`, then mirror it to Cloudflare Pages / CI only if it
  is needed there.
- **Respect the `VITE_` boundary** — see the rule above.

## Supabase Edge Function secrets (`notify-contact-request`, AGE-247)

The transactional-email function (spec `docs/matching-spec.md` §7) reads its
secrets from the **Supabase Functions secret store**, not from the Vite/Pages
runtime. Push them from Infisical so the values never live in the repo:

```bash
# Werte ueber die UMGEBUNG uebergeben, nie ueber eine Datei.
infisical run --env=dev --silent -- sh -c \
  'supabase secrets set --project-ref <ref> \
     RESEND_API_KEY="$RESEND_API_KEY" FROM_EMAIL="$FROM_EMAIL" \
     CONTACT_WEBHOOK_SECRET="$CONTACT_WEBHOOK_SECRET" APP_URL="$APP_URL"'
```

> ⚠️ **Der frühere `export | grep > datei`-Weg stand hier bis zum 28.08. und war
> falsch — an drei Stellen.** Er hat an dem Tag `APNS_KEY_P8` und
> `FCM_SERVICE_ACCOUNT` beschädigt, und zwar **lautlos**: `supabase secrets set`
> meldete `count: 2` und Erfolg.
>
> 1. **`--plain` gibt es nicht.** `infisical export` (0.43.128) kennt das Flag
>    nicht.
> 2. **`grep '^KEY='` schneidet mehrzeilige Werte ab.** Der dotenv-Export ist
>    mehrzeilig — gemessen: 51 Zeilen bei 33 Schlüsseln, also 18
>    Fortsetzungszeilen. Von einem PEM oder einem Dienstkonto-JSON bleibt so nur
>    die **erste Zeile** übrig. Das trifft jedes mehrzeilige Geheimnis und fiel
>    nur deshalb nie auf, weil die vier Werte hier oben alle einzeilig sind.
> 3. **Ohne `--project-ref` trifft es das verlinkte Projekt** — und ein
>    Worktree ist in der Regel mit gar keinem verlinkt.

**Nachweisen, nicht annehmen.** Der `value` in `supabase secrets list` ist das
**SHA-256 des Werts** (belegt am 28.08. an `APNS_BUNDLE_ID`: der Digest ist
`sha256("com.effbeezee.app")`, ohne Zeilenumbruch am Ende). Damit lässt sich
byte-genau vergleichen, ohne ein Geheimnis anzuzeigen:

```bash
# links: was in Infisical steht — rechts: was Supabase gespeichert hat
infisical run --env=dev --silent -- sh -c \
  'for k in APNS_KEY_P8 FCM_SERVICE_ACCOUNT; do eval "v=\$$k"; \
     printf "%-22s %s\n" "$k" "$(printf %s "$v" | shasum -a 256 | cut -d" " -f1)"; done'
supabase secrets list --project-ref <ref>
```

Weichen sie ab, ist der Wert unterwegs verändert worden.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into every Edge
Function by the platform — do **not** set them here.

### Deploy + wire the webhook

```bash
supabase functions deploy notify-contact-request   # verify_jwt=false (see config.toml)
```

The webhook is a **`pg_net` trigger** on `public.contact_requests` (Insert +
Update) that POSTs the Supabase-webhook-shaped payload to the function with the
bearer token. It is applied **directly to the live DB, not as a committed
migration**, because the token can't be in git and Supabase Vault writes are
permission-locked on this project (`_crypto_aead_det_noncegen` — owned by
`supabase_admin`). The token therefore lives inline in the trigger function in
the DB, exactly as Supabase's own Dashboard webhooks store their auth header;
it is readable only with DB-admin access. Reapply with the real token swapped in:

```sql
create extension if not exists pg_net;

create or replace function public.notify_contact_request_webhook()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/notify-contact-request',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <CONTACT_WEBHOOK_SECRET>'),  -- not in git
    body    := jsonb_build_object(
                 'type', tg_op, 'table', tg_table_name, 'schema', tg_table_schema,
                 'record', to_jsonb(new),
                 'old_record', case when tg_op='UPDATE' then to_jsonb(old) else null end));
  return null;
end; $$;
revoke execute on function public.notify_contact_request_webhook() from public, anon, authenticated;

create trigger contact_requests_email_webhook
  after insert or update on public.contact_requests
  for each row execute function public.notify_contact_request_webhook();
```

The function rejects any request whose bearer doesn't match its
`CONTACT_WEBHOOK_SECRET` (401).

> **Sender domain — decided 2026-08-06 (Donald/Detlev): `effbeezee.com`.**
> `FROM_EMAIL` is `FBC <noreply@effbeezee.com>`; both activation functions set
> `Reply-To: info@fairbusinessclub.de` in code, because the activation screen
> promises the member that a reply arrives.
>
> The earlier advice in this box — "use `onboarding@resend.dev` as a
> transition" — was **wrong, not merely dated**, and it is kept here rather than
> deleted because it cost a launch-blocking day. From Resend's shared sandbox
> sender, mail is delivered **only to the Resend account owner's own address**;
> every other recipient is refused with `403`
> (<https://resend.com/docs/knowledge-base/403-error-resend-dev-domain>). It is
> therefore not a transition one can ship on: with it, the activation path can
> reach no member at all, and `send-activation` still answers `202`, so the
> failure is invisible from the API. Measured 2026-08-06, see
> `openspec/changes/member-activation-flow/tasks.md` 10.5.
>
> Two properties of `effbeezee.com` that the setup must respect:
>
> - `_dmarc.effbeezee.com` already carries **`v=DMARC1;p=reject;`**. Do **not**
>   add Resend's optional DMARC record — a second record on the same name makes
>   DMARC invalid. And `reject` means a mistyped DKIM key is not a spam-folder
>   problem but a bounce.
> - The domain has a **wildcard** (`*.effbeezee.com` answers with Strato's MX).
>   Under `send.` create **both** the TXT and the MX: as soon as any record
>   exists at that name the wildcard stops applying to it, so a lone TXT would
>   leave the bounce address pointing nowhere.

## Supabase Edge Function secrets (`create-checkout-session` + `stripe-webhook`, AGE-259)

Der Stripe-Test-Mode-Upgrade-Flow (Spec §3.1–3.4) braucht diese Edge-Function-Secrets
(Infisical → `supabase secrets set`):

- `STRIPE_SECRET_KEY` — Test-Mode Secret Key (`sk_test_…`)
- `STRIPE_WEBHOOK_SECRET` — aus dem Stripe-Webhook-Endpoint (`whsec_…`)
- `STRIPE_PRICE_DISCOVER_YEAR` / `STRIPE_PRICE_DISCOVER_MONTH`
- `STRIPE_PRICE_EXCHANGE_YEAR` / `STRIPE_PRICE_EXCHANGE_MONTH`
- `STRIPE_PRICE_FOCUS_YEAR` / `STRIPE_PRICE_FOCUS_MONTH`
- `STRIPE_PRICE_IMPACT_YEAR` / `STRIPE_PRICE_IMPACT_MONTH`
- `APP_URL` — Basis-URL für success/cancel (z. B. `http://localhost:5173`)

Plattform-injiziert (nicht setzen): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

> **Keine Preis-ID/kein Key im Client** (Spec §3.1, D1): der Client erstellt die
> Checkout-Session nie selbst — das macht `create-checkout-session`. Preis-IDs leben
> daher neben dem Secret Key hier, nie im Client-Bundle. `src/config/levels.ts` trägt
> nur die Anzeige-Beträge (`priceYear`/`priceMonth`), keine Stripe-IDs.

### Einmal-Setup (Mensch, Test-Mode)

1. 4 Produkte in Stripe (Test-Mode): Discover / Exchange / Focus / Impact.
   Je Produkt **zwei wiederkehrende Preise** (D2, `mode: 'subscription'`):
   jährlich (150 / 300 / 600 / 1.200 €) **und** monatlich (Beträge frei wählbar;
   spiegle sie zur Anzeige in `src/config/levels.ts` → `priceMonth`).
2. Die **8** Price-IDs (`price_…`) + `sk_test_…` als Secrets setzen (s. o.).
3. Functions deployen: `supabase functions deploy create-checkout-session stripe-webhook`.
4. Stripe-Webhook-Endpoint auf `…/functions/v1/stripe-webhook` anlegen, Event
   `checkout.session.completed` abonnieren, das `whsec_…` als
   `STRIPE_WEBHOOK_SECRET` setzen.
5. Migration anwenden: `pnpm db:push` (setzt `apply_upgrade`).

Danach: als Basic-Nutzer auf ein gesperrtes Format → Wand → „Upgrade" →
`/mitgliedschaft` → Testkarte `4242 4242 4242 4242` → der Webhook hebt `profiles.tier`,
und der zuvor gesperrte Inhalt wird sichtbar.

## Supabase Edge Function secrets (`send-push`, AGE-641)

`send-push` wird von einem Database Webhook auf `public.notifications` (INSERT)
angestoßen und vom Wiederholungslauf mit `{"modus":"faellig"}`. Secrets kommen
wie überall aus Infisical (`supabase secrets set`), plattform-injiziert sind
`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY`.

Welche Werte es gibt, steht oben in der Server-only-Tabelle. Hier steht, was
man über sie wissen muss.

### Den Webhook eintragen — die Namen sind verbindlich

Es ist **kein** Database Webhook aus der Konsole. Gemessen am 28.08.: auf DEV
**und** PROD fehlt das Schema `supabase_functions` ganz — die Konsolen-Webhooks
wurden auf diesen Projekten nie aktiviert, und darum fehlt im Dashboard auch der
Menüpunkt. `pg_net` ist dagegen auf beiden installiert. Der Push-Webhook ist
deshalb ein `net.http_post`-Trigger von Hand, genau wie der Mail-Webhook
darüber, und besteht wie dieser aus **zwei** Objekten in `public`:

| | |
| --- | --- |
| Funktion | `notify_push_webhook` |
| Trigger | `notifications_push_webhook` auf `public.notifications`, **nur Insert** |

Beide Namen stehen in `ERWARTET_OHNE_MIGRATION`
(`scripts/db-drift-scan.logic.ts`) und müssen in **beiden** Projekten exakt so
lauten. Weicht ein Name ab oder fehlt das Objekt, bricht der Objekt-Drift-Scan
in `migrate-prod.yml` ab; weil `deploy.yml` dann am Migrations-Gate hängen
bleibt, fällt der Frontend-Deploy **stumm** aus. Die Zusagen in
`db-drift-scan.test.ts` lesen die Liste selbst, keine Kopie.

Anwenden mit eingesetztem Token — nicht committen, das Repo ist öffentlich:

```sql
create extension if not exists pg_net;

create or replace function public.notify_push_webhook()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <PUSH_WEBHOOK_SECRET>'),  -- nicht in git
    body    := jsonb_build_object(
                 'type', tg_op, 'table', tg_table_name, 'schema', tg_table_schema,
                 'record', to_jsonb(new)));
  return null;
end; $$;
revoke execute on function public.notify_push_webhook() from public, anon, authenticated;

create trigger notifications_push_webhook
  after insert on public.notifications
  for each row execute function public.notify_push_webhook();
```

Nur `insert`: ein Update an einer Hinweiszeile (etwa `read_at`) erzeugt keinen
neuen Hinweis. `old_record` entfällt deshalb — `send-push` liest ohnehin nur
`record.id`, alles Übrige holt die RPC selbst.

**Zuerst ausliefern, dann eintragen.** Den Functions-Deploy macht `deploy.yml`
erst beim Merge auf `main`, und dann nach DEV **und** PROD. Für eine Probe in
DEV muss `send-push` vorher von Hand dort liegen — und der Deploy gehört **in
den Worktree des Branches**: im Haupt-Checkout gibt es weder die Function noch
ihren `config.toml`-Block, und ohne den Block gilt `verify_jwt = true`. Dann
weist das Gateway den Webhook mit **401** ab, bevor der Handler seine
Geheimnisprüfung erreicht.

**In PROD genügt dafür `PUSH_WEBHOOK_SECRET`.** Die Anbieter-Secrets dürfen
leer bleiben, solange es keine Produktions-App gibt: ohne Zeile in
`push_tokens` legt `push_auftraege_holen` keinen Auftrag an und beansprucht
keinen, die RPC kommt leer zurück, und `send-push` antwortet `{"skipped":true}`
ohne APNs oder FCM je anzufassen
(`20260827240000_push_zustellung.sql`). Fehlt dagegen `PUSH_WEBHOOK_SECRET`,
antwortet die Function auf **jeden** Hinweis mit `500`.

### Prüfen, ohne die Konsole

Der Statuscode allein belegt nichts — `send-push` antwortet auch `200`, wenn es
nichts zuzustellen gab. Diese drei Proben zusammen belegen etwas, und sie
brauchen den Webhook noch gar nicht:

```bash
# 1. richtiger Bearer, erfundene Kennung  → 200 {"skipped":true}
# 2. falscher Bearer                      → 401 Unauthorized
# 3. {"modus":"faellig"}                  → 200 {"skipped":true}
```

Probe 2 ist die entscheidende: ohne sie belegt die 200 nicht, dass die
Geheimnisprüfung überhaupt greift. Und der Wortlaut zählt — `Unauthorized`
stammt aus `index.ts`, das Gateway antwortet anders. Sonst ist ein
Gateway-401 (`verify_jwt` steht falsch) von einem Geheimnis-401 nicht zu
unterscheiden.

Steht der Webhook, ist der Beleg eine **Zeile im Function-Log**, nicht die
Antwort an den Aufrufer: `{"fn":"send-push","event":"nichts_zu_tun",…}`. Solange
es keine Zeile in `push_tokens` gibt, ist `nichts_zu_tun` das erwartete
Ergebnis.

### Den Wiederholungslauf eintragen — `pg_cron` (A5b)

Der Webhook oben deckt nur den **ersten** Versuch ab: er feuert, wenn eine
Hinweiszeile entsteht. Scheitert die Zustellung an einem vorübergehenden
Anbieterfehler, stellt `push_zustellung_quittieren`
(`20260827240000:309-312`) die Zeile mit wachsendem Abstand zurück — und dann
muss jemand wiederkommen. Ohne diesen Lauf ist jede Frist wirkungslos: sie
sagt, *wann* ein Auftrag wieder fällig wird, aber nicht, dass ihn jemand
abholt. Ein gescheiterter Push bliebe bis zum nächsten zufälligen Hinweis
liegen, in einer stillen Nacht also gar nicht.

Gemessen am 28.08.: `pg_cron` ist auf DEV **und** PROD verfügbar (1.6.4) und war
auf beiden nicht installiert. Es ist ein Eingriff in die Instanz — der lokale
Stack ist darin von PROD **nicht** unterscheidbar, dort hat `postgres` andere
Rechte. Deshalb zuerst DEV, dann PROD, und beides von Hand.

| | |
| --- | --- |
| Funktion | `push_wiederholung` (in `ERWARTET_OHNE_MIGRATION`) |
| cron-Job | `push-wiederholung`, `* * * * *` |

**Warum jede Minute und nicht seltener.** Es sind zwei verschiedene Fristen im
Spiel, und sie zu verwechseln kostet die Hälfte der Staffelung:

| | wo | Wert |
| --- | --- | --- |
| **Rückstellung** nach Fehlschlag | `20260827240000:312` | `now() + 1 min · 2^versuche` → 1, 2, 4, 8, 16 min |
| **Anspruchsfrist** (Lease) | `20260828100000:110,179` | `now() + 5 min` |

Der Takt muss sich an der **Rückstellung** orientieren, nicht an der
Anspruchsfrist: pg_cron kann nicht feiner als eine Minute, und die erste
Wiederholungsstufe ist genau eine Minute. Ein `*/5`-Takt — so stand es hier bis
zur Code-Review vom 28.08. — verschlucke die ersten beiden Stufen und machte
aus 1, 2, 4 faktisch 5, 5, 5. Preis des Minutentakts: rund 1440 Aufrufe je Tag
und Projekt, die ohne Zeile in `push_tokens` sofort `{"skipped":true}`
antworten.

```sql
create extension if not exists pg_cron;

create or replace function public.push_wiederholung()
  returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <PUSH_WEBHOOK_SECRET>'),  -- nicht in git
    body    := jsonb_build_object('modus', 'faellig'));
end; $$;
revoke execute on function public.push_wiederholung() from public, anon, authenticated;

select cron.schedule('push-wiederholung', '* * * * *',
                     'select public.push_wiederholung()');
```

**Der Name `push_wiederholung` ist verbindlich**, aus demselben Grund wie die
zwei Webhook-Namen: er steht in `ERWARTET_OHNE_MIGRATION`
(`scripts/db-drift-scan.logic.ts`). Fehlt die Funktion in PROD, bricht der
Objekt-Drift-Scan ab — und die Liste wirkt in **beide** Richtungen: ein Objekt
ohne Namen ist „unbekannt", ein Name ohne Objekt ist „fehlt". Beides rot.

> ⚠️ **Nicht verwechseln — hier standen bis zur Code-Review vom 28.08. zwei
> Gates durcheinander.** Der **Objekt**-Drift-Scan (`db-drift-scan.ts`) läuft an
> **genau einer** Stelle: `migrate-prod.yml:152`, und dieser Workflow ist
> `workflow_dispatch` — er läuft nur von Hand, und der Scan erst *nach* dem
> Anwenden der Migrationen. Das **Migrations**-Drift-Gate in `deploy.yml`
> (`migration-drift-gate.ts`, Zeile 228) ist etwas anderes: es vergleicht die
> Migrations*historie* und blockiert tatsächlich den Deploy. Nur dieses zweite
> fällt beim Merge stumm aus.
>
> Für den Objekt-Scan heisst das: ein Merge blockiert nichts, ein roter Scan
> meldet sich erst beim nächsten Handlauf von `migrate-prod`. Die Reihenfolge
> **erst in PROD anlegen, dann den Namen mergen** bleibt trotzdem richtig — nur
> ist ihr Preis ein abgebrochener Migrationslauf, kein stiller Deploy-Ausfall.

Der Scan deckt davon allerdings nur die Hälfte ab. Die Funktion liegt in
`public`, die Zeitplanung im Schema `cron` — und der Scan fragt ausschliesslich
`public` ab (`db-drift-scan.ts:61-90`). Eine **abbestellte Zeitplanung fällt
ihm nicht auf**: `push_wiederholung` stünde weiter da und würde nie gerufen.
Dafür gibt es `scripts/probe-age641-pg-cron.ts <dev|prod>`.

#### Prüfen — zwei getrennte Belege, keiner genügt allein

`net.http_post` ist **asynchron**. Ein `succeeded` in `cron.job_run_details`
belegt darum nur, dass das SQL lief, *nicht* dass `send-push` geantwortet hat.
Die Antwort steht in `net._http_response`.

1. **Der Rumpf** (URL, Bearer, Nutzlast): `select public.push_wiederholung()`,
   acht Sekunden warten, dann `net._http_response` lesen — aber **nur Zeilen
   neuer als eine vorher festgehaltene `max(id)`**. Ohne diese Grundlinie
   beweist eine `200`-Zeile nichts: auf DEV lag schon eine aus der
   Webhook-Probe desselben Vormittags.
2. **Der Takt**: warten, bis `cron.job_run_details` für den Job eine Zeile
   **mehr** trägt als vorher.

Erwartet ist beide Male `200 {"skipped":true}`, und dieser Wortlaut trägt die
ganze Kette: ohne `modus` antwortete `index.ts` mit **400**, mit falschem
Bearer mit **401**, bei fehlgeschlagener RPC mit **502**. `skipped` heisst
also: Auth durch, `faellig`-Zweig gelaufen, `push_auftraege_faellig` leer —
solange `push_tokens` leer ist, das richtige Ergebnis.

#### Was „der Bearer liegt inline in der Datenbank" wirklich bedeutet

Gilt für **alle drei** Funktionen dieser Sorte — `notify_contact_request_webhook`
(seit Juni), `notify_push_webhook` und `push_wiederholung`. Gemessen am 28.08.
auf DEV, weil es nirgends stand:

- **Ein Funktionsrumpf ist nicht geheim.** Als `anon` **und** als
  `authenticated` liefert `pg_get_functiondef()` den vollen Text samt Bearer.
  `revoke execute` schützt das Ausführen, nicht das Lesen — das sind zwei
  verschiedene Rechte, und nur das erste ist entzogen.
- **Über die Client-Fläche ist das nicht erreichbar.** PostgREST legt nur
  `public` offen; `pg_get_functiondef` liegt in `pg_catalog` und antwortet mit
  einem Anon-Schlüssel `404 PGRST202` („not found in the schema cache").
  Positivkontrolle daneben, sonst belegt die 404 nichts: `POST /rpc/push_wiederholung`
  mit demselben Schlüssel antwortet **`401 42501 permission denied for
  function`** — die Funktion ist der Fläche also durchaus bekannt, nur das
  Ausführen ist entzogen.
- **Wer den Bearer lesen kann, ist damit genau, wer eine direkte
  Postgres-Verbindung hat** — und dafür braucht es Zugangsdaten, gegen die
  dieser Bearer ohnehin keine zusätzliche Hürde wäre. Ein Grund mehr, das
  DB-Passwort zu rotieren, kein Grund, das Muster zu ändern.

### Den Ankündigungslauf für geplante Beiträge eintragen — `pg_cron` (AGE-667)

Ein Beitrag mit `veroeffentlicht_ab` in der Zukunft ist **sichtbar, sobald der
Zeitpunkt erreicht ist** — das rechnet die Regel, dafür läuft nichts. Was einen
Lauf braucht, ist allein die **Ankündigung**: `trg_hinweis_neuer_beitrag`
schweigt beim Planen (sonst hätte das Planen selbst alle Telefone erreicht), und
`public.beitrag_ankuendigen()` holt den Beitrag nach, sobald er live ist.

**Der Unterschied zu `push_wiederholung` oben, und er ist der ganze Punkt:**
fällt dieser Lauf aus, **erscheint der Beitrag trotzdem** und ist nur
unangekündigt. Er verbirgt keinen Inhalt. Genau deshalb ist er hier vertretbar
und für die Sichtbarkeit nicht.

| | |
| --- | --- |
| Funktion | `beitrag_ankuendigen` — **in der Migration** `20260829090000` |
| cron-Job | `beitrag-ankuendigen`, `* * * * *` |

**Die Funktion steht in der Migration, die Zeitplanung nicht.** Gemessen am
29.08.: `pg_cron` ist im lokalen Stack **nicht installiert** (`pg_net,
pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp`) und in der
frischen CI-Abbildung ebenso wenig — ein `cron.schedule` in einer Migration
bräche den CI-Job `migrations`. Der Schnitt liegt deshalb anders als bei
`push_wiederholung`: dort musste die ganze Funktion von Hand entstehen, weil sie
einen Bearer inline trägt. `beitrag_ankuendigen` trägt kein Geheimnis und ruft
kein `net.http_post` — sie ist reines SQL und damit in pgTAP **direkt aufrufbar
und messbar** (`supabase/tests/geplante_beitraege_test.sql`).

**Sie gehört deshalb NICHT in `ERWARTET_OHNE_MIGRATION`.** Die Liste wirkt in
beide Richtungen: ein Name ohne Migration gehört hinein, ein Name **mit**
Migration wäre dort falsch und machte den Objekt-Drift-Scan rot.

Von Hand, auf **DEV zuerst, dann PROD**:

```sql
create extension if not exists pg_cron;

select cron.schedule('beitrag-ankuendigen', '* * * * *',
                     'select public.beitrag_ankuendigen()');
```

**Warum jede Minute.** Feiner kann `pg_cron` nicht, und gröber verschöbe es den
gewählten Zeitpunkt sichtbar: wer „Freitag 18:00" wählt, nimmt eine Minute
Verzug hin, aber keine fünf.

**Prüfen.** Anders als beim Wiederholungslauf ist hier nichts asynchron — der
Rückgabewert ist die Zahl der angekündigten Beiträge:

1. `select public.beitrag_ankuendigen();` → erwartet `0`, solange nichts fällig
   ist. Das ist die **Positivkontrolle für die Erreichbarkeit**, nicht für die
   Wirkung.
2. Der Takt: warten, bis `cron.job_run_details` für den Job eine Zeile **mehr**
   trägt als vorher. Eine abbestellte Zeitplanung fällt dem Objekt-Drift-Scan
   **nicht** auf — er fragt nur `public` ab, die Zeitplanung liegt in `cron`.

> ⚠️ **Vor dem ersten Lauf auf einer bestehenden Umgebung:** die Migration
> markiert den gesamten Bestand als bereits angekündigt (`angekuendigt_am =
> created_at`). Ohne diese Zeile wäre der erste Lauf ein Massenversand — jeder
> vorhandene Beitrag trägt einen erreichten Zeitpunkt. Die Zeile steht in
> `20260829090000`; die Zeitplanung darf erst **nach** angewendeter Migration
> gesetzt werden.

### Der APNs-Schlüssel: drei Fallen

**1. Zwei Schlüsselsorten, ein Dateiname.** Apple lädt sowohl den
**App-Store-Connect-API-Schlüssel** als auch den **APNs-Auth-Key** als
`AuthKey_<KEYID>.p8` herunter. Beide sind PKCS#8/P-256 und an Datei, Größe oder
Inhalt **nicht** zu unterscheiden. Der falsche liefert an jedem Topic
`403 InvalidProviderToken` — eine Meldung, die nach kaputten Zugangsdaten
aussieht und in Wahrheit die falsche Sorte meint.

Sie entstehen an verschiedenen Stellen im Portal:

| Sorte | Wo sie entsteht |
| --- | --- |
| App Store Connect API | Users and Access → Integrations → App Store Connect API |
| **APNs Auth Key** | Certificates, Identifiers & Profiles → **Keys** → Haken bei *Apple Push Notifications service* |

Das hat am 28.08. eine Stunde gekostet. Wer einen `.p8` archiviert, schreibt die
**Sorte in den Titel**, nicht bloß die Key-ID.

**2. Apple gibt die Datei genau einmal heraus.** Es gibt keinen zweiten
Download. Geht sie verloren, bleibt nur Widerrufen und Neuanlegen. Das Archiv
ist darum **1Password**, nicht Infisical — Infisical ist die Laufzeit und kein
Backup. `.p8` steht in `.gitignore`, weil dieses Repo öffentlich ist und ein
versehentlicher Push eine Rotation im Apple-Portal bedeutete, kein `git rm`.

Ein ASC-Schlüssel braucht zusätzlich die **Issuer-ID** (eine UUID). Sie steht
**nicht** in der `.p8` und ist aus ihr nicht ableitbar — ohne Notiz ist der
Schlüssel wertlos.

**3. Zwei Einstellungen sind nach dem Speichern unveränderlich.** Gewählt:

- **Environment: Sandbox & Production.** TestFlight und der Store laufen über
  Produktions-APNs; ein Sandbox-Schlüssel wäre genau dort tot, und man hat je
  Team nur zwei aktive Schlüssel.
- **Key Restriction: Team Scoped (All Topics).** `Topic Specific` verlangt eine
  App-ID, die es zum Anlagezeitpunkt schon gibt — und die Einstellung ließe
  sich nie wieder korrigieren. Preis: ein abhandengekommener Schlüssel dürfte
  an jede App des Teams pushen.

### Die Zugangsdaten prüfen — ohne App und ohne Gerät

Man muss auf AGE-642 nicht warten, um zu wissen, ob die Zugangsdaten stimmen.
Ein Push an ein **erfundenes** Gerätetoken kann niemanden erreichen;
interessant ist allein, **wie** Apple ablehnt:

| Antwort | Bedeutung |
| --- | --- |
| `400 BadDeviceToken` | **Alles richtig.** Apple hat uns authentifiziert und nur das Token verworfen |
| `403 InvalidProviderToken` | Schlüssel, Key-ID oder Team-ID passen nicht — oder es ist die falsche Sorte |
| `400 TopicDisallowed` | Die App-ID gibt es nicht oder sie hat kein Push aktiviert |

Das misst den ganzen Zugangsweg: JWT-Signatur, PEM-Einlesung, Kopfzeilen und
Anfragekörper. **Nicht** gemessen wird damit, ob die App-ID existiert — APNs
prüft das Gerätetoken **vor** dem Topic, ein erfundenes Token kommt also nie
bis zur Topic-Prüfung.

Eine zweite Bundle-ID desselben Teams als **Positivkontrolle** mitzuschicken
lohnt sich: ohne sie ist „Zugangsdaten falsch" nicht von „App-ID fehlt" zu
trennen.

### DEV und PROD

Derselbe `.p8` gehört in **beide** Umgebungen. Apple kennt keinen
umgebungsspezifischen Auth-Key — er gilt teamweit, und mit der Einstellung
*Sandbox & Production* bedient er beide Hosts. Byte-gleich ist hier also kein
Versäumnis, sondern unvermeidbar (anders als bei Stripe und Resend, siehe die
Trennungsregel oben).

`APNS_SANDBOX` steht in `dev` auf `1` und seit dem 31.08. auch in `prod` — dort,
solange das einzige Gerät ein Xcode-Build ist.

> **Seit dem 31.08. entscheidet dieser Wert nichts mehr.** Er sagt nur noch,
> welcher Host **zuerst** gefragt wird.
>
> Bis dahin stand hier die Regel „in `prod` gar nicht setzen" und die Warnung
> „Dev-Builds gehören auf DEV". Beides ist überholt, und die Regel war von
> Anfang an nicht haltbar: ein Wert kann nicht zwei Wahrheiten tragen, sobald
> Entwicklungs- und Store-Builds nebeneinander laufen. Der Preis eines Irrtums
> war auch keine ausgefallene Zustellung, sondern ein **gelöschtes
> Gerätetoken** — `BadDeviceToken` gilt als dauerhaft, das Mitglied war still
> von allen Hinweisen abgemeldet und heilte sich beim nächsten App-Start
> wieder: ein Fehlerbild, das wie Sporadik aussieht und keines ist.
>
> `apnsMitHostErkennung` (`supabase/functions/send-push/anbieter.ts`) fängt das
> ab: auf `BadDeviceToken` wird derselbe Versand am anderen Host wiederholt,
> und dessen Ergebnis gilt. Lehnen **beide** ab, ist das Token wirklich tot und
> wird entfernt. Ein Dev-Build darf damit auf PROD zeigen.
>
> Sobald ein Store-Build läuft, gehört `APNS_SANDBOX` aus `prod` heraus — nicht
> weil es sonst bräche, sondern damit die Vermutung stimmt und der zweite Weg
> die Ausnahme bleibt.

### Der Firebase-Dienstschlüssel: die Organisationsrichtlinie

Firebase braucht es **nur für Android**. iOS spricht direkt mit APNs —
absichtlich: der übliche Weg, iOS durch FCM zu leiten, hiesse, den APNs-Key bei
Google zu hinterlegen.

Die Play-Console-Bestätigung blockiert das **nicht**. Sie regelt die Verteilung
im Store; FCM braucht nur ein Firebase-Projekt, und ein seitlich installiertes
Debug-APK bekommt Push ohne jede Store-Freigabe.

**Was tatsächlich blockiert, ist Google Cloud.** In Workspace-Organisationen ist
das Anlegen von Dienstkontoschlüsseln seit ~2024 per Vorgabe gesperrt; die
Firebase-Konsole meldet dann nur „Das Erstellen von Schlüsseln ist für dieses
Dienstkonto nicht zulässig". Es sind **zwei** Richtlinien, und beide müssen für
das Projekt auf *nicht erzwungen*:

| Einschränkung | |
| --- | --- |
| `iam.disableServiceAccountKeyCreation` | die klassische |
| `iam.managed.disableServiceAccountKeyCreation` | die neuere „managed"-Variante |

Nicht zu verwechseln mit `iam.managed.disableServiceAccountApiKeyCreation` —
die regelt API-Key-Bindungen und ist eine andere Sache.

Nur für **dieses Projekt** überschreiben, nicht organisationsweit abschalten:
langlebige Dienstkontoschlüssel sind genau die Sorte Geheimnis, gegen die die
Richtlinie gedacht ist. Das Überschreiben braucht `roles/orgpolicy.policyAdmin`
auf **Organisationsebene** — Projekt-Inhaber reicht nicht, und
Workspace-Super-Admin ist nicht dasselbe wie Cloud-Organisationsadministrator.
Die Änderung propagiert nicht sofort.

Die Probe funktioniert wie bei Apple, mit einem erfundenen Gerätetoken:

| Antwort | Bedeutung |
| --- | --- |
| `400 INVALID_ARGUMENT` | **Alles richtig.** Authentifiziert, nur das Token verworfen |
| `401 UNAUTHENTICATED` | Dienstkonto oder Signatur stimmen nicht |
| `403` mit „API has not been used in project…" | Die FCM-API ist im Projekt nicht aktiviert |

### Was noch fehlt

- **Die Anbieter-Secrets in `prod`** — bewusst noch leer, solange es keine
  Produktions-App gibt. **Nicht mehr leer bleiben darf `PUSH_WEBHOOK_SECRET`**,
  sobald der PROD-Webhook steht: siehe „Den Webhook eintragen".
- **Die Zustellung an ein echtes Gerät.** Beide Anbieter sind gegen ihre echten
  Endpunkte belegt; was fehlt, ist ein Gerätetoken, und das setzt AGE-642 B1
  voraus.

**Überwachen.** Der Lauf hat keinen Empfänger, der sich beschwert: fällt er aus,
erscheinen die Beiträge trotzdem, nur unangekündigt — es gibt also kein Signal
ausser der Zahl selbst. Zwei Abfragen, beide gegen die Zieldatenbank:

```sql
-- Fällige, die niemand abgeholt hat. Erwartet: 0 (bzw. < 200 kurz nach einer
-- Welle). Eine Zahl, die WÄCHST, ist der Befund.
select count(*) from public.posts
 where kind = 'member' and veroeffentlicht_ab <= now() and angekuendigt_am is null;

-- Und ob der Job überhaupt noch läuft — der Objekt-Drift-Scan sieht das Schema
-- `cron` nicht, eine abbestellte Zeitplanung fällt ihm also NICHT auf.
select jobname, active, schedule from cron.job where jobname = 'beitrag-ankuendigen';
```
