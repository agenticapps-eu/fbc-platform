import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/public-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/public-profile")>();
  return { ...actual, fetchPublicProfile: vi.fn() };
});
import { fetchPublicProfile, type PublicProfileData } from "../lib/public-profile";

vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn() };
});
import { fetchPlatformSettings } from "../lib/platform-settings";

import PublicProfilePage from "./PublicProfilePage";

const ZIEL = "66666666-6666-6666-6666-666666666666";

const VOLL: PublicProfileData = {
  publicProfile: {
    id: ZIEL,
    name: "Fremdes Mitglied",
    avatar_url: null,
    cover_url: "https://cdn.test/covers/x.webp",
    region: "Berlin",
    company: "Bauer Holding",
    short_bio: "Unternehmer und Investor.",
    tier: "impact",
    roles: ["Investor"],
  },
  extended: {
    headline: "Unternehmer · Investor",
    potential_score: 42,
    competencies: ["Finanzierung"],
    videos: [],
    interests: [{ theme: "tun", label: "Segeln" }],
    // `source: "chip"` und ein Schlüssel, den `config/matching` KENNT (AGE-597):
    // die Fixture trug bis dahin `vertrieb`, das dort gar nicht steht. Der Fall
    // „unbekannter Schlüssel" hat jetzt einen eigenen Test.
    offers: [
      {
        id: "o1",
        category: "kapital",
        theme: null,
        title: "Kapital",
        description: null,
        source: "chip",
      },
    ],
    needs: [
      {
        id: "n1",
        category: "partner",
        theme: null,
        title: "Partner",
        description: null,
        source: "chip",
      },
    ],
    branche: "Immobilien",
    member_since: "2019-04-01",
    posts: [
      {
        id: "p1",
        body: "Mein Beitrag",
        created_at: "2026-07-01T10:00:00Z",
        veroeffentlicht_ab: "2026-07-01T10:00:00Z",
      },
    ],
  },
};

beforeEach(() => {
  vi.mocked(fetchPublicProfile).mockReset().mockResolvedValue(VOLL);
  vi.mocked(fetchPlatformSettings).mockReset().mockResolvedValue({ openContact: false });
});

function renderPage(daten: PublicProfileData = VOLL) {
  vi.mocked(fetchPublicProfile).mockResolvedValue(daten);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthFixture value={authAsTier("impact")}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/p/${ZIEL}`]}>
            <Routes>
              <Route path="/p/:id" element={<PublicProfilePage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
}

/** Reihenfolge der Überschriften im Dokument, gefiltert auf die des Mockups. */
function abschnitte(): string[] {
  const gesucht = [
    "Über mich",
    "Beruf",
    "Hobbys",
    "Ich biete",
    "Ich suche",
    "Aktivitäten",
    "Eckdaten",
  ];
  return screen
    .getAllByRole("heading")
    .map((h) => h.textContent?.trim() ?? "")
    .filter((t) => gesucht.includes(t));
}

describe("PublicProfilePage — Aufbau nach dem Mockup (AGE-498)", () => {
  it("zeigt die Abschnitte in der Reihenfolge des Mockups", async () => {
    renderPage();
    await screen.findByText("Fremdes Mitglied");
    expect(abschnitte()).toEqual([
      "Über mich",
      "Beruf",
      "Hobbys",
      "Ich biete",
      "Ich suche",
      "Aktivitäten",
      "Eckdaten",
    ]);
  });

  it("nimmt „Ich biete“ und „Ich suche“ aus dem Kompass — keine zweite Liste", async () => {
    renderPage();
    expect(await screen.findByText("Kapital")).toBeInTheDocument();
    expect(screen.getByText("Partner")).toBeInTheDocument();
  });

  it("lässt leere Abschnitte weg, statt Platzhalter zu zeigen", async () => {
    renderPage({
      ...VOLL,
      extended: { ...VOLL.extended!, interests: [], offers: [], needs: [], posts: [] },
    });
    await screen.findByText("Fremdes Mitglied");
    expect(abschnitte()).toEqual(["Über mich", "Beruf", "Eckdaten"]);
  });

  it("trägt ohne Hintergrundbild genauso — der Verlauf springt ein", async () => {
    renderPage({
      ...VOLL,
      publicProfile: { ...VOLL.publicProfile!, cover_url: null },
    });
    await screen.findByText("Fremdes Mitglied");
    expect(abschnitte()).toContain("Über mich");
    expect(screen.queryByRole("img", { name: "" })).not.toBeInTheDocument();
  });

  it("zeigt die Eckdaten aus dem Profil", async () => {
    renderPage();
    // Auf die Beschriftungen geprüft, nicht auf „Berlin": die Region steht auch
    // im Hero, und ein Text-Treffer sagte nicht, WELCHER der beiden gemeint ist.
    expect(await screen.findByText("Mitglied seit")).toBeInTheDocument();
    expect(screen.getByText("Standort")).toBeInTheDocument();
    expect(screen.getByText("April 2019")).toBeInTheDocument();
  });
});
