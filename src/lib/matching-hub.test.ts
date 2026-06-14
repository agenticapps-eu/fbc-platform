import { describe, expect, it } from "vitest";
import {
  complementarityReasons,
  computeHubStats,
  emptyHubFilters,
  filterMatches,
  hasActiveHubFilters,
  parseBasis,
  secondaryReasons,
  type HubMatch,
  type HubPartner,
} from "./matching-hub";

const BASIS = {
  score: 77,
  routing: "fbc",
  complementarity_pairs: [
    { need: "investoren", offer: "kapital" },
    { need: "investoren", offer: "kapital" }, // dupliziert
    { need: "projekte", offer: "kontakte" },
  ],
  components: [
    {
      key: "complementarity",
      label: "Komplementarität",
      weight: 35,
      points: 35,
      detail: "3 Treffer",
    },
    { key: "theme", label: "Themenbereich", weight: 20, points: 10 },
    { key: "branche", label: "Branche", weight: 15, points: 0 },
    { key: "region", label: "Region", weight: 15, points: 15 },
    { key: "interests", label: "Interessen & Kompetenzen", weight: 10, points: 0 },
    { key: "tier", label: "Mitgliedsstufe", weight: 5, points: 2.5 },
  ],
};

const partner = (over: Partial<HubPartner> = {}): HubPartner => ({
  id: "p1",
  name: "Test",
  avatar_url: null,
  region: "Stuttgart",
  company: null,
  tier: "prime",
  offers: [],
  needs: [],
  ...over,
});

describe("parseBasis", () => {
  it("parst eine wohlgeformte basis-jsonb", () => {
    const b = parseBasis(BASIS);
    expect(b).not.toBeNull();
    expect(b!.score).toBe(77);
    expect(b!.components).toHaveLength(6);
    expect(b!.complementarity_pairs).toHaveLength(3);
  });

  it("ist defensiv bei Müll", () => {
    expect(parseBasis(null)).toBeNull();
    expect(parseBasis("x")).toBeNull();
    expect(parseBasis({})).toBeNull();
  });

  it("überspringt unvollständige Komponenten und Paare", () => {
    const b = parseBasis({
      components: [{ key: "x", label: "X", weight: 5, points: 1 }, { key: "bad" }],
      complementarity_pairs: [{ need: "a", offer: "b" }, { need: 1 }],
    });
    expect(b!.components).toHaveLength(1);
    expect(b!.complementarity_pairs).toHaveLength(1);
  });
});

describe("computeHubStats", () => {
  it("zählt aktiv/erfolgreich und mittelt den Score", () => {
    const stats = computeHubStats([
      { score: 80, status: "suggested" },
      { score: 60, status: "requested" },
      { score: 100, status: "accepted" },
      { score: 40, status: "declined" },
    ]);
    expect(stats.active).toBe(2);
    expect(stats.successful).toBe(1);
    expect(stats.avgScore).toBe(70);
  });

  it("liefert Nullen ohne Matches", () => {
    expect(computeHubStats([])).toEqual({ active: 0, successful: 0, avgScore: 0 });
  });
});

describe("complementarityReasons", () => {
  it("baut „Biete ↔ Suche“ und dedupliziert/kürzt", () => {
    const reasons = complementarityReasons(parseBasis(BASIS));
    expect(reasons).toEqual(["Kapital ↔ Investoren", "Kontakte ↔ Projekte"]);
  });

  it("ist leer ohne basis", () => {
    expect(complementarityReasons(null)).toEqual([]);
  });
});

describe("secondaryReasons", () => {
  it("nennt nur Faktoren mit Punkten > 0 ohne Komplementarität", () => {
    const reasons = secondaryReasons(parseBasis(BASIS), partner());
    expect(reasons).toEqual(["Gemeinsames Thema", "Region Stuttgart", "Passende Stufe"]);
  });
});

describe("filterMatches", () => {
  const match = (over: Partial<HubMatch>): HubMatch => ({
    id: "m",
    score: 80,
    status: "suggested",
    routing: "fbc",
    basis: null,
    partner: partner(),
    contactRequest: null,
    ...over,
  });

  const m1 = match({
    id: "m1",
    score: 90,
    partner: partner({
      region: "Stuttgart",
      offers: [{ id: "o", category: "kapital", theme: "haben", title: "Kapital" }],
      needs: [],
    }),
  });
  const m2 = match({
    id: "m2",
    score: 50,
    partner: partner({
      region: "München",
      offers: [],
      needs: [{ id: "n", category: "experten", theme: "tun", title: "Experten" }],
    }),
  });

  it("filtert nach Mindest-Score", () => {
    expect(filterMatches([m1, m2], { ...emptyHubFilters, minScore: 60 }).map((m) => m.id)).toEqual([
      "m1",
    ]);
  });

  it("filtert nach Region", () => {
    expect(
      filterMatches([m1, m2], { ...emptyHubFilters, region: "München" }).map((m) => m.id),
    ).toEqual(["m2"]);
  });

  it("filtert nach Thema über offers+needs", () => {
    expect(filterMatches([m1, m2], { ...emptyHubFilters, theme: "tun" }).map((m) => m.id)).toEqual([
      "m2",
    ]);
  });

  it("filtert nach Kategorie mit Seite", () => {
    expect(
      filterMatches([m1, m2], { ...emptyHubFilters, category: "offer:kapital" }).map((m) => m.id),
    ).toEqual(["m1"]);
    expect(
      filterMatches([m1, m2], { ...emptyHubFilters, category: "need:experten" }).map((m) => m.id),
    ).toEqual(["m2"]);
  });
});

describe("hasActiveHubFilters", () => {
  it("erkennt aktive Filter", () => {
    expect(hasActiveHubFilters(emptyHubFilters)).toBe(false);
    expect(hasActiveHubFilters({ ...emptyHubFilters, minScore: 60 })).toBe(true);
    expect(hasActiveHubFilters({ ...emptyHubFilters, theme: "tun" })).toBe(true);
  });
});
