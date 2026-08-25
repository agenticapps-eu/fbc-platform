import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import type { AdminMember } from "../lib/admin-members";
import { bildUrl } from "../lib/bild-url";

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
const countsRpc = vi.fn();
const invoke = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    // Die Zähl-RPC (AGE-587) bekommt einen EIGENEN Spion, statt in `rpc`
    // mitzulaufen. Sonst leerte sie die `mockResolvedValueOnce`-Warteschlange
    // mit, die mehrere Zusagen benutzen, um Seite 1 von Seite 2 zu
    // unterscheiden — und die Blätterungs-Zusagen fielen aus einem Grund, der
    // mit dem Blättern nichts zu tun hat.
    rpc: (...args: unknown[]) =>
      args[0] === "admin_member_counts" ? countsRpc(...args) : rpc(...args),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    // AGE-595: die Verzeichniskarte löst `cover_url` über den Storage-Client
    // auf. Ohne diesen Zweig war die Datei nur deshalb grün, weil ihr Fixture
    // `cover_url: null` trug und `bildUrl` vorzeitig aussteigt — die Zusage
    // darunter hätte eine kaputte Admin-Ansicht nicht bemerkt.
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (pfad: string) => ({
          data: { publicUrl: `https://test.local/storage/v1/object/public/${bucket}/${pfad}` },
        }),
      }),
    },
  },
}));

import AdminMitgliederPage from "./AdminMitgliederPage";

function member(overrides: Partial<AdminMember> = {}): AdminMember {
  return {
    id: crypto.randomUUID(),
    name: "Anna Beispiel",
    avatar_url: null,
    cover_url: null,
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
    // Vorgabe: der Ban steht. Ein deaktiviertes Mitglied OHNE Ban ist der halbe
    // Zustand, und der ist der Sonderfall — nicht die Regel.
    gebannt: true,
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

/** Die Zahlen für die Reiter (AGE-587) — bewusst PAARWEISE VERSCHIEDEN, damit
 *  eine vertauschte Zuordnung Reiter → Zustand auffällt. */
const ZAEHLER = [
  { status: "alle", anzahl: 12 },
  { status: "aktiviert", anzahl: 10 },
  { status: "offen", anzahl: 2 },
  { status: "deaktiviert", anzahl: 1 },
  { status: "geloescht", anzahl: 3 },
];

function countCalls(): number {
  return countsRpc.mock.calls.length;
}

beforeEach(() => {
  rpc.mockReset();
  countsRpc.mockReset();
  invoke.mockReset();
  rpc.mockResolvedValue({ data: [OFFEN, AKTIV], error: null });
  countsRpc.mockResolvedValue({ data: ZAEHLER, error: null });
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
  // Seit Abschnitt 8 kommt der Status vom Reiter und nicht mehr aus einem
  // Auswahlfeld. Die Zusage selbst bleibt dieselbe: gefiltert wird in der
  // Datenbank, die Fläche reicht `p_status` durch.
  it("reicht den Statusfilter durch", async () => {
    renderPage();
    await screen.findByText("Bodo Unbestaetigt");

    fireEvent.click(screen.getByRole("tab", { name: "Nicht aktiviert" }));

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
    const menue = await oeffneMenue(OFFEN.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /Zugangslink schicken/i }));

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
    const menue = await oeffneMenue(OFFEN.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /Zugangslink schicken/i }));

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
    const menue = await oeffneMenue(OFFEN.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /Zugangslink schicken/i }));

    await screen.findByText(/fehlgeschlagen|nicht möglich|Fehler/i);
    expect(screen.queryByText(/angefordert/i)).toBeNull();
  });
});

