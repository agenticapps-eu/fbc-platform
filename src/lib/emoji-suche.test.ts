import { describe, expect, it } from "vitest";
import { filtereEmoji, normalisiere, type EmojiEintrag } from "./emoji-suche";

const DATEN: EmojiEintrag[] = [
  ["❤️", "rotes Herz", "herz rotes herz", 8],
  // Absichtlich OHNE die ASCII-Schreibweise „gruen" in den Suchbegriffen: mit
  // ihr bestünde der Test unten auch ohne die zweite Faltung, und die
  // Gegenprobe hat genau das aufgedeckt.
  ["💚", "grünes Herz", "grunes herz", 8],
  ["👍", "Daumen hoch", "daumen hoch gut", 1],
  ["🍺", "Bierkrug", "bier krug prost", 4],
  ["🚗", "Auto", "auto wagen", 5],
];

describe("normalisiere", () => {
  it("macht klein", () => {
    expect(normalisiere("HERZ")).toBe(normalisiere("herz"));
  });

  // Die Spec verspricht, dass `GRUN`, `grün` und `gruen` dieselben Treffer
  // liefern. Das geht nur, wenn BEIDE Schreibweisen des Umlauts auf dieselbe
  // Form fallen — die Faltung `ü→u` allein reicht nicht, sonst bliebe `gruen`
  // aussen vor.
  it("führt die drei Schreibweisen des Umlauts zusammen", () => {
    expect(normalisiere("grün")).toBe(normalisiere("GRUN"));
    expect(normalisiere("gruen")).toBe(normalisiere("grün"));
  });

  it("gilt auch für a, o und das scharfe s", () => {
    expect(normalisiere("Bär")).toBe(normalisiere("Baer"));
    expect(normalisiere("schön")).toBe(normalisiere("schoen"));
    expect(normalisiere("Straße")).toBe(normalisiere("Strasse"));
  });

  it("lässt gewöhnliche Wörter in Ruhe", () => {
    expect(normalisiere("auto")).toBe("auto");
  });
});

describe("filtereEmoji", () => {
  it("gibt ohne Suchbegriff alles zurück", () => {
    expect(filtereEmoji(DATEN, "")).toHaveLength(DATEN.length);
    expect(filtereEmoji(DATEN, "   ")).toHaveLength(DATEN.length);
  });

  // Der Befund, an dem der ganze Datensatz hing: im englischen Satz ist das
  // einzige „Herz" die Flagge von Bosnien & Herzegowina.
  it("findet das Herz auf Deutsch", () => {
    const treffer = filtereEmoji(DATEN, "Herz");
    expect(treffer.map(([e]) => e)).toContain("❤️");
  });

  it("findet über die Suchbegriffe, nicht nur über den Namen", () => {
    const treffer = filtereEmoji(DATEN, "prost");
    expect(treffer.map(([e]) => e)).toEqual(["🍺"]);
  });

  it("ist unempfindlich gegen Schreibweise und Umlaut", () => {
    expect(filtereEmoji(DATEN, "GRUEN").map(([e]) => e)).toContain("💚");
    expect(filtereEmoji(DATEN, "grün").map(([e]) => e)).toContain("💚");
  });

  it("liefert nichts, wenn nichts passt", () => {
    expect(filtereEmoji(DATEN, "raumschiff")).toEqual([]);
  });

  it("behält die Reihenfolge des Datensatzes", () => {
    expect(filtereEmoji(DATEN, "herz").map(([e]) => e)).toEqual(["❤️", "💚"]);
  });
});
