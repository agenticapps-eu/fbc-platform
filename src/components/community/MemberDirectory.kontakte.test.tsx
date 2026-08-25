import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemberDirectory from "./MemberDirectory";
import { contactsQueryKey, type DirectoryMember } from "../../lib/directory";

/**
 * Die zwei Reiter im Verzeichnis (AGE-595).
 *
 * Gemockt wird ausschliesslich die SUPABASE-GRENZE und die Identitaet — nicht
 * die Filterlogik, nicht die Karte, nicht der Schnitt der beiden Mengen. Der
 * Schnitt IST die interessante Aussage; ihn zu mocken hiesse, den eigenen
 * Nachbau zu pruefen.
 *
 * Was diese Datei NICHT belegt: Hoehen, Breiten und alles, wofuer jsdom Layout
 * rechnen muesste. Dafuer ist die Sichtprobe da.
 */
const rpc = vi.fn();
const contactSelect = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (tabelle: string) => ({
      select: () => ({
        eq: () => ({
          or: (...args: unknown[]) => contactSelect(tabelle, ...args),
        }),
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (pfad: string) => ({
          data: { publicUrl: `https://test.local/${bucket}/${pfad}` },
        }),
      }),
    },
  },
}));

const ICH = "11111111-1111-1111-1111-111111111111";
const ANDERES_KONTO = "99999999-9999-9999-9999-999999999999";

let auth: { user: { id: string } | null } = { user: { id: ICH } };
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => auth,
}));

function member(id: string, name: string, overrides: Partial<DirectoryMember> = {}) {
  return {
    id,
    name,
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
    ...overrides,
  } satisfies DirectoryMember;
}

const ANNA = member("a-1", "Anna Allgemein");
const BODO = member("b-2", "Bodo Kontakt");
const CARLA = member("c-3", "Carla Kontakt");

/** Eine angenommene Anfrage, die VOM Betrachter ausging. */
const ausgehend = (gegenueber: string) => ({ from_id: ICH, to_id: gegenueber });
/** … und eine, die ZU ihm kam. Fuer „sind wir verbunden" derselbe Fall. */
const eingehend = (gegenueber: string) => ({ from_id: gegenueber, to_id: ICH });

function renderDirectory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ergebnis = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MemberDirectory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...ergebnis, queryClient };
}

const reiter = (name: RegExp) => screen.getByRole("tab", { name });
const kontakteOeffnen = () => fireEvent.click(reiter(/Meine Kontakte/));

beforeEach(() => {
  rpc.mockReset();
  contactSelect.mockReset();
  auth = { user: { id: ICH } };
  rpc.mockResolvedValue({ data: [ANNA, BODO, CARLA], error: null });
  contactSelect.mockResolvedValue({ data: [], error: null });
});

