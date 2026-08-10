import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivationScreen from "./ActivationScreen";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { requestActivationLink, resendActivationLink } from "../lib/activation";

/**
 * Gemockt wird nur der Netzwerkrand. Der Bildschirm selbst läuft echt.
 *
 * Was hier festgehalten wird, ist kein Detail, sondern der Befund aus dem
 * Audit vom 2026-08-06: der eingeloggte Weg darf NICHT über
 * `requestActivationLink(email)` gehen. Diese Function ist unauthentifiziert
 * und nimmt eine frei wählbare Adresse entgegen — über sie konnte ein Fremder
 * den ausstehenden Link eines Mitglieds entwerten und es aussperren. Der
 * eingeloggte Weg geht über `resendActivationLink()`, deren Subjekt die Sitzung
 * ist (`auth.uid()` in `request_own_activation_token`).
 */
vi.mock("../lib/activation", async (orig) => {
  const echt = await orig<typeof import("../lib/activation")>();
  return {
    ...echt,
    requestActivationLink: vi.fn(async () => {}),
    // Seit AGE-526 gibt die Anforderung ihren Status zurück, statt ihn zu
    // verschlucken. Die Vorgabe hier ist der Erfolgsfall.
    resendActivationLink: vi.fn(async () => "issued" as const),
  };
});

function renderMit(auth: Parameters<typeof fakeAuthValue>[0] = {}) {
  return render(
    <AuthFixture
      value={fakeAuthValue({
        isActivated: false,
        activationName: "Detlev",
        user: { id: "u1", email: "detlev@test.fbc" } as never,
        ...auth,
      })}
    >
      <ActivationScreen />
    </AuthFixture>,
  );
}

