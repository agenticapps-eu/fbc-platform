import { describe, expect, it } from "vitest";
import { getMotionPreset } from "./motion";

describe("getMotionPreset", () => {
  it("returns a usable preset for normal motion", () => {
    const preset = getMotionPreset(false);
    expect(preset.duration).toBeGreaterThan(0);
    expect(preset.stagger).toBeGreaterThan(0);
    expect(preset.slide).toBeGreaterThan(0);
  });

  it("collapses all motion when reduced-motion is requested", () => {
    const preset = getMotionPreset(true);
    expect(preset.duration).toBe(0);
    expect(preset.stagger).toBe(0);
    expect(preset.slide).toBe(0);
  });

  it("always exposes an easing array for framer-motion", () => {
    expect(Array.isArray(getMotionPreset(false).ease)).toBe(true);
    expect(getMotionPreset(true).ease).toBeDefined();
  });
});
