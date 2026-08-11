# Cloudflare Pages Functions

Server-side endpoints that ship with the Pages deployment. Each `.ts` file under
`api/` maps to a route (`api/log.ts` → `/api/log`). Typed against
`@cloudflare/workers-types` via `functions/tsconfig.json`
(`pnpm typecheck:functions`); not part of the Vite/`src` build.

- `api/log.ts` — server-side endpoint for structured domain events. Validates
  against an allowlist, enriches server-side (cf fields, `_time`) and writes a
  JSON line captured by Workers Logs. Holds no secret since ADR-0037 removed
  the Axiom destination. See `docs/observability.md`.
