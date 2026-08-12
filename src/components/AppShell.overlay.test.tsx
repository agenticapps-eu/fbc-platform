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
