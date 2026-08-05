# CI/CD — FBC Platform (Phase 1)

> Linear: **AGE-232**. Two GitHub Actions workflows: `ci.yml` (quality gate) and
> `deploy.yml` (Cloudflare Pages preview/prod + Sentry release). Secrets come from
> Infisical; nothing sensitive lives in the repo.

---

## Workflows

### `.github/workflows/ci.yml` — runs on every PR and on push to `main`

| Job          | What it does                                                                                   | Secrets |
| ------------ | ---------------------------------------------------------------------------------------------- | ------- |
| `verify`     | `pnpm install` → `lint` → `typecheck` → `test` (vitest) → `build`                               | none    |
| `migrations` | Boots a throwaway local Supabase stack and runs `supabase db reset` (applies every migration from a clean DB — fails if any migration is invalid) | none    |
| `pr-title`   | Enforces a Conventional-Commit PR title (the squash-merge subject) — PRs only                   | none    |

`pnpm build` stays a plain `tsc && vite build` (no `infisical run` wrapper), so
CI compiles and bundles without any secret. See [secrets.md](./secrets.md).

> **Why `db reset` and not `supabase test db`?** `db reset` is the migration
> dry-run/validate gate. The pgTAP suite (`supabase/tests/rls_test.sql`) and the
> plain SQL probes are run on demand, not in CI — mixing non-pgTAP probe files
> into `supabase test db` would fail the run.

### `.github/workflows/deploy.yml`

| Trigger        | Result                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| Pull request   | Cloudflare Pages **preview** deploy; preview URL posted as a PR comment  |
| Push to `main` | Cloudflare Pages **production** deploy **+ Sentry release**              |

Flow: checkout (full history) → install deps → install Infisical CLI →
`infisical run -- pnpm build` → `infisical run -- wrangler pages deploy ./dist`.
Both secret-needing commands are wrapped in `infisical run`, so secrets are
injected into the child process and never written to a file or `GITHUB_ENV`.

**Seit AGE-496 hängt `deploy` an zwei Vorbedingungen** (`needs: [migrate-dev,
drift-gate]`), die beide nur auf `main` laufen. Auf Pull Requests werden sie
übersprungen; `if: !cancelled() && !contains(needs.*.result, 'failure')` lässt
`deploy` dort trotzdem los.

| Job           | Läuft auf        | Tut                                                              |
| ------------- | ---------------- | ---------------------------------------------------------------- |
| `migrate-dev` | Push auf `main`  | `supabase db push --db-url $SUPABASE_DB_URL_DEV`                  |
| `drift-gate`  | Push auf `main`  | Migrationshistorie gegen PROD, **beidseitig** → Abweichung = rot  |
| `deploy`      | PR + `main`      | Build + Cloudflare Pages, `needs` beide                           |

**`migrate-dev` läuft bewusst nicht auf Pull Requests.** Sonst mutierte jeder
offene PR das DEV-Projekt mit ungereviewten Migrationen, und zwei parallele PRs
schrieben sich gegenseitig in die Historie.

**`drift-gate` wird auch rot, wenn es nicht messen KANN** — fehlendes Secret, DB
nicht erreichbar, geändertes CLI-Ausgabeformat. Ein Gate, das bei Nichtwissen
grün wird, baut die Juni-Havarie eine Ebene höher nach. Das ist kein
theoretischer Fall: am 2026-08-05 stellte die Supabase-CLI zwischen 2.107.0 und
2.111.0 ihr Ausgabeformat von einer ASCII-Tabelle auf JSON um. Der damalige
Parser fand keine einzige Zeile — rot wurde das Gate nur wegen der Kreuzprobe
gegen die Dateien im Repo.

### `.github/workflows/migrate-prod.yml` — von Hand

Eigener Workflow, `workflow_dispatch`, eigene `concurrency`-Gruppe mit
`cancel-in-progress: false`. Ein `workflow_dispatch` in `deploy.yml` löste auch
einen Deploy aus, und dessen `cancel-in-progress: true` dürfte nie eine laufende
PROD-Migration abbrechen.

Zwei Jobs, damit die Freigabe auf etwas Lesbares fällt:

| Job     | Tut                                                                        |
| ------- | -------------------------------------------------------------------------- |
| `plan`  | belegt, dass `migrate-dev` für **denselben Commit** grün war · löst den Zielhost auf (`scripts/assert-prod-target.ts`) · Drift-Vergleich · `--dry-run` |
| `apply` | `supabase db push` · Historie nachher · Objekt-Drift-Scan                    |

> ⚠️ **Die Freigabe-Regel ist zurückgestellt** (2026-08-05, Donald): das
> GitHub-Environment `production` trägt **keine** Reviewer-Regel, weil er der
> einzige Entwickler ist. `apply` startet damit direkt hinter `plan` — der
> Dry-Run steht im Log, aber niemand muss ihn gelesen haben. Nachziehen, sobald
> ein Zweiter am Repo arbeitet; Befehl in `docs/supabase-environments.md`.

