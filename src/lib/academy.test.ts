import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Academy-lite (AGE-533, C9): die Academy ist eine gefilterte Sicht auf `posts`,
 * kein eigenes Datenmodell.
 *
 * Gemockt ist nur der Rand zur Datenbank — der Query-Builder zeichnet auf, was
 * wirklich angefragt wird. Die Aussagen sind deshalb über die ANFRAGE, nicht
 * über eine nachgebaute Antwort:
 *
 *  - „Alle" filtert auf `video_url is not null` und sonst nichts. Insbesondere
 *    setzt die Academy KEIN Sichtbarkeitsprädikat — das entscheidet die RLS,
 *    wie im Feed. Ein Test, der das nicht prüft, übersähe genau den Fall, in
 *    dem jemand die Sichtbarkeit ins Frontend zöge.
 *  - „Meine" filtert zusätzlich auf den Autor.
 *  - Das zweite Regal geht über die EIGENEN `post_likes` und sortiert nach dem
 *    Zeitpunkt des Likes, nicht des Beitrags.
 */

interface Aufruf {
  table: string;
  select?: string;
  order: { spalte: string; ascending?: boolean }[];
  limit?: number;
  eq: [string, unknown][];
  not: [string, string, unknown][];
  or?: string;
}

let aufrufe: Aufruf[] = [];
let postZeilen: Record<string, unknown>[] = [];
let likeZeilen: Record<string, unknown>[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table, order: [], eq: [], not: [] };
      aufrufe.push(eintrag);
      const daten = () =>
        table === "posts" ? postZeilen : table === "post_likes" ? likeZeilen : [];
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
        eq: (spalte: string, wert: unknown) => {
          eintrag.eq.push([spalte, wert]);
          return kette;
        },
        not: (spalte: string, op: string, wert: unknown) => {
          eintrag.not.push([spalte, op, wert]);
          return kette;
        },
        or: (ausdruck: string) => {
          eintrag.or = ausdruck;
          return kette;
        },
        contains: () => kette,
        in: () => kette,
        then: (
          auf: (r: { data: unknown; error: null }) => unknown,
          ab?: (e: unknown) => unknown,
        ) => Promise.resolve({ data: daten(), error: null }).then(auf, ab),
      };
      return kette;
    },
    rpc: async () => ({ data: [], error: null }),
  },
}));

import { fetchGelikteVideos } from "./academy";
import { fetchFeed } from "./feed";

const ICH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function postZeile(id: string, createdAt: string, videoUrl: string | null) {
  return {
    id,
    author_id: ICH,
    body: "text",
    hashtags: [],
    visibility: "members",
    created_at: createdAt,
    video_url: videoUrl,
    kind: "member",
    ref_id: null,
  };
}

beforeEach(() => {
  aufrufe = [];
  postZeilen = [];
  likeZeilen = [];
});

describe("Academy „Alle“", () => {
  it("filtert auf Beiträge mit Video — und setzt kein Sichtbarkeitsprädikat", async () => {
    postZeilen = [postZeile("p1", "2026-08-13T10:00:00Z", "https://youtu.be/a")];

    await fetchFeed({ uid: ICH, nurVideos: true });

    const posts = aufrufe.find((a) => a.table === "posts");
    expect(posts?.not).toContainEqual(["video_url", "is", null]);
    // Die Academy filtert NICHT nach Sichtbarkeit: das tut die RLS.
    expect(posts?.eq.map(([spalte]) => spalte)).not.toContain("visibility");
    // Und sie filtert nicht nach Autor — das ist der Unterschied zu „Meine".
    expect(posts?.eq.map(([spalte]) => spalte)).not.toContain("author_id");
  });

  it("reicht die Video-URL aus der Spalte durch, statt sie erneut zu parsen", async () => {
    postZeilen = [postZeile("p1", "2026-08-13T10:00:00Z", "https://vimeo.com/7")];

    const seite = await fetchFeed({ uid: ICH, nurVideos: true });

    expect(seite.posts[0].videoUrl).toBe("https://vimeo.com/7");
  });
});

describe("Academy „Meine Academy“ — Regal „selbst geteilt“", () => {
  it("filtert zusätzlich auf den eigenen Autor", async () => {
    postZeilen = [postZeile("p1", "2026-08-13T10:00:00Z", "https://youtu.be/a")];

    await fetchFeed({ uid: ICH, nurVideos: true, autorId: ICH });

    const posts = aufrufe.find((a) => a.table === "posts");
    expect(posts?.not).toContainEqual(["video_url", "is", null]);
    expect(posts?.eq).toContainEqual(["author_id", ICH]);
  });
});

describe("Academy „Meine Academy“ — Regal „gefällt mir“", () => {
  it("liest die eigenen Likes und sortiert nach dem Zeitpunkt des Likes", async () => {
    likeZeilen = [
      {
        post_id: "p1",
        created_at: "2026-08-13T12:00:00Z",
        posts: postZeile("p1", "2026-01-01T10:00:00Z", "https://youtu.be/a"),
      },
    ];

    await fetchGelikteVideos({ uid: ICH });

    const likes = aufrufe.find((a) => a.table === "post_likes");
    expect(likes).toBeDefined();
    // Sortiert nach dem LIKE, nicht nach dem Beitrag: das Regal beantwortet
    // „was habe ich zuletzt markiert", nicht „was ist neu".
    expect(likes?.order[0]).toEqual({ spalte: "created_at", ascending: false });
    // Der Filter auf das Video sitzt am eingebetteten Beitrag, damit die
    // Seitengröße stimmt — nachträgliches Wegwerfen ergäbe kürzere Seiten.
    expect(likes?.not).toContainEqual(["posts.video_url", "is", null]);
  });

  it("gibt ohne Session nichts zurück, statt eine verbotene Abfrage abzusetzen", async () => {
    const seite = await fetchGelikteVideos({ uid: null });

    expect(seite.posts).toEqual([]);
    expect(aufrufe).toHaveLength(0);
  });

  it("lässt ein nicht mehr lesbares Video lautlos weg", async () => {
    // Der Like bleibt liegen, der Beitrag ist für die RLS nicht mehr da: der
    // eingebettete Beitrag kommt als null zurück. Kein Platzhalter, keine Lücke.
    likeZeilen = [
      { post_id: "p1", created_at: "2026-08-13T12:00:00Z", posts: null },
      {
        post_id: "p2",
        created_at: "2026-08-13T11:00:00Z",
        posts: postZeile("p2", "2026-01-01T10:00:00Z", "https://youtu.be/b"),
      },
    ];

    const seite = await fetchGelikteVideos({ uid: ICH });

    expect(seite.posts.map((p) => p.id)).toEqual(["p2"]);
  });
});
