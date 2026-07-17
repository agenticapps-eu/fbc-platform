import { describe, expect, it } from "vitest";
import { accentBandStyle, monogram } from "./membershipVisuals";

describe("membershipVisuals", () => {
  it("monogram is the rank numeral", () => {
    expect(monogram(1)).toBe("1");
    expect(monogram(6)).toBe("6");
  });

  it("accentBandStyle mixes gold over canvas, deepening with rank", () => {
    const r1 = accentBandStyle(1).background as string;
    const r6 = accentBandStyle(6).background as string;
    expect(r1).toContain("var(--color-gold)");
    expect(r1).toContain("var(--color-canvas)");
    expect(r1).toContain("14%"); // 6 + 1*8
    expect(r6).toContain("54%"); // 6 + 6*8
  });

  it("clamps the mix percentage to [8,60]", () => {
    expect(accentBandStyle(0).background as string).toContain("8%");
    expect(accentBandStyle(99).background as string).toContain("60%");
  });
});
