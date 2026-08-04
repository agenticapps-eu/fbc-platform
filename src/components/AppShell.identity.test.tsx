import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import { LEVEL_RANK } from "../config/levels";

/**
 * Mit E-Mail — der entfernte Sidebar-Block rendert genau sie (`user.email`).
 * `authAsTier` liefert einen User OHNE E-Mail; eine Assertion dagegen wäre auch
 * am Altstand grün gewesen und hätte nichts belegt.
 */
const MIT_EMAIL = fakeAuthValue({
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

/**
 * „Wer bin ich" steht genau einmal im Rahmen (AGE-494, Donald 04.08.).
 *
 * Der Rahmen zeigte das eingeloggte Mitglied dreimal auf demselben Bildschirm:
 * als Block über der Sidebar-Navigation, als Avatar rechts in der Topbar und ein
 * drittes Mal mit E-Mail und Stufe im aufgeklappten Profilmenü. Der Sidebar-Block
 * trug dabei die rohe E-Mail-Adresse, obwohl der Name im Profil steht.
 *
 * AGE-499 hat für den AUSGELOGGTEN Fall bereits genau so entschieden — der
 * Anmelde-Block über der Navigation war „dieselbe Aufforderung zweimal". Dieser
 * Test zieht die Regel auf den eingeloggten Fall nach, damit der Block nicht bei
 * der nächsten Shell-Änderung stillschweigend zurückkommt.
 */
describe("Identität im Rahmen (AGE-494)", () => {
  it("zeigt das eingeloggte Mitglied nur in der Topbar, nicht in der Sidebar", () => {
    renderApp(MIT_EMAIL);

    const sidebar = document.querySelector("aside");
    expect(sidebar).not.toBeNull();
    // Die Sidebar trägt Navigation — und sonst keine Identität. Am Altstand stand
    // hier die rohe E-Mail-Adresse.
    expect(within(sidebar as HTMLElement).queryByText("bea@demo.local")).not.toBeInTheDocument();
    expect(
      within(sidebar as HTMLElement).queryByRole("link", { name: /Mein Profil/ }),
    ).toBeInTheDocument();
    // Genau ein Profil-Einstieg über den Avatar, und der sitzt in der Topbar.
    expect(screen.getByRole("button", { name: "Profilmenü" })).toBeInTheDocument();
  });

  it("führt in der Sidebar keinen zweiten Link auf /profil neben dem Menüeintrag", () => {
    renderApp(authAsTier("impact"));

    const sidebar = document.querySelector("aside") as HTMLElement;
    const profilLinks = within(sidebar)
      .getAllByRole("link")
      .filter((el) => el.getAttribute("href") === "/profil");
    expect(profilLinks).toHaveLength(1);
  });

  it("lässt die Navigation für Gäste unverändert", () => {
    renderApp({ ...authAsTier("basic"), user: null, tier: null, levelRank: null });

    const sidebar = document.querySelector("aside") as HTMLElement;
    expect(within(sidebar).getByRole("link", { name: "Aktivität" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Profilmenü" })).not.toBeInTheDocument();
  });
});
