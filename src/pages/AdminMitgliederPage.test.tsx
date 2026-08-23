import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import type { AdminMember } from "../lib/admin-members";

/**
 * Die Admin-Mitgliederliste (AGE-566).
 *
 * Gemockt wird ausschließlich die SUPABASE-GRENZE — nicht `admin-members`, nicht
 * die Seite und nicht die Verzeichniskarte. Sonst prüfte der Test seine eigenen
 * Mocks; die interessanten Aussagen sind, WELCHE Argumente die Bedienung
 * erzeugt und was die Fläche aus den Antworten macht.
 *
 * Die Sichtprobe im Browser ersetzt das nicht: in diesem Projekt sind mehrere
 * Befunde ausschließlich dort aufgefallen, während jsdom grün war.
 */
const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

import AdminMitgliederPage from "./AdminMitgliederPage";

function member(overrides: Partial<AdminMember> = {}): AdminMember {
  return {
    id: crypto.randomUUID(),
    name: "Anna Beispiel",
    avatar_url: null,
    region: null,
    company: null,
    short_bio: null,
    branche: null,
    tier: "impact",
    roles: null,
    competencies: null,
    has_offers: false,
    has_needs: false,
    offer_categories: [],
    need_categories: [],
    login_email: "anna@test.fbc",
    bestaetigt: true,
    member_since: null,
    deaktiviert_seit: null,
    geloescht_seit: null,
    paid_until: null,
    payment_type: null,
    ...overrides,
  };
}

const OFFEN = member({
  name: "Bodo Unbestaetigt",
  login_email: "bodo@test.fbc",
  bestaetigt: false,
});
const AKTIV = member({ name: "Carla Aktiv", login_email: "carla@test.fbc", bestaetigt: true });

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <AdminMitgliederPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Die zuletzt an `admin_list_members` übergebenen Argumente. */
function lastListArgs(): Record<string, unknown> {
  const calls = rpc.mock.calls.filter((c) => c[0] === "admin_list_members");
  return (calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

function listCalls(): number {
  return rpc.mock.calls.filter((c) => c[0] === "admin_list_members").length;
}

beforeEach(() => {
  rpc.mockReset();
  invoke.mockReset();
  rpc.mockResolvedValue({ data: [OFFEN, AKTIV], error: null });
  invoke.mockResolvedValue({ data: null, error: null });
});

describe("Der Zustand ist in jeder Sicht sichtbar (5.5)", () => {
  it.each(["Tabelle", "Karten", "Verzeichnis"])(
    "kennzeichnet ein unbestätigtes Mitglied in der Sicht %s",
    async (sicht) => {
      renderPage();
      await screen.findByText("Bodo Unbestaetigt");

      fireEvent.click(screen.getByRole("button", { name: sicht }));

      // Die Kennzeichnung hängt am Mitglied, nicht an der Sicht — sie muss also
      // in allen drei zu finden sein, und zwar bei DIESEM Mitglied.
      const zeile = await screen.findByTestId(`mitglied-${OFFEN.id}`);
      expect(within(zeile).getByText(/nicht aktiviert/i)).toBeInTheDocument();

      const aktiv = screen.getByTestId(`mitglied-${AKTIV.id}`);
      expect(within(aktiv).queryByText(/nicht aktiviert/i)).toBeNull();
    },
  );
});

describe("Die Verzeichnis-Ansicht führt nicht in die Sackgasse (5.6)", () => {
  it("verlinkt auf /admin/mitglied/:id statt auf /p/:id", async () => {
    renderPage();
    await screen.findByText("Bodo Unbestaetigt");

    fireEvent.click(screen.getByRole("button", { name: "Verzeichnis" }));

    const link = await screen.findByRole("link", { name: /Bodo Unbestaetigt/ });
    expect(link).toHaveAttribute("href", `/admin/mitglied/${OFFEN.id}`);
    // `/p/:id` liest `profiles_public` und verlangt ein bestätigtes
    // ZIELPROFIL — für genau dieses Mitglied meldete es „nicht gefunden".
    expect(link.getAttribute("href")).not.toContain("/p/");
  });
});

describe("Filter, Suche und Blätterung gehen an die Datenbank (5.7)", () => {
  it("reicht den Statusfilter durch", async () => {
    renderPage();
    await screen.findByText("Bodo Unbestaetigt");

    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: "offen" } });

    await waitFor(() => expect(lastListArgs().p_status).toBe("offen"));
  });

  it("reicht den Suchbegriff durch", async () => {
    renderPage();
    await screen.findByText("Bodo Unbestaetigt");

    fireEvent.change(screen.getByLabelText(/Suche/i), { target: { value: "bodo" } });

    await waitFor(() => expect(lastListArgs().p_query).toBe("bodo"));
  });

  /**
   * Diff-Review (AGE-566): das Feld schrieb direkt in den Query-Key, also war
   * jeder Tastendruck eine RPC — und diese verbindet `profiles` mit
   * `auth.users` und zählt zu jedem Treffer Angebote und Bedarfe. Der Nachbar
   * `MemberDirectory.tsx` entprellt seit jeher mit 300 ms und schreibt den
   * Grund dazu; diese Fläche tat es nicht.
   *
   * Geprüft wird die ZAHL der Abfragen, nicht das Vorhandensein eines Timers:
   * ein Test auf „es gibt einen setTimeout" bestünde auch mit 0 ms.
   */
  it("löst nicht bei jedem Tastendruck eine Abfrage aus", async () => {
    renderPage();
    await screen.findByText("Bodo Unbestaetigt");
    const vorher = listCalls();

    const feld = screen.getByLabelText(/Suche/i);
    fireEvent.change(feld, { target: { value: "b" } });
    fireEvent.change(feld, { target: { value: "bo" } });
    fireEvent.change(feld, { target: { value: "bod" } });

    await waitFor(() => expect(lastListArgs().p_query).toBe("bod"));
    // Drei Tastendrücke, EINE Abfrage — und zwar mit dem letzten Stand.
    expect(listCalls() - vorher).toBe(1);
  });

  it("zeigt auf Seite 2 andere Mitglieder als auf Seite 1", async () => {
    // Eine volle Seite plus eine Zusatzzeile — sonst gibt es keine Folgeseite,
    // und der Weiter-Knopf wäre zu Recht nicht da.
    const seite1 = Array.from({ length: 26 }, (_, i) => member({ name: `Erste ${i}` }));
    const seite2 = [member({ name: "Zweite Seite" })];
    rpc.mockResolvedValueOnce({ data: seite1, error: null });
    rpc.mockResolvedValueOnce({ data: seite2, error: null });

    renderPage();
    await screen.findByText("Erste 0");

    fireEvent.click(screen.getByRole("button", { name: /Weiter/i }));

    await screen.findByText("Zweite Seite");
    expect(screen.queryByText("Erste 0")).toBeNull();
    // Das Blättern passiert in der Datenbank, nicht im Browser.
    await waitFor(() => expect(lastListArgs().p_offset).toBe(25));
  });
});

