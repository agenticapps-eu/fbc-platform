import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { fetchFeed, toggleLike, type FeedPost } from "../../lib/feed";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";

/**
 * Die Event-Karte im Feed (AGE-533, C9).
 *
 * Zwei Zusagen werden hier geprüft, und beide standen im Plan-Review als offen:
 *
 *  1. **Likes und Kommentare funktionieren ohne Sonderweg** (Befund codex,
 *     MEDIUM: die Spec sagte es zu, keine Aufgabe verdrahtete es). Unter einer
 *     Event-Karte liegt dieselbe `posts`-Zeile wie unter einem Textbeitrag —
 *     der Interaktionsbereich ist deshalb GETEILT, nicht kopiert.
 *  2. **Die Karte entfällt, wenn das Event nicht lesbar ist.** Sie erscheint
 *     dann nicht leer: `post.event` ist null, weil die RLS von `events` die
 *     Einbettung selbst auswertet.
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

function eventPost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p-event",
    author: { id: "h1", name: "Detlev Meier", avatarUrl: null, tier: "impact" },
    // Der leere Body ist der Kern: die Karte darf davon nichts brauchen.
    body: "",
    hashtags: [],
    visibility: "public",
    createdAt: new Date("2026-08-13T10:00:00Z").toISOString(),
    likeCount: 2,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    media: [],
    videoUrl: null,
    kind: "event",
    event: {
      id: "e1",
      title: "Sommerfest im Hafen",
      startsAt: new Date("2026-08-17T18:00:00Z").toISOString(),
      location: "Hamburg",
      coverPath: null,
    },
    ...overrides,
  };
}

function renderFeed(posts: FeedPost[], eingeloggt = true) {
  vi.mocked(fetchFeed).mockResolvedValue({ posts, nextCursor: null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture
      value={
        eingeloggt
          ? fakeAuthValue({
              // Minimaler User-Stub wie in `authAsTier`: die Karte prüft nur
              // Vorhandensein und id.
              user: { id: "u1" } as ReturnType<typeof fakeAuthValue>["user"],
            })
          : fakeAuthValue()
      }
    >
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

describe("Event-Karte im Feed", () => {
  it("zeigt Titel, Datum, Ort und einen Weg zur Detailseite", async () => {
    renderFeed([eventPost()]);

    const titel = await screen.findByText("Sommerfest im Hafen");
    expect(titel.closest("a")).toHaveAttribute("href", "/events/e1");
    expect(screen.getByText(/Hamburg/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zum Event" })).toHaveAttribute(
      "href",
      "/events/e1",
    );
  });

  it("rendert den Body GAR NICHT — die Karte lebt vom Event, nicht vom Beitrag", async () => {
    // Der Body wird hier absichtlich GEFÜLLT, obwohl der Trigger ihn leer
    // anlegt. Nur so misst der Test etwas: bei leerem Body wäre „kein Text
    // sichtbar" auch dann wahr, wenn die Karte den Body brav rendern würde.
    //
    // Die frühere Fassung prüfte auf das Fehlen des Lightbox-Knopfes — den es
    // an einem Beitrag ohne Bilder ohnehin nie gibt. Sie war grün und bewies
    // nichts (Befund opencode im Diff-Review, MEDIUM).
    renderFeed([eventPost({ body: "DIESER TEXT DARF NICHT ERSCHEINEN" })]);
    await screen.findByText("Sommerfest im Hafen");

    expect(screen.queryByText(/DIESER TEXT DARF NICHT ERSCHEINEN/)).toBeNull();
  });

  it("lässt sich liken wie ein gewöhnlicher Beitrag", async () => {
    renderFeed([eventPost()]);
    await screen.findByText("Sommerfest im Hafen");

    const like = screen.getByRole("button", { name: /Gefällt mir/ });
    expect(like).toHaveTextContent("2");
    fireEvent.click(like);

    await waitFor(() =>
      expect(vi.mocked(toggleLike)).toHaveBeenCalledWith({
        postId: "p-event",
        profileId: "u1",
        liked: false,
      }),
    );
  });

  it("öffnet den Kommentarfaden wie ein gewöhnlicher Beitrag", async () => {
    renderFeed([eventPost()]);
    await screen.findByText("Sommerfest im Hafen");

    const knopf = screen.getByRole("button", { name: /Kommentare/ });
    expect(knopf).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(knopf);

    expect(knopf).toHaveAttribute("aria-expanded", "true");
    await screen.findByLabelText("Neuer Kommentar");
  });

  it("entfällt lautlos, wenn das Event für den Betrachter nicht lesbar ist", async () => {
    renderFeed([eventPost({ event: null })]);

    // Der leere Zustand darf NICHT erscheinen — es gibt ja einen Beitrag, er
    // ist nur nicht darstellbar. Und eine leere Karte darf es auch nicht geben.
    await waitFor(() => expect(screen.queryByText(/Feed wird geladen/)).toBeNull());
    expect(screen.queryByText("Sommerfest im Hafen")).toBeNull();
    expect(screen.queryByRole("button", { name: /Gefällt mir/ })).toBeNull();
  });
});
