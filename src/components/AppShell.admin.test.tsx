import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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
  /** Zeigt an, WO die Anwendung gerade steht — damit die Weiterleitung an ihrem
   *  Ziel geprüft wird und nicht an der Abwesenheit einer Überschrift. */
  function Standort() {
    return <span data-testid="standort">{useLocation().pathname}</span>;
  }

  function renderAt(path: string, value: AuthContextValue) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <AuthFixture value={value}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
              <Standort />
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
    expect(screen.getByTestId("standort").textContent).toBe("/admin/feedback");
  });

  /**
   * Geprüft wird das ZIEL der Weiterleitung, nicht nur die Abwesenheit der
   * Überschrift. Ein Gate, das für Nicht-Admins `null` rendert oder auf eine
   * falsche Route umleitet, liesse den Nutzer auf einer leeren Seite stehen —
   * und eine Zusage, die nur „Überschrift fehlt" sagt, bliebe dabei grün
   * (Diff-Review codex).
   */
  it("leitet ein gewöhnliches Mitglied weg — und zwar auf die Startseite", () => {
    renderAt("/admin/feedback", MITGLIED);

    expect(screen.queryByRole("heading", { name: "QM-Feedback" })).not.toBeInTheDocument();
    // Zeichengleich und nicht per Teilzeichenkette: `toHaveTextContent("/")`
    // trifft JEDEN Pfad und wäre auch bei einer falschen Weiterleitung grün.
    expect(screen.getByTestId("standort").textContent).toBe("/");
  });
});
