import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AGE-641 Phase B — das Gerätetoken verschwindet beim Abmelden.
 *
 * WARUM DAS HIER LIEGT UND NICHT IN DER HÜLLE. `signOut` wird an fünf Stellen
 * gerufen (Kopfzeile, Einstellungen, Aktivierungsschirm, Aktivierungs-Einlösung,
 * Aktivierungs-Gate). Läge das Aufräumen bei einem dieser Aufrufer, hätten die
 * anderen vier die Lücke — und zwar still.
 *
 * WAS DIE REIHENFOLGE ENTSCHEIDET. Die Zeile in `push_tokens` gehört dem
 * angemeldeten Konto; die RLS erlaubt sie nur ihm. Nach `auth.signOut()` ist
 * kein Konto mehr da, das Löschen träfe null Zeilen und meldete trotzdem
 * keinen Fehler — ein Aufräumen, das aussieht wie eines und keines ist. Also
 * VORHER, und diese Reihenfolge ist die eigentliche Zusage dieses Tests.
 *
 * Die Serverseite fängt den Rest ab: schlägt das Löschen fehl (kein Netz, App
 * abgestürzt), übernimmt `claim_push_token` das Token beim nächsten Konto auf
 * demselben Gerät. Das Aufräumen ist der beste Versuch, nicht die Garantie —
 * und darf deshalb das Abmelden NIE verhindern.
 */
const { pushAbmelden, reihenfolge } = vi.hoisted(() => ({
  pushAbmelden: vi.fn(async () => "entfernt"),
  reihenfolge: [] as string[],
}));

vi.mock("../lib/push", () => ({
  pushEinrichten: vi.fn(async () => "web"),
  pushAbmelden: async () => {
    reihenfolge.push("push");
    return pushAbmelden();
  },
}));

const authSignOut = vi.fn(async () => {
  reihenfolge.push("signOut");
  return { error: null };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signOut: authSignOut,
      updateUser: vi.fn(),
    },
    functions: { invoke: vi.fn() },
    rpc: vi.fn(async () => ({ data: [], error: null })),
    from: vi.fn(),
  },
}));

vi.mock("../lib/log", () => ({ logEvent: vi.fn() }));

const { AuthProvider } = await import("./AuthProvider");
const { useAuth } = await import("./auth-context");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

function Abmelden() {
  const { signOut } = useAuth();
  return (
    <button type="button" onClick={() => void signOut()}>
      Abmelden
    </button>
  );
}

function Umgebung() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Abmelden />
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  reihenfolge.length = 0;
  pushAbmelden.mockClear();
  pushAbmelden.mockResolvedValue("entfernt");
  authSignOut.mockClear();
});

describe("Abmelden nimmt das Gerätetoken mit (AGE-641 Phase B)", () => {
  it("räumt das Token auf, BEVOR die Sitzung endet", async () => {
    render(<Umgebung />);
    fireEvent.click(screen.getByRole("button", { name: "Abmelden" }));

    await waitFor(() => expect(authSignOut).toHaveBeenCalledTimes(1));
    expect(pushAbmelden).toHaveBeenCalledTimes(1);
    // Die Reihenfolge ist die Zusage, nicht bloß dass beides lief.
    expect(reihenfolge).toEqual(["push", "signOut"]);
  });

  it("WARTET auf das Aufräumen, statt es nur anzustoßen", async () => {
    // AUFLAGE AUS DER CODE-REVIEW. Der Reihenfolge-Test darüber ist schwächer,
    // als er aussieht: auch ein `void pushAbmelden()` ohne `await` bestünde ihn,
    // weil die Attrappe „push" schon beim AUFRUF notiert. Gemessen würde dann
    // die Aufrufreihenfolge, nicht das Abwarten — und genau das Abwarten ist
    // hier der Punkt: ohne es liefe das `delete` gegen eine Sitzung, die
    // `auth.signOut()` parallel gerade abräumt.
    //
    // Deshalb ein Versprechen, das erst auf Zuruf einlöst. Solange es offen
    // ist, DARF `auth.signOut()` nicht gelaufen sein.
    let einloesen: (() => void) | null = null;
    pushAbmelden.mockImplementation(
      () => new Promise<string>((res) => (einloesen = () => res("entfernt"))),
    );

    render(<Umgebung />);
    fireEvent.click(screen.getByRole("button", { name: "Abmelden" }));

    await waitFor(() => expect(pushAbmelden).toHaveBeenCalledTimes(1));
    expect(authSignOut).not.toHaveBeenCalled();

    einloesen!();
    await waitFor(() => expect(authSignOut).toHaveBeenCalledTimes(1));
  });

  it("meldet auch dann ab, wenn das Aufräumen scheitert", async () => {
    pushAbmelden.mockRejectedValue(new Error("kein Netz"));
    render(<Umgebung />);
    fireEvent.click(screen.getByRole("button", { name: "Abmelden" }));

    await waitFor(() => expect(authSignOut).toHaveBeenCalledTimes(1));
  });
});
