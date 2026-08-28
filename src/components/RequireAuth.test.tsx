import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "../components/ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";

afterEach(() => localStorage.clear());

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
    // AGE-642: Der Beleg war bis zum Route-Splitting das Lade-Skelett
    // (`role="status"`). Das war eine verdeckte Annahme über die ERSTE
    // Renderrunde: die Seite mountete synchron, und die Dashboard-Abfrage war
    // in diesem Moment noch offen. Jetzt kommt die Seite später, und bis dahin
    // ist die Abfrage längst gescheitert — das Skelett ist dann vorbei.
    // Belegt wird deshalb, dass die Profilseite ÜBERHAUPT gemountet hat: ihr
    // Fehlerzweig gehört ihr allein und steht auf keiner anderen Route.
    const fehler = "Profil konnte nicht geladen werden. Bitte neu laden.";
    // Die Vorgabe von `findBy` sind 1000 ms, und genau daran ist dieser Test in
    // CI gescheitert (28.08., Lauf 33173596193: 1086 ms — die Grenze plus
    // Aufschlag). Lokal ist er nicht zu reproduzieren: auch mit geleertem
    // `node_modules/.vite` liegt die ganze Datei bei 542 ms, und sogar eine
    // Grenze von 60 ms hält. Der Unterschied ist der Läufer, nicht die Logik —
    // seit dem Route-Splitting muss vitest die Profilseite erst nachladen und
    // kalt transformieren, und das kostet auf zwei CI-Kernen ein Vielfaches.
    // Deshalb hier ausdrücklich Luft, statt die Grenze global zu heben: global
    // würde jeder ECHTE Fehlschlag in 190 Dateien vier Sekunden länger
    // brauchen, um rot zu werden.
    // `timeout` gehört in den DRITTEN Parameter (`waitForOptions`) — im zweiten
    // steht `SelectorMatcherOptions`, und dort ist es kein bekanntes Feld. Ohne
    // `pnpm typecheck` wäre das stillschweigend wirkungslos geblieben: der Test
    // liefe weiter mit 1000 ms und wäre in CI erneut rot geworden.
    await screen.findByText(fehler, undefined, { timeout: 4000 });
    expect(screen.getByText(fehler)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
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
