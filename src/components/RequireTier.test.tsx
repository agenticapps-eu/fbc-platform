import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "../components/ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";

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

describe("Stufen-Gating für /verzeichnis (min Prime)", () => {
  it("leitet Discover vom Verzeichnis weg auf die Community-Startseite", () => {
    renderAt("/verzeichnis", authAsTier("discover"));

    // Verzeichnis-Inhalt darf nicht erscheinen; stattdessen Community (Redirect / → /community).
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Community" })).toBeInTheDocument();
  });

  it("lässt Prime das Verzeichnis sehen", () => {
    renderAt("/verzeichnis", authAsTier("prime"));

    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("lässt Legacy (höhere Stufe) das Verzeichnis sehen", () => {
    renderAt("/verzeichnis", authAsTier("legacy"));

    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("leitet nicht eingeloggte Nutzer auf /login", () => {
    renderAt("/verzeichnis", fakeAuthValue());

    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });
});

describe("Auth-Gating für /mein-bereich", () => {
  it("leitet nicht eingeloggte Nutzer auf /login", () => {
    renderAt("/mein-bereich", fakeAuthValue());

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("lässt eingeloggte Discover-Nutzer Mein Bereich sehen", () => {
    renderAt("/mein-bereich", authAsTier("discover"));

    // Kein Redirect auf /login → der Auth-Gate hat durchgelassen; das Dashboard
    // mountet und lädt seine Daten (Beleg, dass die Seite gerendert wird).
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard wird geladen…")).toBeInTheDocument();
  });

  it("blockiert Mein Bereich nicht, während die Stufe noch lädt (nur Session nötig)", () => {
    renderAt("/mein-bereich", authLoadingTier());

    expect(screen.getByText("Dashboard wird geladen…")).toBeInTheDocument();
  });
});

describe("Auth-Gating für /profil", () => {
  it("leitet nicht eingeloggte Nutzer auf /login", () => {
    renderAt("/profil", fakeAuthValue());

    expect(screen.queryByRole("heading", { name: "Profil" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("lässt eingeloggte Mitglieder den Profil-Editor öffnen (jede Stufe, auch Discover)", () => {
    renderAt("/profil", authAsTier("discover"));

    // Kein Redirect auf /login → der Auth-Gate hat durchgelassen; der Editor
    // mountet und lädt seine Daten.
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.getByText("Profil wird geladen…")).toBeInTheDocument();
  });
});

describe("Stufen-Gating wartet auf das Laden der Stufe", () => {
  it("leitet einen eingeloggten Nutzer NICHT vorzeitig weg, solange die Stufe lädt", () => {
    renderAt("/verzeichnis", authLoadingTier());

    // Kein vorzeitiger Redirect auf / (Community) und noch kein Verzeichnis-Inhalt:
    // RequireTier rendert nichts, bis level_rank bekannt ist.
    expect(screen.queryByRole("heading", { name: "Community" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });
});
