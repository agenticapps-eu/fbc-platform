import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AGE-641 Phase B — WANN nach der Push-Erlaubnis gefragt wird.
 *
 * `src/lib/push.ts` stand seit dem 28.08. gebaut und ohne Aufrufer da. Dieser
 * Test prüft genau das fehlende Stück: den Aufrufer, und zwar an der Stelle,
 * an der die Frage erklärbar ist.
 *
 * WARUM DAS EINE ZUSAGE IST UND KEINE GESCHMACKSFRAGE. iOS zeigt den
 * Systemdialog EINMAL. Wer ihn beim Kaltstart sieht, sagt nein — und danach
 * ist die Entscheidung endgültig, ein zweiter Anlauf führt nur noch über die
 * Systemeinstellungen. Ein Aufruf im Kaltstart wäre deshalb nicht „etwas
 * früh", sondern der dauerhafte Verlust des Kanals.
 *
 * WAS HIER NICHT GEPRÜFT WIRD: alles hinter `pushEinrichten` — Erlaubnis,
 * Token, `claim_push_token`. Push-Ereignisse entstehen in jsdom nie; ein Test,
 * der auf sie wartet, wäre grün, weil nichts passiert. Dieselbe Falle wie bei
 * `env(safe-area-inset-*)` und beim `backButton`. Die Grenze ist deshalb
 * bewusst das Modul: DASS es gerufen wird, wann, und wie oft.
 */
const { pushEinrichten, pushZielZuhoerer } = vi.hoisted(() => ({
  pushEinrichten: vi.fn(async () => "web"),
  // Der Ziel-Zuhoerer haengt seit AGE-641 Phase B am Montieren der Huelle.
  // Ohne Attrappe liefe der echte in jsdom — und ein fehlendes Feld hier machte
  // JEDE Zusage dieser Datei rot, nicht nur die zum Sprungziel.
  pushZielZuhoerer: vi.fn(async () => {}),
}));
vi.mock("../lib/push", () => ({ pushEinrichten, pushZielZuhoerer }));

vi.mock("../lib/chat", async (original) => ({
  ...(await original<typeof import("../lib/chat")>()),
  fetchThreads: async () => ({ threads: [], nextOffset: null }),
  fetchMessages: async () => ({ messages: [], erschoepft: true }),
  fetchUnreadCounts: async () => ({
    gesamt: 0,
    jeThread: new Map<string, number>(),
    hatUngelesen: () => false,
  }),
  markThreadRead: async () => {},
  subscribeToAllMessages: () => () => {},
  subscribeToThread: () => () => {},
}));

const { default: App } = await import("../App");
const { ToastProvider } = await import("./ui/Toast");
const { AuthFixture, fakeAuthValue } = await import("../test/auth-fixtures");
const { LEVEL_RANK } = await import("../config/levels");
type AuthContextValue = import("../providers/auth-context").AuthContextValue;

