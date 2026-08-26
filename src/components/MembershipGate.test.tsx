import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import { REGISTRIEREN_PFAD } from "../pages/LoginPage";

afterEach(() => localStorage.clear());

/** Eingeloggt, aber tier/level_rank werden noch geladen (Profil-Fetch offen). */
function authLoadingTier(): AuthContextValue {
  return fakeAuthValue({
    user: { id: "test-user" } as AuthContextValue["user"],
    tier: null,
    levelRank: null,
    tierLoading: true,
  });
}

function renderAt(path: string, value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("MembershipGate für Entdecken-Routen", () => {
  // AGE-494: /kompass ist keine „entdecken"-Route mehr (kein Menüeintrag), also
  // greift dort RequireAuth statt der Wand. Die Regel, die dieser Test schützt —
  // ein Schaufenster-Format mauert, statt wegzuleiten — gilt weiter für /academy.
  it("zeigt anon auf einem auth-gegateten Format (/academy) die Wand statt eines Redirects", () => {
    renderAt("/academy", fakeAuthValue());

    // Kein Redirect auf /login; stattdessen die „Mitglied werden"-Wand.
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist Mitgliedern vorbehalten" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mitglied werden" })).toHaveAttribute(
      "href",
      REGISTRIEREN_PFAD,
    );
    // Academy-Inhalt bleibt gesperrt.
    expect(screen.queryByText("Mit dem „Warum“ beginnen")).not.toBeInTheDocument();
  });

  it("lässt ein eingeloggtes Mitglied das auth-gegatete Format sehen", () => {
    renderAt("/academy", authAsTier("basic"));

    expect(screen.getByText("Mit dem „Warum“ beginnen")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Dieser Bereich ist Mitgliedern vorbehalten" }),
    ).not.toBeInTheDocument();
  });

  // AGE-450: /meine-chancen ist keine gegatete Route mehr (leitet auf /). Diese
  // beiden Fälle — „Zur Startseite" statt „Mitglied werden", und der Upgrade-Weg —
  // prüfen wir jetzt an /mitglieder, der verbleibenden discover-gegateten Route.
  it("zeigt einer zu niedrigen Stufe die Stufen-Wand mit „Zur Startseite“ statt CTA", () => {
    renderAt("/mitglieder", authAsTier("basic"));

    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Discover verfügbar" }),
    ).toBeInTheDocument();
    // Eingeloggt-aber-zu-niedrig: kein „Mitglied werden"-CTA, nur „Zur Startseite".
    // Seit AGE-616 ist der CTA ein Link — beide Rollen prüfen, sonst ginge eine
    // Rückkehr zum Knopf hier unbemerkt durch.
    expect(screen.queryByRole("button", { name: "Mitglied werden" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mitglied werden" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zur Startseite" })).toBeInTheDocument();
  });

  it("bietet eingeloggten Nutzern mit zu niedriger Stufe einen Upgrade-Weg zu /mitgliedschaft", () => {
    renderAt("/mitglieder", authAsTier("basic"));

    const upgradeBtn = screen.getByRole("button", { name: "Upgrade" });
    fireEvent.click(upgradeBtn);

    expect(screen.getByRole("heading", { name: "Mitgliedschaft" })).toBeInTheDocument();
  });
});

/**
 * Übersetzt aus RequireTier.test.tsx (AGE-314). Das Verzeichnis lag bis dahin unter
 * /verzeichnis und leitete zu niedrige Stufen weg. Als Top-Level-Eintrag „Mitglieder"
 * mauert es stattdessen (Spec §1) — die Zusage ist dieselbe, nur die Einlösung ist neu.
 */
describe("Stufen-Gating für /mitglieder (min Discover)", () => {
  it("zeigt Basic die Wand statt Mitgliederdaten", () => {
    renderAt("/mitglieder", authAsTier("basic"));

    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Discover verfügbar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });

  it("lässt Discover das Verzeichnis sehen", () => {
    renderAt("/mitglieder", authAsTier("discover"));

    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("lässt Impact (höhere Stufe) das Verzeichnis sehen", () => {
    renderAt("/mitglieder", authAsTier("impact"));

    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("zeigt anonymen Besuchern die Wand mit „Mitglied werden“ — kein Verzeichnis", () => {
    renderAt("/mitglieder", fakeAuthValue());

    expect(screen.getByRole("link", { name: "Mitglied werden" })).toHaveAttribute(
      "href",
      REGISTRIEREN_PFAD,
    );
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });

  it("rendert nichts, solange die Stufe noch lädt — kein Aufblitzen der Wand", () => {
    renderAt("/mitglieder", authLoadingTier());

    expect(
      screen.queryByRole("heading", { name: "Dieser Bereich ist ab Discover verfügbar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });
});
