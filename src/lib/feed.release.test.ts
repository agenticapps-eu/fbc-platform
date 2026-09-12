import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Release-Beiträge im Feed (AGE-718) — die Datenschicht.
 *
 * Diese drei Tests stehen VOR der Migration und vor jeder Zeile in `feed.ts`.
 * Sie beschreiben die Stelle, an der ein Ausrollen sonst NICHT auffiele: eine
 * dritte Beitragsart, die der Lesepfad still auf `member` verengt, erschiene
 * als Mitgliedsbeitrag mit leerem Text und dem Namen des zustellenden Admins.
 *
 * Gemockt ist nur der Rand zur Datenbank. Behauptet wird über die ANFRAGE
 * (welchen Typausdruck setzt der Filter?) und über die ABBILDUNG (welche Art
 * und welcher Absender kommen heraus) — nicht über eine nachgebaute Antwort.
 * Dass die Datenbank eine Zeile mit `kind = 'release'` überhaupt annimmt, ist
 * eine andere Zusage und steht in pgTAP (§4.4).
 */

const ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MITGLIED = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ICH = "cccccccc-cccc-cccc-cccc-cccccccccccc";

interface Aufruf {
  table: string;
  select?: string;
  /** ALLE `or(...)`-Gruppen, nicht die letzte — ab Seite 2 sind es zwei. */
  or: string[];
}

let aufrufe: Aufruf[] = [];
let postZeilen: Record<string, unknown>[] = [];

/** Der zustellende Admin steht sehr wohl in `profiles_public` — mit Namen und
 *  Bild. Genau deshalb taugt er als Probe: die Karte darf beides NICHT zeigen,
 *  obwohl der Lesepfad es mühelos auflösen könnte. */
