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
    ["/meine-kurse", "Meine Kurse"],
    ["/meine-events", "Meine Events"],
    ["/kontakte", "Meine Kontakte"],
  ],
  // Detlevs MVP-Reihenfolge: … Kontakte, Mitgliedschaften, Einstellungen.
  service: [
    ["/mitgliedschaft", "Mitgliedschaft"],
    ["/einstellungen", "Einstellungen"],
  ],
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

  /* AGE-443 — MVP-Umfang fürs Sommerfest. „Chancen-Modul im Detail" steht auf
     Detlevs Nicht-Zeigen-Liste. Ausblenden heißt hier: kein Menüeintrag, aber
     die Route bleibt erreichbar (`section: "sub"`) — reversibel, wie in
     AGE-439 beim Design-Switcher. */
  it("blendet Meine Chancen aus dem Menü aus, hält die Route aber erreichbar", () => {
    const chancen = navItems.find((i) => i.path === "/meine-chancen");
    expect(chancen).toBeDefined();
    expect(chancen?.section).toBe("sub");
  });

  it("führt Mitgliedschaft als Menüeintrag — Detlev listet sie im MVP", () => {
    const mitgliedschaft = navItems.find((i) => i.path === "/mitgliedschaft");
    expect(mitgliedschaft?.section).toBe("service");
  });
});