describe("Direkt aktivieren verlangt eine namentliche Rückfrage (5.10, 5.11)", () => {
  it("bietet die Aktion an einer bestätigten Zeile nicht an", async () => {
    renderPage();
    const bestaetigt = await oeffneMenue(AKTIV.id);

    expect(within(bestaetigt).queryByRole("menuitem", { name: /Direkt aktivieren/i })).toBeNull();
    // Am unbestätigten Mitglied dagegen schon — sonst belegte die Zeile oben
    // nur, dass es den Eintrag überhaupt nicht gibt.
    fireEvent.keyDown(bestaetigt, { key: "Escape" });
    const unbestaetigt = await oeffneMenue(OFFEN.id);
    expect(
      within(unbestaetigt).getByRole("menuitem", { name: /Direkt aktivieren/i }),
    ).toBeInTheDocument();
  });

  it("nennt in der Rückfrage den Namen und die Folge", async () => {
    renderPage();
    const menue = await oeffneMenue(OFFEN.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /Direkt aktivieren/i }));

    const dialog = await screen.findByRole("dialog");
    // Der Name steht in der ÜBERSCHRIFT, nicht bloss irgendwo im Fliesstext —
    // wer schnell klickt, liest genau diese Zeile.
    expect(within(dialog).getByRole("heading", { name: /Bodo Unbestaetigt/ })).toBeInTheDocument();
    // Und die Folge wird benannt, nicht nur die Aktion.
    expect(within(dialog).getByText(/sichtbar/i)).toBeInTheDocument();
  });

  it("ändert beim Abbrechen nichts", async () => {
    renderPage();
    const menue = await oeffneMenue(OFFEN.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /Direkt aktivieren/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /Abbrechen/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(rpc.mock.calls.some((c) => c[0] === "admin_activate_member")).toBe(false);
  });

  it("aktiviert erst nach der Bestätigung — und lädt die Liste danach neu", async () => {
    renderPage();
    const vorher = listCalls();
    const menue = await oeffneMenue(OFFEN.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /Direkt aktivieren/i }));
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
 * Geprüft wird beides: die Fläche zeigt keine solche Aktion, UND die
 * Admin-Module rufen keine setzende Passwort-API. Nur das erste wäre zu wenig —
 * eine Funktion ohne Knopf bliebe eine Funktion.
 */
describe("Kein Weg, ein fremdes Passwort zu setzen (5.12)", () => {
  it("bietet die Fläche keine Passwort-Aktion an", async () => {
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

/**
 * Das Zeilenmenü (AGE-581, Abschnitt 7).
 *
 * Die Aktionen stehen nicht mehr nebeneinander, sondern hinter EINER
 * Schaltfläche am Zeilenende. Der Grund ist nicht Platz: mit vier
 * Lebenszyklus-Aktionen zusätzlich zu den beiden bestehenden stünden an einer
 * Zeile bis zu vier Knöpfe, und der gefährlichste — „löschen" — läge zwischen
 * ihnen wie jeder andere.
 *
 * Das Menü liegt an `document.body` und NICHT in der Zeile (7.2). `within(zeile)`
 * findet es deshalb nicht; die Einträge werden global gesucht. Das ist kein
 * Testkniff, sondern genau die Eigenschaft, derentwegen portaliert wird.
 */
const DEAKTIVIERT = member({
  name: "Dora Deaktiviert",
  login_email: "dora@test.fbc",
  bestaetigt: true,
  deaktiviert_seit: "2026-08-01T10:00:00Z",
});

/** Öffnet das Menü der Zeile und liefert es zurück. */
async function oeffneMenue(mitgliedId: string): Promise<HTMLElement> {
  const zeile = await screen.findByTestId(`mitglied-${mitgliedId}`);
  fireEvent.click(within(zeile).getByRole("button", { name: /Aktionen/i }));
  return await screen.findByRole("menu");
}

describe("Das Zeilenmenü zeigt nur Anwendbares (7.1)", () => {
  it("bietet an einer deaktivierten Zeile „reaktivieren“ und nicht „deaktivieren“", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();

    const menue = await oeffneMenue(DEAKTIVIERT.id);

    expect(within(menue).getByRole("menuitem", { name: /reaktivieren/i })).toBeInTheDocument();
    // Der Kern der Zusage: NICHT bloss „reaktivieren ist da“, sondern dass die
    // Gegenhandlung fehlt. `admin_disable_member` bräche an dieser Zeile mit
    // 22023 ab — ein Eintrag, dessen einziger Ausgang ein Fehler ist.
    expect(within(menue).queryByRole("menuitem", { name: /^deaktivieren$/i })).toBeNull();
  });
});

const GELOESCHT = member({
  name: "Egon Geloescht",
  login_email: "egon@test.fbc",
  bestaetigt: true,
  geloescht_seit: "2026-08-02T10:00:00Z",
});

/** Der kombinierte Zustand aus 7.5: nie bestätigt UND gelöscht. */
const OFFEN_GELOESCHT = member({
  name: "Frida Nieda",
  login_email: "frida@test.fbc",
  bestaetigt: false,
  geloescht_seit: "2026-08-02T10:00:00Z",
});

describe("Die Zustandsspalte nennt den Lebenszyklus (Sichtprobe 11.6)", () => {
  /**
   * Gefunden im Browser, nicht von einem Test: auf den Reitern „Deaktiviert“
   * und „Gelöscht“ stand in der Spalte „Zustand“ die Plakette **Aktiviert**.
   * Die Spalte las allein `bestaetigt`; `deaktiviert_seit` und `geloescht_seit`
   * kommen aus derselben RPC und wurden nirgends gezeigt. Auf „Alle“ fehlen
   * diese Zeilen ganz — der Reiter war das einzige Signal, und die Zeile sagte
   * das Gegenteil.
   */
  it("zeigt an einer deaktivierten Zeile „Deaktiviert“ statt „Aktiviert“", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();

    const zeile = await screen.findByTestId(`mitglied-${DEAKTIVIERT.id}`);
    expect(within(zeile).getByText("Deaktiviert")).toBeInTheDocument();
    // Der Kern der Zusage ist die ABWESENHEIT des gegenteiligen Wortes.
    expect(within(zeile).queryByText("Aktiviert")).toBeNull();
  });

  it("zeigt an einer gelöschten Zeile „Gelöscht“", async () => {
    rpc.mockResolvedValue({ data: [GELOESCHT], error: null });
    renderPage();

    const zeile = await screen.findByTestId(`mitglied-${GELOESCHT.id}`);
    expect(within(zeile).getByText("Gelöscht")).toBeInTheDocument();
    expect(within(zeile).queryByText("Aktiviert")).toBeNull();
  });

  it("lässt den Lebenszyklus vorgehen, wenn die Zeile AUCH unbestätigt ist", async () => {
    rpc.mockResolvedValue({ data: [OFFEN_GELOESCHT], error: null });
    renderPage();

    const zeile = await screen.findByTestId(`mitglied-${OFFEN_GELOESCHT.id}`);
    expect(within(zeile).getByText("Gelöscht")).toBeInTheDocument();
    // „Nicht aktiviert“ ist an einer gelöschten Zeile keine geltende Aussage
    // mehr, sondern Vorgeschichte — und sie kommt mit dem Wiederherstellen
    // zurück.
    expect(within(zeile).queryByText("Nicht aktiviert")).toBeNull();
  });

  it("lässt die beiden bisherigen Zustände unberührt", async () => {
    rpc.mockResolvedValue({ data: [AKTIV, OFFEN], error: null });
    renderPage();

    const aktiv = await screen.findByTestId(`mitglied-${AKTIV.id}`);
    expect(within(aktiv).getByText("Aktiviert")).toBeInTheDocument();
    const offen = await screen.findByTestId(`mitglied-${OFFEN.id}`);
    expect(within(offen).getByText("Nicht aktiviert")).toBeInTheDocument();
  });
});

describe("Kombinierte Zustände (7.5)", () => {
  it("bietet einem unaktivierten UND gelöschten Mitglied keinen Aktivierungsweg", async () => {
    rpc.mockResolvedValue({ data: [OFFEN_GELOESCHT], error: null });
    renderPage();

    const menue = await oeffneMenue(OFFEN_GELOESCHT.id);

    // Beide Wege in ein Konto, das es nicht mehr gibt. „Nicht bestätigt" allein
    // spräche für „direkt aktivieren" — die Zeile ist aber gelöscht, und das
    // schlägt die Bestätigungsfrage.
    expect(within(menue).queryByRole("menuitem", { name: /Zugangslink schicken/i })).toBeNull();
    expect(within(menue).queryByRole("menuitem", { name: /Direkt aktivieren/i })).toBeNull();
  });

  it("bietet an einer gelöschten Zeile „wiederherstellen“ und nicht „reaktivieren“", async () => {
    rpc.mockResolvedValue({ data: [GELOESCHT], error: null });
    renderPage();

    const menue = await oeffneMenue(GELOESCHT.id);

    expect(within(menue).getByRole("menuitem", { name: /Wiederherstellen/i })).toBeInTheDocument();
    // `admin_enable_member` bricht auf einem gelöschten Profil mit 22023 ab —
    // und DÜRFTE es auch nicht anders, sonst entstünde ein gelöschtes Mitglied
    // mit aufgehobener Sperre.
    expect(within(menue).queryByRole("menuitem", { name: /^Reaktivieren$/i })).toBeNull();
    expect(within(menue).queryByRole("menuitem", { name: /^Löschen$/i })).toBeNull();
  });

  it("bietet an einer deaktivierten Zeile weiterhin „löschen“", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();

    // Der Übergang „deaktiviert → gelöscht" steht in der Matrix: er setzt
    // `deleted_at` und lässt `disabled_at` stehen. Ihn auszublenden, weil die
    // Zeile schon entfernt aussieht, nähme eine gültige Aktion weg.
    const menue = await oeffneMenue(DEAKTIVIERT.id);
    expect(within(menue).getByRole("menuitem", { name: /^Löschen$/i })).toBeInTheDocument();
  });
});

describe("Rückfragen für Deaktivieren und Löschen (7.3)", () => {
  it("nennt beim Deaktivieren den Namen und das Ende der Anmeldung", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Deaktivieren$/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /Carla Aktiv/ })).toBeInTheDocument();
    // Die FOLGE, nicht bloss die Aktion: aus dem Wort „deaktivieren" allein
    // liest niemand ab, dass die Anmeldung endet.
    expect(within(dialog).getByText(/nicht mehr anmelden/i)).toBeInTheDocument();
  });

  it("nennt beim Löschen den Namen und das Ende der Anmeldung", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Löschen$/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /Carla Aktiv/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/nicht mehr anmelden/i)).toBeInTheDocument();
  });

  it("ruft beim Abbrechen der Löschen-Rückfrage nichts auf", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Löschen$/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /Abbrechen/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(invoke.mock.calls.some((c) => c[0] === "admin-set-member-ban")).toBe(false);
  });

  it("löscht erst nach der Bestätigung und lädt die Liste danach neu", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    invoke.mockResolvedValue({ data: { hidden: true, banned: true }, error: null });
    renderPage();
    const vorher = listCalls();
    const menue = await oeffneMenue(AKTIV.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Löschen$/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /^Löschen$/i }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("admin-set-member-ban", {
        body: { action: "delete", target: AKTIV.id },
      }),
    );
    await waitFor(() => expect(listCalls()).toBeGreaterThan(vorher));
  });

  it("reaktiviert ohne Rückfrage — die Aktion gibt zurück, sie nimmt nicht", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    invoke.mockResolvedValue({ data: { hidden: false, banned: false }, error: null });
    renderPage();
    const menue = await oeffneMenue(DEAKTIVIERT.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Reaktivieren$/i }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("admin-set-member-ban", {
        body: { action: "enable", target: DEAKTIVIERT.id },
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

/**
 * Die zweite Hälfte von Aufgabe 4.5.
 *
 * `admin-set-member-ban` antwortet mit `207`, wenn die Datenbank umgestellt ist,
 * `banned_until` aber nicht — das Mitglied ist unsichtbar und kommt weiterhin
 * herein. `207` ist ein 2xx: supabase-js setzt `error` NICHT, und eine Fläche,
 * die nur auf `error` schaut, meldete hier einen Erfolg.
 */
describe("Der halbe Zustand wird gemeldet, nicht gefeiert (4.5)", () => {
  it("warnt statt zu bestätigen, wenn nur die Datenbank umgestellt wurde", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    invoke.mockResolvedValue({
      data: { hidden: true, banned: false, detail: "auth kaputt" },
      error: null,
    });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Deaktivieren$/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /^Deaktivieren$/i }));

    // Beides muss stimmen: die Warnung steht da UND der Erfolgston fehlt.
    await screen.findByText(/weiterhin anmelden/i);
    expect(screen.queryByText(/Carla Aktiv: deaktiviert/i)).toBeNull();
  });

  /**
   * Die Falle in der anderen Richtung: ein gelungenes „reaktivieren" liefert
   * `{hidden: false, banned: false}`. Wer den Teilzustand an `banned === false`
   * allein festmacht, warnt hier — bei einer Aktion, die vollständig gelungen
   * ist. Kein anderer Test dieser Datei fiele darauf herein.
   */
  it("meldet ein gelungenes Reaktivieren als Erfolg, nicht als halben Zustand", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    invoke.mockResolvedValue({ data: { hidden: false, banned: false }, error: null });
    renderPage();
    const menue = await oeffneMenue(DEAKTIVIERT.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Reaktivieren$/i }));

    await screen.findByText(/reaktiviert/i);
    expect(screen.queryByText(/weiterhin anmelden/i)).toBeNull();
  });

  it("meldet den vollen Vollzug als Erfolg", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    invoke.mockResolvedValue({ data: { hidden: true, banned: true }, error: null });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Deaktivieren$/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /^Deaktivieren$/i }));

    // Die Gegenprobe zur Zeile darüber: ohne sie belegte jene nur, dass die
    // Fläche NIE einen Erfolg meldet.
    await screen.findByText(/deaktiviert/i);
    expect(screen.queryByText(/weiterhin anmelden/i)).toBeNull();
  });
});

