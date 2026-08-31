import { describe, expect, it } from "vitest";

import { entscheideZurueck, hatVerlauf } from "./zurueck";

describe("entscheideZurueck", () => {
  it("schliesst zuerst das Overlay", () => {
    expect(entscheideZurueck({ overlayOffen: true, hatVerlauf: false })).toBe("overlay-schliessen");
  });

  // DIE Zusage des Abschnitts. Ohne sie ist ein Handler, der schlicht immer
  // zuruecknavigiert, von einem richtigen nicht zu unterscheiden: bei offenem
  // Overlay UND vorhandenem Verlauf faellt er auf, sonst nie. Mehrere Flaechen
  // fuehren ihren Offen-Zustand ueber den Verlaufsschluessel
  // (`HeaderSearch.tsx`, `MemberDirectory.tsx`, `LegalZurueck.tsx`) — ein
  // Zuruecknavigieren schloesse das Overlay als NEBENwirkung und traege die
  // Seite darunter mit fort.
  it("schliesst das Overlay, auch wenn es Verlauf gaebe — und navigiert NICHT", () => {
    expect(entscheideZurueck({ overlayOffen: true, hatVerlauf: true })).toBe("overlay-schliessen");
  });

  it("geht mit Verlauf eine Seite zurueck", () => {
    expect(entscheideZurueck({ overlayOffen: false, hatVerlauf: true })).toBe("seite-zurueck");
  });

  // Positivkontrolle zur Verneinung: der Zweig existiert und wird getroffen.
  it("schickt ohne Verlauf in den Hintergrund, statt zu beenden", () => {
    expect(entscheideZurueck({ overlayOffen: false, hatVerlauf: false })).toBe("hintergrund");
  });

  // Die Anforderung sagt SHALL NOT „die Anwendung mitten in einem Ablauf
  // schliessen". Eine Zusage ueber alle vier Eingaben, nicht ueber eine: ein
  // spaeter hinzugefuegter Zweig „beenden" faellt hier auf, auch wenn niemand
  // an diesen Test denkt.
  it("beendet die Anwendung in keiner der vier Lagen", () => {
    const alle = [true, false].flatMap((overlayOffen) =>
      [true, false].map((hatVerlauf) => entscheideZurueck({ overlayOffen, hatVerlauf })),
    );
    expect(alle).toHaveLength(4);
    expect(alle).not.toContain("beenden");
    expect(new Set(alle)).toEqual(new Set(["overlay-schliessen", "seite-zurueck", "hintergrund"]));
  });
});

/**
 * Gemessen in `react-router@7.18.2`, nicht angenommen — der Unterschied ist
 * der ganze Grund fuer diese Funktion:
 *
 * | Vorgang        | was mit dem Index geschieht |
 * | -------------- | --------------------------- |
 * | erster Eintrag | `index = 0`                 |
 * | `push`         | `index = getIndex() + 1`    |
 * | `replace`      | `index = getIndex()`        |
 *
 * `location.key !== "default"` — die Regel, die `LegalZurueck.tsx` traegt —
 * taugt hier deshalb NICHT: `RequireAuth` und `HomeRedirect` ersetzen beim
 * Kaltstart den ersten Eintrag (`<Navigate replace />`). Der Schluessel waere
 * dann ein anderer als `"default"`, ein Eintrag dahinter gaebe es trotzdem
 * nicht, und Zurueck liefe ins Leere statt zu minimieren.
 */
describe("hatVerlauf", () => {
  it("sieht hinter dem ersten Eintrag nichts", () => {
    expect(hatVerlauf({ idx: 0 })).toBe(false);
  });

  it("sieht hinter dem zweiten Eintrag etwas", () => {
    expect(hatVerlauf({ idx: 1 })).toBe(true);
  });

  // Der Fall, der die Regel `key !== "default"` bricht: ersetzt, nicht
  // hinzugefuegt — der Index bleibt 0.
  it("sieht nach einem ERSETZTEN ersten Eintrag weiterhin nichts", () => {
    expect(hatVerlauf({ idx: 0, key: "xyz123" })).toBe(false);
  });

  it("sieht nichts, solange der Router den Zustand nicht gesetzt hat", () => {
    expect(hatVerlauf(null)).toBe(false);
    expect(hatVerlauf(undefined)).toBe(false);
    expect(hatVerlauf({})).toBe(false);
  });

  // Fremder Verlaufszustand ist kein Verlauf. Ohne diese Zusage machte ein
  // beliebiges `idx: "2"` aus einer fremden Quelle die Zurueck-Taste blind.
  it("nimmt nur eine Zahl als Index", () => {
    expect(hatVerlauf({ idx: "2" })).toBe(false);
  });
});
