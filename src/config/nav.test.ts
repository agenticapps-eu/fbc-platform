import { describe, expect, it } from "vitest";
import { navItems } from "./nav";

/**
 * Die Go-Live-Navigation (AGE-494): sieben Einträge in zwei Gruppen. Reihenfolge
 * ist verbindlich — Academy → Events → Mitglieder → Aktivität erzählt die Reise,
 * seit der Kompass keinen eigenen Menüpunkt mehr hat (er lebt als Filter über der
 * Mitgliederliste und als Block im Profil).
 *
 * Die Gruppe `service` gibt es nicht mehr: Mitgliedschaft fällt aus dem Menü,
 * Einstellungen wandert nach „mein-bereich". Eine dritte Überschrift für einen
 * einzelnen Eintrag wäre mehr Rahmen als Inhalt.
 */
const ERWARTET = {
  entdecken: [
    ["/", "Start"],
    ["/academy", "Academy"],
    ["/events", "Events"],
    ["/mitglieder", "Mitglieder"],
    ["/aktivitaet", "Aktivität"],
  ],
  "mein-bereich": [
    ["/profil", "Mein Profil"],
    ["/einstellungen", "Einstellungen"],
  ],
} as const;

describe("Go-Live-Navigation (AGE-494)", () => {
  for (const [section, erwartet] of Object.entries(ERWARTET)) {
    it(`hat unter „${section}" genau die vorgesehenen Einträge, in Reihenfolge`, () => {
      const ist = navItems.filter((i) => i.section === section).map((i) => [i.path, i.label]);
      expect(ist).toEqual(erwartet.map((e) => [...e]));
    });
  }

  it("zeigt genau sieben Menüeinträge — alles andere ist geroutet, aber unsichtbar", () => {
    const sichtbar = navItems.filter((i) => i.section !== "sub");
    expect(sichtbar).toHaveLength(7);
  });

  it("kennt die Gruppe „service“ nicht mehr", () => {
    expect(navItems.filter((i) => i.section === "service")).toEqual([]);
  });

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
      // AGE-494: die alte Compass-Route heißt jetzt /kompass.
      "/compass",
    ]) {
      expect(pfade).not.toContain(weg);
    }
  });

  it("hält das Verzeichnis ab Discover — die Schranke bleibt, sie mauert nur statt wegzuleiten", () => {
    const mitglieder = navItems.find((i) => i.path === "/mitglieder");
    expect(mitglieder?.minTier).toBe("discover");
  });

  /* AGE-494 — nichts wird gelöscht, es wird nur unerreichbar. Diese Routen
     verlieren ihren Menüeintrag und bleiben als `sub` geroutet: wer den Link
     kennt, darf die Seite sehen, und das Zurückholen ist eine Zeile.

     `/meine-kurse` stand hier bis AGE-533 und ist jetzt raus — nicht weil die
     Regel nicht mehr gilt, sondern weil die Seite gelöscht ist: „Meine Academy"
     ist an ihre Stelle getreten. Der Pfad wird umgeleitet, was der Test
     darunter prüft. */
  it.each([
    ["/kompass", "Kompass"],
    ["/mitgliedschaft", "Mitgliedschaft"],
    ["/kontakte", "Meine Kontakte"],
  ])("blendet %s aus dem Menü aus, hält die Route aber erreichbar", (pfad) => {
    const item = navItems.find((i) => i.path === pfad);
    expect(item).toBeDefined();
    expect(item?.section).toBe("sub");
  });

  /* AGE-442 — „Keine weitere Unterseite": gebuchte und eigene Events stehen jetzt
     als dritter Reiter unter /events. Der Menüeintrag entfällt, die Route bleibt
     erreichbar (alte Links, Lesezeichen) — ausblenden statt löschen, wie AGE-443. */
  it("blendet Meine Events aus dem Menü aus, hält die Route aber erreichbar", () => {
    const events = navItems.find((i) => i.path === "/meine-events");
    expect(events).toBeDefined();
    expect(events?.section).toBe("sub");
  });
});
