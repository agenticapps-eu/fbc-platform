import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AktivitaetPage from "./AktivitaetPage";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";

/**
 * Der Feed lädt über TanStack Query und verlinkt Profile → beide Provider nötig.
 *
 * AuthFixture ist kein Mock: CommunityFeed ruft useAuth() (CommunityFeed.tsx:44),
 * das ohne <AuthProvider> wirft. Wir ersetzen die Komponente nicht durch eine
 * Attrappe, wir stellen ihr die Umgebung bereit, die sie zum Laufen braucht.
 *
 * Bewusst fakeAuthValue() (anonym, user: null) statt authAsTier(...): /aktivitaet
 * ist für alle sichtbar, auch für Ausgeloggte — so deckt der Test den offensten Fall ab.
 */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={fakeAuthValue()}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AktivitaetPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("AktivitaetPage", () => {
  it("zeigt den Aktivität-Hero", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Aktivität" })).toBeInTheDocument();
  });

  it("mountet den CommunityFeed", () => {
    renderPage();
    // "Feed wird geladen…" ist FeedList.isLoading (CommunityFeed.tsx) — der garantierte
    // Anfangszustand direkt nach dem Mount, unabhängig davon, ob die Query je erfolgreich
    // lädt. Würde <CommunityFeed /> aus AktivitaetPage entfernt, gäbe es diesen Text nicht.
    expect(screen.getByText("Feed wird geladen…")).toBeInTheDocument();
  });
});
