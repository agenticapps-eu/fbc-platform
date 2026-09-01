import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AcademyPage from "./AcademyPage";
import { fetchFeed, type FeedPost } from "../lib/feed";
import { fetchGelikteVideos } from "../lib/academy";

/**
 * Suche, Hashtags und Sortierung in der rechten Spalte der Academy (AGE-629).
 *
 * Die Zusage, die hier am meisten wert ist: die Spalte trägt auch auf dünnem
 * Bestand. Auf der Produktion steht heute EIN Video, und es trägt kein
 * Hashtag — die Facettenkarte darf dort nicht als leere Hülle stehen, Suche und
 * Sortierung aber sehr wohl.
 *
 * Zweite Zusage, weniger sichtbar und teurer, wenn sie fehlt: Suche und
 * Ordnung gehen an die ANFRAGE, nicht an eine Nachfilterung im Client. Sonst
 * durchsuchte die Suche nur die geladenen Seiten und behauptete, es gäbe nicht
 * mehr. Geprüft wird deshalb an den Argumenten von `fetchFeed`.
 */
vi.mock("../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/feed")>()),
  fetchFeed: vi.fn(),
}));

vi.mock("../lib/academy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/academy")>()),
  fetchGelikteVideos: vi.fn(),
}));

vi.mock("../providers/auth-context", () => ({
  useAuth: () => ({ user: { id: "00000000-0000-0000-0000-0000000000aa" } }),
}));

function video(teil: Partial<FeedPost> & { id: string; body: string }): FeedPost {
  return {
    authorId: "00000000-0000-0000-0000-0000000000bb",
    author: { id: "00000000-0000-0000-0000-0000000000bb", name: "Ein Mitglied", former: false },
    createdAt: "2026-08-01T10:00:00+00:00",
    veroeffentlichtAb: "2026-08-01T10:00:00+00:00",
    videoUrl: "https://www.youtube.com/watch?v=x",
    hashtags: null,
    visibility: "members",
    kind: "member",
    likeCount: 0,
    ...teil,
  } as FeedPost;
}

/** Alle Aufrufe der Videoliste, ohne die Facetten-Grundabfrage. */
function letzteArgs(): Record<string, unknown> {
  const call = vi.mocked(fetchFeed).mock.calls.at(-1);
  return (call?.[0] ?? {}) as Record<string, unknown>;
}

function renderAcademy(posts: FeedPost[]) {
  vi.mocked(fetchFeed).mockResolvedValue({ posts, nextCursor: null });
  vi.mocked(fetchGelikteVideos).mockResolvedValue({ posts: [], nextCursor: null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/academy"]}>
        <AcademyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(fetchFeed).mockReset();
  vi.mocked(fetchGelikteVideos).mockReset();
});

describe("Academy: Suche, Hashtags und Sortierung in der Spalte", () => {
  it("schickt den Suchbegriff an die Anfrage, nicht in eine Nachfilterung", async () => {
    renderAcademy([video({ id: "1", body: "Über Führung" })]);
    await screen.findByRole("searchbox", { name: "Suche" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Suche" }), {
      target: { value: "führung" },
    });

    await waitFor(() => expect(letzteArgs().suche).toBe("führung"));
    // Und der Video-Filter bleibt dabei stehen — die Academy ist eine
    // gefilterte Sicht auf `posts`, kein zweiter Bestand.
    expect(letzteArgs().nurVideos).toBe(true);
  });

  it("nutzt die vorhandene Ordnung „beliebteste“, statt eine eigene zu bauen", async () => {
    renderAcademy([video({ id: "1", body: "Über Führung" })]);
    await screen.findByRole("combobox", { name: "Sortierung" });

    fireEvent.change(screen.getByRole("combobox", { name: "Sortierung" }), {
      target: { value: "beliebteste" },
    });

    await waitFor(() => expect(letzteArgs().ordnung).toBe("beliebteste"));
  });

  it("leitet die Hashtag-Facette aus dem Bestand ab", async () => {
    renderAcademy([
      video({ id: "1", body: "a", hashtags: ["leadership"] }),
      video({ id: "2", body: "b", hashtags: ["marketing"] }),
    ]);

    expect(await screen.findByRole("checkbox", { name: "leadership" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "marketing" })).toBeInTheDocument();
  });

  it("trägt auch ohne ein einziges Hashtag — der Zustand der Produktion", async () => {
    renderAcademy([video({ id: "1", body: "Über Führung" })]);
    await screen.findByRole("searchbox", { name: "Suche" });

    // Keine leere Hülle …
    expect(screen.queryByText("Hashtags")).toBeNull();
    // … aber die Spalte steht trotzdem.
    expect(screen.getByRole("searchbox", { name: "Suche" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sortierung" })).toBeInTheDocument();
  });
});
