import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import type { DashboardData } from "../lib/dashboard";

// Recharts braucht echte Layout-Maße (jsdom liefert 0) — der Radar wird gemockt.
vi.mock("../components/dashboard/ErfolgsradarChart", () => ({
  ErfolgsradarChart: () => <div data-testid="radar-chart" />,
}));

// Datenschicht mocken: getestet wird der Render-Vertrag (CORE = echte Daten,
// DEMO = sichtbar gekennzeichnet), nicht die Supabase-Queries selbst.
vi.mock("../lib/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/dashboard")>();
  return { ...actual, fetchDashboard: vi.fn() };
});
import { fetchDashboard } from "../lib/dashboard";
import MeinBereichPage from "./MeinBereichPage";

const mockedFetch = vi.mocked(fetchDashboard);
const UID = "5e195a30-0000-0000-0000-000000000238";

const baseData: DashboardData = {
  profile: {
    id: UID,
    name: "Maximilian Bauer",
    avatar_url: null,
    region: "Stuttgart",
    company: "Bauer Holding",
    short_bio: "Deal Keeper.",
    tier: "legacy",
    roles: ["Unternehmer", "Investor"],
    headline: null,
    member_number: "FBC-10023",
    member_since: "2019-03-01",
    potential_score: 873,
    dev_focus: "wirken",
    dev_progress: 70,
    next_steps: ["Compass-Tiefenanalyse abschließen", "Mentee-Programm starten"],
  },
  themeScores: [
    { theme: "sein", score: 8.5 },
    { theme: "wirken", score: 6.4 },
  ],
  interests: [{ theme: "tun", label: "Unternehmensaufbau" }],
  goals: [{ category: "unternehmerisch", title: "Skalierung auf 3 Standorte", progress: 45 }],
  offers: [{ id: "o1", category: "kapital", theme: "haben", title: "Beteiligungskapital" }],
  needs: [{ id: "n1", category: "projekte", theme: "wirken", title: "Impact-Projekte" }],
  badges: [{ key: "mentor", label: "Certified Mentor", icon: null, awarded_at: "2021-06-01" }],
  matchStats: { active: 4, successful: 2, avgScore: 81 },
  contactsCount: 17,
  eventsCount: 3,
  events: [
    {
      status: "registered",
      checked_in: false,
      event: {
        id: "e1",
        title: "Legacy Summit 2026",
        type: "presence",
        starts_at: "2026-09-10T09:00:00Z",
        location: "München",
      },
    },
  ],
  posts: [
    {
      id: "p1",
      body: "Mein Beitrag über Ökosysteme.",
      hashtags: null,
      created_at: "2026-06-01T09:00:00Z",
      visibility: "members",
    },
  ],
};

function renderPage(data: DashboardData) {
  mockedFetch.mockResolvedValue(data);
  const value: AuthContextValue = fakeAuthValue({
    user: { id: UID } as AuthContextValue["user"],
    tier: "legacy",
    levelRank: 7,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/mein-bereich"]}>
          <MeinBereichPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => mockedFetch.mockReset());

describe("Mein-Bereich-Dashboard (AGE-240)", () => {
  it("rendert die CORE-Widgets mit echten Daten", async () => {
    renderPage(baseData);

    // Header (CORE): Name, Tier, Mitgliedsnummer, Impact-Stat.
    expect(await screen.findByRole("heading", { name: "Maximilian Bauer" })).toBeInTheDocument();
    expect(screen.getByText(/FBC-10023/)).toBeInTheDocument();

    // Erfolgsradar (CORE) — gemockter Chart ist vorhanden (lazy → findBy).
    expect(await screen.findByTestId("radar-chart")).toBeInTheDocument();

    // Entwicklung (CORE): Fortschritt + nächste Schritte.
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("Mentee-Programm starten")).toBeInTheDocument();

    // Interessen / Matching / Ziele / Auszeichnungen / Impact (CORE).
    expect(screen.getByText("Unternehmensaufbau")).toBeInTheDocument();
    expect(screen.getByText("Beteiligungskapital")).toBeInTheDocument();
    expect(screen.getByText("Impact-Projekte")).toBeInTheDocument();
    expect(screen.getByText("Skalierung auf 3 Standorte")).toBeInTheDocument();
    expect(screen.getByText("Certified Mentor")).toBeInTheDocument();
    // potential_score erscheint als Impact-Stat-Tile UND in der Impact-Card.
    expect(screen.getAllByText("873").length).toBeGreaterThanOrEqual(1);
    // Netzwerk-Count (CORE) ist echt.
    // contactsCount erscheint als Netzwerk-Stat-Tile UND im Netzwerk-Widget.
    expect(screen.getByText("Bestätigte Kontakte")).toBeInTheDocument();
    expect(screen.getAllByText("17").length).toBeGreaterThanOrEqual(1);
    // Echte gebuchte Events statt DEMO-Fallback.
    expect(screen.getByText("Legacy Summit 2026")).toBeInTheDocument();
  });

  it("kennzeichnet die DEMO-Widgets sichtbar als „Demo“", async () => {
    renderPage(baseData);

    expect(await screen.findByRole("heading", { name: "Meine Communities" })).toBeInTheDocument();
    expect(screen.getByText("Unternehmer-Kreis Süd")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meine Statistik (30 Tage)" })).toBeInTheDocument();

    // Mehrere Demo-Marker (Communities, Statistik, Projekte, Investments, KI, …).
    expect(screen.getAllByText("Demo").length).toBeGreaterThanOrEqual(5);
  });

  it("fällt für Events/Beiträge auf gekennzeichnete DEMO-Daten zurück, wenn keine echten existieren", async () => {
    renderPage({ ...baseData, events: [], posts: [] });

    // DEMO-Fallback-Inhalte erscheinen, klar als Demo markiert.
    expect(await screen.findByText("Legacy Dinner Stuttgart")).toBeInTheDocument();
    expect(screen.getByText(/Warum Ökosysteme die Zukunft/)).toBeInTheDocument();
  });
});
