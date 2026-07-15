import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "../components/ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";

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

function renderAt(path: string, value: Parameters<typeof AuthFixture>[0]["value"]) {
  // App-weite Provider (sonst in main.tsx) mitliefern: /profil mountet den
  // Profil-Editor, der QueryClient + Toasts braucht. retry:false hält die
  // (im Test ins Leere laufende) Profil-Abfrage im Lade-Zustand stabil.
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

describe("Auth-Gating für /mein-bereich", () => {
  it("leitet nicht eingeloggte Nutzer auf /login", () => {
    renderAt("/mein-bereich", fakeAuthValue());

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("lässt eingeloggte Basic-Nutzer Mein Bereich sehen", () => {
    renderAt("/mein-bereich", authAsTier("basic"));

    // /mein-bereich leitet auf /profil weiter; der Auth-Gate hat durchgelassen
    // und die Profilansicht rendert (Beleg: Lade-Skeleton sichtbar, kein Login).
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("blockiert Mein Bereich nicht, während die Stufe noch lädt (nur Session nötig)", () => {
    renderAt("/mein-bereich", authLoadingTier());

    // /mein-bereich → /profil (RequireAuth, kein MembershipGate): bei laufendem
    // tier-Fetch reicht die Session – kein vorzeitiger Redirect auf /login.
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("Auth-Gating für /profil", () => {
  it("leitet nicht eingeloggte Nutzer auf /login", () => {
    renderAt("/profil", fakeAuthValue());

    expect(screen.queryByRole("heading", { name: "Profil" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("lässt eingeloggte Mitglieder den Profil-Editor öffnen (jede Stufe, auch Basic)", () => {
    renderAt("/profil/bearbeiten", authAsTier("basic"));

    // Kein Redirect auf /login → der Auth-Gate hat durchgelassen; der Editor
    // mountet und lädt seine Daten.
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.getByText("Profil wird geladen…")).toBeInTheDocument();
  });
});
