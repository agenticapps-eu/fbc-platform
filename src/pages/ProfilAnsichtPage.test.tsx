import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import type { DashboardData } from "../lib/dashboard";

vi.mock("../components/dashboard/ErfolgsradarChart", () => ({
  ErfolgsradarChart: () => <div data-testid="radar-chart" />,
}));
vi.mock("../lib/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/dashboard")>();
  return { ...actual, fetchDashboard: vi.fn() };
});
import { fetchDashboard } from "../lib/dashboard";
import ProfilAnsichtPage from "./ProfilAnsichtPage";

const mockedFetch = vi.mocked(fetchDashboard);

const DATA: DashboardData = {
  profile: {
    id: "test-user",
    name: "Eleonora Voss",
    avatar_url: null,
    region: "Berlin",
    company: "Voss Ventures",
    short_bio: null,
    tier: "legacy",
    roles: ["Investorin"],
    headline: null,
    member_number: null,
    member_since: null,
    potential_score: 82,
    profile_completion: 60,
    dev_focus: null,
    dev_progress: 0,
    next_steps: [],
  },
  themeScores: [],
  scoreBreakdown: null,
  interests: [{ theme: "tun", label: "Impact Investing" }],
  goals: [],
  offers: [],
  needs: [],
  badges: [],
  matchStats: { active: 0, successful: 1, avgScore: 0 },
  contactsCount: 1,
  eventsCount: 2,
  events: [],
  hostedEvents: [],
  posts: [],
};

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(DATA);
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("impact")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilAnsichtPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("ProfilAnsichtPage (Bento)", () => {
  it("zeigt Hero, KPI und Profil-Kacheln und einen Bearbeiten-Link", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Eleonora Voss" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profil bearbeiten" })).toHaveAttribute(
      "href",
      "/profil/bearbeiten",
    );
    expect(screen.getByRole("heading", { name: "Mein Erfolgsradar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meine Interessen" })).toBeInTheDocument();
    // Impact Score / potential_score sind für den MVP ausgeblendet (Nav-IA §3).
    expect(screen.queryByText("Impact Score")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Mein Impact" })).toBeNull();
  });
});
