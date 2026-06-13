import { describe, expect, it } from "vitest";
import type { CompassStep } from "../config/compass";
import {
  type CompassDraft,
  deriveCompassRows,
  deriveInterests,
  deriveNeeds,
  deriveOffers,
  dominantTheme,
  emptyDraft,
} from "./compass";

// Eigener Test-Katalog (unabhängig vom mit Detlev abzustimmenden Default-Katalog).
const STEPS: CompassStep[] = [
  {
    id: "s-sein",
    kind: "scale",
    theme: "sein",
    title: "Sein",
    prompt: "?",
    minLabel: "-",
    maxLabel: "+",
  },
  {
    id: "s-tun",
    kind: "scale",
    theme: "tun",
    title: "Tun",
    prompt: "?",
    minLabel: "-",
    maxLabel: "+",
  },
  {
    id: "interests",
    kind: "chips",
    target: "interests",
    title: "Interessen",
    prompt: "?",
    options: [
      { value: "i1", label: "Persönlichkeit", theme: "sein" },
      { value: "i2", label: "Investment", theme: "haben" },
      { value: "i3", label: "Leadership", theme: "tun" },
    ],
  },
  {
    id: "offers",
    kind: "chips",
    target: "offers",
    title: "Ich biete",
    prompt: "?",
    options: [
      { value: "o1", label: "Kapital", theme: "haben", category: "kapital" },
      { value: "o2", label: "Mentoring", theme: "sein", category: "leistung" },
    ],
  },
  {
    id: "needs",
    kind: "chips",
    target: "needs",
    title: "Ich suche",
    prompt: "?",
    options: [{ value: "n1", label: "Investoren", theme: "haben", category: "kapital" }],
  },
];

describe("dominantTheme", () => {
  it("wählt das Thema mit der höchsten Selbsteinschätzung", () => {
    const draft: CompassDraft = { scales: { "s-sein": 3, "s-tun": 8 }, chips: {} };
    expect(dominantTheme(STEPS, draft)).toBe("tun");
  });

  it("bricht Gleichstand über die feste Themen-Reihenfolge (sein vor tun)", () => {
    const draft: CompassDraft = { scales: { "s-sein": 7, "s-tun": 7 }, chips: {} };
    expect(dominantTheme(STEPS, draft)).toBe("sein");
  });

  it("nutzt den neutralen Default (5) für unbeantwortete Skalen", () => {
    // Beide unbeantwortet → beide 5 → Gleichstand → sein (Reihenfolge).
    expect(dominantTheme(STEPS, emptyDraft())).toBe("sein");
  });

  it("liefert null, wenn der Katalog keine Skala-Schritte hat", () => {
    const noScales = STEPS.filter((s) => s.kind !== "scale");
    expect(dominantTheme(noScales, emptyDraft())).toBeNull();
  });
});

describe("deriveCompassRows", () => {
  it("erzeugt je Thema mit Skala/Interesse eine Zeile mit numerischem rating", () => {
    const draft: CompassDraft = {
      scales: { "s-sein": 9, "s-tun": 4 },
      chips: { interests: ["i1", "i2"] }, // i1=sein, i2=haben
    };
    const rows = deriveCompassRows(STEPS, draft);
    const byTheme = Object.fromEntries(rows.map((r) => [r.theme, r.answers]));

    // sein: rating 9 + Interesse „Persönlichkeit"
    expect(byTheme.sein).toEqual({ rating: 9, interests: ["Persönlichkeit"] });
    // tun: rating 4, keine Interessen
    expect(byTheme.tun).toEqual({ rating: 4 });
    // haben: keine Skala, aber Interesse → Zeile nur mit interests
    expect(byTheme.haben).toEqual({ interests: ["Investment"] });
    // wirken: nichts → keine Zeile
    expect(byTheme.wirken).toBeUndefined();
  });

  it("das rating ist numerisch (Voraussetzung für den Erfolgsradar)", () => {
    const draft: CompassDraft = { scales: { "s-sein": 6 }, chips: {} };
    const sein = deriveCompassRows(STEPS, draft).find((r) => r.theme === "sein");
    expect(typeof sein?.answers.rating).toBe("number");
  });
});

describe("deriveInterests / deriveOffers / deriveNeeds", () => {
  it("bildet ausgewählte Chips auf {theme,label} bzw. {theme,category,title} ab", () => {
    const draft: CompassDraft = {
      scales: {},
      chips: { interests: ["i3"], offers: ["o1", "o2"], needs: ["n1"] },
    };

    expect(deriveInterests(STEPS, draft)).toEqual([{ theme: "tun", label: "Leadership" }]);
    expect(deriveOffers(STEPS, draft)).toEqual([
      { theme: "haben", category: "kapital", title: "Kapital" },
      { theme: "sein", category: "leistung", title: "Mentoring" },
    ]);
    expect(deriveNeeds(STEPS, draft)).toEqual([
      { theme: "haben", category: "kapital", title: "Investoren" },
    ]);
  });

  it("liefert leere Listen ohne Auswahl", () => {
    expect(deriveInterests(STEPS, emptyDraft())).toEqual([]);
    expect(deriveOffers(STEPS, emptyDraft())).toEqual([]);
    expect(deriveNeeds(STEPS, emptyDraft())).toEqual([]);
  });
});
