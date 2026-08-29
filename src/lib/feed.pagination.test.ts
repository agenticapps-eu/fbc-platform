import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Feed lädt seitenweise (AGE-528, Task 5.5/5.7).
 *
 * Gemockt ist nur der Rand zur Datenbank — der Query-Builder zeichnet auf, was
 * `fetchFeed` wirklich anfragt. Die Aussagen sind: wie GROSS ist eine Seite, wie
 * sieht der Cursor aus, und trägt er den `id`-Stichentscheid, ohne den zwei
 * Beiträge mit demselben Zeitstempel übersprungen würden.
 */

interface Aufruf {
  table: string;
  select?: string;
  order: { spalte: string; ascending?: boolean }[];
  limit?: number;
  or?: string;
  in?: [string, unknown[]];
}

let aufrufe: Aufruf[] = [];
let postZeilen: Record<string, unknown>[] = [];
let mediaZeilen: Record<string, unknown>[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table, order: [] };
      aufrufe.push(eintrag);
      const daten = () =>
        table === "posts" ? postZeilen : table === "post_media" ? mediaZeilen : [];
      const kette = {
        select: (spalten: string) => {
          eintrag.select = spalten;
          return kette;
        },
        order: (spalte: string, opts?: { ascending?: boolean }) => {
          eintrag.order.push({ spalte, ascending: opts?.ascending });
          return kette;
        },
        limit: (n: number) => {
          eintrag.limit = n;
          return kette;
        },
        or: (ausdruck: string) => {
          eintrag.or = ausdruck;
          return kette;
        },
        contains: () => kette,
        in: (spalte: string, werte: unknown[]) => {
          eintrag.in = [spalte, werte];
          return kette;
        },
        then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
          Promise.resolve({ data: daten(), error: null }).then(auf, ab),
      };
      return kette;
    },
    rpc: async () => ({ data: [], error: null }),
  },
}));

import { FEED_SEITE, fetchFeed } from "./feed";

const AUTOR = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function zeile(id: string, zeitpunkt: string) {
  return {
    id,
    author_id: AUTOR,
    body: "Text",
    hashtags: [],
    visibility: "public",
    created_at: zeitpunkt,
    // Seit AGE-667 ist `veroeffentlicht_ab` die Ordnung des Feeds und das
    // führende Feld des Cursors. Beide Spalten tragen hier denselben Moment:
    // diese Datei misst die SEITENGRENZE, nicht die Planung, und ein
    // Unterschied zwischen beiden hätte hier keine Bedeutung.
    veroeffentlicht_ab: zeitpunkt,
  };
}

const postsAufruf = () => aufrufe.find((a) => a.table === "posts")!;

beforeEach(() => {
  aufrufe = [];
  postZeilen = [];
  mediaZeilen = [];
});

