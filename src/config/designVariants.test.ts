import { describe, expect, it } from "vitest";
import {
  DEFAULT_VARIANT,
  DESIGN_VARIANTS,
  isDesignVariantId,
  resolveInitialVariant,
} from "./designVariants";

describe("designVariants config", () => {
  it("models the variants a–i plus sommerfest (a–d stable, e–g experimental, h/i brand)", () => {
    expect(Object.keys(DESIGN_VARIANTS).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "sommerfest",
    ]);
  });

  it("marks D as the recommended default", () => {
    expect(DEFAULT_VARIANT).toBe("d");
    expect(DESIGN_VARIANTS.d.recommended).toBe(true);
    // exactly one recommended variant
    const recommended = Object.values(DESIGN_VARIANTS).filter((v) => v.recommended);
    expect(recommended).toHaveLength(1);
  });

  it("flags exactly e/f/g as experimental", () => {
    const experimental = Object.values(DESIGN_VARIANTS)
      .filter((v) => v.experimental)
      .map((v) => v.id)
      .sort();
    expect(experimental).toEqual(["e", "f", "g"]);
    // the stable + brand variants must not carry the experimental tag
    for (const id of ["a", "b", "c", "d", "h", "i"] as const) {
      expect(DESIGN_VARIANTS[id].experimental).toBeFalsy();
    }
  });

  it("carries the Navy & Gold brand variants h (dark sidebar) / i (light)", () => {
    expect(DESIGN_VARIANTS.h.heroStyle).toBe("dark-glow");
    expect(DESIGN_VARIANTS.i.heroStyle).toBe("light");
    expect(DESIGN_VARIANTS.h.headlineFont).toBe("serif");
    expect(DESIGN_VARIANTS.i.headlineFont).toBe("serif");
  });

  it("carries the spec's motion / hero / headline flags", () => {
    expect(DESIGN_VARIANTS.a.motion).toBe("subtle");
    expect(DESIGN_VARIANTS.b.motion).toBe("dramatic");
    expect(DESIGN_VARIANTS.c.motion).toBe("medium");
    expect(DESIGN_VARIANTS.d.motion).toBe("dramatic");
    expect(DESIGN_VARIANTS.e.motion).toBe("subtle");
    expect(DESIGN_VARIANTS.f.motion).toBe("dramatic");
    expect(DESIGN_VARIANTS.g.motion).toBe("medium");

    expect(DESIGN_VARIANTS.a.heroStyle).toBe("light");
    expect(DESIGN_VARIANTS.b.heroStyle).toBe("dark-glow");
    expect(DESIGN_VARIANTS.c.heroStyle).toBe("light");
    expect(DESIGN_VARIANTS.d.heroStyle).toBe("dark-glow");

    expect(DESIGN_VARIANTS.c.headlineFont).toBe("sans");
    expect(DESIGN_VARIANTS.d.headlineFont).toBe("serif");
    expect(DESIGN_VARIANTS.f.headlineFont).toBe("sans");
  });

  it("wires the structural backdrop / cardStyle flags for e/f/g", () => {
    expect(DESIGN_VARIANTS.e.cardStyle).toBe("editorial");
    expect(DESIGN_VARIANTS.e.backdrop).toBe("none");
    expect(DESIGN_VARIANTS.f.cardStyle).toBe("glass");
    expect(DESIGN_VARIANTS.f.backdrop).toBe("aurora");
    expect(DESIGN_VARIANTS.g.cardStyle).toBe("solid");
    expect(DESIGN_VARIANTS.g.backdrop).toBe("paper");
  });
});

describe("isDesignVariantId", () => {
  it("accepts known ids and rejects everything else", () => {
    expect(isDesignVariantId("a")).toBe(true);
    expect(isDesignVariantId("d")).toBe(true);
    expect(isDesignVariantId("e")).toBe(true);
    expect(isDesignVariantId("g")).toBe(true);
    expect(isDesignVariantId("h")).toBe(true);
    expect(isDesignVariantId("i")).toBe(true);
    expect(isDesignVariantId("z")).toBe(false);
    expect(isDesignVariantId("")).toBe(false);
    expect(isDesignVariantId(null)).toBe(false);
    expect(isDesignVariantId(undefined)).toBe(false);
    expect(isDesignVariantId("D")).toBe(false); // case-sensitive
  });
});

describe("resolveInitialVariant — precedence URL > localStorage > default", () => {
  it("prefers a valid ?variant= over storage and default", () => {
    expect(resolveInitialVariant({ search: "?variant=b", stored: "c" })).toBe("b");
  });

  it("falls back to a valid stored value when the URL has none", () => {
    expect(resolveInitialVariant({ search: "", stored: "c" })).toBe("c");
    expect(resolveInitialVariant({ search: "?foo=1", stored: "a" })).toBe("a");
  });

  it("falls back to the default when neither is valid", () => {
    expect(resolveInitialVariant({ search: "", stored: null })).toBe(DEFAULT_VARIANT);
    expect(resolveInitialVariant({ search: "?variant=zzz", stored: "nope" })).toBe(DEFAULT_VARIANT);
  });

  it("ignores an invalid URL value but still honours valid storage", () => {
    expect(resolveInitialVariant({ search: "?variant=x", stored: "b" })).toBe("b");
  });

  it("accepts a bare search string without the leading question mark", () => {
    expect(resolveInitialVariant({ search: "variant=a", stored: null })).toBe("a");
  });
});
