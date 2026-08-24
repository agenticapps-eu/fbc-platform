import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * „Ehemaliges Mitglied" — der Feed unterscheidet zurückgezogen von entfernt
 * (AGE-581, Abschnitt 10).
 *
 * ── WARUM BEIDE AUTOREN IN EINEM TEST STEHEN ────────────────────────────────
 * Aus `profiles_public` fällt ein Autor heute aus VIER Gründen heraus:
 * `is_public = false`, nie bestätigt, `disabled_at`, `deleted_at`
 * (`20260823120000_member_lifecycle_schema.sql:234`). Alle vier landen auf
 * demselben Rückfall. Ein Test, der nur den entfernten Autor prüft, wäre auch
 * dann grün, wenn JEDER fehlende Autor „Ehemaliges Mitglied" hiesse — und
 * genau das ist der Fehler, den das Delta ausschliesst: der Feed hätte für
 * „Autor fehlt" zwei Ursachen, die gleich aussehen. Die Zusage ist die
 * UNTERSCHEIDUNG, also muss ein Test sie an zwei Zeilen nebeneinander messen.
 *
 * Gemockt ist nur der Rand zur Datenbank. Die Regel, wer entfernt ist, steht
 * NICHT hier — sie steht in `former_member_entries`
 * (`20260823160000_former_member_entries.sql`) und wird von
 * `supabase/tests/member_lifecycle_test.sql` geprüft. Dieser Test prüft, dass
 * der Lesepfad die Auskunft holt und richtig verteilt.
 */

const OEFFENTLICH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ZURUECKGEZOGEN = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ENTFERNT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

/** Welche RPCs wurden mit welchen Argumenten gerufen? Trägt 10.2. */
let rpcs: { name: string; args: unknown }[] = [];
let angefragt: string[] = [];

const POSTS = [
  {
    id: "p-oeffentlich",
    author_id: OEFFENTLICH,
    body: "Von einem sichtbaren Profil",
    hashtags: [],
    visibility: "members",
    created_at: "2026-08-03T10:00:00Z",
    video_url: null,
    kind: "member",
    ref_id: null,
    events: null,
  },
  {
    id: "p-zurueck",
    author_id: ZURUECKGEZOGEN,
    body: "Von einem Mitglied, das sein Profil nicht öffentlich stellt",
    hashtags: [],
    visibility: "members",
    created_at: "2026-08-02T10:00:00Z",
    video_url: null,
    kind: "member",
    ref_id: null,
    events: null,
  },
  {
    id: "p-entfernt",
    author_id: ENTFERNT,
    body: "Von einem gelöschten Mitglied",
    hashtags: [],
    visibility: "members",
    created_at: "2026-08-01T10:00:00Z",
    video_url: null,
    kind: "member",
    ref_id: null,
    events: null,
  },
];

const KOMMENTARE = [
  {
    id: "k-zurueck",
    post_id: "p-oeffentlich",
    author_id: ZURUECKGEZOGEN,
    body: "Kommentar eines zurückgezogenen Mitglieds",
    created_at: "2026-08-03T11:00:00Z",
  },
  {
    id: "k-entfernt",
    post_id: "p-oeffentlich",
    author_id: ENTFERNT,
    body: "Kommentar eines gelöschten Mitglieds",
    created_at: "2026-08-03T12:00:00Z",
  },
];

/**
 * Welche Einträge gelten der Datenbank als entfernt? Der Mock leitet seine
 * Antwort DARAUS ab, statt eine feste Liste zurückzugeben — sonst antwortete
 * er auf jede Frage dasselbe, und ein Aufruf mit anderen IDs (etwa der zweite
 * Block eines langen Fadens) bekäme trotzdem die Antwort des ersten.
 */
const ENTFERNTE_EINTRAEGE = new Set(["p-entfernt", "k-entfernt"]);

/** Die Kommentarzeilen, die der Stub liefert — je Test setzbar. */
let kommentarzeilen: Record<string, unknown>[] = KOMMENTARE;

