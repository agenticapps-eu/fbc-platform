# fbc-platform

Plattform des **Fair Business Club (FBC)** — soziales Business-Netzwerk für Unternehmer, Experten und Investoren mit intelligentem Matching (Suche ⇄ Biete).

Teil der **factiv**-Familie (siehe `~/Sourcecode/factiv`).

## Status

Phase 1 — Prototyp-Build (Frontend-Fundament steht). Phase 0 (Requirements & Design,
Fragebogen unter `docs/`) ist abgeschlossen.

## Entwicklung

**Voraussetzungen**

- [Node.js](https://nodejs.org) ≥ 22
- [pnpm](https://pnpm.io) ≥ 9 (`corepack enable` oder `npm i -g pnpm`)
- [Infisical CLI](https://infisical.com/docs/cli/overview) (Secrets-Injektion in Dev/CI)
- [GitHub CLI](https://cli.github.com) `gh` (Repo-/PR-Workflow)

**Setup**

```bash
pnpm install                 # Abhängigkeiten installieren (richtet auch Husky-Hooks ein)
cp .env.example .env.local   # Platzhalter füllen — NIE echte Secrets committen
```

**Befehle**

| Befehl                          | Zweck                                      |
| ------------------------------- | ------------------------------------------ |
| `pnpm dev`                      | Vite-Dev-Server (HMR)                      |
| `pnpm build`                    | Typecheck + Produktions-Build nach `dist/` |
| `pnpm preview`                  | Produktions-Build lokal servieren          |
| `pnpm lint` / `pnpm lint:fix`   | ESLint                                     |
| `pnpm typecheck`                | TypeScript (strict, `--noEmit`)            |
| `pnpm test` / `pnpm test:watch` | Vitest (Unit-Tests)                        |
| `pnpm format`                   | Prettier                                   |

Secrets werden über **Infisical** injiziert statt in `.env` abgelegt:

```bash
infisical run -- pnpm dev     # startet Dev-Server mit injizierten Secrets
```

Ein **pre-commit-Hook** (Husky + lint-staged) führt vor jedem Commit
`eslint --fix` + `prettier` auf gestagte Dateien sowie `pnpm typecheck` aus.

## Inhalt

- **`docs/`** — Requirements- & Design-Fragebogen für Detlev, gehostet als **GitHub Page**.
  Live: `https://agenticapps-eu.github.io/fbc-platform/`
  Rücklauf der Antworten über Formspree (Endpoint in `docs/index.html` → `FORMSPREE_ENDPOINT`).

## Roadmap

| Phase                | Inhalt                                                       | Dauer    |
| -------------------- | ------------------------------------------------------------ | -------- |
| 1 · Prototyp         | Profil, Matching-Hub, Feed/Events, gestaffelte Zugänge       | ~1 Monat |
| 2 · Launch Stuttgart | Stripe-Abos, volle Rechte, Academy/Library, DSGVO, Migration | ~1 Monat |
| 3 · Skalierung       | Multi-City, Mobile, tieferes Matching                        | laufend  |

## Geplanter Stack

React + Vite · Supabase (Auth/DB/RLS/Realtime/Storage) · Stripe (ab Phase 2) · Cloudflare Pages · Video-Embed (YouTube/Vimeo). EU-Hosting (Frankfurt).
