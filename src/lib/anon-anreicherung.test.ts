import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ohne Session wird nicht abgefragt, was ohne Session nicht lesbar ist (AGE-530).
 *
 * Die Aussage steht am **Netzwerkverkehr**, nicht am Aussehen — und das ist der
 * ganze Punkt: `displayAuthor` maskiert ausgeloggt ohnehin, ein Test auf die
 * gerenderte Zeile wäre vorher wie nachher grün und bewiese nichts. Der Stub
 * zeichnet deshalb auf, WELCHE Relationen angefragt werden.
 *
 * Zwei Relationen sind für `anon` gesperrt und liefern heute je einen 401:
 * `profiles_public` (Autoren, Profil-Hosts) und `partners` (Partner-Hosts,
 * `20260715140000_explicit_grants.sql:62`). Beide dürfen ausgeloggt gar nicht
 * erst angefragt werden.
 *
 * Gemockt ist nur der Rand zur Datenbank. Die Gegenprobe (eingeloggt wird beides
 * weiterhin angefragt UND aufgelöst) steht in denselben Tests, damit die
 * Bedingung nicht zu breit greifen kann.
 */

let angefragt: string[] = [];
/**
 * Welche SPALTEN wurden je Relation angefragt? Der Mock verwarf das Argument
 * von `select()` bisher — eine Fixture beantwortet dann jede Projektion gleich,
 * und ein entfernter Spaltenname fiele niemandem auf. Befund aus dem
 * Diff-Review zum Layout-Nachzug (AGE-531).
 */
let spalten: Record<string, string> = {};

const AUTOR = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PARTNER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const ZEILEN: Record<string, Record<string, unknown>[]> = {
  posts: [
    {
      id: "p1",
      author_id: AUTOR,
      body: "Text",
      hashtags: [],
      visibility: "public",
      created_at: "2026-08-01T10:00:00Z",
    },
  ],
  events: [
    {
      id: "e1",
      title: "Sommerfest",
      type: "dinner",
      starts_at: "2026-09-01T18:00:00Z",
      location: "Wien",
      visibility: "public",
      capacity: null,
      host_id: AUTOR,
      host_partner_id: null,
    },
    {
      id: "e2",
      title: "Partnerabend",
      type: "online",
      starts_at: "2026-09-02T18:00:00Z",
      location: null,
      visibility: "public",
      capacity: null,
      host_id: null,
      host_partner_id: PARTNER,
    },
  ],
  profiles_public: [
    {
      id: AUTOR,
      name: "Jonas Keller",
      avatar_url: "https://x/a.webp",
      tier: "impact",
      // Seit dem Layout-Nachzug zu AGE-531 wählt `hostsFor` drei Spalten mehr
      // aus derselben Abfrage; sie füllen die Veranstalter-Karte.
      company: "Keller GmbH",
      roles: ["Gründer"],
      short_bio: "Baut Dinge.",
    },
  ],
  partners: [
    {
      id: PARTNER,
      name: "Musterpartner",
      logo_url: "https://x/p.png",
      description: "Ein Partner.",
    },
  ],
  post_media: [],
  event_registrations: [],
  comments: [
    {
      id: "c1",
      post_id: "p1",
      author_id: AUTOR,
      body: "Kommentar",
      created_at: "2026-08-01T11:00:00Z",
    },
  ],
};

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      angefragt.push(table);
      const daten = () => ZEILEN[table] ?? [];
      const kette: Record<string, unknown> = {
        select: (spalte?: string) => {
          if (typeof spalte === "string") spalten[table] = spalte;
          return kette;
        },
        order: () => kette,
        limit: () => kette,
        or: () => kette,
        contains: () => kette,
        eq: () => kette,
        in: () => kette,
        maybeSingle: async () => ({ data: daten()[0] ?? null, error: null }),
        then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
          Promise.resolve({ data: daten(), error: null }).then(auf, ab),
      };
      return kette;
    },
    rpc: async () => ({ data: [], error: null }),
  },
}));

import { fetchComments, fetchFeed } from "./feed";
import { fetchEvent, fetchEvents } from "./events";

beforeEach(() => {
  angefragt = [];
  spalten = {};
});