describe("fetchFeed — Seiten", () => {
  it("holt 20 Beiträge, absteigend über veroeffentlicht_ab UND id", async () => {
    postZeilen = [zeile("p1", "2026-08-01T10:00:00Z")];

    await fetchFeed({ uid: null });

    expect(FEED_SEITE).toBe(20);
    expect(postsAufruf().limit).toBe(FEED_SEITE + 1);
    // Beide Spalten in der Sortierung, sonst ist der Cursor unten wirkungslos:
    // ein Stichentscheid im `where` ohne denselben im `order by` ordnet nichts.
    // AGE-667: die führende Spalte ist `veroeffentlicht_ab`, nicht
    // `created_at`. Sie MUSS dieselbe sein wie im Cursor unten — eine Grenze
    // über eine andere Spalte als die Ordnung überspringt Zeilen oder liefert
    // sie doppelt.
    expect(postsAufruf().order).toEqual([
      { spalte: "veroeffentlicht_ab", ascending: false },
      { spalte: "id", ascending: false },
    ]);
    expect(postsAufruf().or).toBeUndefined();
  });

  it("fragt eine Zeile mehr an, als die Seite trägt", async () => {
    // Der Spähzeile wegen: ohne sie wüsste niemand, ob es weitergeht. Eine
    // volle Seite allein ist kein Beweis — bei genau 20 sichtbaren Beiträgen
    // verspräche sie eine nächste Seite, die garantiert leer ist.
    postZeilen = [zeile("p1", "2026-08-01T10:00:00Z")];

    await fetchFeed({ uid: null });

    expect(postsAufruf().limit).toBe(FEED_SEITE + 1);
  });

  it("gibt genau 20 Beiträge zurück und den Cursor der 20., wenn eine 21. Zeile kam", async () => {
    postZeilen = Array.from({ length: 21 }, (_, i) =>
      zeile(`p${i}`, `2026-08-01T10:00:${String(i).padStart(2, "0")}Z`),
    );

    const seite = await fetchFeed({ uid: null });

    expect(seite.posts).toHaveLength(20);
    expect(seite.posts.at(-1)?.id).toBe("p19");
    expect(seite.nextCursor).toEqual({ veroeffentlichtAb: "2026-08-01T10:00:19Z", id: "p19" });
  });

  it("genau 20 sichtbare Beiträge versprechen KEINE weitere Seite", async () => {
    // Der Fall aus dem Diff-Review: vorher kam hier ein Cursor heraus, und
    // „Ältere Beiträge" holte eine garantiert leere Seite, bevor der Knopf
    // verschwand.
    postZeilen = Array.from({ length: 20 }, (_, i) =>
      zeile(`p${i}`, `2026-08-01T10:00:${String(i).padStart(2, "0")}Z`),
    );

    const seite = await fetchFeed({ uid: null });

    expect(seite.posts).toHaveLength(20);
    expect(seite.nextCursor).toBeNull();
  });

  it("keine volle Seite heißt: nichts mehr nachzuladen", async () => {
    postZeilen = [zeile("p1", "2026-08-01T10:00:00Z")];

    expect((await fetchFeed({ uid: null })).nextCursor).toBeNull();
  });

  it("der Cursor trägt den id-Stichentscheid, sonst verschwinden gleiche Zeitstempel", async () => {
    // Der Fall, der beim Import der ~70 Konten wahrscheinlich wird: zwei
    // Beiträge mit identischem `veroeffentlicht_ab`. Ein Cursor nur über die
    // Zeit (`veroeffentlicht_ab.lt.X`) überspränge den zweiten still — er ist
    // weder auf Seite 1 noch auf Seite 2.
    postZeilen = [zeile("p21", "2026-08-01T09:00:00Z")];

    await fetchFeed({
      uid: null,
      cursor: { veroeffentlichtAb: "2026-08-01T10:00:00Z", id: "p20" },
    });

    expect(postsAufruf().or).toBe(
      "veroeffentlicht_ab.lt.2026-08-01T10:00:00Z," +
        "and(veroeffentlicht_ab.eq.2026-08-01T10:00:00Z,id.lt.p20)",
    );
  });
});

describe("fetchFeed — Bilder", () => {
  it("liest die Bildzeilen der Seite mit und hängt sie geordnet an ihren Beitrag", async () => {
    postZeilen = [zeile("p1", "2026-08-01T10:00:00Z"), zeile("p2", "2026-08-01T09:00:00Z")];
    mediaZeilen = [
      { post_id: "p1", storage_path: "u/p1/1-2.webp", sort: 1, width: 800, height: 600 },
      { post_id: "p1", storage_path: "u/p1/0-1.webp", sort: 0, width: 1600, height: 1200 },
    ];

    const seite = await fetchFeed({ uid: null });

    const media = aufrufe.find((a) => a.table === "post_media")!;
    expect(media.in).toEqual(["post_id", ["p1", "p2"]]);
    expect(seite.posts[0].media).toEqual([
      { storagePath: "u/p1/0-1.webp", sort: 0, width: 1600, height: 1200 },
      { storagePath: "u/p1/1-2.webp", sort: 1, width: 800, height: 600 },
    ]);
    expect(seite.posts[1].media).toEqual([]);
  });
});
