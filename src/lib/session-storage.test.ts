import { beforeEach, describe, expect, it, vi } from "vitest";

import { nativerSitzungsspeicher, sitzungsSchluessel } from "./session-storage";

/**
 * Die Attrappe ist absichtlich eine **echte** Ablage, kein `vi.fn()`, das
 * zurückgibt, was der Test hören will. Ein Adapter, dessen `removeItem` ins
 * Leere läuft, muss hier durchfallen — gegen eine Attrappe ohne Gedächtnis
 * bestünde er.
 */
const ablage = new Map<string, string>();

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: ablage.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      ablage.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      ablage.delete(key);
    },
  },
}));

beforeEach(() => {
  ablage.clear();
});

describe("sitzungsSchluessel", () => {
  // Die Erwartungen stehen als LITERALE da, nicht als zweite Ableitung aus
  // derselben Formel. Ein Test, der `sb-${host}-auth-token` nachrechnet, prüft
  // nur, dass zwei Kopien derselben Zeile übereinstimmen — er bliebe grün,
  // wenn beide gemeinsam falsch würden, und genau das ist der Fall, gegen den
  // dieser Schlüssel festgenagelt wird.
  it("bildet den Schlüssel wie `supabase-js` ihn bis heute selbst bildet", () => {
    expect(sitzungsSchluessel("https://abcdefghijklmnop.supabase.co")).toBe(
      "sb-abcdefghijklmnop-auth-token",
    );
  });

  it("nimmt auch den lokalen Stack, wo der Host keinen Punkt trägt", () => {
    expect(sitzungsSchluessel("http://localhost:54321")).toBe("sb-localhost-auth-token");
  });
});

describe("nativerSitzungsspeicher", () => {
  it("gibt zurück, was gelegt wurde", async () => {
    await nativerSitzungsspeicher.setItem("sb-test-auth-token", "eine-sitzung");

    await expect(nativerSitzungsspeicher.getItem("sb-test-auth-token")).resolves.toBe(
      "eine-sitzung",
    );
  });

  it("meldet `null` für einen Schlüssel, den es nicht gibt", async () => {
    await expect(nativerSitzungsspeicher.getItem("gibt-es-nicht")).resolves.toBeNull();
  });

  it("entfernt den Eintrag tatsächlich", async () => {
    await nativerSitzungsspeicher.setItem("sb-test-auth-token", "eine-sitzung");
    await nativerSitzungsspeicher.removeItem("sb-test-auth-token");

    // Zwei Zusagen, und die zweite ist die eigentliche: Der Adapter meldet
    // nichts mehr — UND die Ablage darunter hält den Wert auch nicht mehr.
    // Ohne die zweite Zeile bestünde ein `getItem`, das nach einem `removeItem`
    // blind `null` liefert, ohne je etwas gelöscht zu haben. Ein Konto, das
    // sich nicht abmelden lässt, sähe genau so aus.
    await expect(nativerSitzungsspeicher.getItem("sb-test-auth-token")).resolves.toBeNull();
    expect(ablage.has("sb-test-auth-token")).toBe(false);
  });
});
