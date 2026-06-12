import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../App";
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
  return render(
    <AuthFixture value={value}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthFixture>,
  );
}

describe("Stufen-Gating für /verzeichnis (min Prime)", () => {
  it("leitet Discover vom Verzeichnis weg auf den Feed", () => {
    renderAt("/verzeichnis", authAsTier("discover"));

    // Verzeichnis-Inhalt darf nicht erscheinen; stattdessen der Feed (Redirect /).
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feed" })).toBeInTheDocument();
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

    expect(screen.getByRole("heading", { name: "Mein Bereich" })).toBeInTheDocument();
  });

  it("blockiert Mein Bereich nicht, während die Stufe noch lädt (nur Session nötig)", () => {
    renderAt("/mein-bereich", authLoadingTier());

    expect(screen.getByRole("heading", { name: "Mein Bereich" })).toBeInTheDocument();
  });
});

describe("Stufen-Gating wartet auf das Laden der Stufe", () => {
  it("leitet einen eingeloggten Nutzer NICHT vorzeitig weg, solange die Stufe lädt", () => {
    renderAt("/verzeichnis", authLoadingTier());

    // Kein vorzeitiger Redirect auf / (Feed) und noch kein Verzeichnis-Inhalt:
    // RequireTier rendert nichts, bis level_rank bekannt ist.
    expect(screen.queryByRole("heading", { name: "Feed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });
});
