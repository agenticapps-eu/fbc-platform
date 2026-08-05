# Session Handoff — 2026-08-05 (8. Session)

## Accomplished

**C4 / AGE-496: Repo-Seite fertig, PROD-Projekt angelegt und konfiguriert.**
Branch `donald/age-496-c4-supabase-trennen-neues-prod-projekt-altes-wird-devdemo`,
elf Commits. Migrationen sind noch **nicht** auf PROD.

- **Task 0.3** Drift-Scan-Ausgangsbefund: genau das Webhook-Paar, sonst nichts.
- **Task 1–5** Branch · `config.toml` auf PROD · `db:push:prod`/`config:push:prod`
  als TDD-Paar · die drei CI-Jobs · DEV-Kennzeichnung in der App.
- **Task 6** PROD-Projekt `fbc-platform-prod` = **`viwntbodrtqxgmqyxluh`**
  (Donald angelegt), `eu-central-1`, Org `factiv`, ACTIVE_HEALTHY.
- **Task 6a** Die offene Frage gemessen — siehe unten, das war der Ertrag.
- **Task 9** Auth- und Storage-Konfiguration auf PROD, nachgemessen.
- **Task 13.3** Runbook auf den echten Ref gezogen.
- **Task 14.2** Beide Verbindungs-URLs in Infisical (vorgezogen, 6a brauchte sie).

Gesamtsuite 371/371 · `openspec validate --all` 26/26.

## Die vier Funde, die den Tag ausmachen

1. **`config push` ändert mehr als die Absicht.** Am leeren PROD-Projekt
   gemessen (Baseline → Push → Baseline → Diff über alle 242 Felder): geplant
   waren fünf Felder, bewegt haben sich **zehn**. Ungewollt u. a.
   `smtp_max_frequency` 60→1 und MFA/TOTP true→false. Volle Tabelle im Runbook.
2. **`rate_limit_email_sent` lässt sich nicht erhöhen.** Direkter PATCH →
   `HTTP 401 Custom SMTP required`. Ohne eigenen SMTP deckelt Supabase bei
   **2 Auth-Mails pro Stunde, projektweit**. → „Passwort vergessen" ist bis C3
   kein verlässlicher Weg. Als Vorbedingung im Runbook vermerkt.
3. **`db.<ref>.supabase.co` löst nur auf IPv6 auf.** GitHub-Actions-Runner sind
   IPv4 — beide Verbindungs-URLs müssen der Session-Pooler sein, sonst könnten
   `migrate-dev`/`drift-gate` gar nicht messen.
4. **Der Pooler-Host ist pro PROJEKT verschieden, nicht pro Region.** Altes
   Projekt `aws-1`, neues `aws-0`. Durchprobiert und verbunden, nicht geraten.

Dazu zwei kleinere: das Drift-Gate wurde anfangs aus dem falschen Grund rot
(Spaltentrennzeichen ging beim Parsen verloren), und die erste Position der
DEV-Kennzeichnung verdeckte den Einklapp-Knopf der Sidebar.

## Decisions

- **Task 4.6 zurückgestellt** (Donald): kein `production`-Environment mit
  Freigabepflicht, er ist der einzige Entwickler. Entscheidung 16 in `design.md`
  eingeschränkt. _Folge: `apply` läuft direkt hinter `plan`._
- **Resend/SMTP kommt in C3, nicht in C4** (Donald). Folge siehe Fund 2.
- **MFA/TOTP bleibt aus** (Donald) — die App hat keine MFA-Oberfläche.
- **`email_sent` in `config.toml` von 30 auf 2 zurück**, weil ein Wert, der
  still nicht greift, genau der Fehlerfall ist, den dieser Change abschafft.
- **`push-prod.ts` statt `.sh`**, **`migrate-prod` als eigener Workflow**
  (`plan` → `apply`), **Kennzeichnung in `App.tsx` statt `AppShell`** — je
  begründet in `tasks.md`.

## Next session: start here

**Zwei Dinge, beide von Donald, in dieser Reihenfolge.**

1. **Infisical `prod`, `SUPABASE_DB_URL_PROD`: Host `aws-1-` → `aws-0-`.**
   Nur dieser eine Teil; Rest der URL bleibt. Grund: Fund 4.
2. Danach **Task 7** in seinem Terminal:
   ```
   pnpm db:push:prod
   ```
   Stufe 1 prüft den Ref maschinell → zeigt Host + Dry-Run → Ref abtippen.
   Erwartung: 40 Migrationen, alle neu (das Projekt ist leer).

Danach Claude: Task 7.2 (`migration list` gegen beide Projekte, diff-frei),
Task 8 (Storage/`avatars`, RLS-Probe), Task 10 (drei Edge Functions),
Task 11 (Admin-Konten), Task 12 (Webhook + `db-drift-scan.sh`), Rest von 13,
14.3 (GitHub-Secrets), 15, 16.

## Open questions

- **`SUPABASE_DB_URL_DEV`/`_PROD` fehlen noch als GitHub-Secrets** (Task 14.3).
  Bis dahin werden `migrate-dev` und `drift-gate` auf `main` rot — gewollt, aber
  es heißt: **dieser Branch darf erst danach auf `main`**, sonst blockiert er
  jeden Deploy.
- **`custom_oauth_max_providers` sprang 3 → 32767** beim ersten Push. Steht in
  keiner `config.toml`. Ob Push oder Provisionierung ist ungeklärt; harmlos,
  aber offen.
- **Echt-Link-Probe aus Task 9.3** wandert hinter Task 11 (braucht ein Konto).
- **Detlev hat zwei Prod-Accounts** (mit/ohne Bindestrich). Vor Task 11.2 klären.
- **Token-Rotation:** Claude hat beim Auflisten der Infisical-Secrets versehentlich
  `AXIOM_TOKEN`, `CLOUDFLARE_API_TOKEN` und `SENTRY_AUTH_TOKEN` ins Transkript
  ausgegeben. Donald: „vergiss die Rotation" — hier nur der Vollständigkeit halber.
- **Nachläufe aus AGE-494**, unverändert offen: „Meine Communities" auf
  `/kontakte` · `NUR_REDIRECT` handgepflegt · `ChipGroup`/`ChipFilterGroup`
  dupliziert · roher `23505` beim Kategoriewechsel · Preview-Abnahme durch Detlev.