describe("Das Menü ist mit der Tastatur bedienbar und schliesst beim Verlassen (7.4)", () => {
  it("setzt den Fokus beim Öffnen auf den ersten Eintrag", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();

    const menue = await oeffneMenue(DEAKTIVIERT.id);

    // Ohne das bliebe der Fokus am Auslöser, und Tab spränge am offenen Menü
    // vorbei in die nächste Zeile — das Menü wäre nur mit der Maus erreichbar.
    const erster = within(menue).getAllByRole("menuitem")[0];
    expect(document.activeElement).toBe(erster);
  });

  it("wandert mit den Pfeiltasten und läuft am Ende um", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();
    const menue = await oeffneMenue(DEAKTIVIERT.id);
    const eintraege = within(menue).getAllByRole("menuitem");
    expect(eintraege.length).toBeGreaterThan(1);

    fireEvent.keyDown(menue, { key: "ArrowDown" });
    expect(document.activeElement).toBe(eintraege[1]);

    fireEvent.keyDown(menue, { key: "ArrowUp" });
    expect(document.activeElement).toBe(eintraege[0]);

    // Umlauf nach oben: vom ersten auf den letzten.
    fireEvent.keyDown(menue, { key: "ArrowUp" });
    expect(document.activeElement).toBe(eintraege[eintraege.length - 1]);
  });

  it("schliesst mit Escape und gibt den Fokus an die Schaltfläche zurück", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();
    const menue = await oeffneMenue(DEAKTIVIERT.id);
    const zeile = screen.getByTestId(`mitglied-${DEAKTIVIERT.id}`);
    const knopf = within(zeile).getByRole("button", { name: /Aktionen/i });

    fireEvent.keyDown(menue, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    // Ohne die Rückgabe fiele der Fokus auf `body`, und der nächste Tab finge
    // am Seitenanfang an.
    expect(document.activeElement).toBe(knopf);
  });

  it("schliesst bei einem Klick ausserhalb", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();
    await oeffneMenue(DEAKTIVIERT.id);

    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("meldet den Zustand an der Schaltfläche", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();
    const zeile = await screen.findByTestId(`mitglied-${DEAKTIVIERT.id}`);
    const knopf = within(zeile).getByRole("button", { name: /Aktionen/i });

    expect(knopf).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(knopf);
    await screen.findByRole("menu");
    expect(knopf).toHaveAttribute("aria-expanded", "true");
  });
});

/**
 * 7.2 — das Menü hängt an `document.body` und NICHT in der Zeile.
 *
 * jsdom sieht das Einfangen durch `transform` und `backdrop-blur` nie; was es
 * sehen kann, ist die Massnahme dagegen. Die Sichtprobe im Browser (7.6) prüft
 * die Wirkung, dieser Test hält die Ursache fest — sonst wanderte das Menü beim
 * nächsten Umbau zurück in die Zeile, und alle anderen Tests blieben grün.
 */
describe("Das Menü liegt ausserhalb der Zeile (7.2)", () => {
  it("hängt direkt am body und nicht in der Tabellenzeile", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    renderPage();

    const menue = await oeffneMenue(DEAKTIVIERT.id);
    const zeile = screen.getByTestId(`mitglied-${DEAKTIVIERT.id}`);

    expect(zeile.contains(menue)).toBe(false);
    expect(menue.parentElement).toBe(document.body);
  });
});

/**
 * Befunde der Diff-Prüfung (Stufe 4), beide im Browser nachgemessen.
 *
 * Die erste Fassung dieser Datei hatte 37 grüne Zusagen und ließ beide durch.
 * Der Grund ist derselbe: `fireEvent.click` in jsdom VERSCHIEBT DEN FOKUS
 * NICHT. Im Browser bekommt ein `<button>` beim `mousedown` den Fokus, und
 * genau daraus entsteht der Fehler. Diese Tests stellen die Reihenfolge des
 * Browsers nach — `blur` mit `relatedTarget`, dann `click` —, statt sie zu
 * unterstellen.
 */
