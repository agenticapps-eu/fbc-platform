import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Auslöser des Aktivierungsversands (AGE-526).
 *
 * WAS HIER FESTGEHALTEN WIRD. Bei der Demo am 2026-08-10 kam für keine neue
 * Registrierung eine Mail an — und es war keine fehlgeschlagen, es hatte nie
 * jemand eine angefordert. Die eingebaute Bestätigung ist aus (AGE-445), und
 * der Aktivierungsweg aus AGE-495 war für IMPORTIERTE Mitglieder gebaut, denen
 * ein Admin den Link schickt. Wer sich selbst registriert, fiel hinter
 * dasselbe Gate, ohne dass jemand den Versand auslöste.
 *
 * Der Auslöser sitzt in `signUp` und nicht im Formular: Die Registrierung
 * ENTSTEHT hier, `LoginPage` ist nur ein Aufrufer. Läge er im Formular, hätte
 * ein zweiter Registrierungsweg die Lücke sofort wieder.
 *
 * Gemockt ist der Supabase-Client, also der echte Netzwerkrand — nicht ein
 * eigenes Modul, dessen Aufruf dann nur sich selbst bezeugt.
 */
const signUp = vi.fn();
const invoke = vi.fn();
const rpc = vi.fn(async () => ({ data: [{ activated: false, display_name: "Neu" }], error: null }));

/** Der Rückruf, den `AuthProvider` bei Supabase hinterlegt — damit ein Test
 *  einen Sitzungswechsel auslösen kann, ohne echtes Netzwerk. */
let authRückruf: ((event: string, session: unknown) => void) | null = null;

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signUp,
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        authRückruf = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
    functions: { invoke },
    rpc,
    from: vi.fn(),
  },
}));

vi.mock("../lib/log", () => ({ logEvent: vi.fn() }));

const { logEvent } = await import("../lib/log");
const { AuthProvider } = await import("./AuthProvider");
const { useAuth } = await import("./auth-context");

/** Ruft `signUp` einmal beim Rendern und zeigt das Ergebnis an. */
function Registrieren() {
  const { signUp: melden } = useAuth();
  return (
    <button onClick={() => void melden("neu@test.fbc", "Neu Mitglied")} type="button">
      los
    </button>
  );
}

function renderUndRegistrieren() {
  render(
    <AuthProvider>
      <Registrieren />
    </AuthProvider>,
  );
  screen.getByRole("button", { name: "los" }).click();
}

/**
 * Eine GELUNGENE Registrierung — mit Sitzung.
 *
 * Bis AGE-591 stand hier `{ data: { user: { id } }, error: null }`, also nie
 * eine Sitzung. Das war der Fehler dieser Datei: Sie prüfte den Versand
 * ausgerechnet in dem Fall, in dem er nicht laufen darf, und schrieb ihn damit
 * fest. Der Kommentar zwei Tests weiter unten sagte derweil schon immer „das
 * Konto ist angelegt und die Sitzung besteht, bevor der Versand beginnt" —
 * beschrieben, aber nie modelliert.
 *
 * Was GoTrue bei einer Wiederholung liefert (200, kein Fehler, KEINE Sitzung),
 * hat jetzt einen eigenen Test und einen eigenen Namen: WIEDERHOLUNG.
 */
const ERFOLG = (id: string) => ({
  data: { user: { id }, session: { access_token: "t", user: { id } } },
  error: null,
});

/**
 * Der Aufzählungsschutz von GoTrue: Eine Registrierung auf eine BEREITS
 * BEKANNTE Adresse antwortet mit Erfolg, ohne Fehler — und ohne Sitzung. Der
 * zurückgegebene Nutzer ist verschleiert und gehört dem Aufrufer nicht.
 */
const WIEDERHOLUNG = {
  data: { user: { id: "verschleiert" }, session: null },
  error: null,
};

