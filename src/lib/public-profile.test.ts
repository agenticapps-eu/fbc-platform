import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Welche Tabellen `fetchPublicProfile` wirklich anfragt (AGE-597).
 *
 * GEMOCKT IST NUR DER RAND ZUR DATENBANK — aufgezeichnet wird die FORM der
 * Anfrage: welche Tabelle, welche Spalten. Genau darum geht es hier: der
 * Erfolgsradar verschwindet aus der Ansicht, und mit ihm SOLL seine Abfrage
 * verschwinden. Ein Rundlauf ohne Leser ist kein „Erhalten", sondern Ballast
 * (Befund codex im Plan-Review).
 *
 * Der zweite Teil sichert die Gegenrichtung: `source` MUSS mitgelesen werden.
 * Ohne die Spalte fiele jede Zeile in den Editor-Zweig, und die 19 Marken
 * erschienen wieder als Fließtext.
 */

interface Aufruf {
  table: string;
  select?: string;
}

let aufrufe: Aufruf[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table };
      aufrufe.push(eintrag);
      const kette = {
        select: (spalten: string) => {
          eintrag.select = spalten;
          return kette;
        },
        eq: () => kette,
        order: () => kette,
        limit: () => kette,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(auf, ab),
      };
      return kette;
    },
  },
}));

import { fetchPublicProfile } from "./public-profile";

const ID = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  aufrufe = [];
});

describe("fetchPublicProfile — welche Tabellen gelesen werden (AGE-597)", () => {
  it("liest `profile_theme_scores` NICHT mehr", async () => {
    await fetchPublicProfile(ID);
    expect(aufrufe.map((a) => a.table)).not.toContain("profile_theme_scores");
  });

  it("liest weiterhin die Tabellen, die die Seite anzeigt", async () => {
    await fetchPublicProfile(ID);
    const tabellen = aufrufe.map((a) => a.table);
    // Gegenprobe zur Zusage oben: der Test darf nicht dadurch gruen werden,
    // dass gar nichts mehr gelesen wird.
    for (const t of ["profiles_public", "profiles", "profile_interests", "offers", "needs", "posts"]) {
      expect(tabellen).toContain(t);
    }
  });

  it("liest `source` bei Angeboten und Gesuchen mit", async () => {
    await fetchPublicProfile(ID);
    for (const tabelle of ["offers", "needs"]) {
      const spalten = aufrufe.find((a) => a.table === tabelle)?.select ?? "";
      expect(spalten.split(",").map((s) => s.trim())).toContain("source");
    }
  });
});
