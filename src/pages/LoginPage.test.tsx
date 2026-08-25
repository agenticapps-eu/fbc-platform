import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AuthError } from "@supabase/supabase-js";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import type { AuthContextValue } from "../providers/auth-context";
import { DesignVariantProvider } from "../providers/DesignVariantProvider";
import LoginPage from "./LoginPage";

/**
 * AGE-437: Die Registrierung muss einen Namen erheben. Der Signup-Trigger
 * (20260611171003:91) liest ihn aus `raw_user_meta_data->>'full_name'` und
 * schreibt ihn nach `profiles.name` — kommt er nicht mit, bleibt der Name NULL
 * und das Mitglied erscheint im Verzeichnis dauerhaft als „Mitglied"
 * (MemberDirectory.tsx:235). Deshalb wird hier geprüft, was tatsächlich AN
 * `signUp` ÜBERGEBEN wird, nicht nur, dass ein Feld existiert.
 */
/**
 * Der Rückgabetyp wird ausdrücklich genannt, statt ihn aus der Vorgabe ableiten
 * zu lassen: Sonst schließt TypeScript auf `error: null` und jeder Test, der
 * einen FEHLER durchspielt, passt nicht mehr in dieselbe Stelle.
 */
type SignUpAttrappe = ReturnType<typeof vi.fn<AuthContextValue["signUp"]>>;

function renderLogin(
  signUp: SignUpAttrappe = vi.fn(async () => ({ error: null, hatSession: true })),
) {
  render(
    <AuthFixture value={fakeAuthValue({ signUp })}>
      <DesignVariantProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </DesignVariantProvider>
    </AuthFixture>,
  );
  return signUp;
}

function toRegisterMode() {
  fireEvent.click(screen.getByRole("button", { name: /Noch kein Konto\? Registrieren/ }));
}

