import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesignVariantProvider } from "./DesignVariantProvider";
import { ThemeServerSync } from "./ThemeServerSync";
import { useDesignVariant } from "./design-variant-context";
import type { AuthContextValue } from "./auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";

/* AGE-492 — die Theme-Auflösung hat zwei Quellen und eine Reihenfolge:
 *   ausgeloggt  → nur localStorage, Default 'hell'
 *   eingeloggt  → member_settings.theme gewinnt und überschreibt localStorage
 *
 * Der Serverwert trifft prinzipbedingt NACH dem ersten Paint ein. Diese Tests
 * prüfen den Zustand danach; das Ausbleiben eines Flashs davor ist Sache des
 * Inline-Skripts in index.html und hier nicht messbar.
 *
 * Gemockt wird ausschließlich die Datenzugriffsschicht (member-settings), nicht
 * der Provider oder die Sync-Komponente selbst — sonst prüfte der Test seine
 * eigene Fiktion. */

const fetchMemberTheme = vi.hoisted(() => vi.fn());
const saveMemberTheme = vi.hoisted(() => vi.fn());

vi.mock("../lib/member-settings", () => ({
  fetchMemberTheme,
  saveMemberTheme,
  memberThemeQueryKey: (uid: string) => ["member-theme", uid],
}));

function Probe() {
  const { variant, setVariant } = useDesignVariant();
  return (
    <>
      <span data-testid="variant">{variant}</span>
      <button type="button" onClick={() => setVariant("navy")}>
        navy wählen
      </button>
      <button type="button" onClick={() => setVariant("hell")}>
        hell wählen
      </button>
    </>
  );
}

function renderApp(auth: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={auth}>
      <QueryClientProvider client={queryClient}>
        <DesignVariantProvider>
          <ThemeServerSync />
          <Probe />
        </DesignVariantProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

const loggedIn = fakeAuthValue({ user: { id: "user-1" } as AuthContextValue["user"] });

beforeEach(() => {
  fetchMemberTheme.mockReset().mockResolvedValue(null);
  saveMemberTheme.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
  document.documentElement.removeAttribute("data-variant");
});

afterEach(() => {
  localStorage.clear();
});

describe("ausgeloggt", () => {
  it("nimmt den localStorage-Wert", () => {
    localStorage.setItem("fbc.designVariant", "navy");
    renderApp(fakeAuthValue());
    expect(screen.getByTestId("variant")).toHaveTextContent("navy");
  });

  it("fällt ohne gespeicherten Wert auf hell zurück", () => {
    renderApp(fakeAuthValue());
    expect(screen.getByTestId("variant")).toHaveTextContent("hell");
  });

  it("fragt den Server gar nicht erst", () => {
    renderApp(fakeAuthValue());
    expect(fetchMemberTheme).not.toHaveBeenCalled();
  });

  it("schreibt eine Änderung nur lokal", async () => {
    renderApp(fakeAuthValue());
    screen.getByRole("button", { name: "navy wählen" }).click();
    await waitFor(() => expect(screen.getByTestId("variant")).toHaveTextContent("navy"));
    expect(localStorage.getItem("fbc.designVariant")).toBe("navy");
    expect(saveMemberTheme).not.toHaveBeenCalled();
  });
});

/* Diese Komponente LIEST nur — der Write sitzt in EinstellungenPage, wo die
 * Handlung passiert, und wird dort getestet. Der Grund steht im Kopf von
 * ThemeServerSync.tsx: aus einem Effect über `variant` abgeleitet, überschriebe
 * der Write beim Login die Serverwahl mit dem lokalen Wert. */
describe("schreibt selbst nie", () => {
  it("ruft saveMemberTheme auch eingeloggt nicht auf", async () => {
    localStorage.setItem("fbc.designVariant", "hell");
    fetchMemberTheme.mockResolvedValue("navy");
    renderApp(loggedIn);
    await waitFor(() => expect(screen.getByTestId("variant")).toHaveTextContent("navy"));
    expect(saveMemberTheme).not.toHaveBeenCalled();
  });
});

describe("eingeloggt", () => {
  it("lässt den Serverwert über localStorage gewinnen und schreibt ihn dorthin", async () => {
    localStorage.setItem("fbc.designVariant", "hell");
    fetchMemberTheme.mockResolvedValue("navy");

    renderApp(loggedIn);

    // Beide Zusicherungen gehören IN den waitFor: das <span> trägt den Wert
    // schon im Commit, localStorage schreibt erst der Passive Effect des
    // DesignVariantProvider. Gemessen: in dem Moment, in dem das DOM "navy"
    // zeigt, steht im Storage noch "hell". Stand die Storage-Prüfung draußen,
    // hing der Test daran, dass das Polling zufällig später fiel — einmal in
    // CI tat es das nicht.
    await waitFor(() => {
      expect(screen.getByTestId("variant")).toHaveTextContent("navy");
      expect(localStorage.getItem("fbc.designVariant")).toBe("navy");
    });
  });

  // Ohne member_settings-Zeile darf der lokale Wert NICHT auf den Default
  // zurückgezwungen werden — sonst verliert jeder Erstlogin seine Wahl.
  it("behält den lokalen Wert, wenn der Server nichts gespeichert hat", async () => {
    localStorage.setItem("fbc.designVariant", "navy");
    fetchMemberTheme.mockResolvedValue(null);

    renderApp(loggedIn);

    await waitFor(() => expect(fetchMemberTheme).toHaveBeenCalled());
    expect(screen.getByTestId("variant")).toHaveTextContent("navy");
  });

  it("spiegelt das Theme auf <html data-variant>", async () => {
    fetchMemberTheme.mockResolvedValue("navy");
    renderApp(loggedIn);
    await waitFor(() => expect(document.documentElement.dataset.variant).toBe("navy"));
  });
});

describe("Logout", () => {
  // AGE-492: Abmelden setzt das Theme NICHT zurück. Der zuletzt gewählte Wert
  // bleibt als anonymer Default stehen.
  it("behält die zuletzt gewählte Darstellung", async () => {
    fetchMemberTheme.mockResolvedValue("navy");
    const { unmount } = renderApp(loggedIn);
    await waitFor(() => expect(screen.getByTestId("variant")).toHaveTextContent("navy"));
    unmount();

    renderApp(fakeAuthValue());
    expect(screen.getByTestId("variant")).toHaveTextContent("navy");
  });
});