describe("Der Auslöser schliesst das Menü wieder (Diff-Prüfung)", () => {
  it("schliesst beim zweiten Klick, auch wenn der Fokus vorher hinauswandert", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    const zeile = screen.getByTestId(`mitglied-${AKTIV.id}`);
    const knopf = within(zeile).getByRole("button", { name: /Aktionen/i });

    // Was der Browser zwischen mousedown und click tut: der Fokus springt vom
    // Menüeintrag auf den Auslöser. Ohne diese Zeile ist der Test grün und
    // prüft nichts.
    fireEvent.blur(menue, { relatedTarget: knopf });
    fireEvent.click(knopf);

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(knopf).toHaveAttribute("aria-expanded", "false");
  });
});

describe("Tab verlässt das Menü nicht ins Nirgendwo (Diff-Prüfung)", () => {
  it("schliesst und setzt den Fokus auf den Auslöser zurück", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    const zeile = screen.getByTestId(`mitglied-${AKTIV.id}`);
    const knopf = within(zeile).getByRole("button", { name: /Aktionen/i });

    fireEvent.keyDown(menue, { key: "Tab" });

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    // Das Menü hängt am ENDE von `document.body`. Ohne Rückgabe landet der
    // nächste Tab hinter der ganzen Anwendung — nicht in der nächsten Zeile,
    // wie der frühere Kommentar behauptete.
    expect(document.activeElement).toBe(knopf);
  });
});

/**
 * Der dritte Befund der Diff-Prüfung: die Function unterscheidet 403, 404, 409,
 * 502 und 500 ausdrücklich (`statusFuerPgFehler`) — und ungelesen kam davon
 * nichts an. supabase-js verpackt jedes Nicht-2xx in dieselbe englische
 * Meldung.
 */
describe("Die Statusabbildung der Function kommt an (Diff-Prüfung)", () => {
  /** Was supabase-js aus einer Nicht-2xx-Antwort macht. */
  function httpFehler(status: number, rumpf: unknown) {
    const error = new Error("Edge Function returned a non-2xx status code");
    (error as unknown as { context: unknown }).context = {
      status,
      json: async () => rumpf,
    };
    return error;
  }

  it.each([
    [409, /schon in diesem Zustand/i],
    [404, /gibt es nicht mehr/i],
    [403, /Berechtigung/i],
    [502, /Anmeldedienst/i],
  ])("übersetzt %i in einen lesbaren Satz", async (status, erwartet) => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    invoke.mockResolvedValue({ data: null, error: httpFehler(status, { error: "db_failed" }) });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Deaktivieren$/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /^Deaktivieren$/i }));

    await screen.findByText(erwartet);
    // Und der englische Rohsatz taucht NICHT auf — sonst belegte die Zeile
    // darüber nur, dass irgendwo irgendein Text steht.
    expect(screen.queryByText(/non-2xx status code/i)).toBeNull();
  });

  it("fällt bei unbekanntem Status auf den Rumpf zurück, nicht auf den Rohsatz", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    invoke.mockResolvedValue({
      data: null,
      error: httpFehler(500, { error: "db_failed", detail: "Verbindung weg" }),
    });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Deaktivieren$/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /^Deaktivieren$/i }));

    await screen.findByText(/Verbindung weg/i);
  });
});

/**
 * Die neue Ordnung beim Öffnen (24.08.): Datenbank zuerst, Bann danach.
 *
 * Dadurch hat der halbe Zustand beim Öffnen die ANDERE Gestalt als beim
 * Schliessen — sichtbar, aber ausgesperrt statt unsichtbar, aber anmeldefähig.
 * Ein Kriterium, das nur auf `hidden && !banned` schaut, sähe ihn gar nicht und
 * meldete einen Erfolg.
 */
describe("Der halbe Zustand hat zwei Gestalten (Ordnungswechsel)", () => {
  it("warnt, wenn beim Reaktivieren die Aufhebung der Sperre fehlt", async () => {
    rpc.mockResolvedValue({ data: [DEAKTIVIERT], error: null });
    invoke.mockResolvedValue({
      data: { hidden: false, banned: true, detail: "auth down" },
      error: null,
    });
    renderPage();
    const menue = await oeffneMenue(DEAKTIVIERT.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Reaktivieren$/i }));

    await screen.findByText(/nicht anmelden|ausgesperrt/i);
    expect(screen.queryByText(/Dora Deaktiviert: reaktiviert/i)).toBeNull();
  });

  it("meldet ein Wiederherstellen, das deaktiviert bleibt, als genau das", async () => {
    rpc.mockResolvedValue({ data: [GELOESCHT], error: null });
    // `admin_restore_member` gab `entbannen: false` zurück: das Mitglied war vor
    // dem Löschen deaktiviert und bleibt es. Verborgen UND gesperrt ist hier der
    // RICHTIGE Ausgang — kein halber Zustand, aber auch kein schlichtes
    // „wiederhergestellt": das Mitglied kommt weiterhin nicht herein.
    invoke.mockResolvedValue({ data: { hidden: true, banned: true }, error: null });
    renderPage();
    const menue = await oeffneMenue(GELOESCHT.id);

    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Wiederherstellen$/i }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("admin-set-member-ban", {
        body: { action: "restore", target: GELOESCHT.id },
      }),
    );
    await screen.findByText(/bleibt deaktiviert/i);
    // Und keine Warnung — das ist kein Teilfehlschlag.
    expect(screen.queryByText(/unvollständig/i)).toBeNull();
  });
});

/**
 * Der Nachsetz-Weg für einen fehlenden Ban (Diff-Prüfung, 24.08.).
 *
 * Das Delta verlangt zweierlei, was sich ohne `gebannt` widerspricht: „fehlt
 * der Ban, SHALL derselbe Aufruf ihn nachsetzen" und „‚deaktivieren' SHALL NOT
 * an bereits deaktivierten erscheinen". Mit der Spalte gilt beides — der
 * Eintrag erscheint GENAU DANN, wenn der Ban fehlt.
 */
describe("Der halbe Zustand ist über das Menü heilbar (gebannt)", () => {
  it("bietet „Deaktivieren“ an einer deaktivierten Zeile OHNE Ban", async () => {
    rpc.mockResolvedValue({ data: [member({ ...DEAKTIVIERT, gebannt: false })], error: null });
    renderPage();

    const menue = await oeffneMenue(DEAKTIVIERT.id);

    // Das ist der Zustand nach einem 207: `disabled_at` steht, `banned_until`
    // fehlt. `admin_disable_member` bricht hier NICHT ab, sondern setzt nach.
    expect(within(menue).getByRole("menuitem", { name: /^Deaktivieren$/i })).toBeInTheDocument();
  });

  it("verbirgt ihn, sobald der Ban steht", async () => {
    rpc.mockResolvedValue({ data: [member({ ...DEAKTIVIERT, gebannt: true })], error: null });
    renderPage();

    const menue = await oeffneMenue(DEAKTIVIERT.id);

    // Vollständiger Zustand — hier wäre der einzige Ausgang eine 22023.
    expect(within(menue).queryByRole("menuitem", { name: /^Deaktivieren$/i })).toBeNull();
    expect(within(menue).getByRole("menuitem", { name: /^Reaktivieren$/i })).toBeInTheDocument();
  });

  it("bietet ihn an einer GELÖSCHTEN Zeile auch ohne Ban nicht an", async () => {
    rpc.mockResolvedValue({ data: [member({ ...GELOESCHT, gebannt: false })], error: null });
    renderPage();

    const menue = await oeffneMenue(GELOESCHT.id);

    // Die Matrix kennt für „gelöscht" keinen Nachsetz-Weg: `admin_delete_member`
    // bricht dort mit 22023 ab, gleichgültig ob der Ban steht. Das ist eine
    // Lücke im Bestand und keine Freiheit dieser Fläche — sie erfindet keine.
    expect(within(menue).queryByRole("menuitem", { name: /^Löschen$/i })).toBeNull();
    expect(
      within(menue).getByRole("menuitem", { name: /^Wiederherstellen$/i }),
    ).toBeInTheDocument();
  });
});

