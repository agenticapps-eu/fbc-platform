import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

// Source-Map-Upload nur, wenn ein Auth-Token vorliegt (CI-/Build-Env). So
// bleiben lokale Builds und der CI-`verify`-Build (ohne Secret) grün; das
// Token landet nie im Client.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  // Source-Maps erzeugen (versteckt: kein sourceMappingURL-Kommentar im Bundle),
  // damit der Plugin sie beim Prod-Build hochladen kann.
  build: { sourcemap: "hidden" },
  plugins: [
    react(),
    tailwindcss(),
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG ?? "factiv",
            project: process.env.SENTRY_PROJECT ?? "fbc-platform",
            authToken: sentryAuthToken,
            url: process.env.SENTRY_URL ?? "https://de.sentry.io",
            release: {
              name: process.env.VITE_SENTRY_RELEASE,
              // Associate the release with its commits (HEAD + previous release).
              // ignoreMissing keeps the first-ever release from failing when there
              // is no prior release to diff against.
              setCommits: { auto: true, ignoreMissing: true },
            },
          }),
        ]
      : []),
  ],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    // Seed-Tooling (supabase/seed) und die Push-Guards (scripts) werden
    // mitgetestet — reine Helfer, kein Netzwerk. Die Cloudflare Pages Functions
    // (functions/) laufen anders als die Supabase Edge Functions in einer
    // Node-kompatiblen Runtime und passen deshalb hierher statt in den
    // Deno-Job `edge-functions`.
    // `*.integration.test.ts` spricht den LOKALEN Supabase-Stack an und laeuft
    // deshalb in einem eigenen Lauf (`pnpm test:integration`), nicht in
    // `pnpm test` — dort gibt es keinen Stack.
    //
    // Getrennt statt zur Laufzeit uebersprungen, und das ist der Punkt: ein
    // `describe.skipIf(!erreichbar)` waere ueberall gruen, auch dort, wo nie
    // etwas lief. Der Lauf haengt stattdessen im CI-Job `migrations`, der den
    // Stack ohnehin hochfaehrt.
    include: process.env.FBC_INTEGRATION
      ? ["src/**/*.integration.test.ts"]
      : [
          "src/**/*.test.{ts,tsx}",
          "functions/**/*.test.ts",
          "supabase/seed/**/*.test.ts",
          "scripts/**/*.test.ts",
        ],
    exclude: process.env.FBC_INTEGRATION
      ? [...configDefaults.exclude]
      : [...configDefaults.exclude, "**/*.integration.test.ts"],
    // Dummy-Supabase-Config, damit src/lib/supabase.ts beim Import nicht wirft
    // (Unit-Tests sprechen kein Netzwerk an).
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
