import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reiter, Ordnung, Tags und Beitragstyp als Argumente von `fetchFeed` (AGE-582,
 * Abschnitt 5).
 *
 * GEMOCKT IST NUR DER RAND ZUR DATENBANK. Der Query-Builder zeichnet auf, was
 * `fetchFeed` wirklich anfragt — die Aussagen hier sind über die FORM der
 * Anfrage: welcher Operator, welche Sortierung, welcher Cursor-Ausdruck, welcher
 * Schlüssel.
 *
 * Was dieser Mock NICHT belegen kann, und deshalb woanders steht: dass PostgREST
 * diese Form auch so versteht. Ein aufgezeichnetes `.overlaps(...)` beweist
 * nicht, dass der Server die Vereinigung bildet, und ein aufgezeichneter
 * `or(...)`-Ausdruck beweist nicht, dass zwischen zwei Seiten kein Beitrag
 * durchfällt. Beides läuft in `feed.auswahl.integration.test.ts` gegen den
 * lokalen Stack.
 */

interface Aufruf {
  table: string;
  select?: string;
  order: { spalte: string; ascending?: boolean }[];
  limit?: number;
  or?: string;
  eq: [string, unknown][];
  in?: [string, unknown[]];
  overlaps?: [string, unknown[]];
  contains?: [string, unknown[]];
  not: [string, string, unknown][];
  is: [string, unknown][];
  neq: [string, unknown][];
}

let aufrufe: Aufruf[] = [];
let zeilenJeTabelle: Record<string, Record<string, unknown>[]> = {};

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table, order: [], eq: [], not: [], is: [], neq: [] };
      aufrufe.push(eintrag);
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
        eq: (spalte: string, wert: unknown) => {
          eintrag.eq.push([spalte, wert]);
          return kette;
        },
        in: (spalte: string, werte: unknown[]) => {
          eintrag.in = [spalte, werte];
          return kette;
        },
        overlaps: (spalte: string, werte: unknown[]) => {
          eintrag.overlaps = [spalte, werte];
          return kette;
        },
        contains: (spalte: string, werte: unknown[]) => {
          eintrag.contains = [spalte, werte];
          return kette;
        },
        not: (spalte: string, op: string, wert: unknown) => {
          eintrag.not.push([spalte, op, wert]);
          return kette;
        },
        is: (spalte: string, wert: unknown) => {
          eintrag.is.push([spalte, wert]);
          return kette;
        },
        neq: (spalte: string, wert: unknown) => {
          eintrag.neq.push([spalte, wert]);
          return kette;
        },
        then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
          Promise.resolve({ data: zeilenJeTabelle[table] ?? [], error: null }).then(auf, ab),
      };
      return kette;
    },
    rpc: async () => ({ data: [], error: null }),
  },
}));

import { feedListKey, feedSeitenKey, fetchFeed, type FeedAuswahl } from "./feed";

const ICH = "11111111-1111-1111-1111-111111111111";
const ANDERE = "22222222-2222-2222-2222-222222222222";

function zeile(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    author_id: ANDERE,
    body: "Text",
    hashtags: [],
    visibility: "public",
    created_at: "2026-08-01T10:00:00Z",
    like_count: 0,
    ...extra,
  };
}

const postsAufruf = () => aufrufe.find((a) => a.table === "posts")!;
const auswahl = (teil: Partial<FeedAuswahl> = {}): FeedAuswahl => ({
  reiter: "alle",
  ordnung: "neueste",
  tags: [],
  typ: null,
  ...teil,
});

beforeEach(() => {
  aufrufe = [];
  zeilenJeTabelle = { posts: [zeile("p1")] };
});

describe("5.2 — der stille Fall: kein Reiter ohne Kennung", () => {
  it("„Beiträge von mir“ ohne Kennung entartet NICHT zu „alle Beiträge“", async () => {
    // Ein `if (autorId) query = query.eq(...)` liefert bei fehlender Kennung
    // still den ganzen Bestand. Das ist kein leerer Filter, sondern ein Fehler
    // im Aufrufweg — und er muss laut sein.
    await expect(fetchFeed({ uid: null, reiter: "meine" })).rejects.toThrow(/Kennung/);
  });

  it("und stellt dabei gar keine Anfrage", async () => {
    // Die schärfere Zusage: nicht „liefert nichts“, sondern „fragt nicht“.
    await fetchFeed({ uid: null, reiter: "meine" }).catch(() => {});
    expect(aufrufe.filter((a) => a.table === "posts")).toHaveLength(0);
  });

  it("„Gespeichert“ ohne Kennung ebenso", async () => {
    await expect(fetchFeed({ uid: null, reiter: "gespeichert" })).rejects.toThrow(/Kennung/);
  });

  it("„Alle Beiträge“ ohne Kennung bleibt erlaubt — das Schaufenster", async () => {
    await expect(fetchFeed({ uid: null, reiter: "alle" })).resolves.toBeDefined();
  });

  it("„Beiträge von mir“ filtert auf die eigene Kennung, nicht auf ein Argument", async () => {
    await fetchFeed({ uid: ICH, reiter: "meine" });
    expect(postsAufruf().eq).toContainEqual(["author_id", ICH]);
  });
});

