import { describe, expect, it } from "vitest";

import { filtereEmoji, type EmojiEintrag } from "../lib/emoji-suche";

/** Prüft die AUSGELIEFERTE Datei, nicht eine Attrappe (AGE-645).
 *
 *  Der Komponententest arbeitet bewusst mit drei erfundenen Einträgen — er soll
 *  Verhalten prüfen, nicht Daten. Damit kann er aber die eine Frage nicht
 *  beantworten, an der die Wahl des Datensatzes hing: **findet eine deutsche
 *  Suche, was sie meint?** Mit dem englischen Satz wäre das einzige „Herz" die
 *  Flagge von Bosnien & Herzegowina gewesen.
 *
 *  Dynamisch geladen wie im Betrieb — ein statisches `import` von hier ist im
 *  Test harmlos, aber die Datei soll überall gleich behandelt werden.
 */
const { EMOJI, EMOJI_GRUPPEN } = await import("./emoji.generated");

const daten = EMOJI as readonly EmojiEintrag[];

function suche(begriff: string): string[] {
  return filtereEmoji(daten, begriff).map(([emoji]) => emoji);
}

describe("emoji.generated", () => {
  it("trägt den vollen Satz", () => {
    expect(daten.length).toBeGreaterThan(1800);
  });

  it("kennt neun Gruppen mit deutschen Namen", () => {
    expect(EMOJI_GRUPPEN).toHaveLength(9);
    expect(EMOJI_GRUPPEN.map(([, name]) => name)).toContain("Tiere & Natur");
  });

  it("enthält KEINE Hautton-Modifikatoren", () => {
    // Gruppe 2 (`component`) sind Bausteine, keine wählbaren Emoji. Hauttöne
    // selbst sind in diesem Vorgang ausgeschlossen (AGE-650).
    expect(daten.some(([, , , gruppe]) => gruppe === 2)).toBe(false);
    expect(daten.some(([emoji]) => emoji === "🏻")).toBe(false);
  });

  it("findet das Herz auf Deutsch", () => {
    expect(suche("Herz")).toContain("❤️");
  });

  it("findet den Daumen auf Deutsch", () => {
    expect(suche("Daumen")).toContain("👍️");
  });

  it("findet über Umlaut und Schreibweise hinweg", () => {
    const mitUmlaut = suche("grün");
    expect(suche("GRUEN")).toEqual(mitUmlaut);
    expect(mitUmlaut.length).toBeGreaterThan(0);
  });

  it("liefert für Unsinn nichts", () => {
    expect(suche("qwertzuiop")).toEqual([]);
  });
});
