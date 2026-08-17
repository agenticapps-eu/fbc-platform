import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { fetchComments, fetchFeed, type FeedPost } from "../../lib/feed";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";

/**
 * Die Kommentar-Vorschau im Feed (AGE-566).
 *
 * Vorher lagen ALLE Kommentare hinter einem Klick auf das Sprechblasen-Symbol.
 * Ein Feed, in dem jede Antwort erst aufgeklappt werden muss, sieht aus wie ein
 * Feed ohne Antworten — und das Gespräch ist hier das Produkt.
 *
 * Gemockt wird nur der Datenweg (`fetchFeed`, `fetchComments`); die Komponente
 * bleibt echt. Geprüft wird sichtbarer Text, nicht ein Bezeichner: „zeigt zwei
 * Kommentare" muss falsch werden, wenn drei erscheinen.
 */
vi.mock("../../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/feed")>()),
  fetchFeed: vi.fn(),
  fetchComments: vi.fn(),
}));

function post(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p1",
    author: { id: "a1", name: "Detlev Meier", avatarUrl: null, tier: "impact" },
    body: "Gestern beim Netzwerken viel gelernt.",
    hashtags: [],
    visibility: "public",
    createdAt: new Date("2026-08-01T10:00:00Z").toISOString(),
    likeCount: 0,
    commentCount: 4,
    likedByMe: false,
    videoUrl: null,
    kind: "member",
    event: null,
    media: [],
    ...overrides,
  };
}

/** Aufsteigend, wie `fetchComments` liefert — die LETZTEN zwei sind C und D. */
const KOMMENTARE = ["Kommentar A", "Kommentar B", "Kommentar C", "Kommentar D"].map((body, i) => ({
  id: `c${i}`,
  postId: "p1",
  author: { id: `u${i}`, name: `Autor ${i}`, avatarUrl: null, tier: "impact" as const },
  body,
  createdAt: new Date(`2026-08-0${i + 1}T10:00:00Z`).toISOString(),
}));

function renderFeed(posts: FeedPost[], kommentare = KOMMENTARE, angemeldet = false) {
  vi.mocked(fetchFeed).mockResolvedValue({ posts, nextCursor: null });
  vi.mocked(fetchComments).mockResolvedValue(kommentare as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Ausgeloggt ist der offenste Fall und die Vorgabe hier: die Vorschau muss
  // auch ohne Sitzung stehen. Nur die Eingabe-Prüfung braucht ein Konto.
  const auth = angemeldet
    ? fakeAuthValue({ user: { id: "a1" } as never, tier: "impact", levelRank: 6 })
    : fakeAuthValue();
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
  vi.mocked(fetchComments).mockReset();
});

describe("Kommentare stehen offen unter dem Beitrag", () => {
  it("zeigt ohne Zutun die letzten zwei — und die älteren nicht", async () => {
    renderFeed([post()]);

    expect(await screen.findByText("Kommentar C")).toBeInTheDocument();
    expect(screen.getByText("Kommentar D")).toBeInTheDocument();
    // Die beiden älteren bleiben zunächst weg. Ohne diese zwei Zeilen bestünde
    // der Test auch, wenn alle vier erschienen.
    expect(screen.queryByText("Kommentar A")).toBeNull();
    expect(screen.queryByText("Kommentar B")).toBeNull();
  });

  it("holt die restlichen erst auf Klick — und nennt ihre Zahl", async () => {
    renderFeed([post()]);
    await screen.findByText("Kommentar D");

    const mehr = screen.getByRole("button", { name: /2 weitere Kommentare anzeigen/i });
    fireEvent.click(mehr);

    expect(await screen.findByText("Kommentar A")).toBeInTheDocument();
    expect(screen.getByText("Kommentar B")).toBeInTheDocument();
    // Und der Knopf verschwindet, sobald es nichts mehr zu zeigen gibt.
    await waitFor(() => expect(screen.queryByText(/weitere Kommentare anzeigen/i)).toBeNull());
  });

  it("nennt einen einzelnen verborgenen Kommentar im Singular", async () => {
    renderFeed([post({ commentCount: 3 })], KOMMENTARE.slice(0, 3));

    expect(
      await screen.findByRole("button", { name: /1 weiteren Kommentar anzeigen/i }),
    ).toBeInTheDocument();
  });

  it("zeigt bei genau zwei Kommentaren keinen Mehr-Knopf", async () => {
    renderFeed([post({ commentCount: 2 })], KOMMENTARE.slice(0, 2));

    await screen.findByText("Kommentar A");
    expect(screen.queryByText(/weitere.? Kommentare? anzeigen/i)).toBeNull();
  });

  /**
   * Der teuerste Fehler dieser Änderung wäre eine Abfrage je Karte. Ein Feed mit
   * zwanzig Beiträgen ohne Kommentare darf keine zwanzig Anfragen auslösen —
   * `commentCount` ist die Antwort, sie steht schon im Feed.
   */
  it("fragt für einen Beitrag ohne Kommentare gar nicht erst nach", async () => {
    renderFeed([post({ commentCount: 0 })], []);
    await screen.findByText(/viel gelernt/);

    expect(fetchComments).not.toHaveBeenCalled();
  });

  /** Die Eingabe gehört zum Aufklappen, nicht unter jeden Beitrag des Feeds. */
  it("zeigt das Eingabefeld erst nach dem Öffnen über die Leiste", async () => {
    renderFeed([post()], KOMMENTARE, true);
    await screen.findByText("Kommentar D");

    expect(screen.queryByLabelText(/Neuer Kommentar/i)).toBeNull();

    // Genau der Knopf in der Leiste — sein Name trägt die Zahl. `/Kommentare/i`
    // allein träfe auch „2 weitere Kommentare anzeigen".
    fireEvent.click(screen.getByRole("button", { name: "4Kommentare" }));

    expect(await screen.findByLabelText(/Neuer Kommentar/i)).toBeInTheDocument();
  });
});