describe("5.3 — mehrere Tags wirken als ODER", () => {
  it("nutzt overlaps, nicht contains", async () => {
    // `contains` verlangt ALLE gewählten Tags am Beitrag (UND) und liefert
    // hinter Auswahlkästchen fast immer eine leere Liste.
    await fetchFeed({ uid: ICH, tags: ["bau", "finanz"] });
    expect(postsAufruf().overlaps).toEqual(["hashtags", ["bau", "finanz"]]);
    expect(postsAufruf().contains).toBeUndefined();
  });

  it("führt den alten Ein-Tag-Filter auf denselben Weg", async () => {
    await fetchFeed({ uid: ICH, hashtag: "bau" });
    expect(postsAufruf().overlaps).toEqual(["hashtags", ["bau"]]);
  });

  it("ohne Tags steht gar kein Tag-Filter in der Anfrage", async () => {
    await fetchFeed({ uid: ICH });
    expect(postsAufruf().overlaps).toBeUndefined();
    expect(postsAufruf().contains).toBeUndefined();
  });
});

describe("5.4 — jede Ordnung hat ihren eigenen Keyset-Pfad", () => {
  it("Neueste zuerst: created_at, id — beide absteigend", async () => {
    await fetchFeed({ uid: ICH, ordnung: "neueste" });
    expect(postsAufruf().order).toEqual([
      { spalte: "created_at", ascending: false },
      { spalte: "id", ascending: false },
    ]);
  });

  it("Älteste zuerst: beide aufsteigend, und der Cursor greift mit gt", async () => {
    await fetchFeed({
      uid: ICH,
      ordnung: "aelteste",
      cursor: { createdAt: "2026-08-01T10:00:00Z", id: "p20" },
    });
    expect(postsAufruf().order).toEqual([
      { spalte: "created_at", ascending: true },
      { spalte: "id", ascending: true },
    ]);
    expect(postsAufruf().or).toBe(
      "created_at.gt.2026-08-01T10:00:00Z,and(created_at.eq.2026-08-01T10:00:00Z,id.gt.p20)",
    );
  });

  it("Beliebteste: like_count führt, created_at und id entscheiden den Gleichstand", async () => {
    await fetchFeed({ uid: ICH, ordnung: "beliebteste" });
    expect(postsAufruf().order).toEqual([
      { spalte: "like_count", ascending: false },
      { spalte: "created_at", ascending: false },
      { spalte: "id", ascending: false },
    ]);
  });

  it("Beliebteste: der Cursor trägt ALLE drei Felder", async () => {
    // Eine Grenze über `like_count` allein überspränge bei gleicher
    // Reaktionszahl still Beiträge — sie stünden weder auf der einen noch auf
    // der nächsten Seite.
    await fetchFeed({
      uid: ICH,
      ordnung: "beliebteste",
      cursor: { createdAt: "2026-08-01T10:00:00Z", id: "p20", likeCount: 7 },
    });
    expect(postsAufruf().or).toBe(
      "like_count.lt.7," +
        "and(like_count.eq.7,created_at.lt.2026-08-01T10:00:00Z)," +
        "and(like_count.eq.7,created_at.eq.2026-08-01T10:00:00Z,id.lt.p20)",
    );
  });

  it("ein Cursor OHNE Reaktionszahl in der Ordnung „Beliebteste“ ist ein Fehler", async () => {
    // Sonst entstünde `like_count.lt.undefined` — eine Anfrage, die der Server
    // abweist oder, schlimmer, still anders auslegt.
    await expect(
      fetchFeed({
        uid: ICH,
        ordnung: "beliebteste",
        cursor: { createdAt: "2026-08-01T10:00:00Z", id: "p20" },
      }),
    ).rejects.toThrow(/likeCount/);
  });

  it("der ausgegebene Cursor trägt die Reaktionszahl nur in „Beliebteste“", async () => {
    zeilenJeTabelle.posts = Array.from({ length: 21 }, (_, i) =>
      zeile(`p${i}`, {
        like_count: 5,
        created_at: `2026-08-01T10:00:${String(i).padStart(2, "0")}Z`,
      }),
    );

    const beliebt = await fetchFeed({ uid: ICH, ordnung: "beliebteste" });
    expect(beliebt.nextCursor).toEqual({
      createdAt: "2026-08-01T10:00:19Z",
      id: "p19",
      likeCount: 5,
    });

    aufrufe = [];
    const neueste = await fetchFeed({ uid: ICH, ordnung: "neueste" });
    expect(neueste.nextCursor).toEqual({ createdAt: "2026-08-01T10:00:19Z", id: "p19" });
  });
});

