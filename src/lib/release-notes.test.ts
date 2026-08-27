import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die Datenschicht der Release-Notes (AGE-631, Band 3).
 *
 * Gemockt ist nur der Rand zur Datenbank. Gemessen wird an den ARGUMENTEN der
 * Attrappe, wo es um die Abfrage geht, und am Ergebnis, wo es um die reine
 * Rechnung geht.
 *
 * **Die schärfste Zusage ist eine Verneinung:** die Liste der noch nicht
 * angekündigten Changes zieht die Slugs der **zugestellten** Notes ab — nicht
 * die aller Notes. Zöge sie auch Entwürfe ab, verschwände ein Change aus der
 * Liste, sobald ihn jemand in einen Entwurf gezogen und den Entwurf liegen
 * gelassen hat. Er wäre dann für immer unangekündigt, und niemandem fiele es
 * auf: eine kürzere Liste sieht aus wie eine vollständige.
 */

interface Aufruf {
  table?: string;
  rpc?: string;
  select?: string;
  eq?: [string, unknown][];
  order?: { spalte: string; ascending?: boolean; nullsFirst?: boolean }[];
  range?: [number, number];
  args?: unknown;
}

let aufrufe: Aufruf[] = [];
let zeilen: Record<string, unknown>[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table, eq: [], order: [] };
      aufrufe.push(eintrag);
      const kette = {
        select: (spalten: string) => {
          eintrag.select = spalten;
          return kette;
        },
        eq: (spalte: string, wert: unknown) => {
          eintrag.eq!.push([spalte, wert]);
          return kette;
        },
        order: (spalte: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => {
          eintrag.order!.push({ spalte, ...opts });
          return kette;
        },
        range: (von: number, bis: number) => {
          eintrag.range = [von, bis];
          return kette;
        },
        upsert: (werte: unknown) => {
          eintrag.args = werte;
          return kette;
        },
        single: () => kette,
        then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
          Promise.resolve({ data: zeilen, error: null }).then(auf, ab),
      };
      return kette;
    },
    rpc: async (name: string, args: unknown) => {
      aufrufe.push({ rpc: name, args });
      return { data: 42, error: null };
    },
  },
}));

import {
  RELEASE_NOTES_SEITE,
  ausLetzterWoche,
  fetchEntwuerfe,
  fetchZugestellte,
  nochNichtAngekuendigt,
  stelleZu,
} from "./release-notes";
import type { ReleaseEintrag } from "../types/release";

function eintrag(slug: string): ReleaseEintrag {
  return { slug, datum: slug.slice(0, 10), titel: slug, linear: null, aenderungen: [] };
}

beforeEach(() => {
  aufrufe = [];
  zeilen = [];
});

describe("nochNichtAngekuendigt — was der Admin zu sehen bekommt", () => {
  const alle = [eintrag("2026-08-27-a"), eintrag("2026-08-26-b"), eintrag("2026-08-25-c")];

  it("zieht die Slugs ZUGESTELLTER Notes ab", () => {
    const offen = nochNichtAngekuendigt(alle, [{ status: "sent", entry_slugs: ["2026-08-26-b"] }]);
    expect(offen.map((e) => e.slug)).toEqual(["2026-08-27-a", "2026-08-25-c"]);
  });

  it("zieht die Slugs eines ENTWURFS NICHT ab", () => {
    // Sonst verschwände ein Change, sobald ihn jemand in einen Entwurf gezogen
    // und den Entwurf liegen gelassen hat — für immer unangekündigt.
    const offen = nochNichtAngekuendigt(alle, [{ status: "draft", entry_slugs: ["2026-08-26-b"] }]);
    expect(offen.map((e) => e.slug)).toEqual(["2026-08-27-a", "2026-08-26-b", "2026-08-25-c"]);
  });

  it("kommt mit mehreren Notes und Überschneidungen zurecht", () => {
    const offen = nochNichtAngekuendigt(alle, [
      { status: "sent", entry_slugs: ["2026-08-26-b", "2026-08-25-c"] },
      { status: "sent", entry_slugs: ["2026-08-25-c"] },
    ]);
    expect(offen.map((e) => e.slug)).toEqual(["2026-08-27-a"]);
  });

  it("gibt ohne Notes alles zurück", () => {
    expect(nochNichtAngekuendigt(alle, [])).toHaveLength(3);
  });
});

