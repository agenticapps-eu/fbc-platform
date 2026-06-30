import { describe, expect, it } from "vitest";
import { MEIN_BEREICH_NODES } from "./meinBereich";

describe("MEIN_BEREICH_NODES", () => {
  it("hat vier Leaf-Einträge auf distinkten Pfaden (kein ?tab, keine Doppel-Pfade)", () => {
    const paths = MEIN_BEREICH_NODES.map((n) => n.to);
    expect(paths).toEqual(["/profil", "/meine-events", "/kontakte", "/einstellungen"]);
    expect(paths.every((p) => !p.includes("?"))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
