import { describe, expect, it } from "vitest";
import {
  COMPLEMENTARITY,
  NEED_CATEGORIES,
  OFFER_CATEGORIES,
  VOLUME_BANDS,
  categoryLabel,
  findCategory,
  routingForBand,
  volumeBandLabel,
} from "./matching";

const offerKeys = new Set(OFFER_CATEGORIES.map((c) => c.key));
const needKeys = new Set(NEED_CATEGORIES.map((c) => c.key));

describe("Komplementaritäts-Map", () => {
  it("verweist nur auf gültige need-Schlüssel als Keys", () => {
    for (const key of Object.keys(COMPLEMENTARITY)) {
      expect(needKeys.has(key)).toBe(true);
    }
  });

  it("verweist nur auf gültige offer-Schlüssel als Werte", () => {
    for (const offers of Object.values(COMPLEMENTARITY)) {
      expect(offers.length).toBeGreaterThan(0);
      for (const offer of offers) expect(offerKeys.has(offer)).toBe(true);
    }
  });

  it("deckt jede Gesuch-Kategorie ab (jede need-Kategorie hat einen Eintrag)", () => {
    for (const need of NEED_CATEGORIES) {
      expect(COMPLEMENTARITY[need.key]).toBeDefined();
    }
  });
});

describe("routingForBand (§8)", () => {
  it("routet große Volumina zu DKRI", () => {
    expect(routingForBand("1m_10m")).toBe("dkri");
    expect(routingForBand("gt_10m")).toBe("dkri");
  });

  it("routet kleinere Volumina und Unbekanntes zu FBC", () => {
    expect(routingForBand("lt_10k")).toBe("fbc");
    expect(routingForBand("10k_100k")).toBe("fbc");
    expect(routingForBand("100k_1m")).toBe("fbc");
    expect(routingForBand(null)).toBe("fbc");
    expect(routingForBand(undefined)).toBe("fbc");
  });
});

describe("categoryLabel / findCategory", () => {
  it("liefert das Label bekannter Kategorien je Seite", () => {
    expect(categoryLabel("offer", "kapital")).toBe("Kapital");
    expect(categoryLabel("need", "investoren")).toBe("Investoren");
  });

  it("unterscheidet die Seiten (immobilien existiert beidseitig)", () => {
    expect(findCategory("offer", "immobilien")?.side).toBe("offer");
    expect(findCategory("need", "immobilien")?.side).toBe("need");
    expect(findCategory("offer", "investoren")).toBeUndefined(); // need-only
  });

  it("fällt für unbekannte/leere Schlüssel lesbar zurück", () => {
    expect(categoryLabel("offer", "expertise")).toBe("Expertise");
    expect(categoryLabel("need", null)).toBe("—");
  });
});

describe("Kategorie-Stammdaten", () => {
  it("jede Kategorie trägt key, label, theme, icon und die passende Seite", () => {
    for (const c of OFFER_CATEGORIES) expect(c.side).toBe("offer");
    for (const c of NEED_CATEGORIES) expect(c.side).toBe("need");
    for (const c of [...OFFER_CATEGORIES, ...NEED_CATEGORIES]) {
      expect(c.key).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(["sein", "tun", "haben", "wirken"]).toContain(c.theme);
      expect(c.icon).toBeTruthy();
    }
  });
});

describe("volumeBandLabel", () => {
  it("liefert ein Label je Band und null ohne Band", () => {
    for (const b of VOLUME_BANDS) expect(volumeBandLabel(b.value)).toBe(b.label);
    expect(volumeBandLabel(null)).toBeNull();
  });
});
