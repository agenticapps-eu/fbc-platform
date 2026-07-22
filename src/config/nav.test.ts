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
      // AGE-450: Chancen fürs Sommerfest komplett raus — auch als geroutete
      // (sub-)Route. /meine-chancen leitet jetzt in App.tsx auf / um.
      "/meine-chancen",
    ]) {
      expect(pfade).not.toContain(weg);
    }
  });

  it("hält das Verzeichnis ab Discover — die Schranke bleibt, sie mauert nur statt wegzuleiten", () => {
    const mitglieder = navItems.find((i) => i.path === "/mitglieder");
    expect(mitglieder?.minTier).toBe("discover");
  });

  /* AGE-450 — Chancen fürs Sommerfest komplett raus (Detlev, 22.07.). Anders als
     AGE-443 (nur Menüeintrag weg, Route blieb `sub`): jetzt kein navItem mehr,
     und App.tsx leitet /meine-chancen auf / um. Die Route ist unerreichbar. */
  it("kennt Meine Chancen gar nicht mehr — die Route ist unerreichbar", () => {
    expect(navItems.find((i) => i.path === "/meine-chancen")).toBeUndefined();
  });

  /* AGE-442 — „Keine weitere Unterseite": gebuchte und eigene Events stehen jetzt
     als dritter Reiter unter /events. Der Menüeintrag entfällt, die Route bleibt
     erreichbar (alte Links, Lesezeichen) — ausblenden statt löschen, wie AGE-443. */
  it("blendet Meine Events aus dem Menü aus, hält die Route aber erreichbar", () => {
    const events = navItems.find((i) => i.path === "/meine-events");
    expect(events).toBeDefined();
    expect(events?.section).toBe("sub");
  });

  it("führt Mitgliedschaft als Menüeintrag — Detlev listet sie im MVP", () => {
    const mitgliedschaft = navItems.find((i) => i.path === "/mitgliedschaft");
    expect(mitgliedschaft?.section).toBe("service");
  });
});
