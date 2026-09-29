import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import type { AdminMember } from "../lib/admin-members";

/**
 * Die Aufnahmestrecke, die Anlege-Maske und die Mehrfachauswahl (AGE-927, §5).
 *
 * Eigene Datei neben `AdminMitgliederPage.test.tsx`, nicht darin: jene prüft
 * die Fläche aus AGE-566/581/587/707 und ist 1760 Zeilen lang. Dieselbe
 * Trennung wie bei `MemberDirectory.stufen.test.tsx`.
 *
 * Gemockt wird ausschliesslich die SUPABASE-GRENZE — nicht `admin-members` und
 * nicht die Seite. Die interessanten Aussagen sind, WELCHE Aufrufe die
 * Bedienung erzeugt und was die Fläche aus den Antworten macht.
 */
const rpc = vi.fn();
const countsRpc = vi.fn();
const invoke = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) =>
      args[0] === "admin_member_counts" ? countsRpc(...args) : rpc(...args),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (pfad: string) => ({
          data: { publicUrl: `https://test.local/${bucket}/${pfad}` },
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
    eingeladen_am: null,
    member_since: null,
    deaktiviert_seit: null,
    geloescht_seit: null,
    paid_until: null,
    payment_type: null,
    gebannt: true,
    ...overrides,
  };
}

/** Drei Mitglieder in Schritt ① — noch nicht bestätigt, noch nie eingeladen. */
const ANNA = member({ name: "Anna Angelegt", login_email: "anna@test.fbc", bestaetigt: false });
const BODO = member({ name: "Bodo Angelegt", login_email: "bodo@test.fbc", bestaetigt: false });
const CARLA = member({ name: "Carla Angelegt", login_email: "carla@test.fbc", bestaetigt: false });

/**
 * Die Zahlen sind PAARWEISE VERSCHIEDEN, damit eine vertauschte Zuordnung
 * Schritt → Zustand auffällt — und `angelegt + eingeladen = offen` geht auf,
 * weil die Datenbank genau das zusagt.
 */
const ZAEHLER = [
  { status: "alle", anzahl: 12 },
  { status: "aktiviert", anzahl: 7 },
  { status: "offen", anzahl: 5 },
  { status: "angelegt", anzahl: 3 },
  { status: "eingeladen", anzahl: 2 },
  { status: "deaktiviert", anzahl: 1 },
  { status: "geloescht", anzahl: 4 },
];

function renderMitRouter(eintrag = "/admin/mitglieder?tab=angelegt") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/admin/mitglieder", element: <AdminMitgliederPage /> },
      { path: "/admin/mitglied/:id", element: <p>Einzelseite</p> },
    ],
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

