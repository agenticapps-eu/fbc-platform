import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

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
 * Erstlogin führt nicht mehr in den Kompass-Assistenten (AGE-494).
 *
 * Bis hierher fing `HomeRedirect` genau einen Fall ab: eingeloggt, keine
 * `compass_responses`, nicht übersprungen → `/onboarding`. Am 17.08. loggen sich
 * ~70 Menschen zum ersten Mal ein und träfen alle diesen Fall — ein Fragebogen als
 * erster Eindruck. An diesen Platz tritt in C3 das Aktivierungs-Gate.
 *
 * Der Test prüft absichtlich die ECHTE Weiche über `<App />` und nicht die
 * Komponente isoliert: die Aussage ist „der Erstlogin landet auf der Startseite",
 * und die entsteht erst aus Route, Weiche und Seite zusammen.
 */
describe("Erstlogin (AGE-494)", () => {
  it("führt ein frisches Konto ohne Kompass-Antworten NICHT in den Assistenten", async () => {
    // Der Status muss hier ERFOLGREICH mit „keine Antworten" auflösen, sonst
    // prüft der Test nichts: ohne Mock scheitert die Abfrage in der
    // Testumgebung, die alte Weiche fiel in ihren Fehler-Fallback und zeigte die
    // Startseite — der Test wäre auch vor der Änderung grün gewesen.
    const compass = await import("../lib/compass");
    vi.spyOn(compass, "fetchCompassStatus").mockResolvedValue({
      hasResponses: false,
    } as Awaited<ReturnType<typeof compass.fetchCompassStatus>>);

    renderAt("/", authAsTier("basic"));

    // Auf ein Signal warten, das NUR der Nicht-Assistenten-Pfad erzeugt. Die
    // Shell-Navigation taugt dafür nicht: sie steht auch, während die alte Weiche
    // noch entscheidet, und der Test wäre wieder blind. Das Dashboard versucht zu
    // laden und meldet in der Testumgebung seinen Fehler — genau dieser Text
    // erscheint nur, wenn `/` das Dashboard gerendert hat statt umzuleiten.
    expect(
      await screen.findByText("Dashboard konnte nicht geladen werden. Bitte neu laden."),
    ).toBeInTheDocument();
    // Und die Assistenten-Strecke ist nirgends: sie lebt außerhalb der AppShell
    // und bringt eine eigene Kopfzeile mit „Überspringen" mit.
    expect(screen.queryByRole("button", { name: "Überspringen" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Schritt 1 von/)).not.toBeInTheDocument();
  });

  it("zeigt Gästen unverändert die öffentliche Startseite", async () => {
    renderAt("/", fakeAuthValue());

    expect(
      await screen.findByRole("heading", { name: "Willkommen im Fair Business Club" }),
    ).toBeInTheDocument();
  });

  it("fragt den Kompass-Status für die Startseite gar nicht mehr ab", async () => {
    // Der Beleg, dass die Weiche wirklich weg ist und nicht nur ihr Ergebnis
    // zufällig stimmt: die Abfrage darf überhaupt nicht mehr stattfinden.
    const compass = await import("../lib/compass");
    const spy = vi.spyOn(compass, "fetchCompassStatus");

    renderAt("/", authAsTier("basic"));
    await screen.findByRole("link", { name: "Aktivität" });

    expect(spy).not.toHaveBeenCalled();
  });
});
