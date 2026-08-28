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
  /** Die Optionen des `upsert` — `ignoreDuplicates` ist der einzige Weg zu
   *  `on conflict do nothing`, und den prüft ein Test. */
  optionen?: unknown;
  geloescht?: boolean;
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
        upsert: (werte: unknown, optionen?: unknown) => {
          eintrag.args = werte;
          eintrag.optionen = optionen;
          return kette;
        },
        delete: () => {
          eintrag.geloescht = true;
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
  fetchAngekuendigt,
  fetchUebersprungene,
  fetchZugestellte,
  holeZurueck,
  markiereUebersprungen,
  stelleZu,
  teileAuf,
} from "./release-notes";
import type { ReleaseEintrag } from "../types/release";

function eintrag(slug: string): ReleaseEintrag {
  return { slug, datum: slug.slice(0, 10), titel: slug, linear: null, aenderungen: [] };
}

beforeEach(() => {
  aufrufe = [];
  zeilen = [];
});

/** Eine zugestellte Note, verkürzt auf das, was `teileAuf` braucht. */
function zugestellt(titel: string, am: string | null, slugs: string[]) {
  return { status: "sent", title: titel, sent_at: am, entry_slugs: slugs };
}

describe("teileAuf — was in der Liste steht und was im Archiv", () => {
  const alle = [eintrag("2026-08-27-a"), eintrag("2026-08-26-b"), eintrag("2026-08-25-c")];

  it("zieht die Slugs ZUGESTELLTER Notes aus der Liste — und legt sie ins Archiv", () => {
    const { offen, archiv } = teileAuf(
      alle,
      [zugestellt("Neu in der App", "2026-08-26T09:00:00Z", ["2026-08-26-b"])],
      [],
    );
    expect(offen.map((e) => e.slug)).toEqual(["2026-08-27-a", "2026-08-25-c"]);
    expect(archiv).toEqual([
      {
        eintrag: alle[1],
        grund: { art: "zugestellt", titel: "Neu in der App", am: "2026-08-26T09:00:00Z" },
      },
    ]);
  });

  it("zieht die Slugs eines ENTWURFS NICHT ab", () => {
    // Sonst verschwände ein Change, sobald ihn jemand in einen Entwurf gezogen
    // und den Entwurf liegen gelassen hat — für immer unangekündigt.
    const { offen, archiv } = teileAuf(
      alle,
      [{ status: "draft", title: "Liegengeblieben", sent_at: null, entry_slugs: ["2026-08-26-b"] }],
      [],
    );
    expect(offen.map((e) => e.slug)).toEqual(["2026-08-27-a", "2026-08-26-b", "2026-08-25-c"]);
    expect(archiv).toEqual([]);
  });

  it("kommt mit mehreren Notes und Überschneidungen zurecht", () => {
    const { offen } = teileAuf(
      alle,
      [
        zugestellt("Erste", "2026-08-25T09:00:00Z", ["2026-08-26-b", "2026-08-25-c"]),
        zugestellt("Zweite", "2026-08-26T09:00:00Z", ["2026-08-25-c"]),
      ],
      [],
    );
    expect(offen.map((e) => e.slug)).toEqual(["2026-08-27-a"]);
  });

  it("nennt bei zwei Zustellungen die FRÜHERE — unabhängig von der Reihenfolge", () => {
    // Ohne diese Zusage entschiede ein `find()`, und die Antwort hinge still an
    // der Sortierung der Abfrage. Deshalb dieselbe Rechnung zweimal, mit
    // umgedrehter Eingabe.
    const frueh = zugestellt("Die frühe", "2026-08-25T09:00:00Z", ["2026-08-26-b"]);
    const spaet = zugestellt("Die späte", "2026-08-27T09:00:00Z", ["2026-08-26-b"]);

    for (const notes of [
      [frueh, spaet],
      [spaet, frueh],
    ]) {
      const { archiv } = teileAuf(alle, notes, []);
      expect(archiv[0].grund).toEqual({
        art: "zugestellt",
        titel: "Die frühe",
        am: "2026-08-25T09:00:00Z",
      });
    }
  });

  it("legt Übersprungenes ins Archiv, mit eigenem Grund", () => {
    const { offen, archiv } = teileAuf(alle, [], ["2026-08-25-c"]);
    expect(offen.map((e) => e.slug)).toEqual(["2026-08-27-a", "2026-08-26-b"]);
    expect(archiv).toEqual([{ eintrag: alle[2], grund: { art: "nicht-relevant" } }]);
  });

  it("lässt ZUGESTELLT gegen NICHT RELEVANT gewinnen", () => {
    // Ein verschickter Eintrag ist verschickt, egal was vorher jemand angehakt
    // hat — und nur so bleibt „kein Weg zurück" wahr.
    const { archiv } = teileAuf(
      alle,
      [zugestellt("Neu in der App", "2026-08-26T09:00:00Z", ["2026-08-26-b"])],
      ["2026-08-26-b"],
    );
    expect(archiv).toHaveLength(1);
    expect(archiv[0].grund.art).toBe("zugestellt");
  });

  it("gibt ohne Notes und ohne Markierungen alles als offen zurück", () => {
    const { offen, archiv } = teileAuf(alle, [], []);
    expect(offen).toHaveLength(3);
    expect(archiv).toEqual([]);
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

  it("holt für die Admin-Fläche ALLE Zugestellten — ohne Seite und ohne body", async () => {
    // Die Rechnung „was ist archiviert" braucht die vollständige Menge. Eine
    // Seite wäre von „nicht angekündigt" nicht zu unterscheiden und holte
    // Einträge stillschweigend zurück in die Liste (Fremd-Review, HIGH).
    await fetchAngekuendigt();
    const a = aufrufe.find((x) => x.table === "release_notes")!;
    expect(a.eq).toContainEqual(["status", "sent"]);
    expect(a.range).toBeUndefined();
    expect(a.select).not.toContain("body");
  });

  it("liest die Markierungen aus der eigenen Tabelle", async () => {
    await fetchUebersprungene();
    expect(aufrufe.some((x) => x.table === "release_entry_skips")).toBe(true);
  });

  it("markiert über upsert mit ignoreDuplicates — und schickt NUR den Slug", async () => {
    // `insert()` kann `on conflict do nothing` gar nicht ausdrücken; zwei
    // Admins gleichzeitig bekämen sonst einen 23505 zu sehen, wo nichts
    // gestört ist. Und `skipped_by` gehört der Datenbank: die Policy verlangt
    // `= auth.uid()`, ein mitgeschickter Wert würde abgewiesen.
    await markiereUebersprungen("2026-08-27-a");
    const a = aufrufe.find((x) => x.table === "release_entry_skips")!;
    expect(a.args).toEqual({ slug: "2026-08-27-a" });
    expect(a.optionen).toEqual({ onConflict: "slug", ignoreDuplicates: true });
  });

  it("holt über DELETE auf den Slug zurück", async () => {
    await holeZurueck("2026-08-27-a");
    const a = aufrufe.find((x) => x.table === "release_entry_skips")!;
    expect(a.geloescht).toBe(true);
    expect(a.eq).toContainEqual(["slug", "2026-08-27-a"]);
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
