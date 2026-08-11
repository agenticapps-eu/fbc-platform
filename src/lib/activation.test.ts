import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `resendActivationLink` — der Weg des Aktivierungsbildschirms (AGE-526).
 *
 * Der Befund, den diese Datei festhält: Die Function antwortet bei jedem
 * FACHLICHEN Ausgang mit **200** und dem Status im Rumpf — `rate_limited`,
 * `rate_limited_day`, `rate_limited_global`, `already_activated`. Bis AGE-526
 * gab dieses Modul `void` zurück und warf nur bei einem Transportfehler; der
 * Bildschirm meldete daraufhin grün „Der Link ist unterwegs", obwohl kein Token
 * ausgegeben und keine Mail versendet wurde.
 *
 * Mit dem automatischen Versand nach der Registrierung ist das nicht mehr ein
 * Randfall, sondern der wahrscheinlichste: Der automatische Versand verbraucht
 * die 60-Sekunden-Sperrfrist sofort, und wer danach den Knopf drückt, läuft
 * genau hinein.
 */
const invoke = vi.fn();
vi.mock("./supabase", () => ({ supabase: { functions: { invoke } } }));

const { resendActivationLink } = await import("./activation");

/** Was `supabase-js` aus einer 4xx/5xx-Antwort macht: ein Fehler, dessen
 *  `context` den Rumpf trägt. Genau diese Form liest `redeemActivation` schon. */
function httpFehler(body: unknown) {
  return { name: "FunctionsHttpError", context: { json: async () => body } };
}

describe("resendActivationLink", () => {
  beforeEach(() => invoke.mockReset());

  it("gibt den Status der Function zurück, statt ihn zu verschlucken", async () => {
    invoke.mockResolvedValueOnce({ data: { status: "issued" }, error: null });

    await expect(resendActivationLink()).resolves.toBe("issued");
    expect(invoke).toHaveBeenCalledWith("resend-activation", { body: {} });
  });

  it("meldet eine abgewiesene Anforderung als solche, nicht als Versand", async () => {
    invoke.mockResolvedValueOnce({ data: { status: "rate_limited" }, error: null });

    await expect(resendActivationLink()).resolves.toBe("rate_limited");
  });

  it("reicht das neue rate_limited_global durch", async () => {
    invoke.mockResolvedValueOnce({ data: { status: "rate_limited_global" }, error: null });

    await expect(resendActivationLink()).resolves.toBe("rate_limited_global");
  });

  /**
   * Der Unterschied, auf den es ankommt: Eine abgewiesene Anforderung heißt
   * „warte kurz", ein Fehlversand heißt „versuch es nochmal". Landen beide im
   * selben Zweig, meldet der Bildschirm eine Wartezeit, wo ein zweiter Versuch
   * nötig wäre — der Nutzer wartet dann auf eine Mail, die niemand mehr
   * schickt.
   */
  it("unterscheidet den Fehlversand von einer abgewiesenen Anforderung", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: httpFehler({ status: "send_failed" }) });

    await expect(resendActivationLink()).resolves.toBe("send_failed");
  });

  it("meldet einen Transportfehler als error, statt zu werfen", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error("network") });

    await expect(resendActivationLink()).resolves.toBe("error");
  });
});
