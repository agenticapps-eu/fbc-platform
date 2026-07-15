import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { ToastProvider } from "./components/ui/Toast";
import type { AuthContextValue } from "./providers/auth-context";
import { AuthFixture, authAsTier } from "./test/auth-fixtures";

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

/**
 * Redirects für alte URLs (App.tsx:49-55). Sie existieren, damit Bookmarks echter
 * Mitglieder und Detlevs Demo-Skript nach dem Nav-Umbau (AGE-314) nicht brechen — es
 * gibt kein `path="*"`, ein Tippfehler im Redirect-Ziel würde also auf einer leeren
 * Seite landen. Jeder Test prüft deshalb den echten Inhalt der Zielseite, nicht nur,
 * dass kein Fehler auftritt.
 */
describe("Redirects alter URLs", () => {
  it("/matching → /meine-chancen (min Discover)", () => {
    renderAt("/matching", authAsTier("discover"));

    // "Deine Chancen-Datenbank" kommt aus HubHeader, das nur bei echtem Seiteninhalt
    // rendert — die MembershipGate-Wand zeigt nur denselben Hero-Titel ("Meine
    // Chancen"), also nicht diese Überschrift.
    expect(screen.getByRole("heading", { name: "Deine Chancen-Datenbank" })).toBeInTheDocument();
  });

  it("/community → /aktivitaet (jede eingeloggte Stufe)", () => {
    renderAt("/community", authAsTier("basic"));

    expect(screen.getByRole("heading", { name: "Aktivität" })).toBeInTheDocument();
  });

  it("/verzeichnis → /mitglieder (min Discover)", () => {
    renderAt("/verzeichnis", authAsTier("discover"));

    // "Verzeichnis" kommt aus MemberDirectory und rendert nur bei echtem
    // Seiteninhalt — die Wand zeigt nur den Hero-Titel ("Mitglieder").
    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("/angebote-gesuche → /compass (jede eingeloggte Stufe)", () => {
    renderAt("/angebote-gesuche", authAsTier("basic"));

    // "Mini-Compass" ist die Karten-Überschrift des Mini-Compass-Tabs — eindeutig
    // gegenüber der Wand, die stattdessen "Dieser Bereich ist Mitgliedern
    // vorbehalten" zeigt (siehe MembershipGate.test.tsx).
    expect(screen.getByRole("heading", { name: "Mini-Compass" })).toBeInTheDocument();
  });
});
