import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Was `createClient` bekommt, ist die ganze Zusage dieses Umbaus — und sie ist
 * an keiner anderen Stelle ablesbar. Deshalb fängt der Test den Aufruf ab,
 * statt am fertigen Client herumzumessen.
 *
 * `vi.resetModules()` je Fall ist nötig, weil `supabase.ts` den Client auf
 * **Modulebene** erzeugt: ohne Zurücksetzen liefe nur der erste Fall gegen
 * echten Code und der zweite gegen den zwischengespeicherten Rest.
 */
const createClient = vi.fn(() => ({}) as unknown);
const isNativePlatform = vi.fn(() => false);

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform } }));

async function clientNeuAufbauen() {
  vi.resetModules();
  await import("./supabase");
  return createClient.mock.calls.at(-1) as unknown as [
    string,
    string,
    { auth?: Record<string, unknown> },
  ];
}

beforeEach(() => {
  createClient.mockClear();
});

afterEach(() => {
  isNativePlatform.mockReturnValue(false);
});

describe("im Web", () => {
  it("bekommt KEINEN eigenen Speicher untergeschoben", async () => {
    isNativePlatform.mockReturnValue(false);

    const [, , optionen] = await clientNeuAufbauen();

    // Die Abnahme lautet „eine bestehende Web-Sitzung bleibt angemeldet". Sie
    // hält genau dann, wenn hier NICHTS steht: kein Wrapper, kein Präfix, kein
    // eigener Speicher. `localStorage` unverändert durchreichen heißt, ihn gar
    // nicht erst zu erwähnen.
    expect(optionen.auth).not.toHaveProperty("storage");
  });

  it("nagelt den Sitzungsschlüssel auf den heutigen Wert fest", async () => {
    const [, , optionen] = await clientNeuAufbauen();

    // Literal, nicht nachgerechnet. Die Testumgebung setzt
    // VITE_SUPABASE_URL=http://localhost:54321 (vite.config.ts).
    expect(optionen.auth?.storageKey).toBe("sb-localhost-auth-token");
  });
});

describe("nativ", () => {
  it("bekommt den Speicher auf `@capacitor/preferences`", async () => {
    isNativePlatform.mockReturnValue(true);

    const [, , optionen] = await clientNeuAufbauen();
    const { nativerSitzungsspeicher } = await import("./session-storage");

    expect(optionen.auth?.storage).toBe(nativerSitzungsspeicher);
  });

  it("trägt denselben Schlüssel wie im Web", async () => {
    isNativePlatform.mockReturnValue(true);

    const [, , optionen] = await clientNeuAufbauen();

    // Ein zweiter Schlüssel nativ wäre kein Fehler, den jemand bemerkt — er
    // wäre eine zweite Sitzung, die es nie gab.
    expect(optionen.auth?.storageKey).toBe("sb-localhost-auth-token");
  });
});