/**
 * Die Positivliste aus `20260715140000_explicit_grants.sql` — mehr darf `anon`
 * nicht lesen. Alles andere ist ein 401, egal wie plausibel der Aufruf aussieht.
 *
 * ── WIE WEIT DIESER WÄCHTER REICHT (AGE-291, gemessen 2026-08-13) ───────────
 *
 * Er wird gern als allgemeines Geländer zitiert („ausgeloggt kann nichts
 * austreten, das prüft ja der Test"). Das ist er NICHT, und die Grenze ist
 * gemessen, nicht geschätzt — mit zwei Eingriffen, die ihn GRÜN ließen:
 *
 *   1. **Nur die hier aufgerufenen Lesepfade.** Der Test ruft `fetchFeed`,
 *      `fetchEvents`, `fetchEvent` und `fetchComments` auf — mehr nicht. Eine
 *      NEUE Datei mit eigenem `supabase.from(...)` läuft nie durch diesen
 *      Aufruf und bleibt unbemerkt.
 *   2. **Keine Funktionsaufrufe.** Der Stub unten beantwortet `rpc()`, ohne den
 *      NAMEN festzuhalten. Eine für `anon` ausführbare `SECURITY DEFINER`-RPC —
 *      etwa eine öffentliche Suche — liefe vollständig daran vorbei.
 *
 * WAS ER LEISTET: er fängt einen bisher unbekannten Verstoß INNERHALB dieses
 * Aufrufgraphen, ohne dass ihn jemand vorher erraten muss. Das ist der Grund
 * für die Positivliste statt einer Ausschlussliste, und es ist viel wert — nur
 * eben nicht alles.
 *
 * WER EINEN NEUEN AUSGELOGGT ERREICHBAREN LESEPFAD BAUT, bringt seinen EIGENEN
 * negativen Nachweis mit und beruft sich nicht auf diese Liste. Steht so als
 * Anforderung in `openspec/specs/directory-search/spec.md`. Wird der neue Pfad
 * über eine der vier Funktionen oben erreichbar, gehört er zusätzlich in den
 * Aufruf in „Die Regel, nicht der Einzelfall" — sonst wächst die Lücke.
 */
const ANON_DARF_LESEN = [
  "badges",
  "membership_tiers",
  "partner_categories",
  "posts",
  "events",
  "tags",
  "post_media",
];

describe("Die Regel, nicht der Einzelfall", () => {
  it("fragt ausgeloggt ausschließlich Relationen an, die anon lesen darf", async () => {
    // Drei Verstöße hat dieser Change einzeln gefunden (profiles_public, partners,
    // comments) — jedes Mal, weil ein Lesepfad die Session nicht kannte. Diese
    // Zeile prüft nicht mehr den Einzelfall, sondern die Regel: ein vierter fiele
    // hier auf, ohne dass jemand ihn vorher erraten muss.
    await fetchFeed({ uid: null });
    await fetchEvents(null);
    await fetchEvent(null, "e1");
    await fetchComments(null, "p1");

    expect([...new Set(angefragt)].filter((t) => !ANON_DARF_LESEN.includes(t))).toEqual([]);
  });
});

describe("Feed — Autoren", () => {
  it("fragt ausgeloggt profiles_public gar nicht erst an", async () => {
    const seite = await fetchFeed({ uid: null });

    expect(angefragt).not.toContain("profiles_public");
    // Und der Feed liefert trotzdem seine Beiträge — die Sperre nimmt nichts mit.
    expect(seite.posts).toHaveLength(1);
    // „Ein Mitglied", nicht „Mitglied": der Rückfall in `authorOf` heisst seit
    // AGE-581 wie die Maskierung von `displayAuthor`, weil es derselbe
    // Sachverhalt ist — da, zeigt sich nur nicht. Ausgeloggt ist der Wert
    // ohnehin nicht sichtbar (`displayAuthor` maskiert), aber dieser Test
    // misst die Datenschicht, und dort steht er.
    expect(seite.posts[0].author.name).toBe("Ein Mitglied");
    expect(seite.posts[0].author.avatarUrl).toBeNull();
    expect(seite.posts[0].author.tier).toBeNull();
  });

  it("fragt eingeloggt weiterhin an und löst den Autor auf", async () => {
    const seite = await fetchFeed({ uid: "me" });

    expect(angefragt).toContain("profiles_public");
    expect(seite.posts[0].author.name).toBe("Jonas Keller");
    expect(seite.posts[0].author.avatarUrl).toBe("https://x/a.webp");
    expect(seite.posts[0].author.tier).toBe("impact");
  });
});

