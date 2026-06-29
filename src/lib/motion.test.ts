import { describe, expect, it } from "vitest";
import { getMotionPreset } from "./motion";

describe("getMotionPreset", () => {
  it("scales intensity: subtle < medium < dramatic", () => {
    const subtle = getMotionPreset("subtle", false);
    const medium = getMotionPreset("medium", false);
    const dramatic = getMotionPreset("dramatic", false);

    expect(subtle.duration).toBeLessThan(medium.duration);
    expect(medium.duration).toBeLessThan(dramatic.duration);

    expect(subtle.stagger).toBeLessThan(medium.stagger);
    expect(medium.stagger).toBeLessThanOrEqual(dramatic.stagger);

    expect(subtle.slide).toBeLessThan(dramatic.slide);
  });

  it("enables the gold glow only for the dramatic tier", () => {
    expect(getMotionPreset("subtle", false).glow).toBe(false);
    expect(getMotionPreset("medium", false).glow).toBe(false);
    expect(getMotionPreset("dramatic", false).glow).toBe(true);
  });

  it("collapses all motion when reduced-motion is requested", () => {
    for (const intensity of ["subtle", "medium", "dramatic"] as const) {
      const preset = getMotionPreset(intensity, true);
      expect(preset.duration).toBe(0);
      expect(preset.stagger).toBe(0);
      expect(preset.slide).toBe(0);
      expect(preset.glow).toBe(false);
    }
  });

  it("always exposes an easing array for framer-motion", () => {
    expect(Array.isArray(getMotionPreset("medium", false).ease)).toBe(true);
    expect(getMotionPreset("medium", true).ease).toBeDefined();
  });
});