/**
 * Diff-Review (AGE-566): Die Blätterung rendert nur NEBEN Treffern. Wird auf
 * der letzten Seite die letzte Zeile aktiviert — im Filter „Nicht aktiviert"
 * der Normalfall —, lädt die Liste neu, hat null Treffer, und mit ihnen
 * verschwindet der „Zurück"-Knopf. Der Admin sitzt dann auf einer leeren Seite
 * fest und liest „Zu diesem Filter gibt es keine Treffer", obwohl es welche
 * gibt: eine Seite weiter vorn.
 */
describe("Eine leer gewordene Folgeseite ist keine Sackgasse", () => {
  it("bietet einen Weg zurück und holt damit wieder Treffer", async () => {
    const seite1 = Array.from({ length: 26 }, (_, i) => member({ name: `Erste ${i}` }));
    rpc.mockResolvedValueOnce({ data: seite1, error: null });
    rpc.mockResolvedValueOnce({ data: [], error: null });

    renderPage();
    await screen.findByText("Erste 0");
    fireEvent.click(screen.getByRole("button", { name: /Weiter/i }));

    await screen.findByText(/Keine Mitglieder gefunden/i);
    // Der Text der ersten Seite wäre hier falsch: es liegt nicht am Filter.
    expect(screen.getByText(/kleiner geworden/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ersten Seite/i }));

    await waitFor(() => expect(lastListArgs().p_offset).toBe(0));
    await screen.findByText("Erste 0");
  });

  it("bietet ihn auf der ERSTEN Seite nicht an", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    renderPage();

    await screen.findByText(/Keine Mitglieder gefunden/i);
    // Sonst stünde auf Seite 1 ein Knopf, der auf Seite 1 führt.
    expect(screen.queryByRole("button", { name: /ersten Seite/i })).toBeNull();
    expect(screen.getByText(/keine Treffer/i)).toBeInTheDocument();
  });
});

describe("Zugangslink schicken (5.8, 5.9)", () => {
  it("ruft send-activation mit der Anmeldeadresse", async () => {
    renderPage();
    const zeile = await screen.findByTestId(`mitglied-${OFFEN.id}`);

    fireEvent.click(within(zeile).getByRole("button", { name: /Zugangslink schicken/i }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("send-activation", {
        body: { email: "bodo@test.fbc" },
      }),
    );
  });

  /**
   * 202 belegt KEINEN Versand: `send-activation` antwortet auf dem angenommenen
   * Pfad immer so, gleichgültig ob es die Adresse gibt (Abwehr von
   * Adressaufzählung). Wer daraus „verschickt" macht, behauptet etwas, das er
   * nicht weiß — und schickt einen Admin ins Warten auf eine Bestätigung, die
   * nie kommt.
   */
  it("meldet ANGEFORDERT und behauptet keinen Versand", async () => {
    renderPage();
    const zeile = await screen.findByTestId(`mitglied-${OFFEN.id}`);

    fireEvent.click(within(zeile).getByRole("button", { name: /Zugangslink schicken/i }));

    const meldung = await screen.findByText(/angefordert/i);
    expect(meldung).toBeInTheDocument();
    expect(screen.queryByText(/verschickt|zugestellt|gesendet/i)).toBeNull();
  });

  /**
   * Der Befund aus dem Plan-Review (codex, MEDIUM-2): der Handler liefert auch
   * 405, 400, 500 und 502. Die erste Fassung des Changes behauptete „immer
   * 202" und hätte einen Betriebsfehler als Erfolg durchgehen lassen.
   */
  it("zeigt bei einem Betriebsfehler einen Fehler statt einer Bestätigung", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "Internal Server Error" } });
    renderPage();
    const zeile = await screen.findByTestId(`mitglied-${OFFEN.id}`);

    fireEvent.click(within(zeile).getByRole("button", { name: /Zugangslink schicken/i }));

    await screen.findByText(/fehlgeschlagen|nicht möglich|Fehler/i);
    expect(screen.queryByText(/angefordert/i)).toBeNull();
  });
});