describe("Kommentare — Autoren", () => {
  it("fragt ohne Session gar nicht erst nach Kommentaren", async () => {
    // Aufklappen kann ein ausgeloggter Besucher den Thread nicht (der Knopf ist
    // `disabled`), aber ER KANN SICH ABMELDEN, WÄHREND ER OFFEN IST: der Thread
    // bleibt montiert, der Query-Key wechselt auf uid = null und React Query holt
    // nach. `comments` trägt sein select nur für `authenticated` — das wäre der
    // dritte 401. Aus dem Diff-Review (codex).
    const kommentare = await fetchComments(null, "p1");

    expect(angefragt).not.toContain("comments");
    expect(angefragt).not.toContain("profiles_public");
    expect(kommentare).toEqual([]);
  });

  it("löst eingeloggt die Kommentar-Autoren weiterhin auf", async () => {
    // Diese Zeile ist der Grund, warum `fetchComments` das `uid` mitbekommen MUSS:
    // ohne es liefe die Anreicherung hier ins Leere und eingeloggte Leser sähen an
    // jedem Kommentar den Rückfall. Ausgeloggt gibt es diesen Pfad nicht —
    // `comments` trägt sein select nur für `authenticated`.
    const kommentare = await fetchComments("me", "p1");

    expect(angefragt).toContain("profiles_public");
    expect(kommentare[0].author.name).toBe("Jonas Keller");
    expect(kommentare[0].author.avatarUrl).toBe("https://x/a.webp");
  });
});

describe("Events — Hosts", () => {
  it("fragt ausgeloggt weder profiles_public noch partners an", async () => {
    // Beide Relationen sind für anon gesperrt. Eine Regel, die nur die
    // Profil-Hälfte überspränge, ließe den zweiten 401 stehen.
    const events = await fetchEvents(null);

    expect(angefragt).not.toContain("profiles_public");
    expect(angefragt).not.toContain("partners");
    expect(events).toHaveLength(2);
    expect(events[0].host).toBeNull();
    expect(events[1].host).toBeNull();
  });

  it("fragt ausgeloggt auch am einzelnen Event keine der beiden an", async () => {
    await fetchEvent(null, "e1");

    expect(angefragt).not.toContain("profiles_public");
    expect(angefragt).not.toContain("partners");
  });

  it("fragt die Spalten an, die die Veranstalter-Karte braucht", async () => {
    // Ohne diese Zeile wäre die Fixture-Erweiterung eine Behauptung: der Mock
    // liefert seine Felder unabhängig davon, was `select()` verlangt hat. Fällt
    // eine Spalte aus der Projektion, verliert die Karte still ihre Zeile.
    await fetchEvents("me");
    expect(spalten.profiles_public).toContain("company");
    expect(spalten.profiles_public).toContain("roles");
    expect(spalten.profiles_public).toContain("short_bio");
    expect(spalten.partners).toContain("description");
  });

  it("löst eingeloggt beide Host-Arten unverändert auf", async () => {
    const events = await fetchEvents("me");

    expect(angefragt).toContain("profiles_public");
    expect(angefragt).toContain("partners");
    expect(events[0].host).toEqual({
      kind: "profile",
      id: AUTOR,
      name: "Jonas Keller",
      avatarUrl: "https://x/a.webp",
      tier: "impact",
      company: "Keller GmbH",
      roles: ["Gründer"],
      shortBio: "Baut Dinge.",
    });
    expect(events[1].host).toEqual({
      kind: "partner",
      id: PARTNER,
      name: "Musterpartner",
      avatarUrl: "https://x/p.png",
      tier: null,
      company: null,
      roles: null,
      shortBio: "Ein Partner.",
    });
  });
});