function lastListArgs(): Record<string, unknown> {
  const calls = rpc.mock.calls.filter((c) => c[0] === "admin_list_members");
  return (calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

function listCalls(): number {
  return rpc.mock.calls.filter((c) => c[0] === "admin_list_members").length;
}

/** Die Aufrufe an EINE Edge Function, in der Reihenfolge ihres Eingangs. */
function invokeCalls(name: string): Record<string, unknown>[] {
  return invoke.mock.calls
    .filter((c) => c[0] === name)
    .map((c) => (c[1] as { body?: Record<string, unknown> })?.body ?? {});
}

/** Ein Bericht des Endpunkts für EIN Mitglied. */
function bericht(ausgang: string, id: string, name: string | null) {
  const leer = {
    verschickt: [] as unknown[],
    uebersprungen: [] as unknown[],
    abgewiesen: [] as unknown[],
    nicht_einladbar: [] as unknown[],
    fehlgeschlagen: [] as unknown[],
  };
  const zahlen = Object.fromEntries(Object.keys(leer).map((k) => [k, k === ausgang ? 1 : 0]));
  return { data: { ...leer, zahlen, [ausgang]: [{ id, name }] }, error: null };
}

beforeEach(() => {
  rpc.mockReset();
  countsRpc.mockReset();
  invoke.mockReset();
  rpc.mockResolvedValue({ data: [ANNA, BODO, CARLA], error: null });
  countsRpc.mockResolvedValue({ data: ZAEHLER, error: null });
  invoke.mockResolvedValue({ data: null, error: null });
});

describe("Die Aufnahmestrecke zeigt ihre Reihenfolge (5.3)", () => {
  it("führt ① Angelegt, ② Eingeladen und ③ Bestätigt in dieser Folge", async () => {
    renderMitRouter("/admin/mitglieder");
    await screen.findByText("Anna Angelegt");

    // Die ersten drei Filter SIND die Strecke — die Reihenfolge ist die
    // Aussage, nicht bloss die Anordnung.
    const namen = screen.getAllByRole("tab").map((t) => t.textContent ?? "");
    expect(namen[0]).toMatch(/Angelegt/);
    expect(namen[1]).toMatch(/Eingeladen/);
    expect(namen[2]).toMatch(/Bestätigt/);
  });

  it("nennt an ① und ② die nächste Handlung, an ③ keine", async () => {
    renderMitRouter("/admin/mitglieder");
    await screen.findByText("Anna Angelegt");

    const [eins, zwei, drei] = screen.getAllByRole("tab");
    expect(eins).toHaveTextContent(/Einladung schicken/);
    expect(zwei).toHaveTextContent(/Erinnern/);
    // In ③ ist nichts mehr zu tun; eine Handlung dort wäre eine Einladung zum
    // Fehlklick.
    expect(drei).not.toHaveTextContent(/schicken|Erinnern/);
  });

  it("trägt an jedem Schritt seine Anzahl, und ① plus ② ergibt die Offenen", async () => {
    renderMitRouter("/admin/mitglieder");
    await screen.findByText("Anna Angelegt");

    const [eins, zwei, drei] = screen.getAllByRole("tab");
    await waitFor(() => expect(within(eins).getByText("3")).toBeInTheDocument());
    expect(within(zwei).getByText("2")).toBeInTheDocument();
    expect(within(drei).getByText("7")).toBeInTheDocument();
    // Die Summenzusage der Datenbank, an der Fläche nachgerechnet: 3 + 2 = 5,
    // und 5 ist die Zahl zu `offen`. Ein Schritt, der auf `alle` zeigte, fiele
    // hier auf.
    expect(ZAEHLER[3].anzahl + ZAEHLER[4].anzahl).toBe(ZAEHLER[2].anzahl);
  });

  it("reicht die Kennung des Schritts als `p_status` durch", async () => {
    renderMitRouter("/admin/mitglieder");
    await screen.findByText("Anna Angelegt");

    fireEvent.click(screen.getByRole("tab", { name: /Eingeladen/ }));
    await waitFor(() => expect(lastListArgs().p_status).toBe("eingeladen"));

    fireEvent.click(screen.getByRole("tab", { name: /Bestätigt/ }));
    // ③ heisst an der Fläche „Bestätigt", in der Funktion `aktiviert`. Die
    // Abbildung ist nicht die Identität, deshalb wird sie geprüft.
    await waitFor(() => expect(lastListArgs().p_status).toBe("aktiviert"));
  });

  it("schreibt den Schritt in die Adresse", async () => {
    const router = renderMitRouter("/admin/mitglieder");
    await screen.findByText("Anna Angelegt");

    fireEvent.click(screen.getByRole("tab", { name: /Eingeladen/ }));

    await waitFor(() => expect(router.state.location.search).toBe("?tab=eingeladen"));
  });
});

describe("Das alte Lesezeichen landet in Schritt ① (5.4)", () => {
  it("fällt von `?tab=offen` auf ① Angelegt statt auf „Alle“", async () => {
    renderMitRouter("/admin/mitglieder?tab=offen");
    await screen.findByText("Anna Angelegt");

    expect(screen.getByRole("tab", { name: /Angelegt/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Alle" })).toHaveAttribute("aria-selected", "false");
    await waitFor(() => expect(lastListArgs().p_status).toBe("angelegt"));
  });

  it("sagt einmal, dass der alte Reiter geteilt wurde — und lässt sich schliessen", async () => {
    renderMitRouter("/admin/mitglieder?tab=offen");
    await screen.findByText("Anna Angelegt");

    // Ohne den Hinweis stünde dort eine kleinere Zahl als im Lesezeichen
    // gemeint, ohne dass jemand erführe, warum.
    const hinweis = await screen.findByRole("status");
    expect(hinweis).toHaveTextContent(/geteilt|zwei Schritte/i);

    fireEvent.click(screen.getByRole("button", { name: /Hinweis schliessen/i }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("zeigt ihn nicht, wenn der Schritt unmittelbar gewählt wurde", async () => {
    renderMitRouter("/admin/mitglieder?tab=angelegt");
    await screen.findByText("Anna Angelegt");

    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Die Maske legt ein einzelnes Mitglied an (5.5)", () => {
  async function maskeOeffnen(eintrag = "/admin/mitglieder?tab=angelegt") {
    renderMitRouter(eintrag);
    await screen.findByText("Anna Angelegt");
    fireEvent.click(screen.getByRole("button", { name: "Mitglied anlegen" }));
    return screen.getByRole("dialog");
  }

  function ausfuellen(dialog: HTMLElement) {
    fireEvent.change(within(dialog).getByLabelText(/Vorname/i), { target: { value: "Dora" } });
    fireEvent.change(within(dialog).getByLabelText(/Nachname/i), { target: { value: "Neu" } });
    fireEvent.change(within(dialog).getByLabelText(/E-Mail/i), {
      target: { value: "dora@test.fbc" },
    });
  }

  it("bietet genau die drei Clubstufen an", async () => {
    const dialog = await maskeOeffnen();

    const plan = within(dialog).getByLabelText(/Plan/i);
    const werte = Array.from(plan.querySelectorAll("option")).map((o) => o.value);
    expect(werte).toEqual(["discover", "focus", "impact"]);
    // Die drei Stufen ausserhalb des Clubs sind keine Wahl — dieselbe Zusage
    // wie für „Stufe setzen" (AGE-903).
    for (const draussen of ["active", "boost", "connect"]) {
      expect(werte).not.toContain(draussen);
    }
  });

  it("hat den Haken „Bestätigungsmail senden“ vorausgewählt", async () => {
    const dialog = await maskeOeffnen();

    expect(within(dialog).getByLabelText(/Bestätigungsmail senden/i)).toBeChecked();
  });

  it("schickt Vorname, Nachname, Adresse, Plan und Haken an `admin-create-member`", async () => {
    const dialog = await maskeOeffnen();
    ausfuellen(dialog);
    fireEvent.change(within(dialog).getByLabelText(/Plan/i), { target: { value: "focus" } });
    invoke.mockResolvedValueOnce({
      data: { status: "ok", schritt: "bestaetigungsmail_verschickt", id: "neu" },
      error: null,
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    await waitFor(() => expect(invokeCalls("admin-create-member")).toHaveLength(1));
    expect(invokeCalls("admin-create-member")[0]).toMatchObject({
      vorname: "Dora",
      nachname: "Neu",
      email: "dora@test.fbc",
      plan: "focus",
      mailSenden: true,
    });
  });

  it("legt ohne Haken an und schickt `mailSenden: false` mit", async () => {
    const dialog = await maskeOeffnen();
    ausfuellen(dialog);
    fireEvent.click(within(dialog).getByLabelText(/Bestätigungsmail senden/i));
    invoke.mockResolvedValueOnce({
      data: { status: "ok", schritt: "ohne_mail_angelegt", id: "neu" },
      error: null,
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    await waitFor(() => expect(invokeCalls("admin-create-member")).toHaveLength(1));
    expect(invokeCalls("admin-create-member")[0].mailSenden).toBe(false);
  });

  it("legt ohne gültige Adresse gar nicht erst an und sagt, was fehlt", async () => {
    const dialog = await maskeOeffnen();
    fireEvent.change(within(dialog).getByLabelText(/Vorname/i), { target: { value: "Dora" } });
    fireEvent.change(within(dialog).getByLabelText(/Nachname/i), { target: { value: "Neu" } });
    fireEvent.change(within(dialog).getByLabelText(/E-Mail/i), { target: { value: "keine" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    expect(await within(dialog).findByText(/Adresse/i)).toBeInTheDocument();
    // Kein Konto: die Prüfung steht VOR der Anlage, nicht danach.
    expect(invokeCalls("admin-create-member")).toHaveLength(0);
  });

  it("benennt bei vergebener Adresse das bestehende Mitglied und führt zu ihm", async () => {
    const dialog = await maskeOeffnen();
    ausfuellen(dialog);
    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          status: 409,
          json: async () => ({
            error: "adresse_vergeben",
            mitglied: { id: ANNA.id, name: "Anna Angelegt", deaktiviert: false, geloescht: false },
          }),
        },
      },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    // IN DER MASKE, nicht irgendwo auf der Seite: dieselbe Zeile steht auch in
    // der Liste, mit demselben Namen und demselben Ziel. Eine Zusage, die sie
    // findet, prüft die Maske gar nicht — dieser Test hat das erst getan,
    // nachdem die Zahl der Treffer gemessen war (2 statt 1).
    await within(dialog).findByText(/Diese Adresse gehört bereits/);
    const link = within(dialog).getByRole("link", { name: /Anna Angelegt/ });
    expect(link).toHaveAttribute("href", `/admin/mitglied/${ANNA.id}`);
    // Und die Maske bleibt offen: der Admin berichtigt die Adresse hier.
    expect(dialog).toBeInTheDocument();
  });

  it("sagt ausdrücklich, wenn die Adresse zu einem entfernten Mitglied gehört", async () => {
    const dialog = await maskeOeffnen();
    ausfuellen(dialog);
    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          status: 409,
          json: async () => ({
            error: "adresse_vergeben",
            mitglied: { id: ANNA.id, name: "Anna Angelegt", deaktiviert: false, geloescht: true },
          }),
        },
      },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    // Der wiederkehrende Bewerber ist der erwartbare Fall — ein Verweis auf ein
    // Mitglied, das in keiner sichtbaren Liste steht, wäre eine Sackgasse.
    // Im DIALOG gesucht: „Gelöscht" steht als Reiter ohnehin auf der Seite.
    expect(await within(dialog).findByText(/ist gelöscht/i)).toBeInTheDocument();
  });

  it("meldet ein halb eingerichtetes Konto als bleibend und benennt den Fehlschlag", async () => {
    const dialog = await maskeOeffnen();
    ausfuellen(dialog);
    invoke.mockResolvedValueOnce({
      data: { status: "teilweise", schritt: "stufe_nicht_gesetzt", id: "neu" },
      error: null,
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    // Ein Ton verschwindet; diese Auskunft darf es nicht. Sie steht, bis der
    // Admin sie schliesst.
    const meldung = await screen.findByRole("status");
    expect(meldung).toHaveTextContent(/Stufe/i);
    expect(meldung).toHaveTextContent(/Angelegt/);
  });
});

describe("Die Auswahl gilt je Zeile und je Seite (5.6)", () => {
  it("führt in ① ein Kontrollkästchen je Zeile — und keines im Kopf", async () => {
    renderMitRouter("/admin/mitglieder?tab=angelegt");
    await screen.findByText("Anna Angelegt");

    // Genau so viele Kästchen wie Zeilen. Ein Kopfkästchen wäre mit EINEM
    // Klick deckungsgleich mit „alle einladen" — der Handlung, die ADR-0007
    // verwirft.
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    const kopf = screen.getAllByRole("columnheader");
    for (const zelle of kopf) expect(within(zelle).queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /alle/i })).toBeNull();
  });

  it("führt in ③ Bestätigt keine Kästchen und keine Handlung", async () => {
    renderMitRouter("/admin/mitglieder?tab=bestaetigt");
    await screen.findByText("Anna Angelegt");

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Ausgewählte/ })).toBeNull();
  });

  it("führt unter „Alle“ keine Kästchen", async () => {
    renderMitRouter("/admin/mitglieder?tab=alle");
    await screen.findByText("Anna Angelegt");

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("bietet genau eine Handlung zur Auswahl an — und kein Textfeld", async () => {
    renderMitRouter("/admin/mitglieder?tab=angelegt");
    await screen.findByText("Anna Angelegt");
    fireEvent.click(screen.getByRole("checkbox", { name: /Anna Angelegt/ }));

    expect(await screen.findByRole("button", { name: /Ausgewählte einladen/ })).toBeEnabled();
    // Kein Betreff, kein Text, kein Baustein, kein Ausleiten der Menge.
    expect(screen.queryByLabelText(/Betreff|Textbaustein|Nachricht/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Export|Übernehmen/i })).toBeNull();
  });

  it("heisst die Handlung in ② erinnern", async () => {
    renderMitRouter("/admin/mitglieder?tab=eingeladen");
    await screen.findByText("Anna Angelegt");
    fireEvent.click(screen.getByRole("checkbox", { name: /Anna Angelegt/ }));

    expect(await screen.findByRole("button", { name: /Ausgewählte erinnern/ })).toBeEnabled();
  });

  it("vergisst die Auswahl beim Blättern", async () => {
    // Eine volle Seite plus die Zusatzzeile — sonst gibt es keine Folgeseite.
    const seite1 = Array.from({ length: 26 }, (_, i) =>
      member({ name: `Erste ${i}`, bestaetigt: false }),
    );
    rpc.mockResolvedValueOnce({ data: seite1, error: null });
    rpc.mockResolvedValue({ data: [ANNA], error: null });
    renderMitRouter("/admin/mitglieder?tab=angelegt");
    await screen.findByText("Erste 0");

    fireEvent.click(screen.getByRole("checkbox", { name: /Erste 0/ }));
    expect(await screen.findByRole("button", { name: /Ausgewählte einladen/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await screen.findByText("Anna Angelegt");

    // Die Auswahl gilt je Seite. Sie mitzunehmen hiesse, Zeilen einzuladen, die
    // der Admin nicht mehr sieht.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Ausgewählte einladen/ })).toBeNull(),
    );
  });
});

describe("Der Lauf, der Fortschritt und der Bericht (5.7)", () => {
  async function auswaehlenUndAusloesen(namen: string[]) {
    renderMitRouter("/admin/mitglieder?tab=angelegt");
    await screen.findByText("Anna Angelegt");
    for (const n of namen) {
      fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(n) }));
    }
    fireEvent.click(await screen.findByRole("button", { name: /Ausgewählte einladen/ }));
  }

  it("fragt vorher mit der ZAHL zurück und nennt die Unumkehrbarkeit", async () => {
    await auswaehlenUndAusloesen(["Anna Angelegt", "Bodo Angelegt"]);

    const frage = await screen.findByRole("dialog");
    expect(frage).toHaveTextContent(/2/);
    expect(frage).toHaveTextContent(/nicht zurück/i);
    // Noch ist nichts hinausgegangen — die Frage steht VOR dem Lauf.
    expect(invokeCalls("admin-invite-members")).toHaveLength(0);
  });

  it("ruft je ausgewähltem Mitglied einmal auf und bricht bei einem Fehlschlag nicht ab", async () => {
    invoke
      .mockResolvedValueOnce(bericht("verschickt", ANNA.id, ANNA.name))
      .mockResolvedValueOnce({ data: null, error: { message: "kaputt" } })
      .mockResolvedValueOnce(bericht("verschickt", CARLA.id, CARLA.name));
    await auswaehlenUndAusloesen(["Anna Angelegt", "Bodo Angelegt", "Carla Angelegt"]);
    fireEvent.click(await screen.findByRole("button", { name: /^Einladen$/ }));

    await waitFor(() => expect(invokeCalls("admin-invite-members")).toHaveLength(3));
    // Je Aufruf GENAU EINE Kennung: nur so gibt es einen Fortschritt als Zahl
    // und einen Abbruch durch Wegnavigieren.
    for (const rumpf of invokeCalls("admin-invite-members")) {
      expect(rumpf.ids).toHaveLength(1);
    }
    const bodo = await screen.findByText(/fehlgeschlagen/i);
    expect(bodo).toBeInTheDocument();
  });

  it("trennt die Ausgänge, nennt Namen und bleibt stehen, bis der Admin schliesst", async () => {
    invoke
      .mockResolvedValueOnce(bericht("verschickt", ANNA.id, ANNA.name))
      .mockResolvedValueOnce(bericht("uebersprungen", BODO.id, BODO.name))
      .mockResolvedValueOnce(bericht("abgewiesen", CARLA.id, CARLA.name));
    await auswaehlenUndAusloesen(["Anna Angelegt", "Bodo Angelegt", "Carla Angelegt"]);
    fireEvent.click(await screen.findByRole("button", { name: /^Einladen$/ }));

    const bericht_ = await screen.findByRole("status");
    // Getrennt gezählt. Eine Sammelzahl „3 verschickt" wäre über dieser Menge
    // schlicht falsch.
    expect(bericht_).toHaveTextContent(/1 verschickt/);
    expect(bericht_).toHaveTextContent(/1 übersprungen/);
    expect(bericht_).toHaveTextContent(/1 abgewiesen/);
    expect(bericht_).not.toHaveTextContent(/3 verschickt/);
    // Namentlich, nicht nur gezählt.
    expect(within(bericht_).getByText(/Bodo Angelegt/)).toBeInTheDocument();
    expect(within(bericht_).getByText(/Carla Angelegt/)).toBeInTheDocument();

    fireEvent.click(within(bericht_).getByRole("button", { name: /schliessen/i }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("lädt die Liste erst NACH dem Lauf neu — und behält Filter, Suche und Seite", async () => {
    invoke
      .mockResolvedValueOnce(bericht("verschickt", ANNA.id, ANNA.name))
      .mockResolvedValueOnce(bericht("verschickt", BODO.id, BODO.name));
    renderMitRouter("/admin/mitglieder?tab=angelegt");
    await screen.findByText("Anna Angelegt");
    fireEvent.change(screen.getByLabelText(/Suche/i), { target: { value: "ang" } });
    await waitFor(() => expect(lastListArgs().p_query).toBe("ang"));

    fireEvent.click(screen.getByRole("checkbox", { name: /Anna Angelegt/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Bodo Angelegt/ }));
    const vorher = listCalls();
    fireEvent.click(await screen.findByRole("button", { name: /Ausgewählte einladen/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^Einladen$/ }));

    await screen.findByRole("status");
    // Genau EIN Nachladen, und zwar am Ende: eine Zeile, die mittendrin den
    // Schritt wechselt, verschöbe die Auswahl unter der Hand des Admins.
    await waitFor(() => expect(listCalls()).toBe(vorher + 1));
    expect(lastListArgs().p_status).toBe("angelegt");
    expect(lastListArgs().p_query).toBe("ang");
    expect(lastListArgs().p_offset).toBe(0);
  });

  it("bricht beim Wegnavigieren ab, statt weiterzuschicken", async () => {
    // Der erste Aufruf bleibt offen, bis der Test ihn auflöst — dazwischen
    // verlässt der Admin die Seite.
    let ersterFertig: (wert: unknown) => void = () => {};
    invoke
      .mockReturnValueOnce(new Promise((aufloesen) => (ersterFertig = aufloesen)))
      .mockResolvedValue(bericht("verschickt", BODO.id, BODO.name));

    renderMitRouter("/admin/mitglieder?tab=angelegt");
    await screen.findByText("Anna Angelegt");
    fireEvent.click(screen.getByRole("checkbox", { name: /Anna Angelegt/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Bodo Angelegt/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Ausgewählte einladen/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^Einladen$/ }));
    await waitFor(() => expect(invokeCalls("admin-invite-members")).toHaveLength(1));

    cleanup();
    ersterFertig(bericht("verschickt", ANNA.id, ANNA.name));

    // EINE ECHTE PAUSE UND KEIN `waitFor`. Jenes ist zufrieden, sobald die Zahl
    // einmal stimmt — und unmittelbar nach dem Abbau stimmt sie immer, auch
    // wenn der zweite Aufruf gleich danach hinausginge. Die erste Fassung
    // dieser Zusage bestand deshalb auch OHNE den Riegel. Gemessen: mit ihm
    // bleibt es bei einem Aufruf, ohne ihn werden es zwei.
    await new Promise((r) => setTimeout(r, 50));

    // Was verschickt wurde, steht nach dem Neuladen in ② — die Wahrheit liegt
    // in `activation_tokens`, nicht auf dem Bildschirm.
    expect(invokeCalls("admin-invite-members")).toHaveLength(1);
  });

  it("hält niemanden mit einer Browser-Rückfrage auf", async () => {
    const zuhoerer = vi.spyOn(window, "addEventListener");
    invoke.mockResolvedValue(bericht("verschickt", ANNA.id, ANNA.name));
    await auswaehlenUndAusloesen(["Anna Angelegt"]);
    fireEvent.click(await screen.findByRole("button", { name: /^Einladen$/ }));
    await screen.findByRole("status");

    // Es gibt keinen Zwischenzustand zwischen zwei Mitgliedern — eine Warnung
    // wäre eine Warnung vor einer Gefahr, die es nicht gibt.
    expect(zuhoerer.mock.calls.map((c) => c[0])).not.toContain("beforeunload");
    zuhoerer.mockRestore();
  });
});