**Kein Break-Glass.** Sobald ein Merge eine Migration enthält, blockiert
`drift-gate` jeden Frontend-Deploy, bis `migrate-prod` gelaufen ist — auch einen
eiligen Fix ohne Bezug zur Migration. Der Ausweg ist immer derselbe:
`migrate-prod` freigeben, dann deployen.

**Nötige GitHub-Secrets:** `SUPABASE_DB_URL_DEV` und `SUPABASE_DB_URL_PROD`
(beides Session-Pooler-URLs, siehe [secrets.md](./secrets.md)). Fehlen sie,
werden `migrate-dev` und `drift-gate` auf `main` rot — gewollt, aber es heißt:
erst die Secrets, dann der Merge.

**Sentry:** the `@sentry/vite-plugin` (configured in `vite.config.ts`, P8) does
the whole release **during the build**: when `SENTRY_AUTH_TOKEN` is set (prod env)
and `VITE_SENTRY_RELEASE` names the release (`= github.sha`, main only), it uploads
hidden source-maps, creates/finalizes the release, and associates commits
(`release.setCommits.auto`, needs `fetch-depth: 0`). On previews the dev env has no
`SENTRY_AUTH_TOKEN`, so the plugin stays off and no Sentry noise is produced per PR.

---

## Secrets — two strategies

The required keys (already defined in Infisical — see [secrets.md](./secrets.md)):

- **Client / build (`VITE_*`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_SENTRY_DSN`, `VITE_ENVIRONMENT`
- **Server / deploy:** `SENTRY_AUTH_TOKEN`, `AXIOM_TOKEN`, `AXIOM_DATASET`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `SENTRY_ORG` / `SENTRY_PROJECT` are **not** required in Infisical — the workflow
  and `vite.config.ts` default them to `factiv` / `fbc-platform`.

### A. Infisical CLI + service token (recommended — what `deploy.yml` uses)

CI installs the Infisical CLI and runs `infisical run --env=<env> -- <cmd>`,
authenticated by **one GitHub secret, `INFISICAL_TOKEN`** (an Infisical service
token scoped read-only to the `dev` and `prod` environments). Adding or rotating an
app secret happens once, in Infisical; GitHub is only touched if the service token
itself is rotated.

Mint the token with the CLI (read-only, both envs) and store it in GitHub:

```bash
infisical service-token create \
  --name "github-actions-ci" --access-level read --expiry-seconds 0 \
  --scope "dev:/" --scope "prod:/" --token-only \
  | gh secret set INFISICAL_TOKEN --repo agenticapps-eu/fbc-platform
```

> `--expiry-seconds 0` = never expires (avoids a surprise deploy outage). Rotate by
> re-running the command; revoke the old token in the Infisical dashboard. If your
> org is on Infisical EU, `export INFISICAL_API_URL=https://eu.infisical.com` first.

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` must exist in **both** envs
(previews deploy from `dev`):

```bash
infisical secrets set CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<id> --env=dev
infisical secrets set CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<id> --env=prod
```

### B. Infisical Machine Identity (alternative — GitHub Action instead of the CLI)

Replace the CLI steps with `Infisical/secrets-action` (Universal Auth: two GitHub
secrets `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`, `method: universal`),
which exports the env into the job and lets later steps read `${{ env.X }}`.

### C. Individual GitHub secrets (fallback — no Infisical in CI)

Mirror every key above into GitHub Actions secrets and reference `${{ secrets.X }}`
directly instead of going through Infisical. Heaviest to maintain (every rotation =
a GitHub edit), which is why **A is preferred**.

---

## Supply chain

Third-party actions are **pinned to full commit SHAs** (the `# vN` comment marks
the human-readable tag) so a moved tag can't silently swap the code that handles
our deploy secrets. `.github/dependabot.yml` watches the `github-actions`
ecosystem and opens reviewed PRs to bump those SHAs. First-party `actions/*` are
left tag-pinned.

---

## Branch protection (`main`)

Configured on the GitHub repo (not in a workflow file) — **applied**:

- Pull request required before merge (no direct pushes); 0 required approvals
  (solo-friendly — raise later when there are reviewers).
- Required status checks (must be green): **`verify`**, **`migrations`**,
  **`pr-title`**. Branches must be up to date (`strict`) before merge. `deploy` is
  deliberately **not** required — it can't pass without the Infisical secrets and
  would otherwise make `main` unmergeable.
- Conventional-Commit PR title enforced by the `pr-title` check; squash-merge so
  the PR title becomes the commit subject.

Re-apply / inspect with the GitHub CLI:

```bash
gh api -X PUT repos/agenticapps-eu/fbc-platform/branches/main/protection \
  -H "Accept: application/vnd.github+json" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "verify" },
      { "context": "migrations" },
      { "context": "pr-title" }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
```

---

## Linear

Branches use the `donald/age-XXX-…` format, which Linear auto-links. Put the issue
key (e.g. `AGE-232`) in the PR title/description so Linear attaches the PR and
moves the issue through its states.

---

## Definition of Done

- A PR produces green CI (`verify` + `migrations` + `pr-title`) and a Cloudflare
  Pages preview deploy (URL commented on the PR).
- Merge to `main` deploys production and creates a Sentry release with commits +
  source-maps.
- `main` is protected; all secrets come from Infisical, nothing sensitive in the repo.
