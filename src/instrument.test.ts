// Ordnungstest für die Sentry-Initialisierung.
//
// Der Befund aus dem Sicherheits-Audit vom 2026-08-06: Sentry erfasst
// `location.href` samt Fragment, und `replaysOnErrorSampleRate` steht auf 1.0.
// Das Aktivierungs-Token stand bis hierher noch in der Adresszeile, wenn Sentry
// startete — `leseTokenAusFragment()` räumt sie erst auf, wenn die Einlöseseite
// rendert. Ein beliebiger Fehler im Puffer-Fenster hätte das Token an Sentry
// gesendet, und wer Sentry-Zugriff hat, setzt damit binnen 72 h ein fremdes
// Passwort.
//
// Deshalb misst dieser Test nicht, DASS aufgeräumt wird, sondern WANN: die
// Adresszeile zum Zeitpunkt des `init`-Aufrufs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ hrefBeiInit: [] as string[] }));

vi.mock("@sentry/react", () => ({
  init: () => {
    sentry.hrefBeiInit.push(window.location.href);
  },
  reactRouterV7BrowserTracingIntegration: () => ({ name: "tracing" }),
  replayIntegration: () => ({ name: "replay" }),
}));

beforeEach(() => {
  sentry.hrefBeiInit.length = 0;
  vi.stubEnv("VITE_SENTRY_DSN", "https://key@example.invalid/1");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("instrument", () => {
  it("startet Sentry erst, wenn das Aktivierungs-Token aus der Adresszeile ist", async () => {
    window.history.replaceState(null, "", "/aktivierung#token=geheim-123");

    await import("./instrument");

    expect(sentry.hrefBeiInit).toHaveLength(1);
    expect(sentry.hrefBeiInit[0]).not.toContain("geheim-123");
    expect(window.location.pathname).toBe("/aktivierung");
  });

  /**
   * Befund 8.7 aus Review 5.4. Der Fall oben stand allein da und prüfte nur
   * `/aktivierung` — dabei trägt der Reset-Link seit AGE-505 dasselbe Token im
   * Fragment, und dieselbe Sentry-Gefahr hängt daran: wer damit binnen 72 h
   * ankommt, setzt ein fremdes Passwort. Wer die Aufräumung je an den Pfad
   * bindet, hätte den Reset-Weg damit lautlos offengelassen.
   */
  it("räumt auch auf /passwort-neu auf — der Reset-Link trägt dasselbe Token", async () => {
    window.history.replaceState(null, "", "/passwort-neu#token=geheim-456");

    await import("./instrument");

    expect(sentry.hrefBeiInit).toHaveLength(1);
    expect(sentry.hrefBeiInit[0]).not.toContain("geheim-456");
    expect(window.location.pathname).toBe("/passwort-neu");
  });

  it("lässt ein Supabase-Auth-Fragment unangetastet", async () => {
    window.history.replaceState(null, "", "/#access_token=abc&token_type=bearer");

    await import("./instrument");

    expect(window.location.hash).toContain("access_token=abc");
  });

  it("bleibt ohne DSN ein No-op", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    window.history.replaceState(null, "", "/");

    await import("./instrument");

    expect(sentry.hrefBeiInit).toHaveLength(0);
  });
});
