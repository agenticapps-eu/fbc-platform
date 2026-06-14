import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import type { PublicProfileData } from "../lib/public-profile";

// Die Datenschicht wird gemockt: getestet wird der Render-Vertrag der Seite gegenüber
// dem, was die RLS zurückgibt (extended === null ⇒ nur öffentlich; extended gesetzt ⇒
// erweiterte Sicht). Die RLS selbst ist auf DB-Ebene per SQL verifiziert.
vi.mock("../lib/public-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/public-profile")>();
  return { ...actual, fetchPublicProfile: vi.fn() };
});
// Auch die Kontaktbeziehung wird gemockt: getestet wird der Render-Vertrag der Seite
// gegenüber dem, was die RLS zurückgibt (contact nur bei accepted). Die RLS selbst ist
// auf DB-Ebene verifiziert.
vi.mock("../lib/contact-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contact-requests")>();
  return { ...actual, fetchContactRelation: vi.fn() };
});
import { fetchPublicProfile } from "../lib/public-profile";
import { fetchContactRelation, type ContactRelation } from "../lib/contact-requests";
import PublicProfilePage from "./PublicProfilePage";

const mockedFetch = vi.mocked(fetchPublicProfile);
const mockedRelation = vi.mocked(fetchContactRelation);

const NO_RELATION: ContactRelation = { request: null, contact: null, matchId: null };

const PROFILE_ID = "5e195a30-0000-0000-0000-000000000001";

const publicProfile = {
  id: PROFILE_ID,
  name: "Legacy Demo",
  avatar_url: null,
  region: "Berlin",
  company: "Legacy GmbH",
  short_bio: "Begleitet Unternehmer beim Aufbau von Ökosystemen.",
  tier: "legacy",
  roles: ["Unternehmer", "Investor"],
};

const discoverView: PublicProfileData = { publicProfile, extended: null };

const fullView: PublicProfileData = {
  publicProfile,
  extended: {
    headline: null,
    potential_score: 842,
    competencies: ["M&A", "Mentoring"],
    themeScores: [
      { theme: "sein", score: 8.5 },
      { theme: "wirken", score: 6.4 },
    ],
    interests: [{ theme: "tun", label: "Unternehmensaufbau" }],
    offers: [
      {
        id: "o1",
        category: "Kapital",
        theme: "haben",
        title: "Beteiligungskapital",
        description: "Eigenkapital.",
      },
    ],
    needs: [
      {
        id: "n1",
        category: "Projekte",
        theme: "wirken",
        title: "Impact-Projekte",
        description: "DACH-Raum.",
      },
    ],
  },
};

function renderPage(value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/p/${PROFILE_ID}`]}>
            <Routes>
              <Route path="/p/:id" element={<PublicProfilePage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  mockedFetch.mockReset();
  mockedRelation.mockReset();
  mockedRelation.mockResolvedValue(NO_RELATION);
});

describe("Öffentliche Profilseite (AGE-239)", () => {
  it("zeigt Discover nur öffentliche Felder (Name, Rollen, Tier) — keine erweiterten Blöcke", async () => {
    mockedFetch.mockResolvedValue(discoverView);
    renderPage(authAsTier("discover"));

    expect(await screen.findByRole("heading", { name: "Legacy Demo" })).toBeInTheDocument();
    expect(screen.getByText("Investor")).toBeInTheDocument();
    expect(screen.getByText(/Legacy Member/i)).toBeInTheDocument();

    // Erweiterte Blöcke fehlen — die RLS gab sie nicht frei (extended === null).
    expect(screen.queryByRole("heading", { name: "Erfolgsradar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kompetenzen" })).not.toBeInTheDocument();
    expect(screen.queryByText("842")).not.toBeInTheDocument();
    // Kein Kontakt-Senden-Button für Discover; stattdessen der Prime-Hinweis-Block.
    expect(screen.queryByRole("button", { name: "Kontaktanfrage senden" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Erweiterte Profilangaben" })).toBeInTheDocument();
  });

  it("zeigt Prime die erweiterten Felder und den Kontaktanfrage-Button", async () => {
    mockedFetch.mockResolvedValue(fullView);
    renderPage(authAsTier("prime"));

    expect(await screen.findByRole("heading", { name: "Erfolgsradar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kompetenzen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Such- & Bieteprofil" })).toBeInTheDocument();
    expect(screen.getByText("842")).toBeInTheDocument();
    expect(screen.getByText("Beteiligungskapital")).toBeInTheDocument();
    expect(screen.getByText("Impact-Projekte")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kontaktanfrage senden" })).toBeInTheDocument();
  });

  it("zeigt auf dem eigenen Profil „Profil bearbeiten“ statt eines Kontakt-Buttons", async () => {
    mockedFetch.mockResolvedValue(fullView);
    renderPage(
      fakeAuthValue({
        user: { id: PROFILE_ID } as AuthContextValue["user"],
        tier: "legacy",
        levelRank: 7,
      }),
    );

    expect(await screen.findByRole("link", { name: "Profil bearbeiten" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kontaktanfrage senden" })).not.toBeInTheDocument();
  });

  it("zeigt vor Annahme keine Kontaktdaten — Hinweis ist präsent, keine E-Mail/Telefon", async () => {
    mockedFetch.mockResolvedValue(fullView);
    renderPage(authAsTier("prime"));

    expect(
      await screen.findByText("E-Mail und Telefon werden nie automatisch angezeigt."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Kontakt freigegeben/)).not.toBeInTheDocument();
  });

  it("zeigt Kontaktdaten ERST nach Annahme (RLS gibt `contact` nur bei accepted zurück)", async () => {
    mockedFetch.mockResolvedValue(fullView);
    mockedRelation.mockResolvedValue({
      request: { id: "cr1", status: "accepted", outgoing: true },
      contact: { email: "legacy@example.com", phone: "+49 30 1234567" },
      matchId: null,
    });
    renderPage(authAsTier("prime"));

    expect(await screen.findByText("Kontakt freigegeben")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "legacy@example.com" })).toHaveAttribute(
      "href",
      "mailto:legacy@example.com",
    );
    expect(screen.getByRole("link", { name: "+49 30 1234567" })).toHaveAttribute(
      "href",
      "tel:+49 30 1234567",
    );
    // Im freigegebenen Zustand verschwindet der Senden-Button.
    expect(screen.queryByRole("button", { name: "Kontaktanfrage senden" })).not.toBeInTheDocument();
  });
});
