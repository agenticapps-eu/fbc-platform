import { describe, expect, it } from "vitest";
import {
  DEFAULT_VARIANT,
  DESIGN_VARIANTS,
  DESIGN_VARIANT_IDS,
  isDesignVariantId,
  resolveInitialVariant,
} from "./designVariants";

describe("designVariants config", () => {
  it("models exactly the two themes hell and navy", () => {
    expect(Object.keys(DESIGN_VARIANTS).sort()).toEqual(["hell", "navy"]);
    expect([...DESIGN_VARIANT_IDS]).toEqual(["hell", "navy"]);
  });

  it("defaults to hell", () => {
    expect(DEFAULT_VARIANT).toBe("hell");
  });

  it("carries only id, label and description — no motion or structural flags", () => {
    for (const id of DESIGN_VARIANT_IDS) {
      expect(Object.keys(DESIGN_VARIANTS[id]).sort()).toEqual(["description", "id", "label"]);
    }
  });
});

describe("isDesignVariantId", () => {
  it("accepts the two themes and rejects everything else", () => {
    expect(isDesignVariantId("hell")).toBe(true);
    expect(isDesignVariantId("navy")).toBe(true);
    expect(isDesignVariantId("")).toBe(false);
    expect(isDesignVariantId(null)).toBe(false);
    expect(isDesignVariantId(undefined)).toBe(false);
    expect(isDesignVariantId("Hell")).toBe(false); // case-sensitive
  });

  // AGE-492: die zwölf Vorgänger-Varianten sind zurückgezogen. Sie dürfen nicht
  // mehr als gültig durchgehen, sonst landet ein alter localStorage-Wert als
  // data-variant auf <html> und trifft dort auf keinen einzigen CSS-Block.
  it("rejects every retired variant id", () => {
    for (const id of [
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
      "blau",
      "blau-slate",
      "blau-navy",
      "linkedin",
    ]) {
      expect(isDesignVariantId(id)).toBe(false);
    }
  });
});

describe("resolveInitialVariant — localStorage, sonst Default", () => {
  it("honours a valid stored value", () => {
    expect(resolveInitialVariant({ stored: "navy" })).toBe("navy");
    expect(resolveInitialVariant({ stored: "hell" })).toBe("hell");
  });

  it("falls back to hell when nothing is stored", () => {
    expect(resolveInitialVariant({ stored: null })).toBe(DEFAULT_VARIANT);
    expect(resolveInitialVariant({ stored: "" })).toBe(DEFAULT_VARIANT);
  });

  // Der eigentliche Regressionsschutz: Bestandsnutzer tragen noch
  // "sommerfest", "blau" oder "linkedin" im localStorage. Fällt einer davon
  // nicht auf hell zurück, rendert die App ohne Theme-Block.
  it("falls back to hell for every retired stored value", () => {
    for (const stored of ["sommerfest", "blau", "blau-navy", "linkedin", "a", "h"]) {
      expect(resolveInitialVariant({ stored })).toBe("hell");
    }
  });

  it("falls back to hell for garbage", () => {
    expect(resolveInitialVariant({ stored: "zzz" })).toBe(DEFAULT_VARIANT);
    expect(resolveInitialVariant({ stored: "{}" })).toBe(DEFAULT_VARIANT);
  });
});
