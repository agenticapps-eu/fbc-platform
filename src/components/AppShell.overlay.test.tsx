import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { LEVEL_RANK } from "../config/levels";

/**
 * Die Off-Canvas-Navigation ist das VIERTE Overlay (AGE-529) — und das einzige,
 * das im Tisch des Issues fehlte. Sie ist auf jeder Seite gemountet, trägt
 * `aria-modal="true"` und erscheint nur unter `lg`: genau der Telefonfall, für
 * den die iOS-feste Sperre gebaut wurde.
 *
 * Der zweite Test hier ist kein Beiwerk, sondern die BEDINGUNG dafür, dass die
 * Sperre hier überhaupt angeschlossen werden darf — siehe seinen Kommentar.
 */

/** Steuerbares matchMedia: der globale Stub aus `test/setup.ts` meldet für jede
 *  Breiten-Abfrage `false` und ignoriert Zuhörer, kann den Breakpoint-Wechsel
 *  also nicht auslösen. */
function medienAbfrage(anfangsBreitGenug: boolean) {
  const zuhoerer = new Set<() => void>();
  let matches = anfangsBreitGenug;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("prefers-reduced-motion") ? true : matches;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, f: () => void) => zuhoerer.add(f),
    removeEventListener: (_: string, f: () => void) => zuhoerer.delete(f),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  return {
    aufBreitSchalten() {
      matches = true;
      act(() => zuhoerer.forEach((f) => f()));
    },
  };
}

const ANGEMELDET = fakeAuthValue({
  user: { id: "u1", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={ANGEMELDET}>
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

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.removeAttribute("style");
});

describe("Off-Canvas-Navigation — Overlay-Hygiene", () => {
  it("sperrt die Seite dahinter und hält den Fokus in der Schublade", () => {
    medienAbfrage(false);
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    const dialog = screen.getByRole("dialog", { name: /navigation/i });
    expect(document.body.style.position).toBe("fixed");

    // Der Fokusumlauf steht neben der Sperre: die Sperre allein wäre auch grün,
    // wenn der Hook zwar gerufen, sein Ref aber nie am Container hinge.
    const knoten = Array.from(dialog.querySelectorAll<HTMLElement>("a[href], button"));
    expect(knoten.length).toBeGreaterThan(1);
    knoten[knoten.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(knoten[0]);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.position).toBe("");
  });

  it("schließt beim Sprung über lg — sonst bliebe die Seite dauerhaft gesperrt", () => {
    // Der teuerste Befund des Plan-Reviews. Die Schublade verschwindet ab `lg`
    // NUR per CSS (`lg:hidden`), ihr Zustand bleibt offen. Solange das bloß eine
    // unsichtbare Schublade war, fiel es niemandem auf — mit der Scroll-Sperre
    // daran wäre die Seite danach gesperrt, ohne dass irgendetwas zu sehen ist,
    // und kein Klick käme mehr heran.
    const mq = medienAbfrage(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));
    expect(document.body.style.position).toBe("fixed");

    mq.aufBreitSchalten();

    expect(screen.queryByRole("dialog", { name: /navigation/i })).toBeNull();
    expect(document.body.style.position).toBe("");
  });

  it("gibt der Schublade ihr `aria-modal` ab, solange Feedback darüber steht (AGE-688)", () => {
    // Der Feedback-Zugang ist unterhalb von `lg` NUR hier zu haben. Trägt die
    // Schublade ihr `aria-modal` weiter, tragen zwei Knoten es gleichzeitig —
    // und das Formular hängt per Portal an `body`, also AUSSERHALB der
    // Schublade. Vorlesesoftware, die `aria-modal` befolgt, hielte damit genau
    // die Fläche für inert, die geöffnet wurde.
    //
    // Die Schublade bleibt dabei OFFEN, und das ist keine Bequemlichkeit: der
    // Auslöser steht in ihr. Sie zu schliessen hängt ihn ab und nimmt den
    // Zustand mit, an dem das Portal hängt — gemessen, das Formular ging dann
    // gar nicht erst auf.
    medienAbfrage(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    const schublade = screen.getByRole("dialog", { name: /navigation/i });
    fireEvent.click(within(schublade).getByRole("button", { name: /^feedback$/i }));

    const formular = screen.getByRole("dialog", { name: /feedback geben/i });
    expect(schublade.isConnected).toBe(true);

    // Über `document`, nicht über den `screen`-Container: das Formular ist
    // portalisiert. Und die Identität über die Rolle samt Namen —
    // `getByLabelText` ist nicht der zugängliche Name.
    const modale = Array.from(document.querySelectorAll('[aria-modal="true"]'));
    expect(modale).toHaveLength(1);
    expect(modale[0]).toBe(formular);
  });

  it("gibt der Schublade ihr `aria-modal` zurück, wenn Feedback zugeht (AGE-688)", () => {
    // Die Gegenrichtung, und sie ist die teurere: bleibt die Meldung beim
    // Schliessen aus, stünde die Schublade danach dauerhaft ohne `aria-modal`
    // da — ein Defekt, den niemand sieht, weil sichtbar alles stimmt.
    medienAbfrage(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    const schublade = screen.getByRole("dialog", { name: /navigation/i });
    fireEvent.click(within(schublade).getByRole("button", { name: /^feedback$/i }));

    // Über „Abbrechen" IM Formular, nicht über Escape: `AppShell.tsx:508`
    // schliesst auf Escape die Schublade selbst — ungeachtet dessen, was über
    // ihr liegt. Das ist Bestand und nicht Gegenstand dieses Changes, würde
    // hier aber die Schublade abhängen und die Zusage am losgelösten Knoten
    // messen lassen.
    const formular = screen.getByRole("dialog", { name: /feedback geben/i });
    fireEvent.click(within(formular).getByRole("button", { name: /abbrechen/i }));

    expect(screen.queryByRole("dialog", { name: /feedback geben/i })).toBeNull();
    expect(schublade).toHaveAttribute("aria-modal", "true");
  });

  it("meldet auch das Abhängen, sonst bleibt die Schublade dauerhaft ohne `aria-modal` (AGE-688)", () => {
    // Der Fall, den keine der beiden Zusagen darüber trifft: die Schublade
    // schliesst am Breakpoint, während das Formular offen steht. Der Auslöser
    // hängt IN ihr und geht mit weg. Bliebe der gemeldete Zustand danach auf
    // „offen", käme die nächste geöffnete Schublade ohne `aria-modal` hoch —
    // und sichtbar wäre daran nichts.
    const mq = medienAbfrage(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /navigation/i })).getByRole("button", {
        name: /^feedback$/i,
      }),
    );

    mq.aufBreitSchalten();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    expect(screen.getByRole("dialog", { name: /navigation/i })).toHaveAttribute(
      "aria-modal",
      "true",
    );
  });

  it("lässt einen Klick in der Schublade weiterhin durch", () => {
    // Gegenprobe: die Falle darf die Bedienung nicht ersetzen.
    medienAbfrage(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    const dialog = screen.getByRole("dialog", { name: /navigation/i });
    fireEvent.click(within(dialog).getAllByRole("link")[0]);

    expect(screen.queryByRole("dialog", { name: /navigation/i })).toBeNull();
    expect(document.body.style.position).toBe("");
  });
});