const PROFILE = [
  { id: ADMIN, name: "Anna Berger", avatar_url: "https://x/admin.webp", tier: "impact" },
  { id: MITGLIED, name: "Jonas Keller", avatar_url: "https://x/jonas.webp", tier: "connect" },
];

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => {
      const eintrag: Aufruf = { table, or: [] };
      aufrufe.push(eintrag);
      const daten = () =>
        table === "posts" ? postZeilen : table === "profiles_public" ? PROFILE : [];
      const kette: Record<string, unknown> = {
        select: (spalten: string) => {
          eintrag.select = spalten;
          return kette;
        },
        or: (ausdruck: string) => {
          eintrag.or.push(ausdruck);
          return kette;
        },
        order: () => kette,
        limit: () => kette,
        eq: () => kette,
        not: () => kette,
        contains: () => kette,
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

import { FEED_TYPEN, feedSeitenKey, fetchFeed, normalisierteTypen } from "./feed";

/** Eine zugestellte Mitteilung, wie der Auslöser sie anlegt: leerer `body`,
 *  Bezug über `release_note_id`, KEIN `ref_id`, Autor ist der Zusteller. */
const RELEASE_ZEILE = {
  id: "p-release",
  author_id: ADMIN,
  body: "",
  hashtags: null,
  visibility: "members",
  created_at: "2026-09-04T08:00:00Z",
  veroeffentlicht_ab: "2026-09-04T08:00:00Z",
  video_url: null,
  kind: "release",
  ref_id: null,
  release_note_id: "rn-1",
  like_count: 0,
  events: null,
  // Der benannte Einbettungs-Join. `body` steht NICHT am Beitrag — er kommt bei
  // jedem Abruf frisch aus `release_notes`.
  //
  // BEWUSST OHNE Markdown-Syntax, obwohl die pgTAP-Vorlage aus AGE-631 eine
  // `##`-Zeile führt: der Text wird auf ALLEN drei Flächen als Text gerendert
  // (`/neues`-Liste, `/neues`-Dialog, jetzt die Feed-Karte), und im Repo liegt
  // kein Markdown-Renderer. Eine Vorlage mit `##` behauptete eine Auszeichnung,
  // die nirgends greift — Befund gemini im Diff-Review.
  release_notes: { id: "rn-1", title: "Neu in der App", body: "Die Glocke ist verdrahtet." },
};

const MITGLIEDSZEILE = {
  id: "p-member",
  author_id: MITGLIED,
  body: "Ein gewöhnlicher Beitrag",
  hashtags: [],
  visibility: "members",
  created_at: "2026-09-03T08:00:00Z",
  veroeffentlicht_ab: "2026-09-03T08:00:00Z",
  video_url: null,
  kind: "member",
  ref_id: null,
  release_note_id: null,
  like_count: 0,
  events: null,
};

const postsAufruf = () => aufrufe.find((a) => a.table === "posts")!;

beforeEach(() => {
  aufrufe = [];
  postZeilen = [];
});

describe("AGE-718 §3 — die Verengung an der Grenze", () => {
  it("3.1 liest eine Zeile mit kind = 'release' als Art release, nicht als member", async () => {
    postZeilen = [RELEASE_ZEILE, MITGLIEDSZEILE];

    const seite = await fetchFeed({ uid: ICH });

    // Die Positivkontrolle steht daneben: ohne sie wäre der Test auch dann
    // grün, wenn JEDE Zeile plötzlich „release“ hiesse.
    expect(seite.posts.map((p) => p.kind)).toEqual(["release", "member"]);
  });

  it("3.2 schliesst Release-Beiträge aus dem Beitragstyp „Text“ aus", async () => {
    await fetchFeed({ uid: ICH, typen: ["text"] });

    const [ausdruck] = postsAufruf().or;
    // Der Filter nennt die gemeinte Art, statt eine einzige andere zu
    // verneinen. `kind.neq.event` fängt jede künftige Art mit ein — eine
    // Release-Karte erschiene darin als Textbeitrag, mit leerem Text.
    expect(ausdruck).toContain("kind.eq.member");
    expect(ausdruck).not.toContain("kind.neq.event");
  });

  it("3.3 zeigt an der Release-Karte weder Namen noch Bild des zustellenden Admins", async () => {
    postZeilen = [RELEASE_ZEILE, MITGLIEDSZEILE];

    const seite = await fetchFeed({ uid: ICH });
    const release = seite.posts.find((p) => p.id === "p-release")!.author;

    expect(release.name).not.toBe("Anna Berger");
    expect(release.avatarUrl).toBeNull();
    expect(release.tier).toBeNull();
    // Die Anwendung spricht unter ihrem eigenen Namen (Donald, 11.09.).
    expect(release.name).toBe("eff.bee.zee");

    // Positivkontrolle: der gewöhnliche Beitrag behält seinen Autor. Sonst
    // belegte dieser Test auch eine Maskierung, die jeden Autor träfe.
    const mitglied = seite.posts.find((p) => p.id === "p-member")!.author;
    expect(mitglied.name).toBe("Jonas Keller");
    expect(mitglied.avatarUrl).toBe("https://x/jonas.webp");
  });

  it("5.3 holt Titel und Text über den benannten Join, nicht aus dem Beitrag", async () => {
    postZeilen = [RELEASE_ZEILE, MITGLIEDSZEILE];

    const seite = await fetchFeed({ uid: ICH });

    // Der Name des Fremdschlüssels steht in der Abfrage. Ein generierter Name
    // wäre eine stille Kopplung, die bei jeder Umbenennung bricht.
    expect(postsAufruf().select).toContain("release_notes!posts_release_note_id_fkey");

    const release = seite.posts.find((p) => p.id === "p-release")!;
    expect(release.body).toBe("");
    expect(release.releaseNote).toEqual({
      id: "rn-1",
      title: "Neu in der App",
      body: "Die Glocke ist verdrahtet.",
    });

    // Positivkontrolle: der gewöhnliche Beitrag trägt keine Mitteilung — sonst
    // belegte der Test auch eine Abbildung, die jeder Zeile eine anhängte.
    expect(seite.posts.find((p) => p.id === "p-member")!.releaseNote).toBeNull();
  });

  it("5.3b lässt die Mitteilung weg, wenn die Einbettung nichts liefert", async () => {
    // Die RLS von `release_notes` wertet die Einbettung selbst aus: eine nicht
    // lesbare Mitteilung kommt als `null` zurück, nicht als Fehler. Die Karte
    // entfällt dann — entschieden wird das an diesem Feld.
    postZeilen = [{ ...RELEASE_ZEILE, release_notes: null }];

    const seite = await fetchFeed({ uid: ICH });

    expect(seite.posts[0].kind).toBe("release");
    expect(seite.posts[0].releaseNote).toBeNull();
  });
});

describe("AGE-718 §5.2c — alle vier Haken sind dasselbe wie kein Haken", () => {
  /**
   * Die benannte Ausnahme zur Regel „ein Haken, keine Release-Karten"
   * (Entscheidung 10 im Design). Sie ist der einzige Zustand mit Haken, in dem
   * Release-Karten erscheinen — weil er gar keine Typgruppe erzeugt.
   *
   * Der Widerspruch dahinter stand im Spec-Delta und wurde VOR der ersten
   * Codezeile aufgelöst: derselbe Cache-Schlüssel heisst dieselbe Abfrage und
   * damit dieselben Zeilen. „Vier Haken schliessen Release-Karten aus" und
   * „vier Haken tragen denselben Schlüssel wie kein Haken" sind zusammen
   * unerfüllbar.
   */
  const auswahl = (typen: string[]) =>
    ({ tags: [], reiter: "alle", ordnung: "neueste", typen }) as never;

  it("setzt bei vier Haken buchstäblich dieselbe Anfrage ab wie ohne Haken", async () => {
    postZeilen = [RELEASE_ZEILE, MITGLIEDSZEILE];

    const ohne = await fetchFeed({ uid: ICH });
    const ohneAufruf = { ...postsAufruf() };

    aufrufe = [];
    const alle = await fetchFeed({ uid: ICH, typen: [...FEED_TYPEN] });
    const alleAufruf = postsAufruf();

    // Keine Typgruppe — und damit auch kein Ausdruck, der `release` ausliesse.
    expect(ohneAufruf.or).toEqual([]);
    expect(alleAufruf.or).toEqual([]);
    expect(alleAufruf.select).toBe(ohneAufruf.select);

    // Die Release-Karte steht in BEIDEN Listen. Ohne diese Hälfte belegten die
    // Zeilen darüber nur, dass zweimal dasselbe Nichts gefiltert wurde.
    expect(ohne.posts.map((p) => p.kind)).toEqual(["release", "member"]);
    expect(alle.posts.map((p) => p.kind)).toEqual(["release", "member"]);
  });

  it("trägt bei vier Haken denselben Cache-Schlüssel wie ohne Haken", () => {
    expect(normalisierteTypen([...FEED_TYPEN])).toEqual([]);
    expect(feedSeitenKey(ICH, auswahl([...FEED_TYPEN]))).toEqual(feedSeitenKey(ICH, auswahl([])));
  });

  it("lässt Release-Karten aus, sobald EIN Haken gesetzt ist", async () => {
    // Die Regel selbst, neben ihrer Ausnahme: keiner der vier Ausdrücke nennt
    // `release`, also trägt jede echte Typgruppe die Karte nicht mit.
    for (const typ of FEED_TYPEN) {
      aufrufe = [];
      await fetchFeed({ uid: ICH, typen: [typ] });
      const [ausdruck] = postsAufruf().or;
      expect(ausdruck).not.toContain("release");
    }
  });
});