/** Nur der öffentliche Autor steht drin — die beiden anderen fehlen, aus
 *  verschiedenen Gründen, und genau die soll der Feed auseinanderhalten. */
const ZEILEN: Record<string, Record<string, unknown>[]> = {
  posts: POSTS,
  get comments() {
    return kommentarzeilen;
  },
  profiles_public: [
    { id: OEFFENTLICH, name: "Jonas Keller", avatar_url: "https://x/a.webp", tier: "impact" },
  ],
  post_media: [],
  post_likes: [],
};

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      angefragt.push(table);
      const daten = () => ZEILEN[table] ?? [];
      const kette: Record<string, unknown> = {
        select: () => kette,
        order: () => kette,
        limit: () => kette,
        or: () => kette,
        not: () => kette,
        contains: () => kette,
        eq: () => kette,
        in: () => kette,
        maybeSingle: async () => ({ data: daten()[0] ?? null, error: null }),
        then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
          Promise.resolve({ data: daten(), error: null }).then(auf, ab),
      };
      return kette;
    },
    rpc: async (name: string, args: unknown) => {
      rpcs.push({ name, args });
      if (name === "former_member_entries") {
        const { p_post_ids = [], p_comment_ids = [] } = (args ?? {}) as {
          p_post_ids?: string[];
          p_comment_ids?: string[];
        };
        // Die echte Funktion bricht über 200 Einträgen mit `22023` ab
        // (`20260823160000_former_member_entries.sql`). Der Stub tut es auch —
        // ein Mock, der grosszügiger ist als die Datenbank, macht aus einem
        // Laufzeitfehler in Prod einen grünen Test.
        if (p_post_ids.length + p_comment_ids.length > 200) {
          return { data: null, error: { code: "22023", message: "zu viele Eintraege" } };
        }
        // Sie antwortet je Eintrag, nicht je Profil — und AUCH für die nicht
        // entfernten, mit `former = false`.
        return {
          data: [
            ...p_post_ids.map((id) => ({
              kind: "post",
              entry_id: id,
              former: ENTFERNTE_EINTRAEGE.has(id),
            })),
            ...p_comment_ids.map((id) => ({
              kind: "comment",
              entry_id: id,
              former: ENTFERNTE_EINTRAEGE.has(id),
            })),
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    },
  },
}));

import { fetchComments, fetchFeed } from "./feed";

beforeEach(() => {
  rpcs = [];
  angefragt = [];
  kommentarzeilen = KOMMENTARE;
});

describe("Feed — zurückgezogen ist nicht dasselbe wie entfernt (10.1)", () => {
  it("nennt den zurückgezogenen Autor „Ein Mitglied“ und den entfernten „Ehemaliges Mitglied“", async () => {
    const seite = await fetchFeed({ uid: "ich" });

    const nach = (id: string) => seite.posts.find((p) => p.id === id)!;

    // Der aufgelöste Autor bleibt unangetastet — sonst prüfte der Test nur,
    // dass irgendetwas maskiert wird.
    expect(nach("p-oeffentlich").author.name).toBe("Jonas Keller");
    expect(nach("p-oeffentlich").author.former).toBe(false);

    // Da, zeigt sich nur nicht.
    expect(nach("p-zurueck").author.name).toBe("Ein Mitglied");
    expect(nach("p-zurueck").author.former).toBe(false);

    // Weg.
    expect(nach("p-entfernt").author.name).toBe("Ehemaliges Mitglied");
    expect(nach("p-entfernt").author.former).toBe(true);
  });

  it("gibt dem entfernten Autor weder Bild noch Stufe", async () => {
    const seite = await fetchFeed({ uid: "ich" });
    const entfernt = seite.posts.find((p) => p.id === "p-entfernt")!.author;

    expect(entfernt.avatarUrl).toBeNull();
    expect(entfernt.tier).toBeNull();
  });
});

