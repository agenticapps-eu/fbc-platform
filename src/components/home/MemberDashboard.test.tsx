import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "../../lib/dashboard";
import type { DirectoryMember } from "../../lib/directory";

vi.mock("../../lib/dashboard", async (o) => ({
  ...(await o<typeof import("../../lib/dashboard")>()),
  fetchDashboard: vi.fn(),
}));
vi.mock("../../lib/events", async (o) => ({
  ...(await o<typeof import("../../lib/events")>()),
  fetchEvents: vi.fn(),
}));
vi.mock("../../lib/feed", async (o) => ({
  ...(await o<typeof import("../../lib/feed")>()),
  fetchFeed: vi.fn(),
}));
vi.mock("../../lib/directory", async (o) => ({
  ...(await o<typeof import("../../lib/directory")>()),
  fetchDirectoryBaseline: vi.fn(),
}));
vi.mock("../../lib/event-cover", async (o) => ({
  ...(await o<typeof import("../../lib/event-cover")>()),
  signEventCovers: vi.fn(),
}));
vi.mock("../../lib/post-media", async (o) => ({
  ...(await o<typeof import("../../lib/post-media")>()),
  signPostMedia: vi.fn(),
}));

import { fetchDashboard } from "../../lib/dashboard";
import { fetchEvents } from "../../lib/events";
import { fetchFeed } from "../../lib/feed";
import { fetchDirectoryBaseline } from "../../lib/directory";
import { signEventCovers } from "../../lib/event-cover";
import { signPostMedia } from "../../lib/post-media";
import type { FeedPost } from "../../lib/feed";
import { MemberDashboard } from "./MemberDashboard";

const DASH: DashboardData = {
  profile: {
    id: "u1",
    name: "Anna Müller",
    avatar_url: null,
    cover_url: null,
    region: "Stuttgart",
    company: "Müller GmbH",
    short_bio: null,
    tier: "exchange",
    roles: [],
    headline: null,
    member_number: null,
    member_since: null,
    potential_score: 40,
    profile_completion: 60,
    dev_focus: null,
    dev_progress: 0,
    next_steps: [],
  },
  themeScores: [],
  scoreBreakdown: null,
  interests: [],
  goals: [],
  offers: [],
  needs: [],
  badges: [],
  matchStats: { active: 2, successful: 0, avgScore: 0 },
  contactsCount: 0,
  eventsCount: 0,
  events: [],
  hostedEvents: [],
  posts: [],
};

const MEMBERS = [
  {
    id: "m1",
    name: "Beatrice Sommer",
    avatar_url: null,
    region: "Hamburg",
    company: "Sommer Co",
    branche: null,
    tier: "discover",
    competencies: null,
  },
] as unknown as DirectoryMember[];

beforeEach(() => {
  vi.mocked(fetchDashboard).mockReset().mockResolvedValue(DASH);
  vi.mocked(fetchEvents).mockReset().mockResolvedValue([]);
  vi.mocked(fetchFeed).mockReset().mockResolvedValue({ posts: [], nextCursor: null });
  vi.mocked(signEventCovers).mockReset().mockResolvedValue({});
  vi.mocked(signPostMedia).mockReset().mockResolvedValue({});
  vi.mocked(fetchDirectoryBaseline).mockReset().mockResolvedValue(MEMBERS);
});

function renderDash() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MemberDashboard uid="u1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MemberDashboard", () => {
  it("begrüßt mit dem Vornamen und zeigt echte Kennzahlen", async () => {
    renderDash();
    // AGE-499: Der Gruß steht in der Eyebrow-Zeile des Heros, die Überschrift
    // trägt die Kampagnenzeile. Der Vorname muss trotzdem auftauchen — er ist der
    // Grund, warum das Dashboard überhaupt eine Begrüßung hat.
    expect(
      await screen.findByRole("heading", { name: /Deine nächste Chance/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Anna$/)).toBeInTheDocument();
    // Compass % kommt direkt aus profile_completion.
    expect(screen.getByText("60%")).toBeInTheDocument();
    // Mein Plan zeigt das Stufen-Label (levelLabel), nicht den rohen Key.
    expect(screen.getByText("Exchange")).toBeInTheDocument();
  });

  it("empfiehlt sichtbare Mitglieder und leitet einen Compass-Schritt aus der Lücke ab", async () => {
    renderDash();
    expect(await screen.findByText("Beatrice Sommer")).toBeInTheDocument();
    // 80 % Schwelle minus 60 % Vollständigkeit = noch 20 %.
    expect(screen.getByText(/Noch 20%/)).toBeInTheDocument();
  });

  it("zeigt einen Leerzustand statt Fake-Daten, wenn kein Event ansteht", async () => {
    renderDash();
    expect(await screen.findByText("Aktuell kein Event geplant")).toBeInTheDocument();
  });
});

/** Ein Beitrag mit allen Pflichtfeldern; die Abweichung kommt je Test dazu. */
function beitrag(over: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p1",
    author: { id: "a1", name: "Carla Beispiel", avatarUrl: null, tier: "impact" },
    body: "",
    hashtags: [],
    visibility: "public",
    createdAt: "2026-08-27T10:00:00Z",
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    media: [],
    videoUrl: null,
    kind: "member",
    event: null,
    ...over,
  } as FeedPost;
}

describe("Vorschaubilder in der Aktivitätsliste (AGE-635)", () => {
  it("zeigt das Cover eines Event-Beitrags", async () => {
    vi.mocked(fetchFeed).mockResolvedValue({
      posts: [
        beitrag({
          kind: "event",
          event: {
            id: "e1",
            title: "FBC Weekly Onlinetreffen",
            startsAt: "2026-09-01T18:00:00Z",
            location: null,
            coverPath: "e1/cover.jpg",
          },
        }),
      ],
      nextCursor: null,
    });
    vi.mocked(signEventCovers).mockResolvedValue({ "e1/cover.jpg": "blob:signiert-cover" });

    renderDash();

    const bild = await screen.findByRole("img", { name: "FBC Weekly Onlinetreffen" });
    expect(bild).toHaveAttribute("src", "blob:signiert-cover");
  });

  it("lässt bei einem Beitrag ohne Bild und ohne Event die Fläche ganz weg", async () => {
    // Kein Platzhalterkasten: eine leere Fläche rechts sieht aus wie ein Bild,
    // das nicht geladen hat, und lässt die Zeile springen.
    vi.mocked(fetchFeed).mockResolvedValue({
      posts: [beitrag({ body: "Nur Text." })],
      nextCursor: null,
    });

    renderDash();

    await screen.findByText("Nur Text.");
    const liste = screen.getByText("Nur Text.").closest("li")!;
    expect(liste.querySelector("img")).toBeNull();
  });
});
