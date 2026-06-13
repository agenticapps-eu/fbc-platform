import { describe, expect, it } from "vitest";
import {
  deriveFacets,
  emptyDirectoryFilters,
  filtersToArgs,
  hasActiveFilters,
  type DirectoryMember,
} from "./directory";

function member(overrides: Partial<DirectoryMember>): DirectoryMember {
  return {
    id: crypto.randomUUID(),
    name: "Mitglied",
    avatar_url: null,
    region: null,
    company: null,
    short_bio: null,
    branche: null,
    tier: "prime",
    roles: null,
    competencies: null,
    has_offers: false,
    has_needs: false,
    ...overrides,
  };
}

describe("filtersToArgs", () => {
  it("mappt leere/whitespace-Filter auf undefined (= serverseitig kein Filter)", () => {
    expect(filtersToArgs(emptyDirectoryFilters)).toEqual({
      p_query: undefined,
      p_theme: undefined,
      p_branche: undefined,
      p_region: undefined,
      p_competency: undefined,
      p_offering: undefined,
    });
    expect(filtersToArgs({ ...emptyDirectoryFilters, query: "   " }).p_query).toBeUndefined();
  });

  it("trimmt gesetzte Werte und reicht sie als RPC-Argumente durch", () => {
    const args = filtersToArgs({
      query: "  Coaching ",
      theme: "tun",
      branche: "IT",
      region: "Stuttgart",
      competency: "Vertrieb",
      offering: "offers",
    });
    expect(args).toEqual({
      p_query: "Coaching",
      p_theme: "tun",
      p_branche: "IT",
      p_region: "Stuttgart",
      p_competency: "Vertrieb",
      p_offering: "offers",
    });
  });
});

describe("hasActiveFilters", () => {
  it("ist false für leere Filter und true sobald ein Feld gesetzt ist", () => {
    expect(hasActiveFilters(emptyDirectoryFilters)).toBe(false);
    expect(hasActiveFilters({ ...emptyDirectoryFilters, query: " x " })).toBe(true);
    expect(hasActiveFilters({ ...emptyDirectoryFilters, offering: "needs" })).toBe(true);
  });
});

describe("deriveFacets", () => {
  it("liefert distinkte, alphabetisch (de) sortierte Werte; null/leer werden ignoriert", () => {
    const facets = deriveFacets([
      member({ branche: "IT", region: "Stuttgart", competencies: ["Vertrieb", "Strategie"] }),
      member({ branche: "Bau", region: "Stuttgart", competencies: ["Strategie", null as never] }),
      member({ branche: null, region: null, competencies: null }),
    ]);
    expect(facets.branchen).toEqual(["Bau", "IT"]);
    expect(facets.regionen).toEqual(["Stuttgart"]);
    expect(facets.kompetenzen).toEqual(["Strategie", "Vertrieb"]);
  });
});
