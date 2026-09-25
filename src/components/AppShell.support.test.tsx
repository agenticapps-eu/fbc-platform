import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { LEVEL_RANK } from "../config/levels";
import { navItems } from "../config/nav";

/**
 * Der Abschnitt „Support" am Fuss der Leiste (AGE-904).
 *
 * Die Zusage ist dreifach, weil die Leiste drei Gestalten hat: offen,
 * eingeklappt und als Schublade. Bis AGE-904 stand hier ein einzelner
 * Feedback-Knopf; ein Test nur an der offenen Leiste wäre grün geblieben,
 * während der Eintrag auf dem Telefon fehlt — und das Telefon ist der Ort, an
 * dem jemand nach Hilfe sucht.
 *
 * Auf der untersten Stufe angemeldet (`basic`), nicht als `impact`: Hilfe ist
 * keine Frage der Mitgliedsstufe, und wer sie am nötigsten braucht, hat am
 * wenigsten Rechte. Ein Test als `impact` sähe ein fehlendes `minTier` nie.
 */

const BASIC = fakeAuthValue({
  user: { id: "u1", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "basic",
  levelRank: LEVEL_RANK.basic,
});

/** Steuerbares matchMedia — wie in `AppShell.overlay.test.tsx`. */
function breite(breitGenug: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? true : breitGenug,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

/**
 * Die Überschrift der Tutorial-Fläche, abgewartet.
 *
 * `findBy`, nicht `getBy`: die Seite kommt als `lazy()` nach (AGE-642). Und mit
 * eigener Frist statt der voreingestellten Sekunde — im Lauf der GANZEN Suite
 * baut vitest 249 jsdom-Umgebungen nebeneinander auf, und das Nachladen des
 * Moduls dauert dort länger als allein. Einzeln lief die Zusage fünfmal grün
 * und in der vollen Suite rot; ohne diese Zeile wäre sie ein Flake, den beim
 * nächsten roten Lauf jemand für echt hält.
 */
function tutorialUeberschrift() {
  return screen.findByRole(
    "heading",
    { level: 1, name: /so funktioniert der club/i },
    { timeout: 5000 },
  );
}

function renderApp(start = "/aktivitaet") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={BASIC}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[start]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.removeAttribute("style");
});

describe("Support-Abschnitt — offen, eingeklappt, in der Schublade", () => {
  it("führt in der offenen Leiste genau zwei Einträge unter „Support“", () => {
    breite(true);
    renderApp();

    const support = screen.getByRole("navigation", { name: "Support" });
    expect(within(support).getByText("Support")).toBeInTheDocument();
    expect(within(support).getByRole("link", { name: "Tutorials" })).toHaveAttribute(
      "href",
      "/hilfe/tutorials",
    );
    expect(within(support).getByRole("button", { name: /^feedback$/i })).toBeInTheDocument();
    // Genau zwei: ein dritter Weg (etwa zur Mitgliedschaft) gehört nicht in
    // einen Supportbereich, und AGE-907 macht ihn gerade unerreichbar.
    expect(within(support).getAllByRole("link")).toHaveLength(1);
    expect(within(support).getAllByRole("button")).toHaveLength(1);
  });

  it("hält beide Einträge eingeklappt benennbar, obwohl die Beschriftung fehlt", () => {
    // Eingeklappt ist das Symbol der einzige Anker, den ein Eintrag hat. Ohne
    // zugänglichen Namen wäre er für Vorlesesoftware ein leerer Knopf.
    localStorage.setItem("fbc.sidebarCollapsed", "1");
    breite(true);
    renderApp();

    const support = screen.getByRole("navigation", { name: "Support" });
    expect(within(support).getByRole("link", { name: "Tutorials" })).toBeInTheDocument();
    expect(within(support).getByRole("button", { name: "Feedback" })).toBeInTheDocument();
    // Die Überschrift fällt weg — in einem Rail von Symbolbreite hat sie keinen
    // Platz. Die Namen oben tragen den Abschnitt allein.
    expect(within(support).queryByText("Support")).toBeNull();
  });

  it("trägt beide Einträge auch in der Schublade", () => {
    breite(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    const schublade = screen.getByRole("dialog", { name: /navigation/i });
    const support = within(schublade).getByRole("navigation", { name: "Support" });
    expect(within(support).getByRole("link", { name: "Tutorials" })).toBeInTheDocument();
    expect(within(support).getByRole("button", { name: /^feedback$/i })).toBeInTheDocument();
  });

  it("schliesst die Schublade, wenn jemand aus ihr ins Tutorial geht", async () => {
    // Über den bestehenden `onNavigate`-Weg. Bliebe sie offen, stünde die
    // Navigation über der Seite, die gerade geöffnet wurde — und die Seite
    // dahinter bliebe gesperrt.
    breite(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    const schublade = screen.getByRole("dialog", { name: /navigation/i });
    fireEvent.click(within(schublade).getByRole("link", { name: "Tutorials" }));

    expect(screen.queryByRole("dialog", { name: /navigation/i })).toBeNull();
    expect(await tutorialUeberschrift()).toBeInTheDocument();
  });

  it("zeigt die Fläche einem Konto der untersten Stufe vollständig", async () => {
    // Kein `minTier`: was die Anwendung kann, ist keine Frage der Stufe. Stünde
    // hier eine Schranke, käme statt des Tutorials die Wand „Mitglied werden".
    // Die Route wird DIREKT angesteuert und nicht über den Eintrag geklickt:
    // dass der Weg dorthin führt, steht in der Zusage darüber; hier geht es um
    // die Schranke, und die entscheidet sich an der Route, nicht am Klick.
    breite(false);
    renderApp("/hilfe/tutorials");

    expect(await tutorialUeberschrift()).toBeInTheDocument();
    expect(screen.queryByText(/mitglied werden/i)).toBeNull();
  });

  it("lässt die Hauptnavigation unangetastet — der Support ist kein achter Menüeintrag", () => {
    expect(navItems.find((i) => i.path === "/hilfe/tutorials")?.section).toBe("sub");

    breite(true);
    renderApp();
    const haupt = screen.getByRole("navigation", { name: /hauptnavigation/i });
    expect(within(haupt).queryByRole("link", { name: "Tutorials" })).toBeNull();
    expect(within(haupt).queryByText(/feedback/i)).toBeNull();
  });
});
