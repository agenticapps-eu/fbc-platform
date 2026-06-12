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

Flow: checkout (full history) → install → load secrets (Infisical) → `pnpm build`
→ (main only) create Sentry release → `wrangler pages deploy ./dist`.

**Sentry split:** the `@sentry/vite-plugin` (configured in `vite.config.ts`, P8)
uploads hidden source-maps **during the build** when `SENTRY_AUTH_TOKEN` is set
and `VITE_SENTRY_RELEASE` names the release. The `getsentry/action-release` step
then **creates/finalizes** that same release (`version = github.sha`) and
**associates commits** (`set_commits: auto`, needs `fetch-depth: 0`). On previews
the build runs with a blank `SENTRY_AUTH_TOKEN`, so the plugin is disabled and no
Sentry noise is produced per PR.

---

## Secrets — two strategies

The required keys (already defined in Infisical — see [secrets.md](./secrets.md)):

- **Client / build (`VITE_*`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_SENTRY_DSN`, `VITE_ENVIRONMENT`
- **Server / deploy:** `SENTRY_AUTH_TOKEN`, `AXIOM_TOKEN`, `AXIOM_DATASET`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `SENTRY_ORG` / `SENTRY_PROJECT` are **not** required in Infisical — the workflow
  and `vite.config.ts` default them to `factiv` / `fbc-platform`.

### A. Infisical Machine Identity (recommended — what `deploy.yml` uses)

An Infisical **Machine Identity** (Universal Auth) — service tokens are
deprecated and `Infisical/secrets-action` no longer accepts them. Two GitHub
secrets, **`INFISICAL_CLIENT_ID`** and **`INFISICAL_CLIENT_SECRET`**; the action
pulls the whole environment into the job env at runtime — `prod` on `main`, `dev`
for previews. Adding or rotating an app secret happens once, in Infisical; GitHub
is only touched if the machine identity itself rotates.

1. Infisical → org **Access Control → Identities** → create a Machine Identity
   with **Universal Auth**; copy its Client ID + Client Secret.
2. Give that identity read access to the `fbc-platform` project's `dev` and `prod`
   environments.
3. GitHub → repo **Settings → Secrets and variables → Actions** → add
   `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET`.
4. If your org is on Infisical EU, uncomment the `domain:` line in `deploy.yml`.

### B. Individual GitHub secrets (fallback — no Infisical in CI)

Mirror every key above into GitHub Actions secrets, then in `deploy.yml` remove
the "Load secrets from Infisical" step and replace each `${{ env.X }}` with
`${{ secrets.X }}`, and add the `VITE_*` keys to the `Build` step's `env:`.
Heavier to maintain (every rotation = a GitHub edit), which is why **A is
preferred**.

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
