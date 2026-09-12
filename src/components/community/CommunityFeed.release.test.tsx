import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { fetchFeed, toggleLike, type FeedPost } from "../../lib/feed";
import { AuthFixture, authAsTier, fakeAuthValue } from "../../test/auth-fixtures";

/**
 * Die Release-Karte im Feed (AGE-718, §6).
 *
 * Vier Zusagen, und jede hat ihren Grund:
 *
 *  1. **Reaktionen und Kommentare funktionieren ohne Sonderweg.** Sie kosten
 *     keine Produktionszeile — genau deshalb ist der Test nötig: er belegt,
 *     dass die Karte den GETEILTEN Interaktionsbereich benutzt und keinen
 *     eigenen bekommen hat. Dieselbe Zusage wie bei der Event-Karte.
 *  2. **Die Karte steht chronologisch zwischen den Beiträgen**, nicht als
 *     getrennte Liste daneben.
 *  3. **Ist die Mitteilung nicht lesbar, entfällt die Karte**, statt leer zu
 *     erscheinen — die RLS von `release_notes` wertet die Einbettung selbst aus.
 *  4. **Es gibt kein Stufen-Gate.** Auch die unterste Stufe sieht die Karte.
 *
 * Und die fünfte, die kein Szenario ist, sondern eine Verneinung: der Absender
 * führt NIRGENDWOHIN. In `author_id` steht der zustellende Admin.
 *
 * Gemockt ist nur der Rand zur Datenbank. Kein `vi.mock` auf die Komponente
 * selbst — das wäre grün und prüfte nichts.
 */
vi.mock("../../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/feed")>()),
  fetchFeed: vi.fn(),
  toggleLike: vi.fn(),
}));

vi.mock("../../lib/event-cover", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/event-cover")>()),
  signEventCovers: vi.fn(async () => ({})),
}));

/** Wie `fetchFeed` sie liefert: leerer Body, Absender aus `feed.ts`. */
function releasePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p-release",
    // `absenderDerAnwendung()` setzt den Namen; die id bleibt die des Admins.
    author: { id: "admin-1", name: "eff.bee.zee", avatarUrl: null, tier: null },
    body: "",
    hashtags: [],
    visibility: "members",
    createdAt: new Date("2026-09-04T08:00:00Z").toISOString(),
    veroeffentlichtAb: new Date("2026-09-04T08:00:00Z").toISOString(),
    likeCount: 3,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    media: [],
    videoUrl: null,
    kind: "release",
    event: null,
    releaseNote: {
      id: "rn-1",
      title: "Die Glocke ist da",
      body: "Hinweise erscheinen jetzt oben rechts.",
    },
    ...overrides,
  };
}

function mitgliedsPost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    ...releasePost(),
    id: "p-member",
    author: { id: "m1", name: "Jonas Keller", avatarUrl: null, tier: "connect" },
    body: "Ein gewöhnlicher Beitrag",
    kind: "member",
    releaseNote: null,
    likeCount: 0,
    ...overrides,
  };
}

