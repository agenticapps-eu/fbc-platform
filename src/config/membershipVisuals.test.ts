import { describe, expect, it } from "vitest";
import { accentBandStyle, monogram } from "./membershipVisuals";

describe("membershipVisuals", () => {
  it("monogram is the rank as a Roman numeral", () => {
    expect(monogram(1)).toBe("I");
    expect(monogram(3)).toBe("III");
    expect(monogram(6)).toBe("VI");
  });

  it("accentBandStyle mixes accent over canvas, deepening with rank", () => {
    const r1 = accentBandStyle(1).background as string;
    const r6 = accentBandStyle(6).background as string;
    expect(r1).toContain("var(--color-accent)");
    expect(r1).toContain("var(--color-canvas)");
    expect(r1).toContain("14%"); // bottom stop: 6 + 1*8
    expect(r6).toContain("54%"); // bottom stop: 6 + 6*8
  });

  it("accentBandStyle adds vertical depth and an engraved accent seam", () => {
    const style = accentBandStyle(3);
    expect(style.background as string).toContain("linear-gradient");
    expect(style.background as string).toContain("radial-gradient"); // spekular highlight
    expect(style.borderBottom).toContain("var(--color-accent)");
  });

  it("clamps the mix percentage to [8,60]", () => {
    expect(accentBandStyle(0).background as string).toContain("8%");
    expect(accentBandStyle(99).background as string).toContain("60%");
  });
});
