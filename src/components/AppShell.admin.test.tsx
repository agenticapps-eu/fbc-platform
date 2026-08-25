import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { LEVEL_RANK } from "../config/levels";

/**
 * Der Administrationsabschnitt der Sidebar (AGE-587, Aufgabe 5.7/5.9).
 *
 * Bis hierher prüfte KEIN Test seine Zusammensetzung. Das ist genau die Lücke,
 * durch die eine neue Admin-Fläche ohne Menüeintrag durchrutscht: sie wäre nur
 * per Adresszeile erreichbar, und niemandem fiele es auf — die Seite selbst ist
 * ja grün getestet.
 */
const ADMIN = fakeAuthValue({
  user: { id: "test-admin", email: "admin@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
  staffRole: "admin",
});

const MITGLIED = fakeAuthValue({
  user: { id: "test-user", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});

afterEach(() => localStorage.clear());

function renderApp(value: AuthContextValue) {
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

/** Die Navigationslinks unterhalb der Überschrift „Administration". */
function adminLinks(): string[] {
  const abschnitt = screen.getByRole("navigation").querySelectorAll("a");
  return Array.from(abschnitt)
    .map((a) => a.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/admin"));
}

describe("Das Administrationsmenü trägt seine Flächen vollständig (AGE-587)", () => {
  it("führt Einstellungen, Mitgliederliste und QM-Feedback", () => {
    renderApp(ADMIN);

    expect(adminLinks()).toEqual(["/admin", "/admin/mitglieder", "/admin/feedback"]);
  });

  it("nennt das QM-Feedback beim Namen", () => {
    renderApp(ADMIN);

    const link = screen.getByRole("link", { name: "QM-Feedback" });
    expect(link).toHaveAttribute("href", "/admin/feedback");
  });

  /**
   * Eine Route mit Parameter lässt sich ohne ihren Parameter gar nicht öffnen —
   * ein Menüeintrag darauf führte ins Leere. Sie wird aus der Mitgliederliste
   * erreicht. Ohne diese Zusage fiele es niemandem auf, wenn sie eines Tages
   * doch im Menü landete.
   */
  it("lässt die Seite eines EINZELNEN Mitglieds aus dem Menü heraus", () => {
    renderApp(ADMIN);

    expect(adminLinks().some((href) => href.startsWith("/admin/mitglied/"))).toBe(false);
  });

  it("zeigt einem gewöhnlichen Mitglied gar keinen Administrationsabschnitt", () => {
    renderApp(MITGLIED);

    expect(adminLinks()).toEqual([]);
    expect(screen.queryByRole("link", { name: "QM-Feedback" })).not.toBeInTheDocument();
  });
});

describe("Der Weg zur Feedback-Fläche steht nur Admins offen (AGE-587, 5.8)", () => {
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

  it("zeigt einem Admin die Fläche", () => {
    renderAt("/admin/feedback", ADMIN);

    expect(screen.getByRole("heading", { name: "QM-Feedback" })).toBeInTheDocument();
  });

  /**
   * Ohne diese Zusage bliebe eine Route OHNE `RequireAdmin` grün: die Seite
   * selbst rendert dieselbe Überschrift, gleichgültig wer sie aufruft, und die
   * RPC dahinter gäbe einem Nicht-Admin bloss eine leere Liste — also genau das
   * Bild einer Fläche, auf der man nichts zu suchen hat, aber sein darf.
   */
  it("leitet ein gewöhnliches Mitglied weg", () => {
    renderAt("/admin/feedback", MITGLIED);

    expect(screen.queryByRole("heading", { name: "QM-Feedback" })).not.toBeInTheDocument();
  });
});
