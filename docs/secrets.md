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
| `APNS_SANDBOX`              | `1` schickt an Apples Sandbox-Host. In `prod` **nicht setzen** |
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
# Push the function secrets from Infisical's dev env into Supabase.
# (--silent keeps the values off your terminal; --plain emits KEY=value pairs.)
infisical export --env=dev --format=dotenv --plain \
  | grep -E '^(RESEND_API_KEY|FROM_EMAIL|CONTACT_WEBHOOK_SECRET|APP_URL)=' \
  > /tmp/fbc-fn.env
supabase secrets set --env-file /tmp/fbc-fn.env
rm -f /tmp/fbc-fn.env

# …or set them one-off, reading each value from Infisical at call time:
infisical run --env=dev -- sh -c \
  'supabase secrets set RESEND_API_KEY="$RESEND_API_KEY" FROM_EMAIL="$FROM_EMAIL" \
     CONTACT_WEBHOOK_SECRET="$CONTACT_WEBHOOK_SECRET" APP_URL="$APP_URL"'
```

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

Unterschiedlich ist genau **ein** Wert: `APNS_SANDBOX=1` in `dev`, in `prod`
gar nicht gesetzt.

> ⚠️ Zeigt ein Entwicklungs-Build auf **PROD**, schickt PROD ein Sandbox-Token
> an den Produktions-Host. Apple antwortet `BadDeviceToken`, und `send-push`
> stuft das korrekt als `dauerhaft` ein — es **löscht das Gerätetoken**. Beim
> nächsten App-Start heilt sich das über `claim_push_token`, sieht aber wie ein
> Fehler aus. Dev-Builds gehören auf DEV.

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

- **Die `prod`-Umgebung** — bewusst noch leer, solange es keine
  Produktions-App gibt.
- **Die Zustellung an ein echtes Gerät.** Beide Anbieter sind gegen ihre echten
  Endpunkte belegt; was fehlt, ist ein Gerätetoken, und das setzt AGE-642 B1
  voraus.