describe("5.12 — der Typ steht in der Anfrage, nicht in einer Nachfilterung", () => {
  it("Video über video_url", async () => {
    await fetchFeed({ uid: ICH, typ: "video" });
    expect(postsAufruf().not).toContainEqual(["video_url", "is", null]);
  });

  it("Event über kind", async () => {
    await fetchFeed({ uid: ICH, typ: "event" });
    expect(postsAufruf().eq).toContainEqual(["kind", "event"]);
  });

  it("Bild über das Vorhandensein einer post_media-Zeile", async () => {
    await fetchFeed({ uid: ICH, typ: "bild" });
    expect(postsAufruf().not).toContainEqual(["post_media", "is", null]);
    // Ohne die Einbettung im select kennt PostgREST die Beziehung im Filter nicht.
    expect(postsAufruf().select).toContain("post_media(");
  });

  it("Text ist der Beitrag ohne all das — drei Bedingungen, nicht eine", async () => {
    await fetchFeed({ uid: ICH, typ: "text" });
    expect(postsAufruf().is).toContainEqual(["video_url", null]);
    expect(postsAufruf().is).toContainEqual(["post_media", null]);
    expect(postsAufruf().neq).toContainEqual(["kind", "event"]);
  });
});

describe("5.8 / 5.10 — Gespeichert", () => {
  it("der Reiter joint über post_saves, statt IDs im Client nachzukorrigieren", async () => {
    await fetchFeed({ uid: ICH, reiter: "gespeichert" });
    // `!inner` heisst: nur Beiträge mit eigener Speicherzeile. Die RLS von
    // `post_saves` gibt ohnehin nur eigene zurück — sie bleibt das Gate.
    expect(postsAufruf().select).toContain("post_saves!inner(");
  });

  it("die anderen Reiter joinen NICHT — ein anon-Aufruf liefe sonst in 401", async () => {
    await fetchFeed({ uid: null });
    expect(postsAufruf().select).not.toContain("post_saves");
  });

  it("savedByMe kostet EINE Abfrage je Seite, nicht zwanzig", async () => {
    zeilenJeTabelle.posts = Array.from({ length: 20 }, (_, i) => zeile(`p${i}`));
    zeilenJeTabelle.post_saves = [{ post_id: "p3" }];

    const seite = await fetchFeed({ uid: ICH });

    expect(aufrufe.filter((a) => a.table === "post_saves")).toHaveLength(1);
    expect(aufrufe.find((a) => a.table === "post_saves")!.in).toEqual([
      "post_id",
      seite.posts.map((p) => p.id),
    ]);
    expect(seite.posts.find((p) => p.id === "p3")!.savedByMe).toBe(true);
    expect(seite.posts.find((p) => p.id === "p4")!.savedByMe).toBe(false);
  });

  it("ohne Sitzung wird post_saves gar nicht erst gefragt", async () => {
    await fetchFeed({ uid: null });
    expect(aufrufe.filter((a) => a.table === "post_saves")).toHaveLength(0);
  });
});

describe("5.7 — der Query-Schlüssel ist vollständig", () => {
  it("trennt Reiter, Ordnung, Tags und Typ", async () => {
    const basis = feedSeitenKey(ICH, auswahl());
    expect(feedSeitenKey(ICH, auswahl({ reiter: "gespeichert" }))).not.toEqual(basis);
    expect(feedSeitenKey(ICH, auswahl({ ordnung: "beliebteste" }))).not.toEqual(basis);
    expect(feedSeitenKey(ICH, auswahl({ tags: ["bau"] }))).not.toEqual(basis);
    expect(feedSeitenKey(ICH, auswahl({ typ: "bild" }))).not.toEqual(basis);
  });

  it("dieselbe Tagmenge in anderer Reihenfolge ist derselbe Schlüssel", async () => {
    // Sonst lädt ein Haken, der nur die Reihenfolge dreht, die Seite neu.
    expect(feedSeitenKey(ICH, auswahl({ tags: ["finanz", "bau"] }))).toEqual(
      feedSeitenKey(ICH, auswahl({ tags: ["bau", "finanz"] })),
    );
  });

  it("und eine doppelt gewählte Marke zählt einmal", async () => {
    expect(feedSeitenKey(ICH, auswahl({ tags: ["bau", "bau"] }))).toEqual(
      feedSeitenKey(ICH, auswahl({ tags: ["bau"] })),
    );
  });

  it("feedListKey bleibt Präfix — sonst erreicht eine Invalidierung nur eine Fläche", async () => {
    // 5.11: Speichern und Lösen schreiben Kartenzustand UND den Reiter
    // „Gespeichert“ gemeinsam fort. Das trägt der gemeinsame Präfix.
    const praefix = feedListKey(ICH);
    for (const a of [
      auswahl(),
      auswahl({ reiter: "gespeichert" }),
      auswahl({ ordnung: "beliebteste", tags: ["bau"], typ: "video" }),
    ]) {
      expect(feedSeitenKey(ICH, a).slice(0, praefix.length)).toEqual([...praefix]);
    }
  });

  it("und trennt weiterhin nach Betrachter", async () => {
    expect(feedSeitenKey(ICH, auswahl())).not.toEqual(feedSeitenKey(ANDERE, auswahl()));
  });
});
