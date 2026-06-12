# Cloudflare Pages Functions

Server-side endpoints that ship with the Pages deployment. Each `.ts` file under
`api/` maps to a route (`api/log.ts` → `/api/log`). Typed against
`@cloudflare/workers-types` via `functions/tsconfig.json`
(`pnpm typecheck:functions`); not part of the Vite/`src` build.

- `api/log.ts` — server-side Axiom proxy for structured events. Holds the
  `AXIOM_TOKEN` so it never reaches the client. See `docs/observability.md`.
