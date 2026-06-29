import { describe, expect, it } from "vitest";
import {
  DEFAULT_VARIANT,
  DESIGN_VARIANTS,
  isDesignVariantId,
  resolveInitialVariant,
} from "./designVariants";

describe("designVariants config", () => {
  it("models exactly the four variants a/b/c/d", () => {
    expect(Object.keys(DESIGN_VARIANTS).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("marks D as the recommended default", () => {
    expect(DEFAULT_VARIANT).toBe("d");
    expect(DESIGN_VARIANTS.d.recommended).toBe(true);
    // exactly one recommended variant
    const recommended = Object.values(DESIGN_VARIANTS).filter((v) => v.recommended);
    expect(recommended).toHaveLength(1);
  });

  it("carries the spec's motion / hero / headline flags", () => {
    expect(DESIGN_VARIANTS.a.motion).toBe("subtle");
    expect(DESIGN_VARIANTS.b.motion).toBe("dramatic");
    expect(DESIGN_VARIANTS.c.motion).toBe("medium");
    expect(DESIGN_VARIANTS.d.motion).toBe("dramatic");

    expect(DESIGN_VARIANTS.a.heroStyle).toBe("light");
    expect(DESIGN_VARIANTS.b.heroStyle).toBe("dark-glow");
    expect(DESIGN_VARIANTS.c.heroStyle).toBe("light");
    expect(DESIGN_VARIANTS.d.heroStyle).toBe("dark-glow");

    expect(DESIGN_VARIANTS.c.headlineFont).toBe("sans");
    expect(DESIGN_VARIANTS.d.headlineFont).toBe("serif");
  });
});

describe("isDesignVariantId", () => {
  it("accepts known ids and rejects everything else", () => {
    expect(isDesignVariantId("a")).toBe(true);
    expect(isDesignVariantId("d")).toBe(true);
    expect(isDesignVariantId("e")).toBe(false);
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
