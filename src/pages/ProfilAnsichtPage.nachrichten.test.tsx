import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import type { DashboardData } from "../lib/dashboard";

/**
 * AGE-583 — der zweite Einstieg zu den Nachrichten.
 *
 * Der Linear-Vorgang nennt hier eine „Dashboard-Kachel". Ein Dashboard gibt es
 * nicht: `/` ist die Startseiten-Weiche und zeigt die öffentliche Landingpage.
 * Der persönliche Bereich ist diese Seite, mit den Kacheln „Netzwerk" und
 * „Events" (Entscheidung Donald, 26.08.).
 *
 * DIE NULL IST AUCH HIER DER WICHTIGERE FALL. AGE-539 hat von dieser Seite
 * genau das entfernt, was über den Betrachter nichts Wahres sagte — den
 * Matches-Zähler auf eine unerreichbare Fläche. Eine „Nachrichten: 0" wäre
 * derselbe Fehler in neu: eine Zahl, die niemandem etwas sagt, auf einer Seite,
 * die deshalb aufgeräumt wurde.
 */
vi.mock("../lib/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/dashboard")>();
  return { ...actual, fetchDashboard: vi.fn() };
});
vi.mock("../lib/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/chat")>();
  return { ...actual, fetchUnreadCounts: vi.fn() };
});

import { fetchDashboard } from "../lib/dashboard";
import { fasseUngelesenZusammen, fetchUnreadCounts } from "../lib/chat";
import ProfilAnsichtPage from "./ProfilAnsichtPage";

const dashboard = vi.mocked(fetchDashboard);
const ungelesen = vi.mocked(fetchUnreadCounts);

const DATEN: DashboardData = {
  profile: {
    id: "test-user",
    name: "Eleonora Voss",
    avatar_url: null,
    cover_url: null,
    region: "Berlin",
    company: "Voss Ventures",
    short_bio: "Kurz.",
    tier: "impact",
    roles: [],
    headline: null,
    member_number: null,
    member_since: null,
    potential_score: 0,
    profile_completion: 60,
    dev_focus: null,
    dev_progress: 0,
    next_steps: [],
  },
  contactsCount: 4,
  eventsCount: 2,
  themeScores: [],
  badges: [],
  goals: [],
  interests: [],
  posts: [],
} as unknown as DashboardData;

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

beforeEach(() => {
  dashboard.mockReset();
  ungelesen.mockReset();
  dashboard.mockResolvedValue(DATEN);
});

describe("Nachrichten-Kachel auf dem eigenen Profil (AGE-583)", () => {
  it("zeigt die Zahl und führt auf /chat", async () => {
    ungelesen.mockResolvedValue(fasseUngelesenZusammen([{ thread_id: "t1", unread_count: 4 }]));
    renderPage();

    const kachel = await screen.findByRole("link", { name: /Nachrichten/ });
    expect(kachel).toHaveAttribute("href", "/chat");
    expect(kachel).toHaveTextContent("4");
  });

  it("bleibt bei null ganz weg — keine Kachel, keine Null", async () => {
    ungelesen.mockResolvedValue(fasseUngelesenZusammen([]));
    renderPage();

    // Erst warten, bis die Seite wirklich steht — sonst prüft das queryBy nur
    // das Skelett und wäre auch grün, wenn die Kachel später erschiene.
    expect(await screen.findByText("Netzwerk")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Nachrichten/ })).toBeNull();
  });
});
