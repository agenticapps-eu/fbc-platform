import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ToastProvider } from "./components/ui/Toast";
import type { AuthContextValue } from "./providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "./test/auth-fixtures";

/**
 * Nur für den ActivationGate-Test unten gebraucht: `ActivationScreen` (was das
 * Gate bei einem unbestätigten Konto rendert) ruft `resendActivationLink` beim
 * Klick auf den Button, nicht schon beim Mount — hier reicht ein Stub, damit
 * das Modul ohne Netzwerk lädt. Kein `vi.mock` auf eigene Komponenten (siehe
 * ActivationGate.test.tsx): gemockt wird nur der Netzwerkrand. Der Rest des
 * Moduls (`leseTokenAusFragment` u. a.) bleibt echt — den brauchen die
 * `ActivationRedeemPage`-Tests weiter unten in dieser Datei.
 */
vi.mock("./lib/activation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/activation")>()),
  resendActivationLink: vi.fn(async () => {}),
}));

describe("App", () => {
  it("zeigt die Shell-Navigation und rendert auf / die öffentliche Startseite", () => {
    // Die Startseite lädt Events/Feed (TanStack Query) → Provider nötig.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AuthFixture value={fakeAuthValue()}>
        <QueryClientProvider client={queryClient}>
          {/* AppShell rendert jetzt <FeedbackButton /> (AGE-300), das useToast()
              braucht — wie main.tsx muss auch der Test-Wrapper ToastProvider stellen. */}
          <ToastProvider>
            <MemoryRouter initialEntries={["/"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );

    // Logo erscheint in Sidebar (Desktop) und Header (Mobil) — beide im DOM.
    //
    // `toBe(2)` statt `> 0` (Befund des Code-Reviews): der Kopfzeilen-Link führt
    // seit AGE-540 zwei Lockups (Marke unter `sm`, volles darüber), von denen im
    // Browser je eines per Media Query verborgen ist. jsdom kennt keine Media
    // Queries — dort trugen beide zum Namen bei, der Link hieß
    // „eff.bee.zeeeff.bee.zee" und fiel aus GENAU DIESER Zusicherung heraus,
    // ohne sie rot zu machen. `> 0` war schon zufrieden, wenn nur die
    // Seitenleiste passte. Die Zahl prüft jetzt, was der Kommentar behauptet.
    expect(screen.getAllByRole("link", { name: "eff.bee.zee" })).toHaveLength(2);
    // Anon sieht das ganze Schaufenster: alle fünf „Entdecken"-Einträge, unabhängig
    // davon, ob der Inhalt gegatet ist (Spec §1 — Rechte gaten Inhalte, nicht das Menü).
    // AGE-494: „Compass" ist nicht mehr darunter — der Kompass hat keinen eigenen
    // Menüpunkt mehr und lebt als Filter über der Mitgliederliste.
    for (const label of ["Start", "Academy", "Events", "Mitglieder", "Aktivität"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // „Mein Bereich" setzt ein Konto voraus und bleibt für Anon aus. Kompass,
    // Meine Kurse, Kontakte und Mitgliedschaft haben gar keinen Eintrag mehr.
    for (const label of [
      "Mein Profil",
      "Einstellungen",
      "Kompass",
      "Meine Kurse",
      "Meine Kontakte",
      "Mitgliedschaft",
    ]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
    // / rendert die öffentliche Startseite.
    expect(
      screen.getByRole("heading", { name: "Willkommen im Fair Business Club" }),
    ).toBeInTheDocument();
  });

  // AGE-494: /kontakte hat keinen Menüeintrag mehr — die Prüfung braucht eine
  // Route, die noch im Menü steht. /aktivitaet tut dasselbe.
  it("markiert auf /aktivitaet genau einen Sidebar-Eintrag als aktiv", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AuthFixture value={authAsTier("impact")}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/aktivitaet"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );
    const active = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("aria-current") === "page");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Aktivität");
  });

  /* AGE-494: Eine aus dem Menü genommene Route markiert folgerichtig keinen
     Eintrag mehr — sie ist erreichbar, aber nicht mehr Teil der Navigation.
     Ohne diesen Test fiele ein versehentlich wieder eingehängter Eintrag nicht auf. */
  it("markiert auf /kontakte gar keinen Sidebar-Eintrag mehr", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AuthFixture value={authAsTier("impact")}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/kontakte"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );
    const active = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("aria-current") === "page");
    expect(active).toHaveLength(0);
  });
});

/**
 * AGE-492 — der eff.bee.zee-Vision-Dummy ist aus dem Renderpfad entfernt. Bis
 * AGE-450 rendete App.tsx ihn für Staff statt der echten App; dieser Escape-Hatch
 * ist weg, und `src/vision/` wird von nirgends mehr importiert.
 *
 * Der Test steht bewusst als Regressionsschutz weiter hier: er hätte vor diesem
 * Change bestanden (mit umgekehrter Erwartung), und er fällt, sobald jemand den
 * Renderpfad zurückholt. Der Dummy zeigt ein „Vorschau · in Entwicklung"-Banner —
 * daran hängt die Prüfung.
 */