describe("ActivationScreen", () => {
  beforeEach(() => {
    vi.mocked(requestActivationLink).mockClear();
    vi.mocked(resendActivationLink).mockClear();
  });

  it("fordert den Link über die Sitzung an, nicht über die Adresse", async () => {
    renderMit();

    fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

    await waitFor(() => expect(resendActivationLink).toHaveBeenCalledTimes(1));
    // Kein Argument: es gibt keine Adresse, die jemand fälschen könnte.
    expect(vi.mocked(resendActivationLink).mock.calls[0]).toEqual([]);
    expect(requestActivationLink).not.toHaveBeenCalled();
  });

  it("bestätigt den Versand und sperrt den Knopf für die Sperrfrist", async () => {
    renderMit();

    fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

    expect(await screen.findByText(/Der Link ist unterwegs/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Erneut senden in/i })).toBeDisabled();
  });

  /**
   * Der Absender ist seit dem 06.08.2026 `noreply@effbeezee.com`, der Rückkanal
   * bleibt `info@fairbusinessclub.de`. Der Bildschirm muss den Absender nennen,
   * weil die Aktivierungsmail bei importierten Konten der einzige Weg ins Konto
   * ist — ein Absender, den niemand angekündigt hat, ist von Phishing nicht zu
   * unterscheiden, und wer ihn nicht wiedererkennt, klickt nicht.
   *
   * _Korrektur 06.08.: hier stand, `effbeezee.com` sei „eine andere Domain als
   * die, unter der der Club auftritt". Das ist falsch — die Plattform heißt
   * **eff.bee.zee** (siehe `send-activation/emails.ts:82`, der Mailtext führt
   * den Namen selbst ein). Die Domain ist die ausgeschriebene Marke, nicht eine
   * fremde. Die Assertion bleibt trotzdem richtig, nur ihre Begründung war es
   * nicht._
   *
   * Der Test hält beide Hälften fest — angekündigter Absender UND Rückkanal —,
   * weil genau ihr Auseinanderfallen der Fehler wäre. Dass der Rückkanal
   * wirklich trägt, ist inzwischen am `Reply-To`-Header der zugestellten Mail
   * belegt, nicht nur hier behauptet.
   */
  it("kündigt den Absender an und nennt getrennt davon den Rückkanal", async () => {
    renderMit();

    fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

    const hinweis = await screen.findByText(/Der Link ist unterwegs/i);
    expect(hinweis).toHaveTextContent("noreply@effbeezee.com");
    // Der Rückkanal bleibt die Club-Domain — er steht woanders auf der Seite.
    expect(screen.getByRole("link", { name: /info@fairbusinessclub\.de/i })).toHaveAttribute(
      "href",
      "mailto:info@fairbusinessclub.de",
    );
  });

  it("meldet einen Transportfehler, ohne etwas über die Adresse zu verraten", async () => {
    vi.mocked(resendActivationLink).mockRejectedValueOnce(new Error("network"));
    renderMit();

    fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

    expect(await screen.findByText(/hat gerade nicht geklappt/i)).toBeInTheDocument();
  });

  /**
   * AGE-526. Ab hier löst die Registrierung den Versand selbst aus — der
   * Bildschirm muss also den Zustand zeigen, der wirklich eingetreten ist,
   * statt einen Knopf für eine Mail anzubieten, die schon unterwegs ist.
   *
   * Und die andere Richtung, die vorher der stille Fehler war: Die Function
   * antwortet bei jeder Abweisung mit **200** und dem Status im Rumpf. Wer
   * daraus Erfolg liest, meldet grün „Der Link ist unterwegs", obwohl nichts
   * versendet wurde. Mit dem automatischen Versand ist das der
   * WAHRSCHEINLICHSTE Fall: Er verbraucht die 60-Sekunden-Sperrfrist sofort.
   */
  describe("automatischer Versand aus der Registrierung", () => {
    it("startet ohne Klick im Zustand „unterwegs“, wenn der Versand griff", async () => {
      renderMit({ activationMailStatus: "issued" });

      expect(await screen.findByText(/Der Link ist unterwegs/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Erneut senden in/i })).toBeDisabled();
      // Nichts nachgefordert: die Mail ist schon raus.
      expect(resendActivationLink).not.toHaveBeenCalled();
    });

    /**
     * Der Fehler, den erst die Sichtprobe am laufenden System zeigte
     * (2026-08-10, lokaler Stack): Der Versand läuft NACH der Registrierung,
     * die Weiterleitung auf diesen Bildschirm passiert aber schon, sobald die
     * Sitzung steht — also VORHER. Der Status trifft damit ein, während der
     * Bildschirm längst gerendert ist.
     *
     * Eine erste Fassung las ihn als Anfangswert von `useState`. Das ist genau
     * der Fall, den `useState` ignoriert: Der Anfangswert wird einmal genommen,
     * spätere Änderungen erreichen den Zustand nie. Im Test mit vorbelegtem
     * Kontext war das unsichtbar, im Browser stand der Knopf da, als wäre nie
     * etwas versendet worden.
     */
    it("nimmt den Status auch an, wenn er erst nach dem Rendern eintrifft", async () => {
      const { rerender } = renderMit({ activationMailStatus: null });
      expect(screen.queryByText(/Der Link ist unterwegs/i)).not.toBeInTheDocument();

      rerender(
        <AuthFixture
          value={fakeAuthValue({
            isActivated: false,
            activationName: "Detlev",
            user: { id: "u1", email: "detlev@test.fbc" } as never,
            activationMailStatus: "issued",
          })}
        >
          <ActivationScreen />
        </AuthFixture>,
      );

      expect(await screen.findByText(/Der Link ist unterwegs/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Erneut senden in/i })).toBeDisabled();
    });

    it("bietet den Knopf an, wenn der automatische Versand NICHT griff", () => {
      renderMit({ activationMailStatus: "send_failed" });

      expect(screen.queryByText(/Der Link ist unterwegs/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Bestätigungslink senden/i })).toBeEnabled();
    });

    it("meldet eine abgewiesene Anforderung als Wartezeit, nicht als Versand", async () => {
      vi.mocked(resendActivationLink).mockResolvedValueOnce("rate_limited");
      renderMit();

      fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

      expect(await screen.findByText(/bereits unterwegs/i)).toBeInTheDocument();
      expect(screen.queryByText(/Der Link ist unterwegs/i)).not.toBeInTheDocument();
    });

    it("nennt das erschöpfte Kontingent beim Namen, statt Erfolg zu melden", async () => {
      vi.mocked(resendActivationLink).mockResolvedValueOnce("rate_limited_global");
      renderMit();

      fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

      expect(await screen.findByText(/gerade sehr viele/i)).toBeInTheDocument();
      expect(screen.queryByText(/Der Link ist unterwegs/i)).not.toBeInTheDocument();
    });

    /**
     * „Warte kurz" und „versuch es nochmal" sind verschiedene Auskünfte. Landet
     * der Fehlversand im Wartezweig, wartet ein Mitglied auf eine Mail, die
     * niemand mehr schickt.
     */
    it("trennt den Fehlversand von der Abweisung", async () => {
      vi.mocked(resendActivationLink).mockResolvedValueOnce("send_failed");
      renderMit();

      fireEvent.click(screen.getByRole("button", { name: /Bestätigungslink senden/i }));

      expect(await screen.findByText(/hat gerade nicht geklappt/i)).toBeInTheDocument();
      expect(screen.queryByText(/bereits unterwegs/i)).not.toBeInTheDocument();
    });
  });
});
