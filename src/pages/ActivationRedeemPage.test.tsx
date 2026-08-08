import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivationRedeemPage from "./ActivationRedeemPage";
import { AuthContext } from "../providers/auth-context";
import { fakeAuthValue } from "../test/auth-fixtures";
import { redeemActivation, requestActivationLink } from "../lib/activation";

/**
 * Gemockt wird nur der Netzwerkrand. Die Seite selbst — Formular, Statuslogik,
 * die sieben Fälle aus AGE-495 §6 — läuft echt.
 *
 * `leseTokenAusFragment` bleibt ungemockt und liest wirklich aus `location.hash`:
 * dass das Token im FRAGMENT steht und danach aus der Adresszeile verschwindet,
 * ist eine Anforderung und keine Implementierungsnebensache.
 */
vi.mock("../lib/activation", async (orig) => {
  const echt = await orig<typeof import("../lib/activation")>();
  return {
    ...echt,
    redeemActivation: vi.fn(),
    requestActivationLink: vi.fn(async () => {}),
  };
});

const navigate = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const echt = await orig<typeof import("react-router-dom")>();
  return { ...echt, useNavigate: () => navigate };
});

function renderMit(hash: string, auth = {}) {
  window.history.replaceState(null, "", `/aktivierung${hash}`);
  return render(
    <AuthContext.Provider value={fakeAuthValue({ isActivated: false, ...auth })}>
      <MemoryRouter>
        <ActivationRedeemPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

/**
 * Derselbe Bauteil, anderer Zweck (AGE-505). Das Token trägt seinen Zweck nicht
 * — die ROUTE tut es.
 *
 * `pfad` setzt hier NUR `window.location`, damit das Fragment gelesen und
 * aufgeräumt werden kann. Für die Zweckwahl ist er wirkungslos: der
 * `MemoryRouter` steht ohne `initialEntries`, und die Komponente liest den Zweck
 * aus der Eigenschaft, die diese Datei selbst übergibt.
 *
 * Bis zum Review 5.4 behauptete hier ein Kommentar das Gegenteil („sonst prüfte
 * der Test eine Konstruktion, die es so nicht gibt"). Gemessen am 08.08.: alle
 * sechs Pfade durch `/voelliger-unsinn` ersetzt — 18/18 blieben grün. Wer die
 * Verdrahtung geprüft haben will, findet sie in `App.test.tsx` unter „Zweck der
 * Einlöseseite hängt an der Route"; die Fälle hier prüfen den Wortlaut.
 */
function renderReset(pfad: string, hash = "", auth = {}) {
  window.history.replaceState(null, "", `${pfad}${hash}`);
  return render(
    <AuthContext.Provider value={fakeAuthValue({ isActivated: false, ...auth })}>
      <MemoryRouter>
        <ActivationRedeemPage zweck="reset" />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function passwortSetzen(wert: string) {
  passwortSetzenMit(/Zugang freischalten/i, wert);
}

/** Wie oben, aber mit dem Knopf des jeweiligen Zwecks — der Wortlaut unterscheidet sie. */
function passwortSetzenMit(knopf: RegExp, wert: string) {
  fireEvent.change(screen.getByLabelText(/Neues Passwort/i), { target: { value: wert } });
  fireEvent.click(screen.getByRole("button", { name: knopf }));
}

describe("ActivationRedeemPage", () => {
  beforeEach(() => {
    vi.mocked(redeemActivation).mockReset();
    vi.mocked(requestActivationLink).mockClear();
    navigate.mockClear();
  });

  it("liest das Token aus dem Fragment und räumt die Adresszeile auf", () => {
    renderMit("#token=geheim");
    // Die Anforderung: das Token darf danach nicht mehr in der Adresse stehen —
    // weder für einen Screenshot noch für die Browser-Historie.
    expect(window.location.hash).toBe("");
    expect(screen.getByLabelText(/Neues Passwort/i)).toBeInTheDocument();
  });

  it("lehnt ein zu kurzes Passwort im Formular ab, ohne zu senden", () => {
    renderMit("#token=geheim");
    passwortSetzen("kurz");
    expect(redeemActivation).not.toHaveBeenCalled();
    // Die Feldmeldung, nicht der erklärende Vorspann — beide nennen die Zahl.
    expect(screen.getByText(/Das Passwort braucht mindestens 10 Zeichen/i)).toBeInTheDocument();
  });

  it("löst mit gültigem Token ein und schickt danach zur Anmeldung", async () => {
    vi.mocked(redeemActivation).mockResolvedValue("activated");
    renderMit("#token=geheim");
    passwortSetzen("EinLangesPasswort");
    await waitFor(() =>
      expect(redeemActivation).toHaveBeenCalledWith("geheim", "EinLangesPasswort"),
    );
    // Alle Sitzungen sind widerrufen, auch die eigene — eine tote Session
    // weiterzutragen wäre falsch.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login", { replace: true }));
  });

  it("Status expired nennt die Frist und bietet einen neuen Link an", async () => {
    vi.mocked(redeemActivation).mockResolvedValue("expired");
    renderMit("#token=alt");
    passwortSetzen("EinLangesPasswort");
    expect(await screen.findByText(/abgelaufen/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Neuen Link senden/i })).toBeInTheDocument();
  });

  it("Status used sagt: Konto ist aktiviert, und führt zum Login", async () => {
    vi.mocked(redeemActivation).mockResolvedValue("used");
    renderMit("#token=verbraucht");
    passwortSetzen("EinLangesPasswort");
    expect(await screen.findByText(/bereits aktiviert/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Jetzt anmelden/i })).toBeInTheDocument();
  });

  it("Status superseded sagt NICHT bereits-aktiviert — das Konto ist es gerade nicht", async () => {
    // Der Kern von Task 12.4: mit einer gemeinsamen Meldung bekäme jemand, der
    // zweimal anfordert und den ersten Link klickt, eine falsche Auskunft.
    vi.mocked(redeemActivation).mockResolvedValue("superseded");
    renderMit("#token=ueberholt");
    passwortSetzen("EinLangesPasswort");
    const meldung = await screen.findByText(/nicht mehr gültig/i);
    expect(meldung).toBeInTheDocument();
    expect(screen.queryByText(/bereits aktiviert/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Neuen Link senden/i })).toBeInTheDocument();
  });

  it("Status throttled bietet trotzdem einen Weg nach vorn (Task 5.6)", async () => {
    // Die Drossel zählt nur Fehlversuche — ein GÜLTIGER Link läuft nie in sie
    // hinein. Wer diese Meldung sieht, hat also einen ungültigen Link, und der
    // Ausweg ist ein neuer. Deshalb muss das Formular hier stehen: eine
    // Sackgasse wäre an dieser Stelle sachlich falsch.
    vi.mocked(redeemActivation).mockResolvedValue("throttled");
    renderMit("#token=zuoft");
    passwortSetzen("EinLangesPasswort");
    expect(await screen.findByText(/zu viele/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Neuen Link senden/i })).toBeInTheDocument();
  });

  it("zeigt ohne Token das Anforderungsformular — der Weg bei übernommenem Passwort", () => {
    renderMit("");
    expect(
      screen.getByRole("heading", { name: /Bestätigungslink anfordern/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Neues Passwort/i)).not.toBeInTheDocument();
  });

  it("fordert einen Link an und verrät dabei nicht, ob es die Adresse gibt", async () => {
    renderMit("");
    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), {
      target: { value: "wer@auch.immer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Neuen Link senden/i }));
    await waitFor(() => expect(requestActivationLink).toHaveBeenCalledWith("wer@auch.immer"));
    expect(
      await screen.findByText(/Wenn es zu dieser Adresse ein Konto gibt/i),
    ).toBeInTheDocument();
  });

  // 11.6 / P2. Diese eine Meldung steht für DREI Ausgänge: Link ausgegeben,
  // Schutzfenster (offener Link unter 24 h — es geht nichts raus) und bereits
  // aktiviert. Unterscheiden darf sie sie nicht, das wäre die Adressaufzählung.
  // Also muss sie alle drei abdecken: wer die erste Mail nie bekam, liest sonst
  // „Link ist unterwegs" und wartet einen Tag auf nichts.
  it("deckt den 24-Stunden-Fall ab und nennt einen Rückkanal", async () => {
    renderMit("");
    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), {
      target: { value: "wer@auch.immer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Neuen Link senden/i }));
    const hinweis = await screen.findByText(/Wenn es zu dieser Adresse ein Konto gibt/i);
    expect(hinweis).toHaveTextContent(/letzten 24 Stunden/i);
    expect(hinweis).toHaveTextContent(/info@fairbusinessclub\.de/i);
  });

  // ── Passwort vergessen (AGE-505) ────────────────────────────────────────
  // Wer hier landet, hat seinen Zugang längst bestätigt. „Zugang freischalten"
  // wäre schlicht falsch — und „danach ist dein Zugang fertig" auch.

  it("/passwort-neu spricht vom Passwort, nicht vom Bestätigen eines Zugangs", () => {
    renderReset("/passwort-neu", "#token=geheim");
    expect(screen.getByRole("heading", { name: /Neues Passwort setzen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Neues Passwort setzen/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Zugang freischalten/i })).not.toBeInTheDocument();
  });

  it("/passwort-neu kündigt die Abmeldung aller Geräte an, bevor sie passiert", () => {
    // revoke_sessions läuft beim Einlösen mit. Steht das nicht auf dem Schirm,
    // hält wer auf dem Telefon angemeldet war den Reset für kaputt.
    renderReset("/passwort-neu", "#token=geheim");
    expect(screen.getByText(/abgemeldet/i)).toBeInTheDocument();
  });

  it("/passwort-neu räumt das Token genauso aus der Adresszeile wie /aktivierung", () => {
    renderReset("/passwort-neu", "#token=geheim");
    expect(window.location.hash).toBe("");
  });

  it("/passwort-vergessen zeigt das Adressformular in der richtigen Sprache", () => {
    renderReset("/passwort-vergessen");
    expect(screen.getByRole("heading", { name: /Passwort vergessen/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Neues Passwort/i)).not.toBeInTheDocument();
  });

  // Der Name sagt, was der Fall MISST. Bis zum Review 5.4 hieß er „verrät nicht,
  // ob es die Adresse gibt" — das kann er gar nicht prüfen: `requestActivationLink`
  // ist gemockt und antwortet für jede Eingabe gleich. Die Nichtpreisgabe lebt in
  // `send-activation` (immer 202) und in `issue_activation_token`.
  it("deckt die drei Ausgänge des Anforderns mit EINER Meldung ab", async () => {
    renderReset("/passwort-vergessen");
    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), {
      target: { value: "wer@auch.immer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Link senden/i }));
    await waitFor(() => expect(requestActivationLink).toHaveBeenCalledWith("wer@auch.immer"));
    const hinweis = await screen.findByText(/Wenn es zu dieser Adresse ein Konto gibt/i);
    expect(hinweis).toHaveTextContent(/letzten 24 Stunden/i);
    expect(hinweis).toHaveTextContent(/info@fairbusinessclub\.de/i);
  });

  /**
   * Befund 8.2 aus Review 5.4. Der Anforderungspfad hatte ein `finally` ohne
   * `catch`: `setAngefordert(true)` lief unabhängig vom Ausgang, und
   * `angefordert` ist das Einzige, was Formular von Erfolgsmeldung trennt.
   *
   * `requestActivationLink` wirft bei JEDEM Nicht-2xx (`activation.ts`), und
   * `send-activation` antwortet 500 bei fehlendem Secret, 502 bei DB-Fehler,
   * 400 bei kaputtem Rumpf. Alle drei endeten in „der Link ist unterwegs".
   * Seit AGE-505 ist das der einzige Rückweg eines aktivierten Kontos.
   *
   * Die Meldung darf NICHT klingen wie die drei fachlichen Ausgänge — sonst ist
   * „hat nicht geklappt" wieder von „gibt es nicht" ununterscheidbar.
   */
  it("meldet einen technischen Fehlschlag als solchen, statt Erfolg zu behaupten", async () => {
    vi.mocked(requestActivationLink).mockRejectedValueOnce(new Error("500"));
    renderReset("/passwort-vergessen");
    fireEvent.change(screen.getByLabelText(/E-Mail-Adresse/i), {
      target: { value: "wer@auch.immer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Link senden/i }));

    expect(await screen.findByText(/konnte gerade nicht gestellt werden/i)).toBeInTheDocument();
    // Der entscheidende Teil: die Erfolgsmeldung darf NICHT dastehen.
    expect(screen.queryByText(/Wenn es zu dieser Adresse ein Konto gibt/i)).not.toBeInTheDocument();
    // Und das Formular bleibt stehen, damit ein zweiter Versuch möglich ist.
    expect(screen.getByRole("button", { name: /Link senden/i })).toBeInTheDocument();
  });

  it("Status used sagt im Reset-Fall nichts von „bereits aktiviert“", async () => {
    // Beim Zurücksetzen heißt „schon benutzt" nicht „dein Konto ist aktiviert" —
    // das ist es längst. Es heißt: das neue Passwort steht bereits.
    vi.mocked(redeemActivation).mockResolvedValue("used");
    renderReset("/passwort-neu", "#token=verbraucht");
    passwortSetzenMit(/Neues Passwort setzen/i, "einlangespasswort");
    expect(await screen.findByText(/bereits verwendet/i)).toBeInTheDocument();
    expect(screen.queryByText(/bereits aktiviert/i)).not.toBeInTheDocument();
  });

  it("leitet ein bereits aktiviertes Konto ohne Token still auf die Startseite", async () => {
    // Fall 3 aus §6: alter Link im Postfach, Konto längst aktiv. Keine
    // Fehlermeldung — das Mitglied hat nichts falsch gemacht.
    renderMit("", { user: { id: "u1", email: "m@test.fbc" } as never, isActivated: true });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
  });

  it("leitet einen AUSGELOGGTEN Besucher NICHT weg — das ist der Weg zurück", async () => {
    // Für Ausgeloggte ist isActivated true (es gibt nichts zu aktivieren). Ohne
    // die user-Bedingung landete genau das Mitglied auf der Startseite, dessen
    // Passwort ein Dritter übernommen hat — und käme nie an einen neuen Link.
    // Beim Betrachten der laufenden Oberfläche gefunden.
    renderMit("", { user: null, isActivated: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /Bestätigungslink anfordern/i }),
    ).toBeInTheDocument();
  });
});