function renderFeed(posts: FeedPost[], auth = fakeAuthValue({ user: { id: "u1" } as never })) {
  vi.mocked(fetchFeed).mockResolvedValue({ posts, nextCursor: null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture value={auth}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <CommunityFeed />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  vi.mocked(fetchFeed).mockReset();
  vi.mocked(toggleLike).mockReset();
  vi.mocked(toggleLike).mockResolvedValue(undefined);
});

describe("6.1 — die Karte", () => {
  it("zeigt Titel, Text, den Absender und einen Weg zur Mitteilung", async () => {
    renderFeed([releasePost()]);

    await screen.findByText("Die Glocke ist da");
    expect(screen.getByText("Hinweise erscheinen jetzt oben rechts.")).toBeInTheDocument();
    expect(screen.getByText("eff.bee.zee")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alle Neuerungen" })).toHaveAttribute(
      "href",
      "/neues?note=rn-1",
    );
  });

  it("verlinkt den Absender NICHT auf ein Profil", async () => {
    renderFeed([releasePost()]);
    const absender = await screen.findByText("eff.bee.zee");

    // Weder der Name selbst noch irgendetwas im Kopf der Karte führt auf ein
    // Profil. Die Positivkontrolle steht im Test darunter: ein gewöhnlicher
    // Beitrag verlinkt seinen Autor sehr wohl.
    expect(absender.closest("a")).toBeNull();
    expect(document.querySelector('a[href^="/p/"]')).toBeNull();
  });

  it("Positivkontrolle: ein gewöhnlicher Beitrag verlinkt seinen Autor", async () => {
    renderFeed([mitgliedsPost()]);
    const autor = await screen.findByText("Jonas Keller");

    expect(autor.closest("a")).toHaveAttribute("href", "/p/m1");
  });

  it("rendert den Body des Beitrags GAR NICHT — der Text kommt aus der Mitteilung", async () => {
    // Der Body wird absichtlich gefüllt, obwohl der Auslöser ihn leer anlegt.
    // Bei leerem Body wäre „kein Text sichtbar" auch dann wahr, wenn die Karte
    // ihn brav renderte.
    renderFeed([releasePost({ body: "DIESER TEXT DARF NICHT ERSCHEINEN" })]);
    await screen.findByText("Die Glocke ist da");

    expect(screen.queryByText(/DIESER TEXT DARF NICHT ERSCHEINEN/)).toBeNull();
  });
});

describe("6.1b — der Interaktionsbereich ist geteilt, nicht kopiert", () => {
  it("lässt sich liken und den Like wieder entfernen", async () => {
    renderFeed([releasePost()]);
    await screen.findByText("Die Glocke ist da");

    const like = screen.getByRole("button", { name: /Gefällt mir/ });
    expect(like).toHaveTextContent("3");

    fireEvent.click(like);
    await waitFor(() =>
      expect(vi.mocked(toggleLike)).toHaveBeenCalledWith({
        postId: "p-release",
        profileId: "u1",
        liked: false,
      }),
    );
  });

  it("lässt den Like wieder entfernen", async () => {
    // Die Gegenrichtung wird über den AUSGANGSZUSTAND geprüft, nicht über einen
    // zweiten Klick: `fetchFeed` ist gemockt und liefert nach dem Neuladen
    // wieder `likedByMe: false`, ein zweiter Klick sagte also nichts über die
    // Richtung aus. Der Toggle kennt die Release-Karte ohnehin nicht als
    // Sonderfall — er sieht nur eine `posts`-Zeile.
    renderFeed([releasePost({ likedByMe: true, likeCount: 4 })]);
    await screen.findByText("Die Glocke ist da");

    fireEvent.click(screen.getByRole("button", { name: /Gefällt mir/ }));
    await waitFor(() =>
      expect(vi.mocked(toggleLike)).toHaveBeenCalledWith({
        postId: "p-release",
        profileId: "u1",
        liked: true,
      }),
    );
  });

  it("öffnet den Kommentarfaden und bietet die Eingabe an", async () => {
    renderFeed([releasePost()]);
    await screen.findByText("Die Glocke ist da");

    const knopf = screen.getByRole("button", { name: /Kommentare/ });
    expect(knopf).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(knopf);

    expect(knopf).toHaveAttribute("aria-expanded", "true");
    // Die Eingabe ist NICHT gesperrt: dass ein Kommentar hier keinen
    // zuständigen Absender hat, ist eine in Kauf genommene Folge und wird nicht
    // durch eine gesperrte Eingabe verdeckt (Design, Entscheidung 8).
    const eingabe = await screen.findByLabelText("Neuer Kommentar");
    expect(eingabe).not.toBeDisabled();
  });
});

describe("6.2 — chronologisch zwischen den Beiträgen", () => {
  it("steht an ihrer Stelle in derselben Liste, nicht in einer zweiten", async () => {
    const aelter = mitgliedsPost({
      id: "p-alt",
      body: "Älterer Beitrag",
      veroeffentlichtAb: new Date("2026-09-03T08:00:00Z").toISOString(),
    });
    const neuer = mitgliedsPost({
      id: "p-neu",
      body: "Neuerer Beitrag",
      veroeffentlichtAb: new Date("2026-09-05T08:00:00Z").toISOString(),
    });
    renderFeed([neuer, releasePost(), aelter]);

    await screen.findByText("Die Glocke ist da");

    // Die drei Knoten selbst vergleichen, NICHT den Text irgendeines Containers
    // (Befund opencode im Diff-Review, NIEDRIG): eine Suche über
    // `querySelectorAll("div")[0]` misst die Struktur des Seitenmarkups mit,
    // und ein nicht gefundener Text ergäbe `-1`, was die Vergleiche in beide
    // Richtungen kippen ließe.
    //
    // `compareDocumentPosition` beantwortet genau die Frage: steht A vor B?
    const knoten = (text: string) => screen.getByText(text);
    const vorher = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    const neu = knoten("Neuerer Beitrag");
    const karte = knoten("Die Glocke ist da");
    const alt = knoten("Älterer Beitrag");

    expect(vorher(neu, karte)).toBe(true);
    expect(vorher(karte, alt)).toBe(true);
    // Die Gegenrichtung mit: ohne sie wäre die Zusage auch bei drei Knoten an
    // derselben Stelle wahr.
    expect(vorher(karte, neu)).toBe(false);
  });
});

describe("6.3 — ohne lesbare Mitteilung keine Karte", () => {
  it("entfällt lautlos, statt leer zu erscheinen", async () => {
    renderFeed([releasePost({ releaseNote: null })]);

    // Der leere Zustand darf NICHT erscheinen — es gibt ja einen Beitrag, er
    // ist nur nicht darstellbar. Und eine leere Karte darf es auch nicht geben.
    await waitFor(() => expect(screen.queryByText(/Feed wird geladen/)).toBeNull());
    expect(screen.queryByText("eff.bee.zee")).toBeNull();
    expect(screen.queryByRole("button", { name: /Gefällt mir/ })).toBeNull();
  });
});

describe("6.4 — kein Stufen-Gate", () => {
  it("zeigt die Karte auch einem Mitglied der untersten Stufe", async () => {
    renderFeed([releasePost()], authAsTier("basic"));

    await screen.findByText("Die Glocke ist da");
    expect(screen.getByText("eff.bee.zee")).toBeInTheDocument();
  });
});