describe("ausLetzterWoche — was beim Öffnen vorangehakt ist", () => {
  // `heute` wird übergeben, nicht gelesen. Eine Funktion, die selbst zur Uhr
  // greift, ist nur an dem einen Tag prüfbar, an dem der Test geschrieben wurde.
  const heute = new Date("2026-08-27T09:00:00Z");

  it("nimmt den siebten Tag NOCH mit", () => {
    // Die Grenze ist eine Zusage, kein Zufall: „letzte Woche" schliesst den
    // Tag vor sieben Tagen ein. Ohne diesen Fall fiele eine Verschiebung um
    // einen Tag durch jeden Test.
    expect(ausLetzterWoche([eintrag("2026-08-20-a")], heute).map((e) => e.slug)).toEqual([
      "2026-08-20-a",
    ]);
  });

  it("lässt den achten Tag aus", () => {
    expect(ausLetzterWoche([eintrag("2026-08-19-a")], heute)).toEqual([]);
  });

  it("trennt eine gemischte Liste", () => {
    const alle = [eintrag("2026-08-27-a"), eintrag("2026-08-21-b"), eintrag("2026-07-04-c")];
    expect(ausLetzterWoche(alle, heute).map((e) => e.slug)).toEqual([
      "2026-08-27-a",
      "2026-08-21-b",
    ]);
  });

  it("lässt einen Eintrag OHNE Datum aus", () => {
    // Ein Verzeichnisname ohne `JJJJ-MM-TT` ergibt `datum: ""`. Der leere
    // String ist lexikographisch kleiner als jede Grenze — er fällt also von
    // selbst heraus, und das ist die richtige Seite: nicht angehakt, aber
    // sichtbar in der Liste, wo ein Mensch ihn sieht.
    const ohne: ReleaseEintrag = {
      slug: "kein-datum",
      datum: "",
      titel: "kein-datum",
      linear: null,
      aenderungen: [],
    };
    expect(ausLetzterWoche([ohne], heute)).toEqual([]);
  });
});

describe("Die Abfragen", () => {
  it("holt Entwürfe über den Zustand, nicht über eine Sortierung", async () => {
    await fetchEntwuerfe();
    const a = aufrufe.find((x) => x.table === "release_notes")!;
    expect(a.eq).toContainEqual(["status", "draft"]);
  });

  it("holt Zugestellte begrenzt und neueste zuerst", async () => {
    await fetchZugestellte();
    const a = aufrufe.find((x) => x.table === "release_notes")!;
    expect(a.eq).toContainEqual(["status", "sent"]);
    expect(a.order).toEqual([{ spalte: "sent_at", ascending: false, nullsFirst: false }]);
    // Eine Grenze gehört in die ERSTE Fassung jeder listenden Fläche.
    expect(a.range).toEqual([0, RELEASE_NOTES_SEITE - 1]);
  });

  it("stellt über die RPC zu, nicht über ein UPDATE", async () => {
    // Ein UPDATE auf `status` liesse die Policy ohnehin nicht durch — aber die
    // Zusage lautet auf den WEG: der Fan-out gehört in die Datenbank.
    const zahl = await stelleZu("note-1");
    expect(aufrufe).toContainEqual({ rpc: "send_release_note", args: { p_id: "note-1" } });
    expect(zahl).toBe(42);
    expect(aufrufe.some((a) => a.table === "notifications")).toBe(false);
  });
});
