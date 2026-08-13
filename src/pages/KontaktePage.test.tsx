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
    cover_url: null,
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
  it("zeigt das Netzwerk", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Mein Netzwerk" })).toBeInTheDocument();
  });

  // Derselbe Fall wie „Aktivität & Portfolio" in AGE-494 (Task 7.6), nur auf
  // dieser Seite: drei erfundene Communities mit erfundenen Mitgliederzahlen,
  // präsentiert als die des Mitglieds. Ab dem 17.08. sehen das echte Menschen.
  // Bewusst KEIN Leerzustand als Ersatz — Communities existieren in Phase 1
  // nicht, ein „Noch keine Communities" verspräche eine Funktion, die es nicht
  // gibt.
  it("zeigt kein Communities-Widget mehr", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mein Netzwerk" });
    expect(screen.queryByRole("heading", { name: "Meine Communities" })).toBeNull();
  });

  // AGE-450: Matching ist fürs Sommerfest raus — das „Mein Matching"-Widget
  // erscheint nicht mehr auf der Kontakte-Seite.
  it("zeigt kein Matching-Widget mehr", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mein Netzwerk" });
    expect(screen.queryByRole("heading", { name: "Mein Matching" })).toBeNull();
  });

  // AGE-539: Unter der echten Kontaktzahl stand eine fest verdrahtete
  // „Aufschlüsselung" — 24 Freunde, 8 Preferred Partner, 3 Mentoren, 5 Mentees,
  // unabhängig von den tatsächlichen Kontakten. Derselbe Fall wie DEMO_POSTS auf
  // dem Profil: erfundene Zahlen ÜBER DAS MITGLIED SELBST. Die Demo-Marke machte
  // sie nicht wahr.
  it("zeigt keine erfundene Netzwerk-Aufschlüsselung", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mein Netzwerk" });
    expect(screen.queryByText("Aufschlüsselung")).toBeNull();
  });

  it("nennt keine erfundenen Kontaktgruppen", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mein Netzwerk" });
    expect(screen.queryByText("Freunde")).toBeNull();
    expect(screen.queryByText("Preferred Partner")).toBeNull();
    expect(screen.queryByText("Mentoren")).toBeNull();
    expect(screen.queryByText("Mentees")).toBeNull();
  });

  it("trägt keine Demo-Marke mehr", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Mein Netzwerk" });
    expect(screen.queryByText("Demo")).toBeNull();
  });

  // Bewahrend: die echte Zahl ist der Grund, warum das Widget bleibt. Geprüft
  // wird der WERT, nicht nur die Beschriftung — eine fehlende oder fest
  // verdrahtete Zahl bestünde sonst den Test.
  // (Fremd-Review auf dem Diff, codex, MEDIUM.)
  it("zeigt die Zahl der bestätigten Kontakte", async () => {
    mockedFetch.mockResolvedValue({ ...DATA, contactsCount: 7 });
    renderPage();
    await screen.findByRole("heading", { name: "Mein Netzwerk" });
    const label = screen.getByText("Bestätigte Kontakte");
    expect(label.parentElement?.textContent).toContain("7");
  });

  // Bewahrend (AGE-494): ohne Kontakte steht bewusst KEINE Null, sondern eine
  // Einladung. Der Ausbau der Aufschlüsselung darf daran nichts ändern.
  it("lädt ohne Kontakte ein, statt eine Null zu zeigen", async () => {
    mockedFetch.mockResolvedValue({ ...DATA, contactsCount: 0 });
    renderPage();
    const karte = (await screen.findByRole("heading", { name: "Mein Netzwerk" })).closest("div")
      ?.parentElement;
    expect(screen.getByRole("link", { name: "Mitglieder entdecken" })).toBeInTheDocument();
    expect(screen.queryByText("Bestätigte Kontakte")).toBeNull();
    expect(karte?.textContent).not.toContain("0");
  });
});
