import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "../components/ui/Toast";
import { markSkipped } from "../lib/compass";
import { TIER_RANK } from "../lib/tiers";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";

afterEach(() => localStorage.clear());

/** Eingeloggtes Staff-Mitglied (matching_manager). */
function authAsStaff(): AuthContextValue {
  return fakeAuthValue({
    user: { id: "staff-user" } as AuthContextValue["user"],
    tier: "prime",
    levelRank: TIER_RANK.prime,
    staffRole: "matching_manager",
  });
}

/** Eingeloggt, aber Profil (inkl. staffRole) lädt noch. */
function authLoadingProfile(): AuthContextValue {
  return fakeAuthValue({
    user: { id: "test-user" } as AuthContextValue["user"],
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

describe("Staff-Gating für /intern/routing", () => {
  it("leitet nicht eingeloggte Nutzer auf /login", () => {
    renderAt("/intern/routing", fakeAuthValue());

    expect(screen.queryByRole("heading", { name: "Routing-Queue" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("leitet eingeloggte Mitglieder OHNE Staff-Rolle weg (auch Prime)", () => {
    // „/" ist onboarding-bewusst (HomeRedirect); der „übersprungen"-Merker löst die
    // Weiche deterministisch auf /community auf, sodass der Test das Gating prüft.
    markSkipped("test-user");
    renderAt("/intern/routing", authAsTier("prime"));

    expect(screen.queryByRole("heading", { name: "Routing-Queue" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Community" })).toBeInTheDocument();
  });

  it("lässt Staff (matching_manager) die Routing-Queue sehen", () => {
    renderAt("/intern/routing", authAsStaff());

    expect(screen.getByRole("heading", { name: "Routing-Queue" })).toBeInTheDocument();
  });

  it("leitet NICHT vorzeitig weg, solange das Profil (staffRole) noch lädt", () => {
    renderAt("/intern/routing", authLoadingProfile());

    // RequireStaff rendert nichts, bis staffRole bekannt ist — weder Queue noch Redirect.
    expect(screen.queryByRole("heading", { name: "Routing-Queue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Community" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
  });
});
