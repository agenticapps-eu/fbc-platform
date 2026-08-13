import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { fetchFeed, type FeedPost, type FeedSeite } from "../../lib/feed";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";

/**
 * Erste Testdatei zu dieser Komponente (AGE-528, C7 Block 4).
 *
 * GEMOCKT WIRD NUR DER DATENWEG. `fetchFeed` spricht Supabase an und hat im
 * jsdom nichts zu holen; alles andere aus `lib/feed` bleibt echt —
 * `tokenizePostBody`, `parseHashtags`, `buildMentionResolver`. Ein `vi.mock`
 * auf die Komponente selbst wäre grün und prüfte nichts, und eine Assertion auf
 * Klassennamen oder Bezeichner statt auf sichtbaren Text ebenso.
 */
vi.mock("../../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/feed")>()),
  fetchFeed: vi.fn(),
}));

function post(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p1",
    author: { id: "a1", name: "Detlev Meier", avatarUrl: null, tier: "impact" },
    body: "Gestern beim #Netzwerken viel gelernt.",
    hashtags: ["netzwerken"],
    visibility: "public",
    createdAt: new Date("2026-08-01T10:00:00Z").toISOString(),
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    videoUrl: null,
    kind: "member",
    event: null,
    media: [],
    ...overrides,
  };
}

/** Ausgeloggt: /aktivitaet ist ohne Session erreichbar, das ist der offenste Fall. */
async function renderFeed(posts: FeedPost[]) {
  vi.mocked(fetchFeed).mockResolvedValue({ posts, nextCursor: null });
  renderNackt();
  await screen.findByText(/viel gelernt/);
}

function renderNackt() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture value={fakeAuthValue()}>
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
});

describe("CommunityFeed — jeder Tag erscheint genau einmal", () => {
  it("zeigt einen Tag als Chip und als Fließtext, aber nur der Chip ist anklickbar", async () => {
    await renderFeed([post()]);

    // Zwei Treffer sind RICHTIG und bleiben es auch nach dem Fix: der Chip
    // unter dem Beitrag und das Wort im Satz. Groß-/Kleinschreibung
    // unterscheidet die beiden — der Chip trägt den normalisierten Wert
    // `#netzwerken`, der Satz das getippte `#Netzwerken`.
    const stellen = screen.getAllByText(/^#netzwerken$/i);
    expect(stellen).toHaveLength(2);

    // Und DAS ist der Fehler, den dieser Block behebt: heute sind beide Stellen
    // ein Button, der Tag steht also zweimal klickbar da. Eine Zusicherung auf
    // „genau eine anklickbare Stelle" allein wäre zu unscharf — sie ginge auch
    // durch, wenn der Chip verschwände. Deshalb beide Hälften.
    const anklickbar = stellen.filter(
      (el) => el.closest("button") !== null || el.closest("a") !== null,
    );
    expect(anklickbar).toHaveLength(1);
    expect(anklickbar[0]).toHaveTextContent("#netzwerken");
  });

  it("lässt Erwähnung und Link im selben Beitrag Verweise bleiben", async () => {
    await renderFeed([
      post({
        body: "Danke @Detlev, Details auf https://fair-business-club.de — viel gelernt.",
        hashtags: [],
      }),
    ]);

    // Die Erwähnung löst über den Autor des Feeds auf (buildMentionResolver,
    // Vorname genügt) und wird zum Profil-Link.
    expect(screen.getByText("@Detlev").closest("a")).toHaveAttribute("href", "/p/a1");

    const link = screen.getByText("https://fair-business-club.de").closest("a");
    expect(link).toHaveAttribute("href", "https://fair-business-club.de");
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("CommunityFeed — ältere Beiträge sind erreichbar", () => {
  const CURSOR = { createdAt: "2026-08-01T10:00:00Z", id: "p1" };

  function seite(over: Partial<FeedSeite> & { posts: FeedPost[] }): FeedSeite {
    return { nextCursor: null, ...over };
  }

  it("lädt die nächste Seite mit dem Cursor der vorigen und blendet den Knopf danach aus", async () => {
    // Eine feste Obergrenze ohne Nachladen wäre mit Bildern eine stille
    // Kappung: ältere Beiträge wären unauffindbar, ohne dass etwas darauf
    // hinweist (spec.md, „Der Feed lädt seitenweise").
    vi.mocked(fetchFeed)
      .mockResolvedValueOnce(seite({ posts: [post()], nextCursor: CURSOR }))
      .mockResolvedValueOnce(
        seite({ posts: [post({ id: "p2", body: "Ein älterer Erlebnisbericht." })] }),
      );

    renderNackt();
    await screen.findByText(/viel gelernt/);

    fireEvent.click(screen.getByRole("button", { name: /ältere beiträge/i }));

    expect(await screen.findByText(/älterer Erlebnisbericht/)).toBeInTheDocument();
    expect(vi.mocked(fetchFeed).mock.calls[1][0].cursor).toEqual(CURSOR);
    // Der erste Beitrag bleibt stehen — nachladen ist kein Blättern.
    expect(screen.getByText(/viel gelernt/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ältere beiträge/i })).toBeNull();
  });

  it("zeigt ohne weitere Seite gar keinen Knopf", async () => {
    await renderFeed([post()]);

    expect(screen.queryByRole("button", { name: /ältere beiträge/i })).toBeNull();
  });
});