describe("LoginPage", () => {
  // AGE-451: neue Konten starten auf `basic` (handle_new_user), nicht discover.
  // Der Registrierungshinweis muss das korrekt sagen — sonst verspricht er eine
  // bezahlte Stufe, die es erst per Stripe-Upgrade gibt.
  it("nennt im Registrierungshinweis die Stufe Basic, nicht Discover", () => {
    renderLogin();
    toRegisterMode();
    expect(screen.getByText(/Stufe „Basic“/)).toBeInTheDocument();
    expect(screen.queryByText(/Discover/)).toBeNull();
  });

  it("übergibt den eingegebenen Namen an signUp", async () => {
    const signUp = renderLogin();
    toRegisterMode();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Anna Muster  " } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "anna@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    // Getrimmt: führende/folgende Leerzeichen landen sonst im Verzeichnis.
    // Ohne Passwort seit AGE-527 — es entsteht beim Einlösen des Links.
    await waitFor(() => expect(signUp).toHaveBeenCalledWith("anna@example.org", "Anna Muster"));
  });

  it("verlangt einen Namen und registriert ohne ihn nicht", async () => {
    const signUp = renderLogin();
    toRegisterMode();

    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "anna@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    expect(await screen.findByText(/Bitte deinen Namen eingeben/)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("zeigt das Namensfeld im Login-Modus nicht", () => {
    renderLogin();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  // AGE-505. Der Weg muss genau hier stehen: Wer sein Passwort vergessen hat,
  // scheitert an DIESER Seite und sucht ihn nirgendwo sonst.
  it("bietet einen Weg für ein vergessenes Passwort an", () => {
    renderLogin();
    const link = screen.getByRole("link", { name: /Passwort vergessen/i });
    expect(link).toHaveAttribute("href", "/passwort-vergessen");
  });

  // Befund 8.7 aus Review 5.4: der Fall oben belegte den Link, nicht seine
  // BEDINGUNG. Wer `mode === "login"` entfernt, bestünde ihn weiterhin — und
  // böte dann jemandem, der gerade ein Konto anlegt, an, ein Passwort
  // zurückzusetzen, das es noch nicht gibt.
  it("zeigt den Weg im Registrierungsmodus NICHT — dort ist nichts zu vergessen", () => {
    renderLogin();
    toRegisterMode();
    expect(screen.queryByRole("link", { name: /Passwort vergessen/i })).not.toBeInTheDocument();
  });

  /**
   * AGE-527. Das Passwort entsteht erst nach der Bestätigung der Mail — beim
   * Einlösen des Links. Vorher eines zu erheben hieß: gesetzt, nie gebraucht,
   * stillschweigend überschrieben.
   *
   * Der zweite Test hier ist der wichtigere, und er kommt aus dem Plan-Review:
   * Das Zod-Schema verlangte `password` in BEIDEN Modi. Wer nur das Feld
   * entfernt, bekommt einen Knopf, der wortlos nichts tut — die Validierung
   * scheitert an einem Feld, das gar nicht mehr gerendert wird. Ein Test, der
   * bloß „wurde ohne Passwort aufgerufen" prüft, sieht das nicht: Er ist auch
   * dann grün, wenn `signUp` NIE läuft.
   */
  it("zeigt im Registrierungsmodus kein Passwortfeld", () => {
    renderLogin();
    toRegisterMode();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("E-Mail")).toBeInTheDocument();
    expect(screen.queryByLabelText("Passwort")).not.toBeInTheDocument();
  });

  it("registriert ohne Passworteingabe — der Submit läuft durch", async () => {
    const signUp = renderLogin();
    toRegisterMode();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Anna Muster" } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "anna@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith("anna@example.org", "Anna Muster"));
    // Und keine Schema-Meldung zu einem Feld, das es nicht mehr gibt.
    expect(screen.queryByText(/Passwort muss mindestens/i)).not.toBeInTheDocument();
  });

  it("verlangt im LOGIN-Modus weiterhin ein Passwort", () => {
    renderLogin();
    expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
  });

  /**
   * Befund aus dem Diff-Review zu AGE-527: Die Zehn-Zeichen-Regel galt auch beim
   * ANMELDEN. Der Anmeldedienst prüft sie dort nicht — sie gilt beim SETZEN.
   * Ein Konto aus der Zeit vor C4 mit acht Zeichen käme serverseitig durch und
   * wurde vom eigenen Formular ausgesperrt.
   */
  it("sperrt beim Anmelden kein kurzes Alt-Passwort aus", async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    render(
      <AuthFixture value={fakeAuthValue({ signIn })}>
        <DesignVariantProvider>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </DesignVariantProvider>
      </AuthFixture>,
    );

    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "alt@example.org" } });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "achtzehn" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("alt@example.org", "achtzehn"));
    expect(screen.queryByText(/mindestens 10 Zeichen/i)).not.toBeInTheDocument();
  });

  it("verlangt beim Anmelden aber ein nicht leeres Passwort", async () => {
    const signIn = vi.fn(async () => ({ error: null }));
    render(
      <AuthFixture value={fakeAuthValue({ signIn })}>
        <DesignVariantProvider>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </DesignVariantProvider>
      </AuthFixture>,
    );

    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "alt@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByText(/Bitte dein Passwort eingeben/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
  // ── AGE-591: der dritte Ausgang der Registrierung ─────────────────────────
  //
  // GoTrue beantwortet eine Registrierung auf eine BEREITS BEKANNTE Adresse mit
  // 200, ohne Fehler und ohne Sitzung (Aufzählungsschutz). `onSubmit` prüfte nur
  // `error !== null` — der Knopf tat wortlos nichts. Das trifft ausgerechnet die
  // importierten Mitglieder, die den naheliegenden Weg „Registrieren" statt
  // „Aktivieren" wählen; das sind 70 von 73 Konten.
  describe("Registrierung ohne Fehler und ohne Sitzung", () => {
    /** Registriert mit der angegebenen Adresse und wartet, bis `signUp` durch ist. */
    async function registriere(signUp: SignUpAttrappe, email: string) {
      toRegisterMode();
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Anna Muster" } });
      fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: email } });
      fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));
      await waitFor(() => expect(signUp).toHaveBeenCalled());
    }

    const ohneSitzung = () => vi.fn(async () => ({ error: null, hatSession: false }));

    it("zeigt einen sichtbaren Hinweis statt zu schweigen", async () => {
      const signUp = renderLogin(ohneSitzung());
      await registriere(signUp, "anna@example.org");

      expect(await screen.findByRole("status")).toBeInTheDocument();
    });

    /**
     * Der Fluchtweg heißt ZUGANGSLINK, nicht „Passwort zurücksetzen" (Befund des
     * Plan-Reviews). Die Betroffenen sind importierte, nicht aktivierte
     * Mitglieder — sie haben gar kein Passwort, das sich zurücksetzen ließe, und
     * eine Oberfläche, die es ihnen anbietet, verspricht etwas anderes als das,
     * was sie brauchen. `/aktivierung` zeigt ohne Token das Formular
     * „Bestätigungslink anfordern".
     */
    it("führt zum Zugangslink, nicht zum Zurücksetzen des Passworts", async () => {
      const signUp = renderLogin(ohneSitzung());
      await registriere(signUp, "anna@example.org");

      const hinweis = await screen.findByRole("status");
      const ziele = Array.from(hinweis.querySelectorAll("a")).map((a) => a.getAttribute("href"));
      expect(ziele).toContain("/aktivierung");
      expect(ziele).not.toContain("/passwort-vergessen");
    });

    it("bietet daneben den Weg zur Anmeldung an", async () => {
      const signUp = renderLogin(ohneSitzung());
      await registriere(signUp, "anna@example.org");

      const hinweis = await screen.findByRole("status");
      fireEvent.click(within(hinweis).getByRole("button", { name: /Anmelden/i }));

      // Der Login-Modus ist daran erkennbar, dass es wieder ein Passwortfeld gibt.
      expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
      // UND der Hinweis ist weg. Ohne diese Zeile belegte der Test nur den
      // Moduswechsel — ein Registrierungshinweis, der über dem Login-Formular
      // stehen bleibt, behauptet etwas über einen Vorgang, den es nicht mehr
      // gibt. Befund des Diff-Reviews (codex, MEDIUM).
      expect(screen.queryByRole("status")).toBeNull();
    });

    /**
     * Der Hinweis darf keinen GRUND nennen. Die Oberfläche kennt ihn auch gar
     * nicht — GoTrue nennt ihn nicht, und sie fragt nicht nach.
     *
     * Zwei Zusagen in einem Test, weil sie zusammen erst die Aussage tragen:
     * der Text ist für zwei verschiedene Adressen ZEICHENGLEICH (er hängt also
     * an nichts, was die Adresse betrifft), und er enthält keine der Wendungen,
     * mit denen man eine Existenz behauptet.
     *
     * Was hier NICHT zugesagt wird: dass die beiden Ausgänge von außen
     * ununterscheidbar sind. Eine unbekannte Adresse erzeugt eine Sitzung und
     * löst die Seite ab — das ist beobachtbar, war es vorher schon, und es zu
     * schließen hieße den Registrierungsverlauf umzubauen. Steht als
     * Nicht-Zusage in der Spec.
     */
    it("nennt keinen Grund und lautet für jede Adresse gleich", async () => {
      const signUp = renderLogin(ohneSitzung());
      await registriere(signUp, "bekannt@example.org");
      const ersterText = (await screen.findByRole("status")).textContent;

      cleanup();
      const signUp2 = renderLogin(ohneSitzung());
      await registriere(signUp2, "voellig.anders@example.com");
      const zweiterText = (await screen.findByRole("status")).textContent;

      expect(zweiterText).toBe(ersterText);
      expect(ersterText).not.toMatch(/vergeben|existiert|bereits registriert|schon ein Konto/i);
    });

    it("erscheint NICHT, wenn eine Sitzung entstanden ist", async () => {
      const signUp = renderLogin(vi.fn(async () => ({ error: null, hatSession: true })));
      await registriere(signUp, "neu@example.org");

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    /**
     * Ein stehengebliebener Hinweis über einem neuen Versuch ist derselbe
     * Fehlermodus, nur andersherum: Die Oberfläche behauptet etwas über einen
     * Vorgang, der längst ein anderer ist.
     */
    /**
     * GEMESSEN am 25.08. gegen den lokalen Stack, und es hat die Prämisse dieses
     * Issues verschoben.
     *
     * Der stumme 200er ohne Sitzung tritt nur auf, solange die eingebaute
     * E-Mail-Bestätigung EINGESCHALTET ist. Genau so stand PROD zwischen dem
     * 16. und dem 25.08. — daher die Beobachtung. Seit `mailer_autoconfirm` auf
     * PROD wieder `true` ist, antwortet GoTrue auf eine Wiederholung mit
     * **HTTP 422 `user_already_exists`**, also mit einem FEHLER.
     *
     * Damit ist der heute live sichtbare Fehler ein anderer, aber kein
     * kleinerer: Das Formular zeigte `error.message` roh an — „User already
     * registered". Englisch, führt nirgendwohin, und es verrät geradeheraus,
     * dass die Adresse vergeben ist. Ausgerechnet die Aussage, die GoTrues
     * Aufzählungsschutz im anderen Zweig sorgfältig vermeidet.
     *
     * Beide Wege enden deshalb im selben neutralen Hinweis. Der Zweig „ohne
     * Sitzung" bleibt: Wird die Bestätigung wieder eingeschaltet, ist er sofort
     * wieder der aktive — und dann wäre die Stille zurück, hätte man ihn mit
     * der Begründung „kommt ja nicht vor" weggelassen.
     */
    it("fängt auch den 422 user_already_exists ab und zeigt denselben Hinweis", async () => {
      const signUp = vi.fn(async () => ({
        error: {
          code: "user_already_exists",
          message: "User already registered",
          status: 422,
        } as unknown as AuthError,
        hatSession: false,
      }));
      renderLogin(signUp);
      await registriere(signUp, "bekannt@example.org");

      const hinweis = await screen.findByRole("status");
      expect(hinweis).toBeInTheDocument();
      // Der rohe englische Satz darf NIRGENDS auf der Seite stehen.
      expect(screen.queryByText(/User already registered/i)).toBeNull();
    });

    /**
     * Die Gegenprobe, ohne die aus dem Fix ein Fehlerschlucker würde: JEDER
     * andere Fehler muss weiterhin gemeldet werden. Ein Formular, das alles in
     * denselben freundlichen Hinweis übersetzt, ist wieder genau die Fläche, die
     * nichts sagt.
     */
    it("meldet jeden ANDEREN Fehler weiterhin im Klartext", async () => {
      const signUp = vi.fn(async () => ({
        error: {
          code: "over_email_send_rate_limit",
          message: "Zu viele Versuche. Bitte später erneut probieren.",
          status: 429,
        } as unknown as AuthError,
        hatSession: false,
      }));
      renderLogin(signUp);
      await registriere(signUp, "anna@example.org");

      expect(await screen.findByText(/Zu viele Versuche/)).toBeInTheDocument();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("verschwindet beim Wechsel in den Login-Modus", async () => {
      const signUp = renderLogin(ohneSitzung());
      await registriere(signUp, "anna@example.org");
      expect(await screen.findByRole("status")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Schon ein Konto\? Zum Login/ }));

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