describe("Die Warnung verspricht nur, was das Menü hergibt", () => {
  it("verweist nach einem halben Deaktivieren auf die Wiederholung", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    invoke.mockResolvedValue({ data: { hidden: true, banned: false }, error: null });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Deaktivieren$/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /^Deaktivieren$/i }));

    // Zulässig, weil die Zeile danach `gebannt = false` trägt und das Menü
    // „Deaktivieren" deshalb wieder anbietet.
    await screen.findByText(/noch einmal auslösen/i);
  });

  it("verspricht sie nach einem halben Löschen NICHT", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    invoke.mockResolvedValue({ data: { hidden: true, banned: false }, error: null });
    renderPage();
    const menue = await oeffneMenue(AKTIV.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /^Löschen$/i }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /^Löschen$/i }));

    // An einer gelöschten Zeile blendet das Menü „Löschen" aus — die Matrix
    // kennt dort keinen Nachsetz-Weg. Eine Warnung, die ihn verspräche, schickte
    // den Admin auf die Suche nach einem Eintrag, den es nicht gibt.
    await screen.findByText(/unvollständig/i);
    expect(screen.queryByText(/noch einmal auslösen/i)).toBeNull();
  });
});

/**
 * Abschnitt 8 — die fünf Reiter.
 *
 * Gefiltert wird in der DATENBANK, nicht hier: die Fläche reicht `p_status`
 * durch. Ein Test, der nur die Argumente prüft, sagte deshalb nichts über das,
 * was ein Admin sieht — und ein Test, der nur die sichtbaren Zeilen prüft,
 * bestünde auch mit einer Fläche, die clientseitig filtert und die RPC
 * unbehelligt lässt. Deshalb stellt `listeNachStatus` die `case p_status`-Regel
 * der Migration nach, und die Zusagen prüfen beides: was übergeben wird UND was
 * daraufhin dasteht.
 */
function listeNachStatus(zeilen: AdminMember[]) {
  rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn !== "admin_list_members") return Promise.resolve({ data: null, error: null });
    const status = args.p_status as string | null;
    const treffer = zeilen.filter((m) => {
      switch (status) {
        case "deaktiviert":
          return m.deaktiviert_seit !== null && m.geloescht_seit === null;
        case "geloescht":
          return m.geloescht_seit !== null;
        case "aktiviert":
          return m.bestaetigt && m.deaktiviert_seit === null && m.geloescht_seit === null;
        case "offen":
          return !m.bestaetigt && m.deaktiviert_seit === null && m.geloescht_seit === null;
        // `alle` UND `null`: dieselbe Bedingung, genau wie das `else` im `case`
        // der Migration.
        default:
          return m.deaktiviert_seit === null && m.geloescht_seit === null;
      }
    });
    return Promise.resolve({ data: treffer, error: null });
  });
}

const DEAKTIVIERT_8 = member({
  name: "Dora Deaktiviert",
  login_email: "dora@test.fbc",
  deaktiviert_seit: "2026-08-20T10:00:00.000Z",
});

