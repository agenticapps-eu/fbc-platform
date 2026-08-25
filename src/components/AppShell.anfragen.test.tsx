import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AGE-592 — der Weg zu einer eingehenden Kontaktanfrage.
 *
 * WAS HIER FESTGEHALTEN WIRD. Am 25.08. stand auf PROD eine echte Anfrage seit
 * 09:19 unbeantwortet, weil der Empfänger sie nicht finden konnte. „Meine
 * Anfragen" lebt ausschließlich auf `/kontakte`, und dieser Routeneintrag trägt
 * `section: "sub"` — es gab also KEINEN Menüeintrag. Die Fläche existierte, der
 * Weg dorthin nicht.
 *
 * Geprüft wird deshalb die NAVIGATION, nicht die Route. Eine erreichbare Route
 * ohne Eintrag ist genau der Fehler, und ein Routentest hätte ihn nie gesehen.
 *
 * Der Eintrag ist BEDINGT (Entscheidung Donald, 25.08.): Er erscheint für einen
 * offenen Vorgang und verschwindet mit ihm. Ein dauerhafter Eintrag wäre eine
 * verdeckte Rücknahme von AGE-494, die den ständigen Kontakte-Punkt entfernt hat.
 */
vi.mock("../lib/contact-requests", async (original) => ({
  ...(await original<typeof import("../lib/contact-requests")>()),
  fetchIncomingRequests: vi.fn(),
}));

import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { LEVEL_RANK } from "../config/levels";
import { fetchIncomingRequests } from "../lib/contact-requests";

const holen = vi.mocked(fetchIncomingRequests);

const MITGLIED = fakeAuthValue({
  user: { id: "test-user", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});

const GAST = fakeAuthValue();

function anfrage(id: string) {
  return {
    id,
    message: null,
    created_at: "2026-08-25T09:19:00.000Z",
    from: { id: `p-${id}`, name: "Maxi Muster", avatar_url: null, company: null, region: null },
  };
}

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
// Aufräumroutine — es ruft sie nach jedem Test auf, die abgelehnte Zusage nimmt
// niemand entgegen, und der Test scheitert an ihr statt an seiner Aussage.
beforeEach(() => {
  holen.mockReset();
});
afterEach(() => localStorage.clear());

describe("Der Weg zu offenen Anfragen steht in der Navigation (AGE-592)", () => {
  it("führt einen Eintrag zu den Anfragen, sobald eine offen ist", async () => {
    holen.mockResolvedValue([anfrage("a")]);
    renderApp();

    const eintrag = await screen.findByRole("link", { name: /Meine Anfragen/ });
    expect(eintrag).toHaveAttribute("href", "/kontakte");
  });

  /**
   * Die Zahl allein trägt die Aussage nicht: Eine nackte „2" neben einem Wort
   * kann genauso „zwei Kontakte" heißen. Der Plan-Review hat das gemeldet, und
   * es ist zugleich die Zugänglichkeitsfrage — ein Abzeichen ohne Benennung ist
   * für einen Screenreader eine Ziffer ohne Gegenstand.
   */
  it("nennt die Anzahl, sichtbar und benannt", async () => {
    holen.mockResolvedValue([anfrage("a"), anfrage("b")]);
    renderApp();

    const eintrag = await screen.findByRole("link", { name: /Meine Anfragen/ });
    expect(eintrag.textContent).toContain("2");
    expect(eintrag).toHaveAccessibleName(/2 offen/i);
  });

  /**
   * Die Gegenprobe zu allem anderen — und die Zusage, die AGE-494 hält. Ohne
   * offenen Vorgang gibt es den Eintrag NICHT, nicht etwa mit einer Null. Eine
   * Null ist keine Aufforderung, und ein Zähler, der dauernd Null zeigt, wird
   * nicht mehr gelesen.
   */
  it("erscheint gar nicht, wenn keine Anfrage offen ist", async () => {
    holen.mockResolvedValue([]);
    renderApp();

    await waitFor(() => expect(holen).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /Meine Anfragen/ })).toBeNull();
  });

  /**
   * Wer die Leiste einklappt, darf nicht ausgerechnet das Signal verlieren, für
   * das dieser Eintrag existiert.
   *
   * Die Falle dabei: Eingeklappt trägt der Link ein `aria-label`, und ein
   * `aria-label` ERSETZT den Inhalt. Ein Abzeichen darin wäre für Screenreader
   * unsichtbar gewesen — sichtbar für das Auge, stumm für alle anderen.
   */
  it("zeigt die Zahl auch in der eingeklappten Leiste, sichtbar und benannt", async () => {
    localStorage.setItem("fbc.sidebarCollapsed", "1");
    holen.mockResolvedValue([anfrage("a"), anfrage("b"), anfrage("c")]);
    renderApp();

    const eintrag = await screen.findByRole("link", { name: /Meine Anfragen/ });
    expect(eintrag.textContent).toContain("3");
    expect(eintrag).toHaveAccessibleName(/3 offen/i);
  });

  it("fragt ausgeloggt gar nicht erst und zeigt nichts", async () => {
    holen.mockResolvedValue([anfrage("a")]);
    renderApp(GAST);

    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    expect(holen).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /Meine Anfragen/ })).toBeNull();
  });

  /**
   * Der schärfste Befund des Plan-Reviews (codex, HIGH), und mit dem bedingten
   * Eintrag wiegt er doppelt: Verschwände der Eintrag bei einem gescheiterten
   * Abruf, wäre er selbst der stille Fehlschlag, gegen den dieser ganze Change
   * gebaut ist — „Abruf kaputt" sähe aus wie „nichts da", und zwar an der Stelle,
   * auf die sich alles andere verlässt.
   *
   * Also: Eintrag da, Zahl weg, und der Name sagt warum. Ein Eintrag zu viel
   * kostet eine Zeile im Menü; ein Eintrag zu wenig kostet die Anfrage.
   */
  it("steht auch dann da, wenn der Abruf scheitert — ohne Zahl, aber benannt", async () => {
    holen.mockRejectedValue(new Error("permission denied for table contact_requests"));
    renderApp();

    const eintrag = await screen.findByRole("link", { name: /Meine Anfragen/ });
    expect(eintrag).toHaveAccessibleName(/nicht geladen werden/i);
    expect(eintrag.textContent).not.toMatch(/\d/);
  });
});
