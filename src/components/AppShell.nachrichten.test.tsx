import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AGE-583 — der Weg zu den Nachrichten.
 *
 * WAS HIER FESTGEHALTEN WIRD. Nachrichten sind seit Juni gebaut und laufen,
 * aber `/chat` trägt `section: "sub"` — es gibt keinen Menüeintrag. Wer die
 * Adresse nicht kennt, findet sie nicht. Aus Sicht eines Mitglieds ist die
 * Funktion damit nicht vorhanden, auch wenn sie funktioniert.
 *
 * Geprüft wird deshalb der EINSTIEG, nicht die Route. Dieselbe Lehre wie in
 * AGE-592: eine erreichbare Route ohne Weg dorthin ist genau der Fehler, und
 * ein Routentest hätte ihn nie gesehen.
 *
 * DIE NULL IST HIER DER WICHTIGERE FALL. Am Go-Live steht der Zähler bei allen
 * auf 0 — auf PROD sind 2 von 71 Profilen aktiviert, und Nachrichten setzen
 * eine angenommene Kontaktanfrage voraus. Eine „0" an der Kopfzeile wäre die
 * erste Zahl, die ein neues Mitglied zu sehen bekommt.
 */
vi.mock("../lib/chat", async (original) => ({
  ...(await original<typeof import("../lib/chat")>()),
  fetchUnreadCounts: vi.fn(),
  subscribeToAllMessages: vi.fn(() => () => {}),
}));

import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { LEVEL_RANK } from "../config/levels";
import { fasseUngelesenZusammen, fetchUnreadCounts } from "../lib/chat";

const holen = vi.mocked(fetchUnreadCounts);

const MITGLIED = fakeAuthValue({
  user: { id: "test-user", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});

const GAST = fakeAuthValue();

function renderApp(value: AuthContextValue = MITGLIED) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/aktivitaet"]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

// Geschweifte Klammern sind Pflicht: `mockReset()` GIBT DIE ATTRAPPE ZURÜCK, und
// eine aus `beforeEach` zurückgegebene Funktion hält vitest für die
// Aufräumroutine — es ruft sie dann nach jedem Test auf.
beforeEach(() => {
  holen.mockReset();
});
afterEach(() => localStorage.clear());

describe("Der Einstieg zu Nachrichten steht in der Kopfzeile (AGE-583)", () => {
  it("führt auf /chat, sobald etwas ungelesen ist", async () => {
    holen.mockResolvedValue(fasseUngelesenZusammen([{ thread_id: "t1", unread_count: 3 }]));
    renderApp();

    const einstieg = await screen.findByRole("link", { name: /Nachrichten/ });
    expect(einstieg).toHaveAttribute("href", "/chat");
  });

  /**
   * Die Zahl allein trägt die Aussage nicht: eine nackte „3" neben einem Symbol
   * kann alles heißen. Und Farbe trägt in diesem Projekt nie allein eine
   * Bedeutung — für einen Screenreader wäre ein Abzeichen ohne Benennung eine
   * Ziffer ohne Gegenstand.
   */
  it("nennt die Zahl im zugänglichen Namen, nicht nur als Farbfleck", async () => {
    holen.mockResolvedValue(fasseUngelesenZusammen([{ thread_id: "t1", unread_count: 3 }]));
    renderApp();

    expect(await screen.findByRole("link", { name: /3 ungelesen/i })).toBeInTheDocument();
  });

  it("zeigt bei null KEINE Blase — der Einstieg bleibt, die Zahl geht", async () => {
    holen.mockResolvedValue(fasseUngelesenZusammen([]));
    renderApp();

    const einstieg = await screen.findByRole("link", { name: /Nachrichten/ });
    // Der Weg bleibt sichtbar — sonst wäre die Funktion bei null Nachrichten
    // wieder unauffindbar, und genau das ist der Befund dieses Vorgangs.
    expect(einstieg).toHaveAttribute("href", "/chat");
    // Aber keine Ziffer. `queryByText` auf /^\d+$/ trifft die Blase und sonst
    // nichts in der Kopfzeile.
    expect(einstieg).not.toHaveTextContent(/\d/);
  });

  it("erscheint für einen Gast gar nicht", async () => {
    holen.mockResolvedValue(fasseUngelesenZusammen([{ thread_id: "t1", unread_count: 3 }]));
    renderApp(GAST);

    await waitFor(() => expect(screen.getByRole("button", { name: /Anmelden/ })).toBeVisible());
    expect(screen.queryByRole("link", { name: /Nachrichten/ })).toBeNull();
    // Und die Abfrage wird für einen Gast gar nicht erst gestellt.
    expect(holen).not.toHaveBeenCalled();
  });

  /**
   * Dritter Ausgang, nach dem Muster von `useOffeneAnfragen` (AGE-592):
   * verschwände die Zahl bei einem gescheiterten Abruf, wäre „Abruf kaputt" von
   * „nichts da" nicht zu unterscheiden. Der Einstieg bleibt, aber er sagt, dass
   * er es nicht weiß.
   */
  it("kennzeichnet einen gescheiterten Abruf, statt still null zu zeigen", async () => {
    holen.mockRejectedValue(new Error("Netz weg"));
    renderApp();

    expect(
      await screen.findByRole("link", { name: /Nachrichten.*nicht geladen/i }),
    ).toBeInTheDocument();
  });
});