describe("Die Reiter trennen die Zustände (8.1)", () => {
  it("führt ein deaktiviertes Mitglied nicht unter „Alle“, sondern unter „Deaktiviert“", async () => {
    listeNachStatus([AKTIV, DEAKTIVIERT_8]);
    renderPage();

    // „Alle" heisst die Mitgliedschaft, nicht den Datenbestand.
    await screen.findByText("Carla Aktiv");
    expect(screen.queryByText("Dora Deaktiviert")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Deaktiviert" }));

    await screen.findByText("Dora Deaktiviert");
    expect(screen.queryByText("Carla Aktiv")).toBeNull();
    await waitFor(() => expect(lastListArgs().p_status).toBe("deaktiviert"));
  });
});

describe("Die drei Sichten überleben den Reiterwechsel (8.3)", () => {
  it("bleibt in „Karten“, wenn der Reiter wechselt", async () => {
    listeNachStatus([AKTIV, DEAKTIVIERT_8]);
    renderPage();
    await screen.findByText("Carla Aktiv");

    fireEvent.click(screen.getByRole("button", { name: "Karten" }));
    // Die Kartensicht rendert keine Tabelle — daran hängt die Unterscheidung,
    // nicht an der Knopfstellung allein.
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Deaktiviert" }));
    await screen.findByText("Dora Deaktiviert");

    expect(screen.getByRole("button", { name: "Karten" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("table")).toBeNull();
  });
});

/**
 * Der Reiter steht in der ADRESSE (8.2, 8.4).
 *
 * `MemoryRouter` allein reichte hier nicht: er kennt keinen Weg, von aussen zu
 * navigieren oder zurückzugehen. Genau das ist aber die Zusage — ein Zustand,
 * den nur `location` trägt, wird sonst nie von aussen geprüft, und in diesem
 * Projekt ist schon einmal ein Zustand grün getestet worden, den die
 * Zurück-Taste zerlegte.
 */
function renderMitRouter(eintrag: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "/admin/mitglieder", element: <AdminMitgliederPage /> }],
    { initialEntries: [eintrag] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return router;
}

describe("Der Reiter steht in der Adresse (8.2, 8.4)", () => {
  it("schreibt ihn beim Klick hinein", async () => {
    listeNachStatus([AKTIV, DEAKTIVIERT_8]);
    const router = renderMitRouter("/admin/mitglieder");
    await screen.findByText("Carla Aktiv");

    fireEvent.click(screen.getByRole("tab", { name: "Deaktiviert" }));

    await waitFor(() => expect(router.state.location.search).toBe("?tab=deaktiviert"));
  });

  it("liest ihn beim Aufbau — ein Neuladen verliert ihn nicht", async () => {
    listeNachStatus([AKTIV, DEAKTIVIERT_8]);
    renderMitRouter("/admin/mitglieder?tab=deaktiviert");

    // Kein Klick: der Reiter kommt allein aus der Adresse.
    await screen.findByText("Dora Deaktiviert");
    expect(screen.getByRole("tab", { name: "Deaktiviert" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(lastListArgs().p_status).toBe("deaktiviert");
  });

  it("folgt einer Navigation von aussen und der Zurück-Taste", async () => {
    listeNachStatus([AKTIV, DEAKTIVIERT_8]);
    const router = renderMitRouter("/admin/mitglieder");
    await screen.findByText("Carla Aktiv");

    // Von AUSSEN, ohne Klick auf einen Reiter.
    await router.navigate("/admin/mitglieder?tab=deaktiviert");
    await screen.findByText("Dora Deaktiviert");
    expect(screen.queryByText("Carla Aktiv")).toBeNull();

    // Und zurück. Das ist der Weg, den ein `useState` neben der Adresse
    // verschluckt hätte: der Wert dort bliebe auf „deaktiviert" stehen.
    await router.navigate(-1);
    await screen.findByText("Carla Aktiv");
    expect(screen.queryByText("Dora Deaktiviert")).toBeNull();
    expect(screen.getByRole("tab", { name: "Alle" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(lastListArgs().p_status).toBe("alle"));
  });

  it("fällt für einen unbekannten Wert auf „Alle“ zurück", async () => {
    listeNachStatus([AKTIV, DEAKTIVIERT_8]);
    renderMitRouter("/admin/mitglieder?tab=quatsch");

    // Die Adresszeile ist Eingabe von aussen. Ein unbekannter Wert an `p_status`
    // liefe in der Datenbank in eine 22023 — die Fläche zeigt statt dessen die
    // Mitgliedschaft.
    await screen.findByText("Carla Aktiv");
    expect(screen.getByRole("tab", { name: "Alle" })).toHaveAttribute("aria-selected", "true");
    expect(lastListArgs().p_status).toBe("alle");
  });
});

describe("„Mitgliedschaft“ ist ein Darstellungsmodus, kein Filter (8.2)", () => {
  it("zeigt dieselbe Menge wie „Alle“ und fragt denselben Status ab", async () => {
    listeNachStatus([AKTIV, OFFEN, DEAKTIVIERT_8]);
    const router = renderMitRouter("/admin/mitglieder");
    await screen.findByText("Carla Aktiv");

    fireEvent.click(screen.getByRole("tab", { name: "Mitgliedschaft" }));

    // Dieselbe Menge: beide Reiter fragen `alle` ab. Deaktivierte stehen in
    // keinem von beiden — wer nicht mehr dabei ist, hat keinen
    // Zahlungszeitraum, der noch etwas bedeutet.
    await waitFor(() => expect(router.state.location.search).toBe("?tab=mitgliedschaft"));
    expect(lastListArgs().p_status).toBe("alle");
    expect(screen.getByText("Carla Aktiv")).toBeInTheDocument();
    expect(screen.getByText("Bodo Unbestaetigt")).toBeInTheDocument();
    expect(screen.queryByText("Dora Deaktiviert")).toBeNull();
  });
});

describe("Ein Reiterwechsel fängt wieder auf Seite 1 an", () => {
  it("setzt den Versatz zurück, auch wenn der Reiter von aussen kommt", async () => {
    // Eine volle Seite plus Zusatzzeile, damit es überhaupt eine zweite gibt.
    const seite1 = Array.from({ length: 26 }, (_, i) => member({ name: `Erste ${i}` }));
    rpc.mockResolvedValueOnce({ data: seite1, error: null });
    rpc.mockResolvedValue({ data: [member({ name: "Zweite Seite" })], error: null });

    const router = renderMitRouter("/admin/mitglieder");
    await screen.findByText("Erste 0");
    fireEvent.click(screen.getByRole("button", { name: /Weiter/i }));
    await waitFor(() => expect(lastListArgs().p_offset).toBe(25));

    // Von aussen, also ohne den Klick, der zurücksetzen könnte.
    await router.navigate("/admin/mitglieder?tab=geloescht");

    // Seite 3 der Deaktivierten ist keine Fortsetzung von Seite 3 der Offenen —
    // und eine Abfrage mit dem ALTEN Versatz darf dazwischen gar nicht erst
    // hinausgehen.
    await waitFor(() => expect(lastListArgs().p_status).toBe("geloescht"));
    expect(lastListArgs().p_offset).toBe(0);
    expect(
      rpc.mock.calls.filter((c) => c[0] === "admin_list_members" && c[1].p_status === "geloescht"),
    ).toHaveLength(1);
  });
});

describe("Der Auslöser zeigt drei Punkte und heisst trotzdem etwas", () => {
  it("trägt keinen sichtbaren Text, aber einen zugänglichen Namen mit dem Mitglied", async () => {
    rpc.mockResolvedValue({ data: [AKTIV], error: null });
    renderPage();
    const zeile = await screen.findByTestId(`mitglied-${AKTIV.id}`);

    const knopf = within(zeile).getByRole("button", { name: "Aktionen für Carla Aktiv" });

    // Seit der Auslöser nur noch ein Symbol zeigt, ist das `aria-label` die
    // EINZIGE Auskunft darüber, was er tut und zu wem er gehört. Diese Zusage
    // ist gegen den späteren Aufräum-Diff gerichtet, der es entfernt, weil „das
    // steht doch dran" — dann hiesse der Knopf für eine Vorleseausgabe nichts.
    expect(knopf.textContent).toBe("");
    // Und das Symbol selbst darf nicht mitgelesen werden.
    expect(knopf.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

/**
 * Der Reiter „Mitgliedschaft" (Abschnitt 9).
 *
 * Zwei Zeilen mit gegensätzlichem Befund, nicht eine: „unbekannt" allein wäre
 * auch dann grün, wenn die Fläche das Wort an JEDER Zeile zeigte — die
 * Gegenprobe an einem Mitglied MIT Datum ist der Teil, der die Zusage trägt.
 */
const OHNE_DATUM = member({
  name: "Elke Ohnedatum",
  login_email: "elke@test.fbc",
  paid_until: null,
  payment_type: null,
});
const MIT_DATUM = member({
  name: "Frank Bezahlt",
  login_email: "frank@test.fbc",
  paid_until: "2026-12-31",
  payment_type: "rechnung",
});

describe("Der Reiter „Mitgliedschaft“ rät kein Datum (9.1)", () => {
  it("lässt das Feld leer, statt ein Datum zu erfinden", async () => {
    rpc.mockResolvedValue({ data: [OHNE_DATUM, MIT_DATUM], error: null });
    renderMitRouter("/admin/mitglieder?tab=mitgliedschaft");

    const ohne = await screen.findByTestId(`mitglied-${OHNE_DATUM.id}`);
    expect(within(ohne).getByLabelText(/^bezahlt bis für/)).toHaveValue("");

    // Die Gegenprobe. Ohne sie bliebe der Test auch grün, wenn die Fläche gar
    // kein Datum anzeigte.
    const mit = screen.getByTestId(`mitglied-${MIT_DATUM.id}`);
    expect(within(mit).getByLabelText(/^bezahlt bis für/)).toHaveValue("2026-12-31");
  });

  it("verdoppelt die Auskunft nicht durch ein Wort daneben", async () => {
    rpc.mockResolvedValue({ data: [OHNE_DATUM, MIT_DATUM], error: null });
    renderMitRouter("/admin/mitglieder?tab=mitgliedschaft");
    await screen.findByTestId(`mitglied-${OHNE_DATUM.id}`);

    // Bis zum 24.08. stand neben dem leeren Feld noch „unbekannt". Das
    // Auswahlfeld daneben sagt mit „nicht erfasst" dasselbe, und weil das Wort
    // nur an den leeren Zeilen erschien, verschob es in jeder Zeile die
    // folgenden Felder um seine eigene Breite. Diese Zusage ist gegen den
    // späteren Diff gerichtet, der es „zur Verdeutlichung" zurückbringt.
    expect(screen.queryByText("unbekannt")).toBeNull();
  });
});

describe("Die Tabelle beschriftet die Mitgliedschaftsspalten einzeln", () => {
  it("trägt so viele Überschriften wie Zellen — sonst rutscht die Zuordnung", async () => {
    rpc.mockResolvedValue({ data: [MIT_DATUM], error: null });
    renderMitRouter("/admin/mitglieder?tab=mitgliedschaft");
    const zeile = await screen.findByTestId(`mitglied-${MIT_DATUM.id}`);

    expect(screen.getAllByRole("columnheader").map((t) => t.textContent)).toEqual([
      "Name",
      "Anmeldeadresse",
      "Zustand",
      "Stufe",
      "bezahlt bis",
      "Zahlungsart",
      "Speichern",
      "Aktionen",
    ]);

    // Und die Zeile trägt genauso viele Zellen. Diese Zusage ist der Grund,
    // aus dem es sie gibt: die erste Fassung hatte VIER Überschriften über
    // ACHT Zellen, jsdom war grün, und erst der Browser zeigte, dass
    // „Aktionen" über dem Datumsfeld stand.
    expect(within(zeile).getAllByRole("cell")).toHaveLength(8);
  });
});

describe("Die Stufe ist im Reiter „Mitgliedschaft“ nur lesbar (9.2)", () => {
  it("zeigt sie an, bietet sie aber nicht als Eingabefeld an", async () => {
    rpc.mockResolvedValue({ data: [MIT_DATUM], error: null });
    renderMitRouter("/admin/mitglieder?tab=mitgliedschaft");

    const zeile = await screen.findByTestId(`mitglied-${MIT_DATUM.id}`);

    // Angezeigt: die Plakette trägt den Klartext der Stufe.
    expect(within(zeile).getByText("Impact")).toBeInTheDocument();

    // Aber nicht änderbar. Die Zeile trägt GENAU EIN Auswahlfeld, und das ist
    // die Zahlungsart — ein zweites wäre der Stufenwechsel, der hier nicht
    // hingehört (AGE-516). Die Zusage ist eine ABWESENHEIT; sie ist über die
    // Zahl geprüft und nicht über den Namen, weil ein Stufenfeld unter jedem
    // beliebigen Namen dieselbe Wirkung hätte.
    const auswahlfelder = within(zeile).getAllByRole("combobox");
    expect(auswahlfelder).toHaveLength(1);
    expect(auswahlfelder[0]).toHaveAccessibleName(`Zahlungsart für ${MIT_DATUM.name}`);
  });
});

describe("Der Reiter „Mitgliedschaft“ speichert über `admin_update_profile` (9.4)", () => {
  it("schickt GENAU die zwei geänderten Felder, nicht das ganze Profil", async () => {
    rpc.mockResolvedValue({ data: [MIT_DATUM], error: null });
    renderMitRouter("/admin/mitglieder?tab=mitgliedschaft");
    const zeile = await screen.findByTestId(`mitglied-${MIT_DATUM.id}`);

    fireEvent.change(within(zeile).getByLabelText(/^bezahlt bis für/), {
      target: { value: "2027-01-31" },
    });
    fireEvent.change(within(zeile).getByLabelText(/^Zahlungsart für/), {
      target: { value: "stripe" },
    });
    fireEvent.click(within(zeile).getByRole("button", { name: /^Mitgliedschaft speichern für/ }));

    await waitFor(() =>
      expect(rpc.mock.calls.some((c) => c[0] === "admin_update_profile")).toBe(true),
    );

    // `toEqual` und nicht `objectContaining`: die ganze Zusage von 9.4 ist, dass
    // NICHTS SONST mitgeschrieben wird. `saveAdminProfile` baut einen Patch aus
    // dreissig Feldern — Name, Anschrift, Rollen, Kompetenzen, Videos — und
    // räumte aus diesem Zwei-Felder-Formular alles weg, was es nicht kennt.
    const [, args] = rpc.mock.calls.find((c) => c[0] === "admin_update_profile")!;
    expect(args).toEqual({
      target: MIT_DATUM.id,
      patch: { paid_until: "2027-01-31", payment_type: "stripe" },
    });
  });

  it("schickt ein geleertes Feld als null, nicht als leeren Text", async () => {
    rpc.mockResolvedValue({ data: [MIT_DATUM], error: null });
    renderMitRouter("/admin/mitglieder?tab=mitgliedschaft");
    const zeile = await screen.findByTestId(`mitglied-${MIT_DATUM.id}`);

    fireEvent.change(within(zeile).getByLabelText(/^bezahlt bis für/), { target: { value: "" } });
    fireEvent.change(within(zeile).getByLabelText(/^Zahlungsart für/), { target: { value: "" } });
    fireEvent.click(within(zeile).getByRole("button", { name: /^Mitgliedschaft speichern für/ }));

    await waitFor(() =>
      expect(rpc.mock.calls.some((c) => c[0] === "admin_update_profile")).toBe(true),
    );

    // `admin_update_profile` castet `paid_until` nach `date`. Ein `""` liesse
    // den Cast scheitern, und der Admin sähe einen Fehler für ein Feld, das er
    // gerade absichtlich geleert hat.
    const [, args] = rpc.mock.calls.find((c) => c[0] === "admin_update_profile")!;
    expect((args as { patch: Record<string, unknown> }).patch).toEqual({
      paid_until: null,
      payment_type: null,
    });
  });

  it("bietet das Speichern erst an, wenn sich etwas geändert hat", async () => {
    rpc.mockResolvedValue({ data: [MIT_DATUM], error: null });
    renderMitRouter("/admin/mitglieder?tab=mitgliedschaft");
    const zeile = await screen.findByTestId(`mitglied-${MIT_DATUM.id}`);

    const knopf = within(zeile).getByRole("button", { name: /^Mitgliedschaft speichern für/ });
    expect(knopf).toBeDisabled();

    fireEvent.change(within(zeile).getByLabelText(/^bezahlt bis für/), {
      target: { value: "2027-01-31" },
    });
    expect(knopf).toBeEnabled();

    // Und zurück auf den Ausgangswert heisst wieder „nichts zu tun": „geändert"
    // ist ein VERGLEICH gegen das Mitglied, kein Merker, der einmal umfällt.
    fireEvent.change(within(zeile).getByLabelText(/^bezahlt bis für/), {
      target: { value: "2026-12-31" },
    });
    expect(knopf).toBeDisabled();
  });
});

/**
 * Die Zahlen an den Reitern (AGE-587, Abschnitt 6).
 *
 * Sie beantworten „wie viele gibt es", nicht „wie viele meiner Treffer" — und
 * genau dieser Unterschied ist die Zusage, die verhindert, dass ein späterer
 * Leser „Reiter sagt 70, Liste zeigt zwei" für einen Fehler hält.
 */
describe("Zähler an den Reitern (AGE-587)", () => {
  it("zeigt an jedem Reiter seine Zahl", async () => {
    renderPage();
    await screen.findByText("Bodo Unbestaetigt");

    await waitFor(() => {
      expect(within(screen.getByRole("tab", { name: "Alle" })).getByText("12")).toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("tab", { name: "Nicht aktiviert" })).getByText("2"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("tab", { name: "Deaktiviert" })).getByText("1"),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("tab", { name: "Gelöscht" })).getByText("3")).toBeInTheDocument();
  });

  it("gibt „Alle“ und „Mitgliedschaft“ dieselbe Zahl — es ist dieselbe Menge", async () => {
    renderPage();
    await waitFor(() =>
      expect(within(screen.getByRole("tab", { name: "Alle" })).getByText("12")).toBeInTheDocument(),
    );

    expect(
      within(screen.getByRole("tab", { name: "Mitgliedschaft" })).getByText("12"),
    ).toBeInTheDocument();
  });

  /**
   * Der Name des Bedienelements bleibt der NAME des Reiters. Stünde die Zahl im
   * zugänglichen Namen, läse eine Vorleseausgabe „Nicht aktiviert 2" als
   * Bezeichnung eines Knopfes vor — und der Name änderte sich bei jeder
   * Aktivierung.
   */
  it("mischt die Zahl NICHT in den zugänglichen Namen des Reiters", async () => {
    renderPage();
    await waitFor(() =>
      expect(within(screen.getByRole("tab", { name: "Alle" })).getByText("12")).toBeInTheDocument(),
    );

    expect(screen.getByRole("tab", { name: "Nicht aktiviert" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Nicht aktiviert\s*2/ })).not.toBeInTheDocument();
  });

  /**
   * „Keine Zahl" und „die Zahl null" sind zwei verschiedene Auskünfte. Eine
   * voreilige Null behauptet einen leeren Verein, solange nur die Antwort fehlt
   * — die Lehre aus AGE-582, 6.6.
   */
  it("zeigt KEINE Zahl, solange die Zahlen nicht da sind — nicht die Null", async () => {
    countsRpc.mockReturnValue(new Promise(() => {})); // bleibt offen

    renderPage();
    await screen.findByText("Bodo Unbestaetigt");

    const reiter = screen.getByRole("tab", { name: "Alle" });
    expect(within(reiter).queryByText("0")).not.toBeInTheDocument();
    expect(reiter.textContent).toBe("Alle");
  });

  /**
   * Die gewollte Seite des scheinbaren Widerspruchs: der Reiter sagt 12, die
   * Liste zeigt zwei Treffer. Ohne diese Zusage hält ein späterer Leser die
   * Globalität für einen Fehler und „repariert" sie.
   */
  it("lässt die Zahlen global, wenn eine Suche läuft", async () => {
    renderPage();
    await waitFor(() =>
      expect(within(screen.getByRole("tab", { name: "Alle" })).getByText("12")).toBeInTheDocument(),
    );
    const vorher = countCalls();

    fireEvent.change(screen.getByPlaceholderText("Name oder Anmeldeadresse"), {
      target: { value: "meier" },
    });
    await waitFor(() => expect(lastListArgs().p_query).toBe("meier"));

    // Die Zahl steht unverändert da …
    expect(within(screen.getByRole("tab", { name: "Alle" })).getByText("12")).toBeInTheDocument();
    // … und der Suchbegriff hat die Zähl-RPC nicht einmal erreicht.
    expect(countCalls()).toBe(vorher);
    expect(countsRpc.mock.calls.every((c) => c[1] === undefined)).toBe(true);
  });

  /**
   * Aufgabe 4.4: geprüft wird MUTATION → NACHLADEN, nicht das erste Rendern.
   * Läge der Schlüssel der Zähl-Abfrage neben dem Präfix `["admin-members"]`
   * statt darunter, blieben die Zahlen nach einer Aktivierung stehen — und ein
   * Test auf das erste Rendern bliebe dabei grün.
   */
  it("holt die Zahlen nach einer Zustandsänderung neu", async () => {
    renderPage();
    await screen.findByText("Bodo Unbestaetigt");
    await waitFor(() => expect(countCalls()).toBeGreaterThan(0));
    const vorher = countCalls();

    const menue = await oeffneMenue(OFFEN.id);
    fireEvent.click(within(menue).getByRole("menuitem", { name: /Direkt aktivieren/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Aktivieren/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("admin_activate_member", { target: OFFEN.id }),
    );
    await waitFor(() => expect(countCalls()).toBeGreaterThan(vorher));
  });
});

/**
 * AGE-595, Gegenprobe zu Aufgabe 2.7.
 *
 * Die Admin-Ansicht speist DIESELBE `MemberCard` wie `/mitglieder`, übergibt ihr
 * aber `AdminMember` statt `DirectoryMember`. Das ist der Grund, aus dem
 * `cover_url` in BEIDE RPCs musste: die Spalte fehlte hier sonst im Typ, und die
 * Seite bräche beim Übersetzen.
 *
 * Die Zusage setzt ausdrücklich EIN COVER. Mit `cover_url: null` — dem Wert des
 * Standard-Fixtures — steigt `bildUrl` in der ersten Zeile aus und der
 * Storage-Weg wird nie betreten; die Datei war bis hierher grün, ohne ihn je
 * geprüft zu haben.
 */
describe("Die Verzeichniskarte in der Admin-Ansicht (AGE-595)", () => {
  const PFAD = "b1000000-0000-0000-0000-000000000009/1699999999.webp";

  /* Die Seite startet auf „Tabelle"; die Verzeichniskarte steht nur unter
     „Verzeichnis". Ohne diesen Klick prüften die Zusagen darunter eine Ansicht,
     in der die Karte gar nicht vorkommt — und wären grün gewesen, wenn ich sie
     auf „nicht vorhanden" formuliert hätte. */
  const verzeichnisAnsicht = () =>
    fireEvent.click(screen.getByRole("button", { name: "Verzeichnis" }));

  it("zeigt das Cover eines Mitglieds über den Bild-Auflöser", async () => {
    rpc.mockResolvedValue({
      data: [member({ name: "Cover Traegerin", cover_url: PFAD })],
      error: null,
    });
    const { container } = renderPage();
    await screen.findByText("Cover Traegerin");
    verzeichnisAnsicht();

    const img = container
      .querySelector<HTMLElement>('[data-testid="karten-cover"]')
      ?.querySelector("img");
    expect(img?.getAttribute("src")).toBe(bildUrl("covers", PFAD));
    expect(img?.getAttribute("src")).not.toBe(PFAD);
  });

  it("behält das Bildfeld auch für ein Mitglied ohne Cover", async () => {
    rpc.mockResolvedValue({
      data: [member({ name: "Ohne Cover", cover_url: null })],
      error: null,
    });
    const { container } = renderPage();
    await screen.findByText("Ohne Cover");
    verzeichnisAnsicht();

    const feld = container.querySelector<HTMLElement>('[data-testid="karten-cover"]');
    expect(feld).not.toBeNull();
    expect(feld?.querySelector("img")).toBeNull();
  });

  it("zeigt auch hier keine Kompass-Marken mehr", async () => {
    rpc.mockResolvedValue({
      data: [
        member({
          name: "Mit Kategorien",
          offer_categories: ["kapital"],
          need_categories: ["experten"],
          has_offers: true,
          has_needs: true,
        }),
      ],
      error: null,
    });
    renderPage();
    await screen.findByText("Mit Kategorien");
    verzeichnisAnsicht();

    expect(screen.queryByText(/^Bietet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Sucht/)).not.toBeInTheDocument();
  });
});