describe("Direkt aktivieren verlangt eine namentliche Rückfrage (5.10, 5.11)", () => {
  it("bietet die Handlung an einer bestätigten Zeile nicht an", async () => {
    renderPage();
    const aktiv = await screen.findByTestId(`mitglied-${AKTIV.id}`);

    expect(within(aktiv).queryByRole("button", { name: /Direkt aktivieren/i })).toBeNull();
    // Am unbestätigten Mitglied dagegen schon — sonst belegte die Zeile oben
    // nur, dass es den Knopf überhaupt nicht gibt.
    const offen = screen.getByTestId(`mitglied-${OFFEN.id}`);
    expect(within(offen).getByRole("button", { name: /Direkt aktivieren/i })).toBeInTheDocument();
  });

  it("nennt in der Rückfrage den Namen und die Folge", async () => {
    renderPage();
    const offen = await screen.findByTestId(`mitglied-${OFFEN.id}`);

    fireEvent.click(within(offen).getByRole("button", { name: /Direkt aktivieren/i }));

    const dialog = await screen.findByRole("dialog");
    // Der Name steht in der ÜBERSCHRIFT, nicht bloss irgendwo im Fliesstext —
    // wer schnell klickt, liest genau diese Zeile.
    expect(within(dialog).getByRole("heading", { name: /Bodo Unbestaetigt/ })).toBeInTheDocument();
    // Und die Folge wird benannt, nicht nur die Handlung.
    expect(within(dialog).getByText(/sichtbar/i)).toBeInTheDocument();
  });

  it("ändert beim Abbrechen nichts", async () => {
    renderPage();
    const offen = await screen.findByTestId(`mitglied-${OFFEN.id}`);
    fireEvent.click(within(offen).getByRole("button", { name: /Direkt aktivieren/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /Abbrechen/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(rpc.mock.calls.some((c) => c[0] === "admin_activate_member")).toBe(false);
  });

  it("aktiviert erst nach der Bestätigung — und lädt die Liste danach neu", async () => {
    renderPage();
    const offen = await screen.findByTestId(`mitglied-${OFFEN.id}`);
    const vorher = listCalls();
    fireEvent.click(within(offen).getByRole("button", { name: /Direkt aktivieren/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /Aktivieren/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_activate_member", { target: OFFEN.id }),
    );
    // Ohne das Nachladen bliebe die Zeile „nicht aktiviert" stehen, obwohl sie
    // es nicht mehr ist — und der nächste Klick liefe in die 22023.
    await waitFor(() => expect(listCalls()).toBeGreaterThan(vorher));
  });
});

/**
 * REGRESSIONSTEST (5.12) — er startet grün und muss es bleiben.
 *
 * Donalds Entscheidung vom 17.08.: kein admin-gesetztes Passwort als
 * Produktfunktion. Ein Admin, der ein fremdes Passwort setzt, kann sich als das
 * Mitglied anmelden und dessen Nachrichten lesen, ohne dass es irgendwo steht.
 * Der Knopf heißt deshalb „Zugangslink schicken".
 *
 * Geprüft wird beides: die Fläche zeigt keine solche Handlung, UND die
 * Admin-Module rufen keine setzende Passwort-API. Nur das erste wäre zu wenig —
 * eine Funktion ohne Knopf bliebe eine Funktion.
 */
describe("Kein Weg, ein fremdes Passwort zu setzen (5.12)", () => {
  it("bietet die Fläche keine Passwort-Handlung an", async () => {
    renderPage();
    await screen.findByText("Bodo Unbestaetigt");

    expect(screen.queryByRole("button", { name: /passwort/i })).toBeNull();
    expect(screen.queryByLabelText(/passwort/i)).toBeNull();
  });

  it("ruft kein Admin-Modul eine setzende Passwort-API", () => {
    const dateien = [
      "src/lib/admin-members.ts",
      "src/lib/admin-profile.ts",
      "src/pages/AdminMitgliederPage.tsx",
      "src/pages/AdminMitgliedPage.tsx",
    ];
    for (const datei of dateien) {
      const quelle = readFileSync(datei, "utf8");
      expect(quelle).not.toMatch(/updateUserById|auth\.admin|set_password|setPassword/);
    }
  });
});