describe("Kommentare — derselbe Unterschied (10.4)", () => {
  it("neutralisiert auch Kommentarautoren, und nur die entfernten", async () => {
    // Ein Faden, in dem nur die Beiträge neutral sind, hält die Zusage nicht:
    // derselbe Mensch stünde als Kommentator weiter mit Namen da.
    const kommentare = await fetchComments("ich", "p-oeffentlich");

    const nach = (id: string) => kommentare.find((k) => k.id === id)!;
    expect(nach("k-zurueck").author.name).toBe("Ein Mitglied");
    expect(nach("k-entfernt").author.name).toBe("Ehemaliges Mitglied");
    expect(nach("k-entfernt").author.former).toBe(true);
  });
});

describe("Die Auskunft wird nur mit Session geholt (10.2)", () => {
  it("ruft former_member_entries ausgeloggt gar nicht erst auf", async () => {
    // `execute` liegt bei `authenticated`, `anon` ist es entzogen
    // (`20260823160000_former_member_entries.sql`). Ausgeloggt käme also ein
    // 401 zurück — dieselbe Regel wie für die Autorenabfrage (AGE-530).
    await fetchFeed({ uid: null });

    expect(rpcs.map((r) => r.name)).not.toContain("former_member_entries");
  });

  it("übergibt eingeloggt die Beitrags-IDs, keine Profil-IDs", async () => {
    // Die Funktion nimmt bewusst Beitrags- statt Profil-IDs entgegen: nur so
    // kann sie die Sichtbarkeit selbst prüfen, statt sie dem Aufrufer zu
    // glauben. Ein Aufruf, der ihr Profil-IDs gäbe, verfehlte die Signatur.
    await fetchFeed({ uid: "ich" });

    const auskunft = rpcs.find((r) => r.name === "former_member_entries");
    expect(auskunft).toBeDefined();
    expect(auskunft!.args).toEqual({
      p_post_ids: ["p-oeffentlich", "p-zurueck", "p-entfernt"],
      p_comment_ids: [],
    });
  });
});

describe("Ein langer Faden reisst die Grenze der Funktion nicht", () => {
  it("fragt in Blöcken von höchstens 200 und neutralisiert auch den letzten Kommentar", async () => {
    // `fetchComments` holt ALLE Kommentare eines Beitrags, ungedeckelt — die
    // Funktion nimmt höchstens 200 IDs und bricht darüber mit `22023` ab. Ein
    // einziger Aufruf mit 201 IDs nähme dem GANZEN Faden die Unterscheidung,
    // auch den ersten zweihundert: der Fehlerpfad ist „best effort", der
    // Faden bliebe lesbar und jeder entfernte Autor hiesse wieder
    // „Ein Mitglied".
    kommentarzeilen = [
      ...Array.from({ length: 200 }, (_, i) => ({
        id: `k-masse-${i}`,
        post_id: "p-oeffentlich",
        author_id: ZURUECKGEZOGEN,
        body: `Kommentar ${i}`,
        created_at: "2026-08-03T11:00:00Z",
      })),
      {
        id: "k-entfernt",
        post_id: "p-oeffentlich",
        author_id: ENTFERNT,
        body: "Der 201. Kommentar",
        created_at: "2026-08-03T13:00:00Z",
      },
    ];

    const kommentare = await fetchComments("ich", "p-oeffentlich");

    const aufrufe = rpcs.filter((r) => r.name === "former_member_entries");
    expect(aufrufe).toHaveLength(2);
    for (const a of aufrufe) {
      const { p_post_ids, p_comment_ids } = a.args as {
        p_post_ids: string[];
        p_comment_ids: string[];
      };
      expect(p_post_ids.length + p_comment_ids.length).toBeLessThanOrEqual(200);
    }

    // Und die Auskunft kommt beim 201. auch wirklich an — das ist die Zusage,
    // die Zahl der Aufrufe ist nur der Weg dorthin.
    expect(kommentare.find((k) => k.id === "k-entfernt")!.author.name).toBe("Ehemaliges Mitglied");
    expect(kommentare.find((k) => k.id === "k-masse-0")!.author.name).toBe("Ein Mitglied");
  });
});
