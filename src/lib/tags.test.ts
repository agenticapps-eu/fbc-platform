import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kuratierte Tags (AGE-528, Task 5.4).
 *
 * Gemockt ist nur der Rand zur Datenbank. Die Aussagen sind: WELCHE Zeilen
 * fragt `fetchAktiveTags` an, und wann gilt ein Chip als kuratiert.
 */

let letzteAbfrage: { table: string; spalten: string; eq: [string, unknown][]; order?: string } = {
  table: "",
  spalten: "",
  eq: [],
};
let zeilen: { key: string; label: string; sort: number }[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      letzteAbfrage = { table, spalten: "", eq: [] };
      const kette = {
        select: (spalten: string) => {
          letzteAbfrage.spalten = spalten;
          return kette;
        },
        eq: (spalte: string, wert: unknown) => {
          letzteAbfrage.eq.push([spalte, wert]);
          return kette;
        },
        order: (spalte: string) => {
          letzteAbfrage.order = spalte;
          return Promise.resolve({ data: zeilen, error: null });
        },
      };
      return kette;
    },
  },
}));

import { fetchAktiveTags, istKuratiert, type Tag } from "./tags";

const tag = (key: string, sort = 10): Tag => ({ key, label: key, sort });

beforeEach(() => {
  zeilen = [];
});

describe("fetchAktiveTags", () => {
  it("liest nur aktive Tags, in ihrer Sortierreihenfolge", async () => {
    zeilen = [
      { key: "unternehmertum", label: "Unternehmertum", sort: 10 },
      { key: "ki", label: "KI", sort: 110 },
    ];

    const ergebnis = await fetchAktiveTags();

    expect(letzteAbfrage.table).toBe("tags");
    // `active = false` heißt: nicht mehr anbieten. Bestandsbeiträge behalten
    // ihren Wert und zeigen ihn danach als freien Tag (spec.md).
    expect(letzteAbfrage.eq).toEqual([["active", true]]);
    expect(letzteAbfrage.order).toBe("sort");
    expect(ergebnis).toEqual(zeilen);
  });
});

describe("istKuratiert", () => {
  it("erkennt einen Wert aus der Liste", () => {
    expect(istKuratiert("netzwerken", [tag("netzwerken"), tag("ki")])).toBe(true);
  });

  it("ein selbst getippter Wert ist frei", () => {
    expect(istKuratiert("allgäu", [tag("netzwerken")])).toBe(false);
  });

  it("ein deaktivierter Tag ist nicht mehr in der Liste und gilt damit als frei", () => {
    // Genau das Szenario aus spec.md: der Bestandsbeitrag behält seinen Wert,
    // der Chip wandert nur von „gefüllt" nach „Outline".
    expect(istKuratiert("leadership", [])).toBe(false);
  });
});
