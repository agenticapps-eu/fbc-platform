import { describe, expect, it } from "vitest";
import {
  DEFAULT_VARIANT,
  DESIGN_VARIANTS,
  isDesignVariantId,
  resolveInitialVariant,
  SWITCHER_VARIANT_IDS,
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
      "linkedin",
      "sommerfest",
    ]);
  });

  it("marks sommerfest as the recommended default", () => {
    expect(DEFAULT_VARIANT).toBe("sommerfest");
    expect(DESIGN_VARIANTS.sommerfest.recommended).toBe(true);
    // exactly one recommended variant
    const recommended = Object.values(DESIGN_VARIANTS).filter((v) => v.recommended);
    expect(recommended).toHaveLength(1);
    expect(DESIGN_VARIANTS.d.recommended).toBeFalsy();
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

describe("SWITCHER_VARIANT_IDS — was der Switcher anbietet (AGE-439)", () => {
  it("bietet nur A, Sommerfest und eff.bee.zee an", () => {
    expect([...SWITCHER_VARIANT_IDS]).toEqual(["a", "sommerfest", "linkedin"]);
  });

  it("bietet B–I nicht mehr an, behält sie aber in der Config", () => {
    for (const id of ["b", "c", "d", "e", "f", "g", "h", "i"] as const) {
      expect(SWITCHER_VARIANT_IDS).not.toContain(id);
      expect(DESIGN_VARIANTS[id]).toBeDefined();
    }
  });

  it("enthält den Default, sonst wäre die aktive Variante nicht anwählbar", () => {
    expect(SWITCHER_VARIANT_IDS).toContain(DEFAULT_VARIANT);
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
    expect(resolveInitialVariant({ search: "", stored: "sommerfest" })).toBe("sommerfest");
    expect(resolveInitialVariant({ search: "?foo=1", stored: "a" })).toBe("a");
  });

  // AGE-439: wer noch eine zurückgezogene Variante im localStorage hat, säße
  // sonst darauf fest — der Switcher böte keinen Weg zurück.
  it("ignoriert einen gespeicherten Wert, den der Switcher nicht mehr anbietet", () => {
    expect(resolveInitialVariant({ search: "", stored: "c" })).toBe(DEFAULT_VARIANT);
    expect(resolveInitialVariant({ search: "", stored: "h" })).toBe(DEFAULT_VARIANT);
  });

  // Deep-Links bleiben absichtlich intakt: intern sollen B–I zeigbar bleiben.
  it("akzeptiert eine zurückgezogene Variante weiterhin per ?variant=", () => {
    expect(resolveInitialVariant({ search: "?variant=h", stored: null })).toBe("h");
  });

  it("falls back to the default when neither is valid", () => {
    expect(resolveInitialVariant({ search: "", stored: null })).toBe(DEFAULT_VARIANT);
    expect(resolveInitialVariant({ search: "?variant=zzz", stored: "nope" })).toBe(DEFAULT_VARIANT);
  });

  it("ignores an invalid URL value but still honours valid storage", () => {
    expect(resolveInitialVariant({ search: "?variant=x", stored: "a" })).toBe("a");
  });

  it("accepts a bare search string without the leading question mark", () => {
    expect(resolveInitialVariant({ search: "variant=a", stored: null })).toBe("a");
  });
});
