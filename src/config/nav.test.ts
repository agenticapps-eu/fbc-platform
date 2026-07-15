import { describe, expect, it } from "vitest";
import { navItems } from "./nav";

/**
 * Die Ziel-Navigation aus Spec §2 — 6 + 5 + 1. Reihenfolge ist verbindlich: sie
 * erzählt die Reise (Compass → Academy → Events → Mitglieder → Aktivität).
 */
const ERWARTET = {
  entdecken: [
    ["/", "Start"],
    ["/compass", "Compass"],
    ["/academy", "Academy"],
    ["/events", "Events"],
    ["/mitglieder", "Mitglieder"],
    ["/aktivitaet", "Aktivität"],
  ],
  "mein-bereich": [
    ["/profil", "Mein Profil"],
    ["/meine-chancen", "Meine Chancen"],
    ["/meine-kurse", "Meine Kurse"],
    ["/meine-events", "Meine Events"],
    ["/kontakte", "Meine Kontakte"],
  ],
  service: [["/einstellungen", "Einstellungen"]],
} as const;

describe("Ziel-Navigation (Spec §2)", () => {
  for (const [section, erwartet] of Object.entries(ERWARTET)) {
    it(`hat unter „${section}" genau die vorgesehenen Einträge, in Reihenfolge`, () => {
      const ist = navItems.filter((i) => i.section === section).map((i) => [i.path, i.label]);
      expect(ist).toEqual(erwartet.map((e) => [...e]));
    });
  }

  it("führt die gestrichenen Pfade nicht mehr", () => {
    const pfade = navItems.map((i) => i.path);
    for (const weg of [
      "/library",
      "/projekte",
      "/community",
      "/verzeichnis",
      "/matching",
      "/angebote-gesuche",
    ]) {
      expect(pfade).not.toContain(weg);
    }
  });

  it("hält das Verzeichnis ab Discover — die Schranke bleibt, sie mauert nur statt wegzuleiten", () => {
    const mitglieder = navItems.find((i) => i.path === "/mitglieder");
    expect(mitglieder?.minTier).toBe("discover");
  });

  it("hält Meine Chancen ab Discover, auch nach dem Umzug in Mein Bereich", () => {
    const chancen = navItems.find((i) => i.path === "/meine-chancen");
    expect(chancen?.minTier).toBe("discover");
  });
});