describe("Beide Reiter stehen immer", () => {
  it("zeigt sie auch ohne einen einzigen Kontakt, mit Zaehler 0", async () => {
    renderDirectory();
    await screen.findByText("Anna Allgemein");

    expect(reiter(/Alle Mitglieder/)).toBeInTheDocument();
    await waitFor(() => expect(within(reiter(/Meine Kontakte/)).getByText("0")).toBeInTheDocument());
    expect(within(reiter(/Alle Mitglieder/)).getByText("3")).toBeInTheDocument();
  });

  /* Die Zahl steht `aria-hidden` NEBEN der Beschriftung, nicht darin. Stuende
     sie im zugaenglichen Namen, laese eine Vorleseausgabe „Meine Kontakte 2"
     als Bezeichnung eines Bedienelements vor — und dieser Name aenderte sich
     bei jeder angenommenen Anfrage. Dasselbe Muster wie in der
     Admin-Mitgliederliste. */
  it("haelt die Zahl aus dem zugaenglichen Namen heraus", async () => {
    contactSelect.mockResolvedValue({ data: [ausgehend(BODO.id)], error: null });
    renderDirectory();
    await screen.findByText("Anna Allgemein");

    await waitFor(() => expect(within(reiter(/Meine Kontakte/)).getByText("1")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Meine Kontakte" })).toBeInTheDocument();
  });
});

describe("Was unter „Meine Kontakte“ steht", () => {
  it("zeigt ein Gegenueber, dessen Anfrage angenommen wurde", async () => {
    contactSelect.mockResolvedValue({ data: [ausgehend(BODO.id)], error: null });
    renderDirectory();
    await screen.findByText("Anna Allgemein");
    kontakteOeffnen();

    expect(await screen.findByText("Bodo Kontakt")).toBeInTheDocument();
    expect(screen.queryByText("Anna Allgemein")).not.toBeInTheDocument();
  });

  it("zeigt es auch, wenn die Anfrage VOM Gegenueber ausging", async () => {
    contactSelect.mockResolvedValue({ data: [eingehend(CARLA.id)], error: null });
    renderDirectory();
    await screen.findByText("Anna Allgemein");
    kontakteOeffnen();

    expect(await screen.findByText("Carla Kontakt")).toBeInTheDocument();
  });

  /* Die RPC filtert bereits auf `status = accepted`. Diese Zusage prueft, dass
     die Flaeche nicht selbst noch etwas anderes hereinlaesst: die Antwort
     enthaelt genau die angenommenen, alles andere darf gar nicht erst
     ankommen — und die Nebenbedingung steht in der Abfrage, nicht im Client. */
  it("fragt ausdruecklich nur angenommene Anfragen ab, in beide Richtungen", async () => {
    renderDirectory();
    await screen.findByText("Anna Allgemein");

    await waitFor(() => expect(contactSelect).toHaveBeenCalled());
    expect(contactSelect).toHaveBeenCalledWith(
      "contact_requests",
      `from_id.eq.${ICH},to_id.eq.${ICH}`,
    );
  });

  it("zaehlt die dargestellten Karten, nicht die angenommenen Anfragen", async () => {
    // Zwei angenommene Kontakte, aber einer fehlt im Verzeichnisergebnis —
    // nicht oeffentlich, nicht aktiviert oder unter dem Rang. Beides ist
    // unabhaengig voneinander, die Kante ist real.
    contactSelect.mockResolvedValue({
      data: [ausgehend(BODO.id), ausgehend("nicht-im-verzeichnis")],
      error: null,
    });
    renderDirectory();
    await screen.findByText("Anna Allgemein");

    await waitFor(() => expect(within(reiter(/Meine Kontakte/)).getByText("1")).toBeInTheDocument());
    kontakteOeffnen();
    expect(await screen.findByText("Bodo Kontakt")).toBeInTheDocument();
  });
});

describe("Die fuenf Zustaende sind unterscheidbar", () => {
  it("zeigt waehrend des Ladens KEINEN Zaehler", async () => {
    // Beide Abfragen haengen: eine Null, die gleich zu einer Sieben wird, ist
    // eine falsche Aussage, kein Ladezustand.
    rpc.mockReturnValue(new Promise(() => {}));
    contactSelect.mockReturnValue(new Promise(() => {}));
    renderDirectory();

    expect(within(reiter(/Meine Kontakte/)).queryByText("0")).not.toBeInTheDocument();
    expect(within(reiter(/Alle Mitglieder/)).queryByText("0")).not.toBeInTheDocument();
  });

  it("meldet eine gescheiterte Kontaktabfrage als Fehler, nicht als „keine Kontakte“", async () => {
    contactSelect.mockResolvedValue({ data: null, error: { message: "kaputt" } });
    renderDirectory();
    await screen.findByText("Anna Allgemein");
    kontakteOeffnen();

    expect(await screen.findByText(/konnten nicht geladen werden/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kn.pf die erste Verbindung/i)).not.toBeInTheDocument();
    // Und kein Zaehler: eine Null nach einem Fehlschlag behauptet einen Bestand.
    expect(within(reiter(/Meine Kontakte/)).queryByText("0")).not.toBeInTheDocument();
  });

  it("laedt ohne Kontakte zur ersten Kontaktaufnahme ein", async () => {
    contactSelect.mockResolvedValue({ data: [], error: null });
    renderDirectory();
    await screen.findByText("Anna Allgemein");
    kontakteOeffnen();

    expect(await screen.findByText(/Kn.pf die erste Verbindung/i)).toBeInTheDocument();
  });

  it("gibt Kontakten ohne sichtbare Karte einen EIGENEN Hinweis", async () => {
    contactSelect.mockResolvedValue({ data: [ausgehend("nicht-im-verzeichnis")], error: null });
    renderDirectory();
    await screen.findByText("Anna Allgemein");
    kontakteOeffnen();

    // Das Mitglied HAT Kontakte. Es zur ersten Kontaktaufnahme aufzufordern
    // waere schlicht falsch.
    expect(await screen.findByText(/im Verzeichnis nicht sichtbar/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kn.pf die erste Verbindung/i)).not.toBeInTheDocument();
  });

  it("weist auf den Filter hin, wenn er alle Kontakte ausschliesst", async () => {
    contactSelect.mockResolvedValue({ data: [ausgehend(BODO.id)], error: null });
    renderDirectory();
    await screen.findByText("Anna Allgemein");
    kontakteOeffnen();
    await screen.findByText("Bodo Kontakt");

    // Der Filter trifft im Verzeichnis noch, im Reiter aber niemanden mehr.
    rpc.mockResolvedValue({ data: [ANNA], error: null });
    fireEvent.change(screen.getByPlaceholderText(/Suche nach Name/i), { target: { value: "Anna" } });

    expect(await screen.findByText(/passt keiner deiner Kontakte/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kn.pf die erste Verbindung/i)).not.toBeInTheDocument();
  });
});

describe("Filter und Identitaet", () => {
  it("laesst den Suchbegriff den Reiterwechsel ueberleben", async () => {
    contactSelect.mockResolvedValue({ data: [ausgehend(BODO.id)], error: null });
    renderDirectory();
    await screen.findByText("Anna Allgemein");

    const feld = screen.getByPlaceholderText(/Suche nach Name/i);
    rpc.mockResolvedValue({ data: [BODO], error: null });
    fireEvent.change(feld, { target: { value: "Bodo" } });
    await waitFor(() => expect(screen.queryByText("Anna Allgemein")).not.toBeInTheDocument());

    kontakteOeffnen();
    // Der Begriff steht noch im Feld — ein Wechsel aendert die Grundmenge, nicht
    // die Frage an sie.
    expect(feld).toHaveValue("Bodo");
    // … und BEIDE Zaehler zeigen die Zahl unter diesem Filter, sonst
    // widerspraeche der Zaehler seiner Liste.
    await waitFor(() => expect(within(reiter(/Alle Mitglieder/)).getByText("1")).toBeInTheDocument());
    expect(within(reiter(/Meine Kontakte/)).getByText("1")).toBeInTheDocument();
  });

  it("gibt dem zweiten Konto im selben Browser nicht die Kontakte des ersten", async () => {
    contactSelect.mockResolvedValue({ data: [ausgehend(BODO.id)], error: null });
    const { queryClient, rerender } = renderDirectory();
    await screen.findByText("Anna Allgemein");
    kontakteOeffnen();
    await screen.findByText("Bodo Kontakt");

    // Kontowechsel im SELBEN QueryClient — genau das, was der geteilte
    // Zwischenspeicher ueberlebt.
    auth = { user: { id: ANDERES_KONTO } };
    contactSelect.mockResolvedValue({ data: [], error: null });
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MemberDirectory />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Und ZWAR IM REITER: Bodo steht als gewoehnliches Mitglied weiterhin im
    // Verzeichnis. Ein `queryByText` ueber die ganze Seite waere hier gruen
    // gewesen, ohne die Kontaktmenge je geprueft zu haben — der Reiterwechsel
    // ist Teil der Zusage, nicht Beiwerk.
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Meine Kontakte" })).toBeInTheDocument(),
    );
    kontakteOeffnen();
    expect(await screen.findByText(/Kn.pf die erste Verbindung/i)).toBeInTheDocument();
    expect(screen.queryByText("Bodo Kontakt")).not.toBeInTheDocument();
  });

  /* Der Schluessel allein reicht nicht. Er sorgt dafuer, dass Konto B die Menge
     von Konto A nicht ZU SEHEN bekommt — sie laege danach aber weiter im
     Zwischenspeicher, RLS-gefiltert und einem beendeten Konto gehoerend. Die
     Anforderung verlangt beides: Kennung im Schluessel UND Verwerfen.

     Ohne diese Zusage waere die zweite Haelfte unbelegt: die Zusage darueber
     bleibt gruen, wenn man das `removeQueries` wieder herausnimmt. */
  it("verwirft die Kontaktmenge des vorigen Kontos aus dem Zwischenspeicher", async () => {
    contactSelect.mockResolvedValue({ data: [ausgehend(BODO.id)], error: null });
    const { queryClient, rerender } = renderDirectory();
    await screen.findByText("Anna Allgemein");
    await waitFor(() =>
      expect(queryClient.getQueryData(contactsQueryKey(ICH))).toEqual([BODO.id]),
    );

    auth = { user: { id: ANDERES_KONTO } };
    contactSelect.mockResolvedValue({ data: [], error: null });
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MemberDirectory />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(contactsQueryKey(ICH))).toBeUndefined(),
    );
  });

  /* Und der Reiter faellt beim Kontowechsel auf „Alle Mitglieder" zurueck.
     Sonst staende das neue Konto vor einem Reiter, dessen Inhalt es nicht
     gewaehlt hat und der im selben Atemzug neu geladen wird. */
  it("stellt beim Kontowechsel auf „Alle Mitglieder“ zurueck", async () => {
    contactSelect.mockResolvedValue({ data: [ausgehend(BODO.id)], error: null });
    const { queryClient, rerender } = renderDirectory();
    await screen.findByText("Anna Allgemein");
    kontakteOeffnen();
    await screen.findByText("Bodo Kontakt");

    auth = { user: { id: ANDERES_KONTO } };
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MemberDirectory />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Alle Mitglieder" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });
});
