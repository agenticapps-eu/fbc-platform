import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { deletePost, fetchFeed, removePostMedia, updatePost, type FeedPost } from "../../lib/feed";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";

/**
 * Einen eigenen Beitrag bearbeiten (AGE-566).
 *
 * Gemeldet am 17.08.: „Der Ersteller kann seinen eigenen Beitrag nicht
 * bearbeiten." Es war keine kaputte Funktion, sondern eine fehlende — die RLS
 * erlaubt es seit jeher (`posts_write_own` gilt `for all`), die Oberfläche
 * hatte nur das Anlegen.
 *
 * Gemockt wird der Datenweg, nicht die Komponente. Die Zusagen hängen an
 * sichtbarem Text und an den ARGUMENTEN, die nach unten gehen — eine Prüfung
 * auf „der Knopf existiert" liesse offen, ob er das Richtige tut.
 */
vi.mock("../../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/feed")>()),
  fetchFeed: vi.fn(),
  fetchComments: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  removePostMedia: vi.fn(),
}));

const ICH = "u-ich";

function post(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p1",
    author: { id: ICH, name: "Ich Selbst", avatarUrl: null, tier: "impact" },
    body: "Mein Beitrag über #Netzwerken",
    hashtags: ["netzwerken", "leadership"],
    visibility: "members",
    createdAt: new Date("2026-08-17T10:00:00Z").toISOString(),
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

function renderFeed(posts: FeedPost[], uid: string | null = ICH) {
  vi.mocked(fetchFeed).mockResolvedValue({ posts, nextCursor: null });
  vi.mocked(updatePost).mockResolvedValue(undefined);
  vi.mocked(deletePost).mockResolvedValue(undefined);
  vi.mocked(removePostMedia).mockResolvedValue(undefined);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture
      value={fakeAuthValue(uid ? { user: { id: uid } as never, tier: "impact", levelRank: 6 } : {})}
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
  vi.mocked(updatePost).mockReset();
  vi.mocked(deletePost).mockReset();
  vi.mocked(removePostMedia).mockReset();
});

describe("Einen eigenen Beitrag bearbeiten", () => {
  it("bietet Bearbeiten am eigenen Beitrag an", async () => {
    renderFeed([post()]);

    expect(await screen.findByRole("button", { name: "Bearbeiten" })).toBeInTheDocument();
  });

  it("bietet es an einem FREMDEN Beitrag NICHT an", async () => {
    renderFeed([
      post({ author: { id: "u-fremd", name: "Fremd", avatarUrl: null, tier: "impact" } }),
    ]);

    await screen.findByText(/Mein Beitrag/);
    expect(screen.queryByRole("button", { name: "Bearbeiten" })).toBeNull();
  });

  it("bietet es an einem EVENT-Beitrag nicht an — der ist systemverwaltet", async () => {
    // `posts_write_own` verlangt `kind = 'member'`; ein Knopf, dessen einziger
    // Ausgang eine RLS-Ablehnung wäre, ist eine Einladung zum Fehlklick.
    renderFeed([
      post({
        kind: "event",
        body: "",
        event: { id: "e1", title: "Ein Event", startsAt: null, coverPath: null } as never,
      }),
    ]);

    await screen.findByText(/Ein Event/);
    expect(screen.queryByRole("button", { name: "Bearbeiten" })).toBeNull();
  });

  it("schickt den geänderten Text — und BEHÄLT das kuratierte Schlagwort", async () => {
    renderFeed([post()]);
    fireEvent.click(await screen.findByRole("button", { name: "Bearbeiten" }));

    const feld = screen.getByLabelText(/Beitragstext bearbeiten/i);
    fireEvent.change(feld, { target: { value: "Ganz neuer Text ohne Schlagwort" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(updatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "p1",
          body: "Ganz neuer Text ohne Schlagwort",
          // Der ALTE Text und die ALTEN Schlagworte müssen mitgehen: nur damit
          // lässt sich „kuratiert" von „aus dem Text" unterscheiden.
          alterText: "Mein Beitrag über #Netzwerken",
          alteHashtags: ["netzwerken", "leadership"],
        }),
      ),
    );
  });

  it("entfernt ein Bild über seinen Pfad", async () => {
    renderFeed([
      post({ media: [{ storagePath: "u-ich/p1/0.webp", sort: 0, width: 10, height: 10 }] }),
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "Bearbeiten" }));

    fireEvent.click(screen.getByRole("button", { name: "Bild entfernen" }));

    await waitFor(() => expect(removePostMedia).toHaveBeenCalledWith("u-ich/p1/0.webp"));
  });

  it("löscht den Beitrag auf Verlangen", async () => {
    renderFeed([post()]);
    fireEvent.click(await screen.findByRole("button", { name: "Bearbeiten" }));

    fireEvent.click(screen.getByRole("button", { name: /Beitrag löschen/i }));

    await waitFor(() => expect(deletePost).toHaveBeenCalledWith("p1"));
  });

  it("schliesst den Editor mit Abbrechen, ohne zu speichern", async () => {
    renderFeed([post()]);
    fireEvent.click(await screen.findByRole("button", { name: "Bearbeiten" }));
    fireEvent.change(screen.getByLabelText(/Beitragstext bearbeiten/i), {
      target: { value: "verworfen" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    await waitFor(() => expect(screen.queryByLabelText(/Beitragstext bearbeiten/i)).toBeNull());
    expect(updatePost).not.toHaveBeenCalled();
  });
});
