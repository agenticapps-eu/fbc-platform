/**
 * Pure helpers for the demo seed (AGE-254). No DB / `pg` import here so they stay
 * fast and unit-testable. See ADR-0003 for why the guard is an explicit opt-in
 * rather than environment detection (dev and prod are the same Supabase project).
 */

/** Project ref of the single shared Supabase project (see ADR-0003). */
const PROJECT_REF = "foelowldexkcqzewvrcf";
/** Session-mode pooler host (port 5432) — supports the multi-statement SQL files. */
const POOLER_HOST = "aws-1-eu-central-1.pooler.supabase.com";
const POOLER_PORT = "5432";

/** The literal value the operator must set to confirm an intentional run. */
export const CONFIRM_TOKEN = "fbc-demo";

export type SeedMode = "seed" | "reset";

/** A minimal, testable view of the environment (so tests pass plain objects). */
export type SeedEnv = Record<string, string | undefined>;

/**
 * Throws unless the operator has explicitly opted in. On a single shared DB
 * (dev == prod) this is the only enforceable safety property: prevent an
 * *accidental* run. The error doubles as usage guidance.
 */
export function assertOptIn(env: SeedEnv): void {
  if (env.DEMO_SEED_CONFIRM === CONFIRM_TOKEN) return;
  throw new Error(
    `Refusing to run: this writes to the LIVE shared Supabase project.\n` +
      `Set DEMO_SEED_CONFIRM=${CONFIRM_TOKEN} to confirm an intentional run.`,
  );
}

/** Reads the run mode; unknown values are rejected rather than silently ignored. */
export function parseMode(env: SeedEnv): SeedMode {
  const raw = env.DEMO_SEED_MODE;
  if (raw === undefined || raw === "" || raw === "seed") return "seed";
  if (raw === "reset") return "reset";
  throw new Error(`Unknown DEMO_SEED_MODE "${raw}" (expected "seed" or "reset").`);
}

/**
 * Resolves the Postgres connection string. Prefers an explicit override, else
 * builds the session-pooler URL from `SUPABASE_DB_PASSWORD` (the only connection
 * material available in the `dev` Infisical env — see ADR-0003).
 */
export function resolveDatabaseUrl(env: SeedEnv): string {
  if (env.DEMO_SEED_DATABASE_URL) return env.DEMO_SEED_DATABASE_URL;
  const password = env.SUPABASE_DB_PASSWORD;
  if (!password) {
    throw new Error(
      "No connection material: set DEMO_SEED_DATABASE_URL, or provide " +
        "SUPABASE_DB_PASSWORD (injected by `infisical run`).",
    );
  }
  const user = encodeURIComponent(`postgres.${PROJECT_REF}`);
  return `postgresql://${user}:${encodeURIComponent(password)}@${POOLER_HOST}:${POOLER_PORT}/postgres`;
}

/** Host:port of a connection string, with the password stripped (safe to log). */
export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return "<unparseable database url>";
  }
}