describe("AuthProvider.signUp — automatischer Aktivierungsversand", () => {
  beforeEach(() => {
    signUp.mockReset();
    invoke.mockReset();
    vi.mocked(logEvent).mockClear();
    invoke.mockResolvedValue({ data: { status: "issued" }, error: null });
  });

  it("fordert nach erfolgreicher Registrierung den Bestätigungslink an", async () => {
    signUp.mockResolvedValueOnce(ERFOLG("nutzer-neu"));

    renderUndRegistrieren();

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("resend-activation", { body: {} }));
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  /**
   * Ohne Konto gibt es nichts zu bestätigen. Ein Versand an dieser Stelle wäre
   * außerdem der bequemste Weg, die Plattform zum Mailverteiler zu machen:
   * Er liefe, bevor überhaupt ein Profil existiert, an dem eine Grenze greifen
   * könnte.
   */
  it("versendet nichts, wenn die Registrierung fehlschlägt", async () => {
    signUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User already registered" },
    });

    renderUndRegistrieren();

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(invoke).not.toHaveBeenCalled();
  });

  /**
   * Das Konto ist angelegt und die Sitzung besteht, bevor der Versand beginnt.
   * Ein Fehlschlag darf die Registrierung deshalb nicht als gescheitert
   * melden — sonst versucht es der Gast erneut und läuft in „Adresse bereits
   * vergeben", während sein Konto längst existiert.
   */
  it("meldet die Registrierung als erfolgreich, auch wenn der Versand wirft", async () => {
    signUp.mockResolvedValueOnce(ERFOLG("nutzer-x"));
    invoke.mockRejectedValueOnce(new Error("network"));

    let ergebnis: { error: unknown } | undefined;
    function Prüfen() {
      const { signUp: melden } = useAuth();
      return (
        <button
          type="button"
          onClick={() => void melden("x@test.fbc", "X").then((r) => (ergebnis = r))}
        >
          los
        </button>
      );
    }
    render(
      <AuthProvider>
        <Prüfen />
      </AuthProvider>,
    );
    screen.getByRole("button", { name: "los" }).click();

    await waitFor(() => expect(ergebnis).toBeDefined());
    expect(ergebnis?.error).toBeNull();
  });

  /**
   * Befund aus dem Diff-Review (2026-08-10): Der Status wurde gesetzt und nie
   * wieder geräumt — weder beim Abmelden noch beim Wechsel des Kontos. Auf
   * einem geteilten Gerät, etwa dem Anmeldetisch einer Veranstaltung, sieht
   * dann der NÄCHSTE Nutzer „Der Link ist unterwegs. Er gilt 72 Stunden" über
   * eine Mail, die an jemand anderen ging. Und weil der Wert sich nicht
   * ändert, startet nicht einmal die Sperrfrist neu.
   *
   * Das ist genau die Falschmeldung, gegen die dieser ganze Change gebaut ist,
   * nur an einer Stelle, an die niemand gedacht hatte.
   */
  it("räumt den Versandstatus, wenn das Konto wechselt", async () => {
    signUp.mockResolvedValueOnce(ERFOLG("nutzer-a"));

    const gesehen: (string | null)[] = [];
    function Zeigen() {
      const { activationMailStatus, signUp: melden } = useAuth();
      gesehen.push(activationMailStatus);
      return (
        <button type="button" onClick={() => void melden("a@test.fbc", "A")}>
          los
        </button>
      );
    }
    render(
      <AuthProvider>
        <Zeigen />
      </AuthProvider>,
    );
    // Erst den Mount zu Ende laufen lassen: `getSession()` löst mit `null` auf
    // und setzt die Sitzung ein zweites Mal. Ohne dieses Abwarten überholt es
    // die Anmeldung unten, und der Test misst die Reihenfolge seines eigenen
    // Mocks statt das Verhalten.
    await act(async () => {});

    act(() => authRückruf?.("SIGNED_IN", { user: { id: "nutzer-a" } }));
    screen.getByRole("button", { name: "los" }).click();
    await waitFor(() => expect(gesehen.at(-1)).toBe("issued"));

    // Abmelden — und danach meldet sich jemand anderes im selben Tab an.
    act(() => authRückruf?.("SIGNED_OUT", null));

    await waitFor(() => expect(gesehen.at(-1)).toBeNull());
  });

  /**
   * AGE-527. Der Anmeldedienst kennt kein Konto ohne Passwort — es verschwindet
   * also nicht, es wird nur niemandem mehr abverlangt. Was hier festgehalten
   * wird, sind die zwei Eigenschaften, die es tragen muss:
   *
   * KEIN KRYPTO-MOCK in dieser Datei. Wäre die Zufallsquelle eine Attrappe,
   * bewiese der Verschiedenheits-Test nichts — er prüfte dann die Attrappe.
   * Vitest läuft auf Node ≥ 19, `crypto.getRandomValues` ist dort echt.
   */
  it("erzeugt für jedes Konto ein anderes Passwort", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    // Zwei Durchläufe im selben Dokument: die Abfrage muss an den jeweiligen
    // Container gebunden sein, sonst findet sie beide Knöpfe.
    for (let lauf = 0; lauf < 2; lauf++) {
      const { container } = render(
        <AuthProvider>
          <Registrieren />
        </AuthProvider>,
      );
      within(container).getByRole("button", { name: "los" }).click();
    }
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(2));

    const ersteres = signUp.mock.calls[0][0].password as string;
    const zweiteres = signUp.mock.calls[1][0].password as string;
    // Ein fester Platzhalter waere ein Generalschluessel fuer jedes Konto in
    // genau dem Fenster, in dem das Gate noch zu ist.
    expect(zweiteres).not.toBe(ersteres);
  });

  it("erzeugt ein Passwort, das die Mindestlänge des Projekts erfüllt", async () => {
    signUp.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });

    renderUndRegistrieren();

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    // `minimum_password_length = 10` (config.toml). Darunter lehnt der
    // Anmeldedienst ab — und zwar serverseitig, also still.
    expect((signUp.mock.calls[0][0].password as string).length).toBeGreaterThanOrEqual(10);
  });

  /**
   * AGE-591, der Befund aus dem Plan-Review (codex, HIGH).
   *
   * GoTrue beantwortet eine Registrierung auf eine BEREITS BEKANNTE Adresse mit
   * 200, ohne Fehler und ohne Sitzung — sein Schutz gegen das Aufzählen
   * vorhandener Adressen. `signUp` prüfte nur `!error` und hielt das für
   * Erfolg. Zwei Folgen, beide echt:
   *
   *  - `resendActivationLink()` ist SITZUNGSGEBUNDEN. Ohne Sitzung läuft es in
   *    `42501` — genau die Zeile, die am 25.08. in den PROD-Logs stand.
   *  - `logEvent("signup")` zählt eine Registrierung, die nie stattfand.
   *
   * Der zurückgegebene Nutzer hilft dabei nicht weiter: Er ist verschleiert und
   * gehört dem Aufrufer nicht. Die Sitzung ist das einzige verlässliche
   * Zeichen, dass hier wirklich ein Konto entstanden ist.
   */
  it("versendet nichts und zählt nichts, wenn keine Sitzung entsteht", async () => {
    signUp.mockResolvedValueOnce(WIEDERHOLUNG);

    renderUndRegistrieren();

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(invoke).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalledWith("signup");
  });

  /**
   * Der Aufrufer muss den dritten Ausgang unterscheiden können — sonst bleibt
   * `LoginPage` stumm, egal wie richtig der Provider sich verhält. Bewusst
   * `hatSession: boolean` und NICHT das Sitzungsobjekt: Die Seite braucht die
   * Antwort auf „gibt es eine Sitzung?", und ein Sitzungsobjekt in der Seite
   * wäre eine zweite Quelle neben dem Auth-Zuhörer.
   */
  it("meldet dem Aufrufer, ob eine Sitzung entstanden ist", async () => {
    const ergebnisse: { error: unknown; hatSession: boolean }[] = [];
    function Prüfen() {
      const { signUp: melden } = useAuth();
      return (
        <button
          type="button"
          onClick={() => void melden("x@test.fbc", "X").then((r) => ergebnisse.push(r))}
        >
          los
        </button>
      );
    }

    signUp.mockResolvedValueOnce(ERFOLG("mit-sitzung"));
    const { container: a } = render(
      <AuthProvider>
        <Prüfen />
      </AuthProvider>,
    );
    within(a).getByRole("button", { name: "los" }).click();
    await waitFor(() => expect(ergebnisse).toHaveLength(1));
    expect(ergebnisse[0].hatSession).toBe(true);

    signUp.mockResolvedValueOnce(WIEDERHOLUNG);
    const { container: b } = render(
      <AuthProvider>
        <Prüfen />
      </AuthProvider>,
    );
    within(b).getByRole("button", { name: "los" }).click();
    await waitFor(() => expect(ergebnisse).toHaveLength(2));
    expect(ergebnisse[1].hatSession).toBe(false);
    // Und der Fehler bleibt null: Es IST kein Fehler, es ist nur kein Erfolg.
    expect(ergebnisse[1].error).toBeNull();
  });
});
