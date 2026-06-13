import { describe, expect, it } from "vitest";
import { parseScoreBreakdown } from "./dashboard";

/** Aufschlüsselung des Impact Scores (AGE-242) — Parsen der jsonb-RPC-Rückgabe. */
describe("parseScoreBreakdown", () => {
  const valid = {
    score: 47,
    components: [
      {
        key: "completion",
        label: "Profilvollständigkeit",
        weight: 30,
        points: 30,
        detail: "100 % ausgefüllt",
      },
      { key: "compass", label: "Compass", weight: 25, points: 0, detail: "0/4 Themen beantwortet" },
    ],
  };

  it("akzeptiert eine wohlgeformte Aufschlüsselung", () => {
    const parsed = parseScoreBreakdown(valid);
    expect(parsed).not.toBeNull();
    expect(parsed!.score).toBe(47);
    expect(parsed!.components).toHaveLength(2);
    expect(parsed!.components[0]).toEqual({
      key: "completion",
      label: "Profilvollständigkeit",
      weight: 30,
      points: 30,
      detail: "100 % ausgefüllt",
    });
  });

  it("liefert null bei null/undefined oder Nicht-Objekt", () => {
    expect(parseScoreBreakdown(null)).toBeNull();
    expect(parseScoreBreakdown(undefined)).toBeNull();
    expect(parseScoreBreakdown("nope")).toBeNull();
  });

  it("liefert null, wenn score fehlt oder components kein Array ist", () => {
    expect(parseScoreBreakdown({ components: [] })).toBeNull();
    expect(parseScoreBreakdown({ score: 10, components: {} })).toBeNull();
  });

  it("liefert null, wenn eine Komponente Felder/Typen verletzt", () => {
    const badPoints = {
      score: 10,
      components: [{ key: "x", label: "X", weight: 30, points: "30", detail: "d" }],
    };
    expect(parseScoreBreakdown(badPoints)).toBeNull();

    const missingDetail = {
      score: 10,
      components: [{ key: "x", label: "X", weight: 30, points: 30 }],
    };
    expect(parseScoreBreakdown(missingDetail)).toBeNull();
  });

  it("akzeptiert eine leere Komponentenliste", () => {
    const parsed = parseScoreBreakdown({ score: 0, components: [] });
    expect(parsed).toEqual({ score: 0, components: [] });
  });
});
