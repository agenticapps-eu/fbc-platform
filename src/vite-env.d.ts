/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Sentry DSN. Leer/ungesetzt → Sentry bleibt deaktiviert (lokal optional). */
  readonly VITE_SENTRY_DSN?: string;
  /** Sentry-`environment` (z. B. "dev" | "staging" | "prod"). */
  readonly VITE_ENVIRONMENT?: string;
  /** Sentry-`release` — Git-SHA, beim Build injiziert. */
  readonly VITE_SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
