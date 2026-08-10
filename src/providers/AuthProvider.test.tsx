import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signUp,
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
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

const { AuthProvider } = await import("./AuthProvider");
const { useAuth } = await import("./auth-context");

/** Ruft `signUp` einmal beim Rendern und zeigt das Ergebnis an. */
function Registrieren() {
  const { signUp: melden } = useAuth();
  return (
    <button
      onClick={() => void melden("neu@test.fbc", "geheim1234567", "Neu Mitglied")}
      type="button"
    >
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

describe("AuthProvider.signUp — automatischer Aktivierungsversand", () => {
  beforeEach(() => {
    signUp.mockReset();
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { status: "issued" }, error: null });
  });

  it("fordert nach erfolgreicher Registrierung den Bestätigungslink an", async () => {
    signUp.mockResolvedValueOnce({ error: null });

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
    signUp.mockResolvedValueOnce({ error: { message: "User already registered" } });

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
    signUp.mockResolvedValueOnce({ error: null });
    invoke.mockRejectedValueOnce(new Error("network"));

    let ergebnis: { error: unknown } | undefined;
    function Prüfen() {
      const { signUp: melden } = useAuth();
      return (
        <button
          type="button"
          onClick={() => void melden("x@test.fbc", "geheim1234567", "X").then((r) => (ergebnis = r))}
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
});