describe("der Vision-Dummy ist aus dem Renderpfad entfernt", () => {
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  function renderApp(value: AuthContextValue) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <AuthFixture value={value}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );
  }

  it("rendert die echte App auch für Staff — nicht die Vision", async () => {
    renderApp(
      fakeAuthValue({ user: { id: "admin" } as AuthContextValue["user"], staffRole: "admin" }),
    );
    // Die AppShell der echten App (Sidebar-Navigation) ist da; der Vision-Dummy
    // ersetzt die Routes vollständig und hätte sie nicht.
    await waitFor(() => expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument());
    expect(screen.queryByText(/Vorschau · in Entwicklung/)).not.toBeInTheDocument();
  });

  // Bestandsnutzer tragen "linkedin" noch im localStorage. Das darf weder die
  // Vision holen noch die App auf ein Theme ohne CSS-Block stellen.
  it('ignoriert ein gespeichertes „linkedin" und fällt auf hell zurück', async () => {
    localStorage.setItem("fbc.designVariant", "linkedin");
    renderApp(
      fakeAuthValue({ user: { id: "admin" } as AuthContextValue["user"], staffRole: "admin" }),
    );
    await waitFor(() => expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument());
    expect(screen.queryByText(/Vorschau · in Entwicklung/)).not.toBeInTheDocument();
    expect(document.documentElement.dataset.variant).toBe("hell");
  });
});

/**
 * Die Routen zurück ins Konto (AGE-505, Befund 8.3 aus Review 5.4).
 *
 * `ActivationRedeemPage` bekommt den Zweck als **Eigenschaft**; erzeugt wird sie
 * einzig in `App.tsx`. Genau diese Stelle prüfte kein Test: die Fälle in
 * `ActivationRedeemPage.test.tsx` übergeben `zweck` selbst und rendern die
 * Komponente direkt. Gemessen am 08.08.: mit entferntem `zweck="reset"` blieben
 * **458/458** Tests grün, während `/passwort-neu` wieder „Zugang freischalten"
 * anbot — also genau die Verwechslung, die AGE-505 ausräumen sollte.
 *
 * Zwei Fallen, an denen der frühere Versuch vorbeiging:
 *
 *  1. Das Token steht im **Fragment**, und `entnimmAktivierungsFragment` liest
 *     `window.location.hash` — nicht die Router-Location. `MemoryRouter` allein
 *     zeigt deshalb nie das Passwortformular.
 *  2. Ein Test auf nur EINER Route ist nicht unterscheidend: wer die beiden
 *     Routen vertauscht, bestünde ihn. Deshalb steht `/aktivierung` daneben.
 */
describe("Zweck der Einlöseseite hängt an der Route (AGE-505)", () => {
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  function renderRoute(pfad: string, hash = "") {
    // Beides setzen: der Router entscheidet, WELCHE Route greift, das Fragment,
    // ob ein Token da ist. Siehe Falle 1 oben.
    window.history.replaceState(null, "", `${pfad}${hash}`);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <AuthFixture value={fakeAuthValue()}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={[`${pfad}${hash}`]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );
  }

  it("/passwort-neu spricht vom Passwort, nicht vom Freischalten eines Zugangs", () => {
    renderRoute("/passwort-neu", "#token=geheim");

    expect(screen.getByRole("heading", { name: /Neues Passwort setzen/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Zugang freischalten/i })).not.toBeInTheDocument();
  });

  it("/aktivierung spricht weiter vom Zugang — sonst wäre der Test nicht unterscheidend", () => {
    renderRoute("/aktivierung", "#token=geheim");

    expect(screen.getByRole("button", { name: /Zugang freischalten/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Neues Passwort setzen/i }),
    ).not.toBeInTheDocument();
  });

  it("/passwort-vergessen zeigt das Adressformular in der Reset-Sprache", () => {
    renderRoute("/passwort-vergessen");

    expect(screen.getByRole("heading", { name: /Passwort vergessen/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Bestätigungslink anfordern/i }),
    ).not.toBeInTheDocument();
  });
});

/**
 * Befund F1 aus AGE-495 (C3, Review-Restbefund): `/onboarding` trug nur
 * `<RequireAuth>`, nicht `<ActivationGate>` — der gategeschützte Zweig endet
 * in App.tsx vor dieser Route. Ein unbestätigtes Konto sah dadurch den vollen
 * Kompass-Assistenten statt der Wand, obwohl `ActivationGate.tsx` „egal
 * welche Route" verspricht.
 *
 * `/onboarding` bleibt bewusst außerhalb der `AppShell` (eigene Vollbild-
 * strecke, wie `/login`) — nur das Gate kommt zusätzlich, verschachtelt wie
 * im geschützten AppShell-Zweig.
 */
describe("/onboarding liegt hinter der Aktivierungswand (AGE-495, Befund F1)", () => {
  function renderOnboarding(value: AuthContextValue) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <AuthFixture value={value}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/onboarding"]}>
              <App />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </AuthFixture>,
    );
  }

  it("zeigt einem unbestätigten Konto die Wand statt des Kompass-Assistenten", () => {
    renderOnboarding(
      fakeAuthValue({ user: { id: "u1" } as AuthContextValue["user"], isActivated: false }),
    );

    expect(screen.getByRole("heading", { name: /Noch ein Schritt/i })).toBeInTheDocument();
    expect(screen.queryByText(/Schritt 1 von/)).not.toBeInTheDocument();
  });

  it("lässt ein bestätigtes Konto weiterhin auf den Kompass-Assistenten", () => {
    renderOnboarding(
      fakeAuthValue({ user: { id: "u1" } as AuthContextValue["user"], isActivated: true }),
    );

    expect(screen.getByText(/Schritt 1 von/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Noch ein Schritt/i })).not.toBeInTheDocument();
  });
});
