import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import type { DashboardData } from "../lib/dashboard";

vi.mock("../lib/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/dashboard")>();
  return { ...actual, fetchDashboard: vi.fn() };
});
vi.mock("../lib/contact-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contact-requests")>();
  return { ...actual, fetchIncomingRequests: vi.fn() };
});
import { fetchDashboard } from "../lib/dashboard";
import { fetchIncomingRequests } from "../lib/contact-requests";
import KontaktePage from "./KontaktePage";

const mockedFetch = vi.mocked(fetchDashboard);
const mockedRequests = vi.mocked(fetchIncomingRequests);

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
  hostedEvents: [],
  events: [],
  posts: [],
};

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(DATA);
  mockedRequests.mockReset();
  mockedRequests.mockResolvedValue([]);
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("impact")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <KontaktePage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("KontaktePage", () => {
  it("zeigt Netzwerk, Matching und Communities", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Mein Netzwerk" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mein Matching" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meine Communities" })).toBeInTheDocument();
  });
});
