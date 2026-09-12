import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * Das Ziel überlebt die Anmeldung (AGE-643, §7).
 *
 * **Warum es diese Zusage überhaupt braucht:** Browser und App führen getrennte
 * Sitzungsspeicher. Wer im Browser angemeldet ist, ist es in der App nicht —
 * das ist die Bauart, keine Störung. Ohne Zielerhaltung endet JEDER Link aus
 * einer Nachricht auf der Startseite, und das Mitglied sucht die Unterhaltung
 * von Hand.
 *
 * **Und warum der zweite Test der wichtigere ist:** eine Zielerhaltung ohne
 * Verengung auf interne Pfade ist eine offene Weiterleitung — ausgelöst direkt
 * nach der Eingabe der Zugangsdaten, unter dem Vertrauen, das die Anwendung
 * beim Mitglied geniesst.
 */

vi.mock("./lib/push", () => ({
  pushEinrichten: vi.fn(async () => "web"),
  pushKanalAnlegen: vi.fn(async () => "entfaellt"),
  pushLebenszeichen: vi.fn(async () => "web"),
  pushZielZuhoerer: vi.fn(async () => {}),
}));

vi.mock("./lib/chat", async (original) => ({
  ...(await original<typeof import("./lib/chat")>()),
  fetchThreads: async () => ({ threads: [], nextOffset: null }),
  fetchMessages: async () => ({ messages: [], erschoepft: true }),
  fetchUnreadCounts: async () => ({
    gesamt: 0,
    jeThread: new Map<string, number>(),
    hatUngelesen: () => false,
  }),
  markThreadRead: async () => {},
  subscribeToAllMessages: () => () => {},
  subscribeToThread: () => () => {},
}));

const { default: App } = await import("./App");
const { ToastProvider } = await import("./components/ui/Toast");
const { AuthFixture, fakeAuthValue } = await import("./test/auth-fixtures");
const { LEVEL_RANK } = await import("./config/levels");
type AuthContextValue = import("./providers/auth-context").AuthContextValue;

const MITGLIED = fakeAuthValue({
  user: { id: "test-user", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});
const GAST = fakeAuthValue();

/** Der Ort, an dem die Anwendung gerade steht — sonst ist „am Ziel" nicht
 *  messbar, sondern nur „irgendetwas gerendert". */
function Ort() {
  const ort = useLocation();
  return <div data-testid="ort">{`${ort.pathname}${ort.search}${ort.hash}`}</div>;
}

const ort = () => screen.getByTestId("ort").textContent;

function renderApp(eintrag: string | { pathname: string; state: unknown }, wert = GAST) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const baum = (value: AuthContextValue) => (
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[eintrag]}>
            <Ort />
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>
  );
  const gerendert = render(baum(wert));
  return {
    ...gerendert,
    /** Die Sitzung erscheint — genau das, was eine erfolgreiche Anmeldung tut,
     *  ohne die Komponente neu zu montieren. */
    meldeAn: (wer: AuthContextValue = MITGLIED) => gerendert.rerender(baum(wer)),
  };
}

describe("Das Ziel überlebt die Anmeldung (AGE-643)", () => {
  it("führt nach dem Anmelden an die Unterhaltung, nicht auf die Startseite", async () => {
    const { meldeAn } = renderApp("/chat/abc-123");
    await waitFor(() => expect(ort()).toBe("/login"));

    meldeAn();
    await waitFor(() => expect(ort()).toBe("/chat/abc-123"));
  });

  it("führt Query und Fragment mit", async () => {
    const { meldeAn } = renderApp("/p/9f7?von=mail#block");
    await waitFor(() => expect(ort()).toBe("/login"));

    meldeAn();
    await waitFor(() => expect(ort()).toBe("/p/9f7?von=mail#block"));
  });

  it.each([
    ["https://boese.example/", "ein fremder Host mit Schema"],
    ["//boese.example/", "protokollrelativ — sieht wie ein interner Pfad aus"],
    ["/\\boese.example/", "Rückstrich, den Browser wie `//` normalisieren"],
  ])("verwirft %s (%s) und führt auf die Startseite", async (ziel) => {
    const { meldeAn } = renderApp({ pathname: "/login", state: { ziel } });
    await waitFor(() => expect(ort()).toBe("/login"));

    meldeAn();
    await waitFor(() => expect(ort()).toBe("/"));
  });

  it("behält das Ziel auch für ein angemeldetes, nicht aktiviertes Konto", async () => {
    // Die Aktivierungswand tauscht den gerenderten Baum aus und navigiert
    // NICHT — die Adresse bleibt also stehen. Das folgt heute aus der Bauart;
    // hier wird es zur Zusage.
    renderApp("/events/42", fakeAuthValue({ ...MITGLIED, isActivated: false }));

    // Positivkontrolle: die Wand steht wirklich. Ohne sie prüfte der Test nur,
    // dass irgendetwas nicht navigiert hat.
    expect(await screen.findByRole("heading", { name: "Noch ein Schritt" })).toBeInTheDocument();
    expect(ort()).toBe("/events/42");
  });

  it("verlangt auf dem Aktivierungsweg keine Anmeldung", async () => {
    // Der Aktivierungslink ist für viele der ERSTE Kontakt mit der Plattform.
    // Wer dort zuerst zum Anmelden oder zum Installieren geschickt wird, bricht
    // ab, und die Einladung ist verbraucht.
    // Das Token steht im Fragment und wird aus `window.location` gelesen — die
    // Einlöseseite räumt es danach aus der Adresszeile. Beides ist hier echt.
    window.history.replaceState(null, "", "/aktivierung#token=abc.def");
    renderApp("/aktivierung#token=abc.def");

    // Das Passwortfeld belegt, dass der Vorgang wirklich läuft: ein leerer
    // Baum erfüllte die beiden Zusagen darunter sonst von allein.
    expect(await screen.findByLabelText(/Passwort/i)).toBeInTheDocument();
    expect(ort()).toBe("/aktivierung#token=abc.def");
    expect(screen.queryByRole("heading", { name: /Anmelden/i })).toBeNull();
    expect(screen.queryByText(/installier/i)).toBeNull();
  });
});
