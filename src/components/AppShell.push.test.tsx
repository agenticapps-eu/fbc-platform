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
const { pushEinrichten, pushKanalAnlegen, pushLebenszeichen, pushZielZuhoerer } = vi.hoisted(
  () => ({
    pushEinrichten: vi.fn(async () => "web"),
    // AGE-682: das stille Erneuern beim Start. Eigener Ausgang, weil es NICHT
    // fragt — und eigene Attrappe, weil die Zusagen unten unterscheiden, WELCHER
    // der beiden Wege gelaufen ist.
    pushLebenszeichen: vi.fn(async () => "web"),
    // Der Ziel-Zuhoerer haengt seit AGE-641 Phase B am Montieren der Huelle.
    // Ohne Attrappe liefe der echte in jsdom — und ein fehlendes Feld hier machte
    // JEDE Zusage dieser Datei rot, nicht nur die zum Sprungziel.
    pushZielZuhoerer: vi.fn(async () => {}),
    // AGE-642: der Mitteilungskanal, ebenfalls am Montieren. Auch hier gilt:
    // ein fehlendes Feld in dieser Attrappe röte JEDE Zusage der Datei.
    pushKanalAnlegen: vi.fn(async () => "entfaellt"),
  }),
);
vi.mock("../lib/push", () => ({
  pushEinrichten,
  pushKanalAnlegen,
  pushLebenszeichen,
  pushZielZuhoerer,
}));

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
  pushLebenszeichen.mockClear();
  pushKanalAnlegen.mockClear();
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

/**
 * AGE-682 — das Lebenszeichen beim Start.
 *
 * ZWEI EFFEKTE, NICHT EINER. Der Effekt oben hängt an `nachrichtenOffen` und
 * an einem Riegel je Konto; beides ist für ein Lebenszeichen falsch. Dieser
 * Block prüft deshalb genau die Trennung: dass beim Start der stille Weg
 * läuft und der fragende NICHT.
 *
 * Warum die Trennung zählt: verschmölzen die beiden, wäre entweder der
 * Zeitstempel wieder an die Nachrichten gekettet — der Befund, der diesen
 * Vorgang ausgelöst hat — oder der Systemdialog stünde im Kaltstart.
 */
describe("Das Lebenszeichen läuft beim Start, ohne zu fragen (AGE-682)", () => {
  it("erneuert das Token beim Montieren der Hülle", async () => {
    renderApp();
    expect(await screen.findByRole("link", { name: /Nachrichten/ })).toBeInTheDocument();

    await waitFor(() => expect(pushLebenszeichen).toHaveBeenCalledTimes(1));
    // Die Gegenprobe im selben Test: der fragende Weg ist NICHT gelaufen.
    // Ohne sie bliebe offen, ob beim Start doch ein Dialog kommt.
    expect(pushEinrichten).not.toHaveBeenCalled();
  });

  it("erneuert einmal je Montierung, nicht je Ansicht", async () => {
    renderApp();
    expect(await screen.findByRole("link", { name: /Nachrichten/ })).toBeInTheDocument();
    await waitFor(() => expect(pushLebenszeichen).toHaveBeenCalledTimes(1));

    // Die Schublade auf und wieder zu: der Start-Effekt darf davon nichts
    // mitbekommen, sonst hinge er doch an den Nachrichten.
    fireEvent.click(oeffner());
    await waitFor(() => expect(schliesser()).toBeInTheDocument());
    fireEvent.click(schliesser());
    await waitFor(() => expect(oeffner()).toBeInTheDocument());

    expect(pushLebenszeichen).toHaveBeenCalledTimes(1);
  });

  it("erneuert erneut, wenn in derselben Sitzung das Konto wechselt", async () => {
    // Ein Gerät, zwei Konten ist der Normalfall. Das Token gehört danach dem
    // neuen Konto — und dessen `letzter_kontakt` will gesetzt sein.
    const { wechsleKonto } = renderApp();
    expect(await screen.findByRole("link", { name: /Nachrichten/ })).toBeInTheDocument();
    await waitFor(() => expect(pushLebenszeichen).toHaveBeenCalledTimes(1));

    wechsleKonto(ZWEITES_MITGLIED);
    await waitFor(() => expect(pushLebenszeichen).toHaveBeenCalledTimes(2));
    expect(pushEinrichten).not.toHaveBeenCalled();
  });

  it("erneuert für einen Gast nichts", async () => {
    // Ohne Anmeldung gibt es kein Profil, dem ein Token gehören könnte.
    renderApp("/aktivitaet", GAST);
    expect(await screen.findByRole("button", { name: "Anmelden" })).toBeInTheDocument();
    expect(pushLebenszeichen).not.toHaveBeenCalled();
  });
});

/**
 * AGE-642 — der Mitteilungskanal beim Start.
 *
 * OHNE JEDE BEDINGUNG, und das ist die ganze Zusage dieses Blocks. Ein Kanal,
 * den es im Moment der Zustellung noch nicht gibt, fällt auf
 * `fcm_fallback_notification_channel` zurück — die Mitteilung ist dann bereits
 * lautlos angekommen, und ein danach angelegter Kanal ändert daran nichts.
 * Deshalb darf der Aufruf weder am Konto noch am Öffnen der Nachrichten hängen,
 * und der Gast-Fall unten ist keine Randnotiz, sondern der Kern.
 *
 * Was der Kanal am Gerät bewirkt, entsteht in jsdom nie und steht hier nicht.
 * Geprüft wird die Aufrufstelle; der Inhalt des Aufrufs steht in
 * `src/lib/push.kanal.test.ts`.
 */
describe("Der Mitteilungskanal entsteht beim Start (AGE-642)", () => {
  it("legt den Kanal beim Montieren der Hülle an", async () => {
    renderApp();
    expect(await screen.findByRole("link", { name: /Nachrichten/ })).toBeInTheDocument();

    await waitFor(() => expect(pushKanalAnlegen).toHaveBeenCalledTimes(1));
  });

  it("legt ihn auch für einen Gast an", async () => {
    // Die Gegenprobe zum Lebenszeichen darüber, das für einen Gast NICHTS tut:
    // ein Kanal gehört keinem Konto, kostet keine Erlaubnis, und wer sich erst
    // nach der Anmeldung einen anlegte, hätte ihn beim ersten Push noch nicht.
    renderApp("/aktivitaet", GAST);
    expect(await screen.findByRole("button", { name: "Anmelden" })).toBeInTheDocument();

    await waitFor(() => expect(pushKanalAnlegen).toHaveBeenCalledTimes(1));
    expect(pushLebenszeichen).not.toHaveBeenCalled();
  });

  it("legt ihn einmal je Montierung an, nicht je Ansicht", async () => {
    renderApp();
    expect(await screen.findByRole("link", { name: /Nachrichten/ })).toBeInTheDocument();
    await waitFor(() => expect(pushKanalAnlegen).toHaveBeenCalledTimes(1));

    fireEvent.click(oeffner());
    await waitFor(() => expect(schliesser()).toBeInTheDocument());
    fireEvent.click(schliesser());
    await waitFor(() => expect(oeffner()).toBeInTheDocument());

    expect(pushKanalAnlegen).toHaveBeenCalledTimes(1);
  });
});
