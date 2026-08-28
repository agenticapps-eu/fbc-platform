import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ToastProvider } from "../components/ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";

afterEach(() => localStorage.clear());

// Diese Datei prüft das AUTH-GATE, nicht Supabase. Ohne diese Attrappe hing sie
// aber am Netzwerk: `vite.config.ts` gibt den Tests
// `VITE_SUPABASE_URL=http://localhost:54321` — ob dort jemand antwortet,
// entscheidet der Rechner, nicht der Test.
//
// Genau daran ist sie am 28.08. ZWEIMAL in CI gescheitert (Läufe 33173596193
// und 33174921117) und lokal NIE: hier läuft ein lokaler Supabase-Stack und
// antwortet in 50 ms, in CI hört auf 54321 niemand. Die geteilte
// Dashboard-Abfrage — die Kopfzeile startet sie unter demselben Schlüssel,
// bevor die Seite überhaupt nachgeladen ist — erreichte lokal den Fehlerzweig
// und in CI gar keinen Zustand.
//
// Eine grössere Wartezeit war die falsche Antwort und ist wieder draussen: es
// ist keine Frage der Dauer, sondern des Zustands. Mit 4000 ms statt 1000 blieb
// der Lauf rot, nur langsamer.
//
// Ein nie auflösendes Promise hält die Seite deterministisch im Ladezustand,
// auf beiden Seiten gleich und ohne einen einzigen Netzaufruf. Nur
// `fetchDashboard` wird ersetzt; `dashboardQueryKey` bleibt echt, sonst prüfte
// der Test den Schlüssel gegen sich selbst.
const { dashboardAbfrage } = vi.hoisted(() => ({
  dashboardAbfrage: vi.fn(() => new Promise(() => {})),
}));

vi.mock("../lib/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/dashboard")>()),
  fetchDashboard: dashboardAbfrage,
}));

/** Eingeloggt, aber tier/level_rank werden noch geladen (Profil-Fetch offen). */
function authLoadingTier(): AuthContextValue {
  return fakeAuthValue({
    user: { id: "test-user" } as AuthContextValue["user"],
    tier: null,
    levelRank: null,
    tierLoading: true,
  });
}

function renderAt(path: string, value: Parameters<typeof AuthFixture>[0]["value"]) {
  // App-weite Provider (sonst in main.tsx) mitliefern: /profil mountet den
  // Profil-Editor, der QueryClient + Toasts braucht. retry:false hält die
  // (im Test ins Leere laufende) Profil-Abfrage im Lade-Zustand stabil.
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

describe("Auth-Gating für /mein-bereich", () => {
  it("leitet nicht eingeloggte Nutzer auf /login", () => {
    renderAt("/mein-bereich", fakeAuthValue());

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("lässt eingeloggte Basic-Nutzer Mein Bereich sehen", async () => {
    renderAt("/mein-bereich", authAsTier("basic"));

    // /mein-bereich leitet auf /profil weiter; der Auth-Gate hat durchgelassen
    // und die Profilansicht rendert (Beleg: Lade-Skeleton sichtbar, kein Login).
    //
    // AGE-642: Die Seite kommt seit dem Route-Splitting asynchron nach, deshalb
    // `findBy`. Die Verneinung steht bewusst DAHINTER: vor dem Auflösen des
    // Chunks ist der Baum leer, und "kein Login zu sehen" waere dann wahr,
    // ohne etwas zu belegen.
    await screen.findByRole("status");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
  });

  it("blockiert Mein Bereich nicht, während die Stufe noch lädt (nur Session nötig)", async () => {
    renderAt("/mein-bereich", authLoadingTier());

    // /mein-bereich → /profil (RequireAuth, kein MembershipGate): bei laufendem
    // tier-Fetch reicht die Session – kein vorzeitiger Redirect auf /login.
    //
    // AGE-642: Seit dem Route-Splitting kommt die Seite asynchron nach, deshalb
    // `findBy`. Belegt wird das Lade-Skelett — mit der stillgelegten
    // Dashboard-Abfrage (siehe `vi.mock` oben) ist das der Zustand, in dem die
    // Seite bleibt, und zwar auf jedem Rechner gleich.
    //
    // Die Verneinung steht bewusst DAHINTER: vor dem Auflösen des Chunks ist
    // der Baum leer, und „kein Login zu sehen" wäre dann wahr, ohne etwas zu
    // belegen.
    await screen.findByRole("status");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    // Wächter gegen den stillen Rückfall: greift `vi.mock` nach einem Umbau
    // nicht mehr (umbenanntes Modul, verschobener Pfad), hinge dieser Test
    // wieder am lokalen Stack — und wäre hier grün, in CI rot. Genau so ist er
    // heute zweimal durchgerutscht.
    expect(dashboardAbfrage).toHaveBeenCalled();
  });
});

describe("Auth-Gating für /profil", () => {
  it("leitet nicht eingeloggte Nutzer auf /login", () => {
    renderAt("/profil", fakeAuthValue());

    expect(screen.queryByRole("heading", { name: "Profil" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("lässt eingeloggte Mitglieder den Profil-Editor öffnen (jede Stufe, auch Basic)", async () => {
    renderAt("/profil/bearbeiten", authAsTier("basic"));

    // Kein Redirect auf /login → der Auth-Gate hat durchgelassen; der Editor
    // mountet und lädt seine Daten.
    await screen.findByText("Profil wird geladen…");
    expect(screen.getByText("Profil wird geladen…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
  });
});
