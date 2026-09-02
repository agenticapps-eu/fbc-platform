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

/**
 * AGE-642 (A2): Der Umbau auf `lazy()` fasst `Component` an — die Zusage ist,
 * dass er sonst nichts anfasst.
 *
 * Gemessen an Mutationen, nicht am Vorkommen der Namen (31 Läufe der vollen
 * Suite, 210 Dateien). `path` und `section` waren je Route bereits gedeckt:
 * jede Änderung rötete 1 bis 11 Dateien, und fehlt das Feld ganz, fällt `tsc`.
 * Die Sidebar-Hälfte ebenso — die Beschriftung in `AppShell.tsx` gegen den Pfad
 * getauscht rötet 5 Dateien, der Abschnitts-Filter entfernt 7.
 *
 * `label` war die Lücke, und zwar genau für die neun Einträge, die dieser Datei
 * bis hier nur als `section: "sub"` vorkommen. Drei Mutationen liefen still
 * durch — typecheck grün, 210/210 grün: „Nachrichten" zurück auf „Chat",
 * „Neu in der App" auf „Neues", ein LEERES Label auf `/chat`. Und `/neues`
 * samt seinem `lazy()`-Import ganz entfernt ebenfalls: die Route wäre
 * verschwunden, ohne dass eine Zusage darauf zeigte.
 *
 * Deshalb hier das vollständige Verzeichnis. Der Preis ist ehrlich: eine
 * gewollte Umbenennung kostet jetzt eine Zeile in dieser Liste — genau die
 * Bestätigung, die AGE-583 („Chat" → „Nachrichten") lautlos passieren ließ.
 * Nach Pfad sortiert verglichen, nicht in Quelltext-Reihenfolge: die
 * verbindliche Reihenfolge steht oben je Abschnitt, und eine zweite Zusage
 * darüber röte bei einer folgenlosen Umsortierung der `sub`-Einträge.
 */
const ALLE_ROUTEN: ReadonlyArray<readonly [pfad: string, label: string]> = [
  ["/", "Start"],
  ["/academy", "Academy"],
  ["/aktivitaet", "Aktivität"],
  ["/chat", "Nachrichten"],
  ["/einstellungen", "Einstellungen"],
  ["/events", "Events"],
  ["/kompass", "Kompass"],
  ["/kontakte", "Meine Kontakte"],
  ["/meine-events", "Meine Events"],
  ["/mitglieder", "Mitglieder"],
  ["/mitgliedschaft", "Mitgliedschaft"],
  ["/neues", "Neu in der App"],
  ["/profil", "Mein Profil"],
  ["/profil/bearbeiten", "Profil bearbeiten"],
];

describe("Jede Route trägt Pfad und Beschriftung (AGE-642, A2)", () => {
  it("führt genau diese vierzehn Routen, mit genau diesen Beschriftungen", () => {
    const ist = navItems
      .map((i) => [i.path, i.label] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    expect(ist).toEqual(ALLE_ROUTEN.map((e) => [...e]));
  });
});
