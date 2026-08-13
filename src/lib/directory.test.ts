import { describe, expect, it } from "vitest";
import {
  deriveFacets,
  directoryQueryKey,
  directoryUrlForQuery,
  emptyDirectoryFilters,
  filtersToArgs,
  hasActiveFilters,
  headerSearchKeyPrefix,
  headerSearchQueryKey,
  NEED_CATEGORY_OPTIONS,
  OFFER_CATEGORY_OPTIONS,
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
    // AGE-494: Die RPC liefert hier immer ein Array, nie null — das `coalesce`
    // in der Migration garantiert es, und die Fixture bildet das nach.
    offer_categories: [],
    need_categories: [],
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
      p_offers: undefined,
      p_needs: undefined,
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
      offers: ["kapital", "mentoring"],
      needs: ["experten"],
    });
    expect(args).toEqual({
      p_query: "Coaching",
      p_theme: "tun",
      p_branche: "IT",
      p_region: "Stuttgart",
      p_competency: "Vertrieb",
      p_offering: "offers",
      p_offers: ["kapital", "mentoring"],
      p_needs: ["experten"],
    });
  });

  /* AGE-494: Ein LEERES Array darf nicht als Argument rausgehen. Serverseitig
     filtert `cardinality(...) = 0` zwar ohnehin nicht — aber der Filterzustand
     wandert als Objekt in den React-Query-Key, und `[]` und `undefined` wären dort
     zwei verschiedene Schlüssel für dieselbe Abfrage. */
  it("lässt leere Kategorie-Auswahlen weg statt ein leeres Array zu schicken", () => {
    const args = filtersToArgs({ ...emptyDirectoryFilters, offers: [], needs: [] });
    expect(args.p_offers).toBeUndefined();
    expect(args.p_needs).toBeUndefined();
  });
});

describe("hasActiveFilters", () => {
  it("ist false für leere Filter und true sobald ein Feld gesetzt ist", () => {
    expect(hasActiveFilters(emptyDirectoryFilters)).toBe(false);
    expect(hasActiveFilters({ ...emptyDirectoryFilters, query: " x " })).toBe(true);
    expect(hasActiveFilters({ ...emptyDirectoryFilters, offering: "needs" })).toBe(true);
  });

  it("zählt auch eine Kategorie-Auswahl als aktiven Filter", () => {
    expect(hasActiveFilters({ ...emptyDirectoryFilters, offers: ["kapital"] })).toBe(true);
    expect(hasActiveFilters({ ...emptyDirectoryFilters, needs: ["experten"] })).toBe(true);
    // Eine leere Auswahl ist KEIN Filter — sonst stünde „Filter zurücksetzen"
    // dauerhaft da, sobald jemand einen Chip an- und wieder abwählt.
    expect(hasActiveFilters({ ...emptyDirectoryFilters, offers: [], needs: [] })).toBe(false);
  });
});

/* AGE-494: Die elf Kategorien sind KEINE flache Elferliste. `compass.ts` führt
   sechs „Ich biete"- und sechs „Ich suche"-Chips; ihre Vereinigung ergibt elf,
   weil `immobilien` auf beiden Seiten steht. Die Optionen werden aus derselben
   Konfiguration abgeleitet, nicht neu aufgeschrieben — sonst driften Filter,
   Profil-Editor und Assistent auseinander. */
describe("Kompass-Kategorien als Filteroptionen", () => {
  it("führt je Seite sechs Optionen, nicht elf", () => {
    expect(OFFER_CATEGORY_OPTIONS).toHaveLength(6);
    expect(NEED_CATEGORY_OPTIONS).toHaveLength(6);
  });

  it("nutzt den Kategorie-Schlüssel als Wert, nicht den Chip-Schlüssel", () => {
    // `compass.ts` unterscheidet `value` (Entwurfs-Schlüssel) und `category`
    // (was in offers/needs.category landet). Der Filter muss auf `category`
    // gehen, sonst sucht er nach Werten, die in der Tabelle nie stehen:
    // der Chip „expertise" schreibt die Kategorie „know_how".
    expect(OFFER_CATEGORY_OPTIONS.map((o) => o.value)).toContain("know_how");
    expect(OFFER_CATEGORY_OPTIONS.map((o) => o.value)).not.toContain("expertise");
  });

  it("hat auf beiden Seiten Immobilien — die Vereinigung ergibt die elf", () => {
    const alle = new Set([
      ...OFFER_CATEGORY_OPTIONS.map((o) => o.value),
      ...NEED_CATEGORY_OPTIONS.map((o) => o.value),
    ]);
    expect(alle.size).toBe(11);
    expect(OFFER_CATEGORY_OPTIONS.map((o) => o.value)).toContain("immobilien");
    expect(NEED_CATEGORY_OPTIONS.map((o) => o.value)).toContain("immobilien");
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

/**
 * Kopfzeilen-Suche: die Schlüssel-Eigenschaften direkt (AGE-540).
 *
 * Bewusst hier und nicht im Komponententest. Dort ist diese Aussage NICHT
 * prüfbar: `HeaderSearch` leert beim Identitätswechsel ohnehin den
 * Zwischenspeicher, und dieser zweite Schutz macht das Fehlen der Kennung im
 * Schlüssel unsichtbar. Gemessen — nimmt man `uid` aus dem Schlüssel, bleiben
 * alle Komponententests grün. Also wird die Eigenschaft dort geprüft, wo sie
 * entsteht.
 */
describe("headerSearchQueryKey (AGE-540)", () => {
  it("trennt zwei Konten bei gleichem Suchwort", () => {
    expect(headerSearchQueryKey("konto-a", "anna")).not.toEqual(
      headerSearchQueryKey("konto-b", "anna"),
    );
  });

  it("trennt zwei Suchwörter bei gleichem Konto", () => {
    expect(headerSearchQueryKey("konto-a", "anna")).not.toEqual(
      headerSearchQueryKey("konto-a", "berta"),
    );
  });

  it("kollidiert nicht mit dem Schlüssel des vollen Verzeichnisses", () => {
    // Ein auf fünf gekürztes Ergebnis unter `directoryQueryKey` vergiftete den
    // Zwischenspeicher der Verzeichnisseite, die dort die volle Liste erwartet.
    const kopf = headerSearchQueryKey("konto-a", "anna") as readonly unknown[];
    const voll = directoryQueryKey({
      ...emptyDirectoryFilters,
      query: "anna",
    }) as readonly unknown[];
    expect(kopf[1]).not.toBe(voll[1]);
  });

  it("liegt unter dem Präfix, das beim Abmelden entfernt wird", () => {
    const kopf = headerSearchQueryKey("konto-a", "anna") as readonly unknown[];
    expect(kopf.slice(0, headerSearchKeyPrefix.length)).toEqual([...headerSearchKeyPrefix]);
  });
});

describe("directoryUrlForQuery (AGE-540)", () => {
  it("hängt den getrimmten Begriff als Parameter an", () => {
    expect(directoryUrlForQuery("  anna  ")).toBe("/mitglieder?q=anna");
  });

  it("kodiert Sonderzeichen", () => {
    expect(directoryUrlForQuery("müller & co")).toBe("/mitglieder?q=m%C3%BCller%20%26%20co");
  });

  it("lässt den Parameter bei leerem Begriff weg", () => {
    expect(directoryUrlForQuery("   ")).toBe("/mitglieder");
  });
});
