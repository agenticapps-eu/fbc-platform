import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";

afterEach(() => localStorage.clear());

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

describe("MembershipGate für Formate", () => {
  it("zeigt anon auf einem auth-gegateten Format (/compass) die Wand statt eines Redirects", () => {
    renderAt("/compass", fakeAuthValue());

    // Kein Redirect auf /login; stattdessen die „Mitglied werden"-Wand.
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist Mitgliedern vorbehalten" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mitglied werden" })).toBeInTheDocument();
    // Compass-Inhalt bleibt gesperrt.
    expect(screen.queryByText("Mini-Compass")).not.toBeInTheDocument();
  });

  it("lässt ein eingeloggtes Mitglied das auth-gegatete Format sehen", () => {
    renderAt("/compass", authAsTier("basic"));

    expect(screen.getByText("Mini-Compass")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Dieser Bereich ist Mitgliedern vorbehalten" }),
    ).not.toBeInTheDocument();
  });

  it("zeigt einer zu niedrigen Stufe auf /meine-chancen die Stufen-Wand", () => {
    renderAt("/meine-chancen", authAsTier("basic"));

    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Discover verfügbar" }),
    ).toBeInTheDocument();
    // Eingeloggt-aber-zu-niedrig: kein „Mitglied werden"-CTA, nur „Zur Startseite".
    expect(screen.queryByRole("button", { name: "Mitglied werden" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zur Startseite" })).toBeInTheDocument();
  });
});
