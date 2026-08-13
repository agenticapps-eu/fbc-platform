import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Events im Feed (AGE-533, C9) — die Datenschicht.
 *
 * Die Zusage, die hier geprüft wird, ist die wichtigste des ganzen Changes:
 * **der Beitrag speichert keinen Event-Inhalt.** Titel, Datum, Ort und
 * Bildpfad kommen über den Fremdschlüssel aus `events`, zur Laufzeit.
 *
 * Gemockt ist nur der Rand zur Datenbank. Der Test behauptet deshalb über die
 * ANFRAGE (wird wirklich eingebettet, und unter dem Namen, den die Migration
 * ausspricht?) und über die ABBILDUNG (kommt der Titel aus dem eingebetteten
 * Objekt?) — nicht über eine nachgebaute Antwort.
 */

interface Aufruf {
  table: string;
  select?: string;
}

let aufrufe: Aufruf[] = [];
let postZeilen: Record<string, unknown>[] = [];

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
        order: () => kette,
        limit: () => kette,
        eq: () => kette,
        not: () => kette,
        or: () => kette,
        contains: () => kette,
        in: () => kette,
        then: (
          auf: (r: { data: unknown; error: null }) => unknown,
          ab?: (e: unknown) => unknown,
        ) =>
          Promise.resolve({
            data: table === "posts" ? postZeilen : [],
            error: null,
          }).then(auf, ab),
      };
      return kette;
    },
    rpc: async () => ({ data: [], error: null }),
  },
}));

import { fetchFeed } from "./feed";

const ICH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function eventZeile(titel: string, event: Record<string, unknown> | null) {
  return {
    id: "p-event",
    author_id: ICH,
    body: "",
    hashtags: null,
    visibility: "public",
    created_at: "2026-08-13T10:00:00Z",
    video_url: null,
    kind: "event",
    ref_id: "e1",
    events: event ?? null,
    _titel: titel,
  };
}

beforeEach(() => {
  aufrufe = [];
  postZeilen = [];
});

describe("Event-Beiträge im Feed", () => {
  it("bettet das Event über den ausgeschriebenen Fremdschlüssel ein", async () => {
    postZeilen = [];

    await fetchFeed({ uid: ICH });

    const posts = aufrufe.find((a) => a.table === "posts");
    // Der Name ist keine Kosmetik: die Migration spricht ihn aus, weil ein von
    // Postgres generierter Name bei jeder Umbenennung still bräche.
    expect(posts?.select).toContain("events!posts_ref_id_fkey");
    expect(posts?.select).toContain("kind");
    expect(posts?.select).toContain("ref_id");
  });

  it("nimmt Titel, Datum und Ort aus dem eingebetteten Event, nicht aus dem Beitrag", async () => {
    postZeilen = [
      eventZeile("Sommerfest", {
        id: "e1",
        title: "Sommerfest",
        starts_at: "2026-08-17T18:00:00Z",
        location: "Hamburg",
        cover_path: "uid/cover.webp",
      }),
    ];

    const seite = await fetchFeed({ uid: ICH });

    expect(seite.posts[0].kind).toBe("event");
    expect(seite.posts[0].event).toEqual({
      id: "e1",
      title: "Sommerfest",
      startsAt: "2026-08-17T18:00:00Z",
      location: "Hamburg",
      coverPath: "uid/cover.webp",
    });
    // Der Beitrag selbst trägt nichts davon.
    expect(seite.posts[0].body).toBe("");
  });

  it("zeigt einen umbenannten Titel sofort — weil gejoint, nicht kopiert", async () => {
    postZeilen = [
      eventZeile("alt", {
        id: "e1",
        title: "Sommerfest",
        starts_at: null,
        location: null,
        cover_path: null,
      }),
    ];
    const vorher = await fetchFeed({ uid: ICH });
    expect(vorher.posts[0].event?.title).toBe("Sommerfest");

    // Nur das EVENT ändert sich, die posts-Zeile bleibt Zeichen für Zeichen
    // dieselbe. Genau das ist die Zusage.
    postZeilen = [
      eventZeile("alt", {
        id: "e1",
        title: "Sommerfest — verlegt",
        starts_at: null,
        location: null,
        cover_path: null,
      }),
    ];
    const nachher = await fetchFeed({ uid: ICH });

    expect(nachher.posts[0].event?.title).toBe("Sommerfest — verlegt");
  });

  it("lässt das Event null, wenn die RLS es nicht herausgibt", async () => {
    // Ist das bezogene Event für den Betrachter nicht lesbar, liefert die
    // Einbettung null. Die Karte entfällt dann — sie erscheint nicht leer.
    postZeilen = [eventZeile("unsichtbar", null)];

    const seite = await fetchFeed({ uid: ICH });

    expect(seite.posts[0].kind).toBe("event");
    expect(seite.posts[0].event).toBeNull();
  });

  it("führt gewöhnliche Beiträge weiterhin als member ohne Event", async () => {
    postZeilen = [
      {
        id: "p1",
        author_id: ICH,
        body: "Ein Text",
        hashtags: [],
        visibility: "members",
        created_at: "2026-08-13T09:00:00Z",
        video_url: null,
        kind: "member",
        ref_id: null,
        events: null,
      },
    ];

    const seite = await fetchFeed({ uid: ICH });

    expect(seite.posts[0].kind).toBe("member");
    expect(seite.posts[0].event).toBeNull();
  });
});