const MITGLIED = fakeAuthValue({
  user: { id: "test-user", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});
const GAST = fakeAuthValue();

/** Telefonbreite. Der Fall, um den es geht, ist der native — und der ist schmal:
 *  dort trägt die Schublade die Nachrichten, nicht die angedockte Leiste. */
function stelleTelefon() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const ZWEITES_MITGLIED = fakeAuthValue({
  user: { id: "zweites-konto", email: "cem@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});

function baum(pfad: string, value: AuthContextValue, queryClient: QueryClient) {
  return (
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[pfad]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>
  );
}

function renderApp(pfad = "/aktivitaet", value: AuthContextValue = MITGLIED) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const gerendert = render(baum(pfad, value, queryClient));
  return {
    ...gerendert,
    /** Wechselt das Konto, ohne die App neu zu montieren — genau das, was ein
     *  Abmelden und Anmelden in derselben Sitzung tut. */
    wechsleKonto: (anderes: AuthContextValue) =>
      gerendert.rerender(baum(pfad, anderes, queryClient)),
  };
}

const oeffner = () => screen.getByRole("button", { name: "Nachrichten-Leiste öffnen" });
const schliesser = () => screen.getByRole("button", { name: "Nachrichten-Leiste schließen" });

beforeEach(() => {
  stelleTelefon();
  pushEinrichten.mockClear();
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Die Push-Erlaubnis wird beim Öffnen der Nachrichten gefragt (AGE-641 Phase B)", () => {
  it("fragt beim Start NICHT", async () => {
    renderApp();
    // Erst warten, bis die Hülle wirklich steht — sonst misst die Zusage nur,
    // dass noch nichts gerendert war.
    expect(await screen.findByRole("link", { name: /Nachrichten/ })).toBeInTheDocument();
    expect(pushEinrichten).not.toHaveBeenCalled();
  });

  it("fragt, sobald die Nachrichten-Schublade aufgeht", async () => {
    renderApp();
    fireEvent.click(oeffner());
    await waitFor(() => expect(pushEinrichten).toHaveBeenCalledTimes(1));
  });

  it("fragt beim zweiten Öffnen nicht noch einmal", async () => {
    renderApp();
    fireEvent.click(oeffner());
    await waitFor(() => expect(pushEinrichten).toHaveBeenCalledTimes(1));

    fireEvent.click(schliesser());
    // Positivkontrolle: die Schublade ist wirklich zu, der Öffner ist zurück.
    await waitFor(() => expect(oeffner()).toBeInTheDocument());
    fireEvent.click(oeffner());

    await waitFor(() => expect(schliesser()).toBeInTheDocument());
    expect(pushEinrichten).toHaveBeenCalledTimes(1);
  });

  it("fragt auch, wenn die Nachrichten als Seite geöffnet werden", async () => {
    renderApp("/chat");
    await waitFor(() => expect(pushEinrichten).toHaveBeenCalledTimes(1));
  });

  it("fragt nach einem Kontowechsel erneut — auf demselben Gerät", async () => {
    // DER FALL, DEN DER RIEGEL FAST VERSCHLUCKT HÄTTE. Ein Gerät und zwei
    // Konten ist der Normalfall (Ehepaare, Diensttelefone, Nachfolger in einer
    // Firma) — dafür gibt es `claim_push_token` überhaupt. Fragte die App nach
    // dem Wechsel nicht erneut, bliebe das Token beim VORIGEN Konto hängen,
    // und dessen nächste Nachricht ginge auf ein fremdes Telefon.
    const { wechsleKonto } = renderApp();
    fireEvent.click(oeffner());
    await waitFor(() => expect(pushEinrichten).toHaveBeenCalledTimes(1));

    fireEvent.click(schliesser());
    wechsleKonto(ZWEITES_MITGLIED);
    fireEvent.click(oeffner());

    await waitFor(() => expect(pushEinrichten).toHaveBeenCalledTimes(2));
  });

  it("versucht es erneut, wenn die Einrichtung gescheitert ist", async () => {
    // AUFLAGE AUS DER CODE-REVIEW. Der Riegel fällt VOR dem Aufruf — sonst
    // liefe ein schnelles Auf/Zu zweimal hinein. Damit wäre aber auch ein
    // Fehlschlag der Brücke endgültig: der Systemdialog war nie zu sehen, und
    // die App fragte in dieser Sitzung nie wieder. Genau das soll er nicht.
    //
    // Nur bei "fehler". Eine Ablehnung ist eine Entscheidung, die iOS ohnehin
    // kein zweites Mal zur Wahl stellt.
    pushEinrichten.mockResolvedValueOnce("fehler");
    renderApp();

    fireEvent.click(oeffner());
    await waitFor(() => expect(pushEinrichten).toHaveBeenCalledTimes(1));

    fireEvent.click(schliesser());
    await waitFor(() => expect(oeffner()).toBeInTheDocument());
    fireEvent.click(oeffner());

    await waitFor(() => expect(pushEinrichten).toHaveBeenCalledTimes(2));
  });

  it("versucht es nach einer Ablehnung NICHT erneut", async () => {
    // Die Gegenseite derselben Zusage — ohne sie liesse sich „nur bei fehler"
    // von „immer" nicht unterscheiden.
    pushEinrichten.mockResolvedValueOnce("abgelehnt");
    renderApp();

    fireEvent.click(oeffner());
    await waitFor(() => expect(pushEinrichten).toHaveBeenCalledTimes(1));

    fireEvent.click(schliesser());
    await waitFor(() => expect(oeffner()).toBeInTheDocument());
    fireEvent.click(oeffner());

    await waitFor(() => expect(schliesser()).toBeInTheDocument());
    expect(pushEinrichten).toHaveBeenCalledTimes(1);
  });

  it("fragt einen Gast nicht", async () => {
    renderApp("/aktivitaet", GAST);
    expect(await screen.findByRole("button", { name: "Anmelden" })).toBeInTheDocument();
    expect(pushEinrichten).not.toHaveBeenCalled();
  });
});
