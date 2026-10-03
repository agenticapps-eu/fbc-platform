import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { ToastProvider } from "./components/ui/Toast";
import type { AuthContextValue } from "./providers/auth-context";
import { AuthFixture, authAsTier, seedeRechte } from "./test/auth-fixtures";

afterEach(() => localStorage.clear());

function renderAt(path: string, value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // AGE-1000: Die Rechte des Fixtures in den Cache, sonst fragt `useDarf` die
  // RPC, findet keinen Server und meldet „kein Recht" — der Test maesse dann
  // das fehlende Netz statt der Stufe.
  seedeRechte(queryClient, value);
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
  // AGE-450: Chancen sind fürs Sommerfest raus. /matching und /meine-chancen leiten
  // auf / — die Chancen-Datenbank ist über keinen der beiden Pfade mehr erreichbar.
  it("/matching und /meine-chancen sind unerreichbar (keine Chancen-Datenbank)", () => {
    renderAt("/matching", authAsTier("discover"));
    expect(screen.queryByRole("heading", { name: "Deine Chancen-Datenbank" })).toBeNull();
  });

  it("/meine-chancen zeigt keine Chancen-Seite mehr", () => {
    renderAt("/meine-chancen", authAsTier("discover"));
    expect(screen.queryByRole("heading", { name: "Deine Chancen-Datenbank" })).toBeNull();
  });

  it("/community → /aktivitaet (jede eingeloggte Stufe)", async () => {
    renderAt("/community", authAsTier("active"));

    // AGE-642: Ziel der Weiterleitung kommt asynchron nach. Geprüft wird
    // unverändert, dass die Weiterleitung DORT landet.
    await screen.findByRole("heading", { name: "Aktivität" });
    expect(screen.getByRole("heading", { name: "Aktivität" })).toBeInTheDocument();
  });

  // AGE-1000: `impact` statt `discover`. Die Weiterleitung selbst ist
  // unveraendert — gemessen wird, wo sie LANDET, und das setzt voraus, dass die
  // Zielseite auch rendert. Seit das Verzeichnis am Recht `verzeichnis.suchen`
  // haengt, zeigt `discover` dort die Wand, und der Test maesse dann die Wand
  // statt der Weiterleitung.
  it("/verzeichnis → /mitglieder (Recht verzeichnis.suchen)", async () => {
    renderAt("/verzeichnis", authAsTier("impact"));

    // "Verzeichnis" kommt aus MemberDirectory und rendert nur bei echtem
    // Seiteninhalt — die Wand zeigt nur den Hero-Titel ("Mitglieder").
    await screen.findByRole("heading", { name: "Verzeichnis" });
    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("/angebote-gesuche → /kompass (jede eingeloggte Stufe)", async () => {
    renderAt("/angebote-gesuche", authAsTier("active"));

    // "Mini-Kompass" ist die Karten-Überschrift des Mini-Kompass-Tabs — eindeutig
    // gegenüber der Wand, die stattdessen "Dieser Bereich ist Mitgliedern
    // vorbehalten" zeigt (siehe MembershipGate.test.tsx).
    await screen.findByRole("heading", { name: "Mini-Kompass" });
    expect(screen.getByRole("heading", { name: "Mini-Kompass" })).toBeInTheDocument();
  });

  // AGE-494: Die Route heißt sichtbar „Kompass"; der alte Pfad bleibt als Brücke.
  it("/compass → /kompass (alte Links und Lesezeichen)", async () => {
    renderAt("/compass", authAsTier("active"));

    await screen.findByRole("heading", { name: "Mini-Kompass" });
    expect(screen.getByRole("heading", { name: "Mini-Kompass" })).toBeInTheDocument();
  });
});
