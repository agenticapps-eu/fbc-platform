import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue, seedeRechte } from "../test/auth-fixtures";
import { REGISTRIEREN_PFAD } from "../pages/LoginPage";

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

function renderAt(path: string, value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // AGE-1000: Die Rechte des Fixtures in den Cache, sonst fragt `useDarf` die
  // RPC, findet keinen Server und meldet „kein Recht" — der Test maesse dann
  // das fehlende Netz statt der Stufe.
  seedeRechte(queryClient, value);
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

describe("MembershipGate für Entdecken-Routen", () => {
  // AGE-494: /kompass ist keine „entdecken"-Route mehr (kein Menüeintrag), also
  // greift dort RequireAuth statt der Wand. Die Regel, die dieser Test schützt —
  // ein Schaufenster-Format mauert, statt wegzuleiten — gilt weiter für /academy.
  it("zeigt anon auf einem auth-gegateten Format (/academy) die Wand statt eines Redirects", () => {
    renderAt("/academy", fakeAuthValue());

    // Kein Redirect auf /login; stattdessen die „Mitglied werden"-Wand.
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    // AGE-903: die Route trägt jetzt ein `minTier`, und die Wand nennt deshalb
    // die STUFE statt „Mitgliedern vorbehalten". Der Fall selbst ist unverändert
    // — anon wird gemauert und nicht weggeleitet, und genau das prüft die Zeile
    // darüber. Dass sich der Wandtext mit der Route ändert, ist eine Aussage
    // ÜBER die Route: /academy ist seit AGE-903 stufen-gegatet und nicht mehr
    // bloss auth-gegatet.
    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Discover verfügbar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mitglied werden" })).toHaveAttribute(
      "href",
      REGISTRIEREN_PFAD,
    );
    // Academy-Inhalt bleibt gesperrt. Geprüft an der REITERZEILE und nicht mehr
    // am Titel einer kuratierten Lektion: seit AGE-677 liegt die Redaktion in
    // einem Reiter, ihr Titel fehlte also auch dann, wenn die Seite sehr wohl
    // gerendert hätte — die Verneinung wäre wahr geworden, ohne etwas zu
    // belegen.
    expect(screen.queryByRole("tab", { name: "Alle" })).not.toBeInTheDocument();
  });

  // AGE-903: die Academy verlangt jetzt die Clubstufe. Bis dahin trug ihr
  // Eintrag ausschliesslich `requiresAuth: true` — gemessen, nicht angenommen —,
  // und JEDES aktivierte Konto kam hinein. Das war nie beschlossen, sondern nie
  // gebaut. Der Betrachter dieser Zusage steht deshalb jetzt auf `discover`.
  it("lässt ein Clubmitglied die Academy sehen", async () => {
    renderAt("/academy", authAsTier("discover"));

    // AGE-642: Die Seite kommt asynchron nach. Die Verneinung bleibt hinter der
    // positiven Zusage — vor dem Auflösen des Chunks fehlt die Wand ohnehin,
    // und das belegte nichts.
    // Die Marke ist die Reiterzeile, nicht mehr eine kuratierte Lektion: seit
    // AGE-677 steht die Redaktion im dritten Reiter und ist beim Öffnen nicht
    // sichtbar. Die Reiterzeile ist dafür der bessere Beleg — sie gehört der
    // Seite selbst und nicht einer ihrer Sichten.
    await screen.findByRole("tab", { name: "Alle" });
    expect(screen.getByRole("tab", { name: "Redaktion" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Dieser Bereich ist Mitgliedern vorbehalten" }),
    ).not.toBeInTheDocument();
  });

  // AGE-450: /meine-chancen ist keine gegatete Route mehr (leitet auf /). Diese
  // beiden Fälle — „Zur Startseite" statt „Mitglied werden", und der Upgrade-Weg —
  // prüfen wir jetzt an /mitglieder, der verbleibenden stufen-gegateten Route.
  // Die Schranke stand bis AGE-598 auf `discover`, dann auf `connect`, dann
  // wieder auf `discover` (bei gewandertem Rang 3 → 4) und ist mit AGE-1000
  // kein Stufenname mehr, sondern das Recht `verzeichnis.suchen` (Rang 6).
  // `active` liegt in jeder dieser Fassungen darunter, der Fall bleibt also
  // derselbe; nur die Stufe im Wandtext wechselt mit — jetzt IMPACT.
  it("zeigt einer zu niedrigen Stufe die Stufen-Wand mit „Zur Startseite“ statt CTA", () => {
    renderAt("/mitglieder", authAsTier("active"));

    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Impact verfügbar" }),
    ).toBeInTheDocument();
    // Eingeloggt-aber-zu-niedrig: kein „Mitglied werden"-CTA, nur „Zur Startseite".
    // Seit AGE-616 ist der CTA ein Link — beide Rollen prüfen, sonst ginge eine
    // Rückkehr zum Knopf hier unbemerkt durch.
    expect(screen.queryByRole("button", { name: "Mitglied werden" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mitglied werden" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zur Startseite" })).toBeInTheDocument();
  });

  // AGE-907: Diese Zusage ist umgedreht worden. Bis zum 25.09. hieß sie „bietet
  // eingeloggten Nutzern mit zu niedriger Stufe einen Upgrade-Weg zu
  // /mitgliedschaft" und klickte sich bis zur Preistabelle durch. Genau dieser
  // Weg ist der 3.1.1-Befund — und er traf jedes Konto unterhalb der Clubstufe.
  // (Das Prüferkonto der Store-Prüfung entsteht seit AGE-903 direkt auf
  // `discover` und läuft nicht mehr in diese Wand.)
  it("bietet keinen Kaufweg, sondern nennt, wer die Stufe freischaltet", () => {
    renderAt("/mitglieder", authAsTier("active"));

    // Beide Rollen, wie beim CTA darüber: käme der Weg als Link zurück statt als
    // Knopf, ginge er hier sonst unbemerkt durch.
    expect(screen.queryByRole("button", { name: "Upgrade" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Upgrade" })).not.toBeInTheDocument();
    // Die Positivkontrolle zur Verneinung: die Wand ist nicht stumm geworden,
    // sie sagt jetzt etwas anderes. Ohne diese Zeile wäre der Test auch grün,
    // wenn die Wand gar nicht mehr rendert.
    expect(screen.getByText(/schaltet der Fair Business Club/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zur Startseite" })).toBeInTheDocument();
  });
});

/**
 * Übersetzt aus RequireTier.test.tsx (AGE-314). Das Verzeichnis lag bis dahin unter
 * /verzeichnis und leitete zu niedrige Stufen weg. Als Top-Level-Eintrag „Mitglieder"
 * mauert es stattdessen (Spec §1) — die Zusage ist dieselbe, nur die Einlösung ist neu.
 */
describe("Rechte-Gating für /mitglieder (verzeichnis.suchen)", () => {
  it("zeigt Active die Wand statt Mitgliederdaten", () => {
    renderAt("/mitglieder", authAsTier("active"));

    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Impact verfügbar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });

  // Der Fall, den AGE-1000 NEU erzeugt: ein Konto IM Club, das das Verzeichnis
  // trotzdem nicht sieht. Bis hierher gab es ihn nicht — Clubschwelle und
  // Verzeichnisschwelle waren dieselbe Zahl.
  it("zeigt Discover die Wand — im Club und trotzdem ohne Suchrecht", () => {
    renderAt("/mitglieder", authAsTier("discover"));

    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Impact verfügbar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });

  // AGE-1000 — DIESE ZUSAGE IST ZUM ZWEITEN MAL UMGEDREHT, und sie ist die
  // wichtigste der Datei.
  //
  // Erste Fassung (AGE-598): „lässt Connect das Verzeichnis sehen".
  // Zweite Fassung (AGE-903): „zeigt Connect die Wand" — nicht weil AGE-598
  // falsch war, sondern weil `connect` ein anderer RANG wurde und die Schranke
  // von 2 auf 4 stieg.
  // Dritte Fassung (AGE-1000): der teuerste Fall ist nicht mehr `connect`,
  // sondern **`focus`**. Die Schranke ist das Recht `verzeichnis.suchen`
  // (Rang 6), und Rang 5 ist der höchste Rang ohne dieses Recht. Hielte die
  // Wand bei ihm nicht, hielte sie nirgends — und eine Zusage über `connect`
  // oder `active` zeigte das nicht, weil beide ausserhalb des Clubs liegen und
  // schon an der Clubschwelle scheitern könnten.
  it("zeigt Focus die Wand — Rang 5 ist der höchste Rang ohne das Suchrecht", () => {
    renderAt("/mitglieder", authAsTier("focus"));

    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Impact verfügbar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });

  // Bis AGE-1000 hiess diese Zusage „lässt Discover das Verzeichnis sehen".
  // Sie ist die Positivkontrolle zur Wand: ohne sie wären die Zusagen darüber
  // auch von einem Gate erfüllt, das /mitglieder für ALLE zumacht.
  it("lässt Impact das Verzeichnis sehen", async () => {
    renderAt("/mitglieder", authAsTier("impact"));

    // AGE-642: Seite kommt asynchron nach.
    await screen.findByRole("heading", { name: "Verzeichnis" });
    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("lässt Impact (höhere Stufe) das Verzeichnis sehen", async () => {
    renderAt("/mitglieder", authAsTier("impact"));

    await screen.findByRole("heading", { name: "Verzeichnis" });
    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("zeigt anonymen Besuchern die Wand mit „Mitglied werden“ — kein Verzeichnis", () => {
    renderAt("/mitglieder", fakeAuthValue());

    expect(screen.getByRole("link", { name: "Mitglied werden" })).toHaveAttribute(
      "href",
      REGISTRIEREN_PFAD,
    );
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });

  it("rendert nichts, solange die Stufe noch lädt — kein Aufblitzen der Wand", () => {
    renderAt("/mitglieder", authLoadingTier());

    expect(
      screen.queryByRole("heading", { name: "Dieser Bereich ist ab Connect verfügbar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });
});
