import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HeaderSearch from "./HeaderSearch";
import type { DirectoryMember } from "../../lib/directory";

/**
 * Kopfzeilen-Suche (AGE-540).
 *
 * Gemockt sind genau zwei Ränder: die RPC-Grenze und der Auth-Kontext. Weder
 * die Komponente selbst noch `lib/directory` — sonst prüfte der Test seine
 * eigenen Mocks. Die interessanten Aussagen (wann wird abgefragt, mit welchem
 * Text, welcher Zustand erscheint) entstehen alle diesseits dieser zwei Ränder.
 */
const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

let auth: { user: { id: string } | null; levelRank: number | null; tierLoading: boolean } = {
  user: { id: "u-discover" },
  levelRank: 3,
  tierLoading: false,
};
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => auth,
}));

function member(name: string, overrides: Partial<DirectoryMember> = {}): DirectoryMember {
  return {
    id: `id-${name.toLowerCase().replace(/\s/g, "-")}`,
    name,
    avatar_url: null,
    region: null,
    company: "Beispiel GmbH",
    short_bio: null,
    branche: null,
    tier: "impact",
    roles: ["Gründerin"],
    competencies: null,
    has_offers: false,
    has_needs: false,
    offer_categories: [],
    need_categories: [],
    ...overrides,
  };
}

/** Zeigt die aktuelle Adresse an, damit Navigationen prüfbar sind. */
function Adresse() {
  const { pathname, search } = useLocation();
  return <span data-testid="adresse">{pathname + search}</span>;
}

/** Navigation von AUSSERHALB der Komponente — der Fall, den ihre eigenen
 *  Handler nicht abdecken: dort ruft sie `schliessen()` selbst. Nur hierüber
 *  lässt sich prüfen, ob sie auch bei fremder Navigation und beim ZURÜCK
 *  schließt. */
function Steuerung() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/events")}>
        woanders hin
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        zurück
      </button>
    </>
  );
}

function baum(queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        {/* Der Mount-Punkt steht hier, damit prüfbar bleibt, dass die
            Telefon-Fassung ihn per Portal VERLÄSST. Im Rahmen ist er
            `<header>` mit `backdrop-blur`, und der fing jedes `fixed`
            darunter ein. */}
        <div data-testid="mountpunkt">
          <HeaderSearch />
        </div>
        <Adresse />
        <Steuerung />
        <Routes>
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderSuche() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ergebnis = render(baum(queryClient));
  return {
    ...ergebnis,
    queryClient,
    /** Neu rendern, nachdem `auth` umgestellt wurde — SELBER QueryClient. */
    nochmal: () => ergebnis.rerender(baum(queryClient)),
  };
}

function feld(): HTMLInputElement {
  return screen.getByRole("combobox", { name: /suche/i }) as HTMLInputElement;
}
function tippe(text: string) {
  fireEvent.change(feld(), { target: { value: text } });
}
function adresse(): string {
  return screen.getByTestId("adresse").textContent ?? "";
}
/** Nur die Aufrufe, die wirklich eine Suche waren (mit Argumenten). */
function suchbegriffe(): unknown[] {
  return rpc.mock.calls.map((c) => (c[1] as Record<string, unknown> | undefined)?.p_query);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  auth = { user: { id: "u-discover" }, levelRank: 3, tierLoading: false };
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [member("Anna Beispiel")], error: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/** Entprellzeit überspringen. */
async function entprellen() {
  await act(async () => {
    vi.advanceTimersByTime(350);
  });
}

describe("Suchen und Entprellung", () => {
  it("fragt bei einem einzelnen Zeichen nicht ab", async () => {
    renderSuche();
    tippe("a");
    await entprellen();

    expect(rpc).not.toHaveBeenCalled();
  });

  it("fragt auch dann nicht ab, wenn zwei Zeichen getrimmt eines ergeben", async () => {
    renderSuche();
    tippe("a ");
    await entprellen();

    expect(rpc).not.toHaveBeenCalled();
  });

  it("fragt ab zwei Zeichen genau einmal ab", async () => {
    renderSuche();
    tippe("an");
    await entprellen();

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(suchbegriffe()).toEqual(["an"]);
  });

  it("löst schnelles Tippen in EINE Abfrage mit dem letzten Text auf", async () => {
    renderSuche();
    tippe("an");
    tippe("ann");
    tippe("anna");
    await entprellen();

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(suchbegriffe()).toEqual(["anna"]);
  });

  it("zeigt höchstens fünf Treffer", async () => {
    rpc.mockResolvedValue({
      data: ["A", "B", "C", "D", "E", "F", "G"].map((n) => member(`Person ${n}`)),
      error: null,
    });
    renderSuche();
    tippe("person");
    await entprellen();

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(5));
  });
});

describe("Veraltete Treffer und Hervorhebung", () => {
  it("verbirgt beim Weitertippen die Treffer des vorigen Begriffs", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    await waitFor(() => expect(screen.getByRole("option", { name: /Anna/ })).toBeInTheDocument());

    // Noch innerhalb der Entprellzeit: der alte Treffer darf nicht stehen bleiben,
    // sonst öffnet Enter ein Mitglied, das zur Eingabe nicht mehr passt.
    tippe("annab");

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("öffnet mit Enter nach dem Weitertippen NICHT den alten Treffer", async () => {
    // Der Fall, den die vorige Zeile NICHT prüft: Enter wirkt auch bei
    // geschlossener Liste, und `aktiv` zeigt weiter auf einen Index. Bliebe die
    // Trefferliste stehen, öffnete Enter „Anna" — obwohl „annab" im Feld steht.
    // Gefunden, indem der Schutz probeweise entfernt wurde und dieser Test
    // vorher als Einziger nichts gemerkt hat.
    renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    fireEvent.keyDown(feld(), { key: "ArrowDown" });
    tippe("annab");
    fireEvent.keyDown(feld(), { key: "Enter" });

    await waitFor(() => expect(adresse()).toBe("/mitglieder?q=annab"));
    expect(adresse()).not.toContain("/p/");
  });

  it("leert die Liste sofort, sobald der Text unter zwei Zeichen fällt", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    await waitFor(() => expect(screen.getByRole("option", { name: /Anna/ })).toBeInTheDocument());

    tippe("a");

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("hebt nach einem Wechsel des Begriffs keinen Treffer mehr hervor", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    await waitFor(() => expect(screen.getByRole("option", { name: /Anna/ })).toBeInTheDocument());

    fireEvent.keyDown(feld(), { key: "ArrowDown" });
    expect(feld()).toHaveAttribute("aria-activedescendant");

    rpc.mockResolvedValue({ data: [member("Bertha Beispiel")], error: null });
    tippe("bertha");
    await entprellen();
    await waitFor(() => expect(screen.getByRole("option", { name: /Bertha/ })).toBeInTheDocument());

    expect(feld()).not.toHaveAttribute("aria-activedescendant");
  });
});

describe("Die fünf Zustände", () => {
  it("zeigt Treffer mit Name und Einordnung", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();

    const option = await screen.findByRole("option", { name: /Anna Beispiel/ });
    expect(option).toHaveTextContent("Anna Beispiel");
    expect(option).toHaveTextContent("Beispiel GmbH");
  });

  it("zeigt bei einem Fehler weder „nichts gefunden“ noch den Aufstiegs-Hinweis", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom", code: "42501" } });
    renderSuche();
    tippe("anna");
    await entprellen();

    expect(await screen.findByText(/Suche nicht möglich/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kein Mitglied gefunden/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Discover/i)).not.toBeInTheDocument();
  });

  it("nennt bei einem echten Nulltreffer den Weg ins Verzeichnis", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    renderSuche();
    tippe("anna");
    await entprellen();

    expect(await screen.findByText(/Kein Mitglied gefunden/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verzeichnis/i })).toBeInTheDocument();
  });

  it("zeigt unterhalb discover bei leerer Antwort den Aufstiegs-Hinweis", async () => {
    auth = { user: { id: "u-basic" }, levelRank: 1, tierLoading: false };
    rpc.mockResolvedValue({ data: [], error: null });
    renderSuche();
    tippe("anna");
    await entprellen();

    expect(await screen.findByText(/Discover/)).toBeInTheDocument();
    expect(screen.queryByText(/Kein Mitglied gefunden/i)).not.toBeInTheDocument();
  });

  it("zeigt unterhalb discover die eigene Zeile trotzdem an", async () => {
    // Der Rang formuliert NUR den leeren Fall. Blendete er Treffer aus, wäre er
    // eine zweite Zugriffskontrolle im Frontend — Kulisse vor einem echten Gate.
    auth = { user: { id: "u-basic" }, levelRank: 1, tierLoading: false };
    rpc.mockResolvedValue({ data: [member("Ich Selbst")], error: null });
    renderSuche();
    tippe("ich");
    await entprellen();

    expect(await screen.findByRole("option", { name: /Ich Selbst/ })).toBeInTheDocument();
    expect(screen.queryByText(/Discover/)).not.toBeInTheDocument();
  });

  it("rendert ausgeloggt gar nichts", () => {
    auth = { user: null, levelRank: null, tierLoading: false };
    const { container } = renderSuche();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
  });
});

describe("Tastatur und Navigation", () => {
  it("öffnet mit Pfeil-ab und Enter das Profil des Treffers", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    fireEvent.keyDown(feld(), { key: "ArrowDown" });
    fireEvent.keyDown(feld(), { key: "Enter" });

    await waitFor(() => expect(adresse()).toBe("/p/id-anna-beispiel"));
  });

  it("wandert mit Pfeil-auf wieder zurück", async () => {
    rpc.mockResolvedValue({ data: [member("Anna A"), member("Berta B")], error: null });
    renderSuche();
    tippe("be");
    await entprellen();
    await screen.findByRole("option", { name: /Anna A/ });

    fireEvent.keyDown(feld(), { key: "ArrowDown" });
    fireEvent.keyDown(feld(), { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /Berta B/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(feld(), { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: /Anna A/ })).toHaveAttribute("aria-selected", "true");
  });

  it("schließt mit Escape und lässt den Fokus im Feld", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    fireEvent.keyDown(feld(), { key: "Escape" });

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(feld());
  });

  it("führt Enter ohne Hervorhebung ins Verzeichnis, mit Begriff", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    fireEvent.keyDown(feld(), { key: "Enter" });

    await waitFor(() => expect(adresse()).toBe("/mitglieder?q=anna"));
  });

  it("führt Enter unterhalb discover auf die Aufstiegsseite", async () => {
    // `/mitglieder` liegt hinter MembershipGate min="discover" — MemberDirectory
    // mountet dort nie, der Begriff verschwände hinter einer Wand.
    auth = { user: { id: "u-basic" }, levelRank: 1, tierLoading: false };
    renderSuche();
    tippe("anna");
    await entprellen();

    fireEvent.keyDown(feld(), { key: "Enter" });

    await waitFor(() => expect(adresse()).toBe("/mitgliedschaft"));
  });

  it("schließt die Liste nach der Auswahl eines Treffers", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    const option = await screen.findByRole("option", { name: /Anna/ });

    fireEvent.click(option);

    await waitFor(() => expect(adresse()).toBe("/p/id-anna-beispiel"));
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("schließt die Liste bei einem Klick nach außen", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByRole("option")).not.toBeInTheDocument());
  });

  it("zeichnet Feld und Liste als zusammengehörige Auswahl aus", async () => {
    renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    const liste = screen.getByRole("listbox");
    expect(feld()).toHaveAttribute("aria-expanded", "true");
    expect(feld()).toHaveAttribute("aria-controls", liste.id);

    fireEvent.keyDown(feld(), { key: "ArrowDown" });
    expect(feld().getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: /Anna/ }).id,
    );
  });
});

describe("Identität und Zwischenspeicher", () => {
  it("zeigt einem zweiten Konto nicht die Treffer des ersten", async () => {
    // Der Grund, warum der Schlüssel die Kontenkennung trägt: die Treffer sind
    // RLS-gefiltert. Ohne sie bekäme ein `basic`-Konto die Treffer eines
    // `discover`-Kontos aus dem Zwischenspeicher gezeigt, bevor überhaupt eine
    // eigene Abfrage läuft.
    const { nochmal } = renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna Beispiel/ });

    auth = { user: { id: "u-basic" }, levelRank: 1, tierLoading: false };
    rpc.mockResolvedValue({ data: [], error: null });
    act(() => nochmal());

    // Das zweite Konto tippt dasselbe Wort.
    tippe("anna");
    await entprellen();

    await waitFor(() => expect(screen.getByText(/Discover/)).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: /Anna Beispiel/ })).not.toBeInTheDocument();
  });

  it("verwirft beim Abmelden Eingabe und Ergebnisse", async () => {
    const { nochmal, queryClient } = renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna Beispiel/ });

    auth = { user: null, levelRank: null, tierLoading: false };
    act(() => nochmal());

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // Nicht „kein Eintrag": `useQuery` legt auch deaktiviert einen leeren
    // Eintrag unter seinem Schlüssel an, und darauf zu prüfen wäre eine Aussage
    // über React Query statt über die Daten. Entscheidend ist, dass keine ZEILE
    // des beendeten Kontos übrig ist.
    const uebrig = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["directory", "header-search"] })
      .filter((q) => q.state.data !== undefined);
    expect(uebrig).toHaveLength(0);
  });

  it("legt gekürzte Treffer nie unter dem Schlüssel des vollen Verzeichnisses ab", async () => {
    // Ein auf fünf gekürztes Ergebnis unter `directoryQueryKey` vergiftete den
    // Zwischenspeicher der Verzeichnisseite, die dort die vollständige Liste
    // erwartet.
    const { queryClient } = renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna Beispiel/ });

    const schluessel = queryClient
      .getQueryCache()
      .findAll()
      .map((q) => q.queryKey as unknown[]);
    expect(schluessel.some((k) => k[0] === "directory" && k[1] === "header-search")).toBe(true);
    expect(schluessel.some((k) => k[0] === "directory" && k[1] === "search")).toBe(false);
  });
});

describe("Telefon-Fassung", () => {
  function lupe() {
    return screen.getByRole("button", { name: "Suche öffnen" });
  }

  it("öffnet mit dem Lupensymbol eine beschreibbare Suche mit Fokus", async () => {
    renderSuche();
    fireEvent.click(lupe());

    expect(document.activeElement).toBe(feld());

    tippe("anna");
    await entprellen();
    expect(await screen.findByRole("option", { name: /Anna Beispiel/ })).toBeInTheDocument();
  });

  it("legt nie zwei Suchfelder gleichzeitig ins Dokument", () => {
    // Zwei Comboboxen mit denselben Kennungen wären für Hilfstechnik zwei
    // Bedienelemente — CSS verbirgt eines, das Dokument kennt beide.
    renderSuche();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);

    fireEvent.click(lupe());
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("schließt beim Verbreitern über die Umbruchbreite", async () => {
    // Ohne das verbirgt CSS die Fassung, während die Scroll-Sperre stehen
    // bleibt: eine Seite, die sich nicht scrollen lässt und kein sichtbares
    // Overlay hat.
    renderSuche();
    fireEvent.click(lupe());
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();

    act(() => {
      window.innerWidth = 900;
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Abbrechen" })).not.toBeInTheDocument(),
    );
    expect(document.body.style.position).not.toBe("fixed");
  });

  it("gibt beim Abbrechen den Fokus an das Lupensymbol zurück", () => {
    renderSuche();
    fireEvent.click(lupe());

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByRole("button", { name: "Abbrechen" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(lupe());
  });

  it("schließt mit Escape erst die Liste, dann die Fassung", async () => {
    renderSuche();
    fireEvent.click(lupe());
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    fireEvent.keyDown(feld(), { key: "Escape" });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();

    fireEvent.keyDown(feld(), { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Abbrechen" })).not.toBeInTheDocument();
  });
});

/**
 * Die Befunde des Code-Reviews (Schritt 4). Jeder dieser Fälle war vorher grün,
 * weil ihn niemand geprüft hat — nicht, weil er funktionierte. Sie stehen
 * zusammen, damit erkennbar bleibt, wogegen sie schützen.
 */
describe("Befunde des Code-Reviews", () => {
  function lupe() {
    return screen.getByRole("button", { name: "Suche öffnen" });
  }

  it("schließt die Telefon-Fassung beim ZURÜCK — und gibt die Scroll-Sperre frei", async () => {
    // Der Zustand hing am `location.key`. Der schließt beim Vorwärtsgehen
    // richtig — und öffnet beim Zurückgehen wieder, weil React Router den
    // Schlüssel eines Eintrags bei POP wiederherstellt. Ein Modal, das sich
    // selbst wieder öffnet und die Seite erneut festhält.
    // Geprüft wird über „Abbrechen", nicht über `role="dialog"`: so läuft
    // dieser Test auch gegen die Fassung VOR der Behebung und zeigt dort den
    // echten Fehler, statt an einem fehlenden Attribut zu scheitern.
    const fassungDa = () => screen.queryByRole("button", { name: "Abbrechen" });

    renderSuche();
    fireEvent.click(lupe());
    expect(fassungDa()).toBeInTheDocument();
    expect(document.body.style.position).toBe("fixed");

    fireEvent.click(screen.getByRole("button", { name: "woanders hin" }));
    await waitFor(() => expect(adresse()).toBe("/events"));
    expect(fassungDa()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "zurück" }));

    await waitFor(() => expect(adresse()).toBe("/"));
    expect(fassungDa()).not.toBeInTheDocument();
    expect(document.body.style.position).not.toBe("fixed");
  });

  it("schließt die Trefferliste bei fremder Navigation", async () => {
    // Bisher deckten das nur die eigenen Handler ab, und die rufen `schliessen()`
    // selbst — die Eigenschaft „schließt bei JEDEM Routenwechsel" war damit
    // ungeprüft.
    renderSuche();
    tippe("anna");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    fireEvent.click(screen.getByRole("button", { name: "woanders hin" }));

    await waitFor(() => expect(screen.queryByRole("option")).not.toBeInTheDocument());
  });

  it("hängt die Telefon-Fassung NEBEN ihren Mount-Punkt, nicht hinein", () => {
    // Im Rahmen steht die Komponente in `<header>`, und der trägt
    // `backdrop-blur`. Ein nicht-`none` `backdrop-filter` macht das Element zum
    // Bezugsrahmen für `fixed` Nachkommen — gemessen war der Schleier 375×64
    // statt 375×812. jsdom rechnet kein Layout und kann das nie sehen; prüfbar
    // ist der MECHANISMUS der Behebung: die Fassung verlässt den Teilbaum.
    renderSuche();
    fireEvent.click(lupe());

    const fassung = screen.getByRole("dialog");
    expect(fassung).toBeInTheDocument();
    expect(screen.getByTestId("mountpunkt").contains(fassung)).toBe(false);
    expect(document.body.contains(fassung)).toBe(true);
  });

  it("nennt die Telefon-Fassung einen Dialog", () => {
    // `useOverlay` sperrt Scrollen und fängt Tab. Ohne `role`/`aria-modal`
    // bekäme Hilfstechnik die Falle ohne die Ansage.
    renderSuche();
    fireEvent.click(lupe());

    const fassung = screen.getByRole("dialog", { name: "Mitglieder suchen" });
    expect(fassung).toHaveAttribute("aria-modal", "true");
  });

  it("zeigt bei UNBEKANNTER Stufe keinen Aufstiegs-Hinweis und führt ins Verzeichnis", async () => {
    // `levelRank` ist `null`, solange das Profil lädt — und dauerhaft, wenn es
    // nicht geladen werden konnte. `(levelRank ?? 0)` machte aus beidem
    // „unterhalb discover": ein `impact`-Mitglied mit gescheitertem Profilabruf
    // bekam den Aufstiegs-Hinweis und landete auf `/mitgliedschaft`. Ein
    // Anmeldefehler, verkleidet als Verkaufsargument.
    auth = { user: { id: "u-lädt" }, levelRank: null, tierLoading: true };
    rpc.mockResolvedValue({ data: [], error: null });
    renderSuche();
    tippe("anna");
    await entprellen();

    await waitFor(() => expect(screen.getByText(/kein mitglied gefunden/i)).toBeInTheDocument());
    expect(screen.queryByText(/ab discover verfügbar/i)).not.toBeInTheDocument();

    fireEvent.keyDown(feld(), { key: "Enter" });

    expect(adresse()).toBe("/mitglieder?q=anna");
  });

  it("kündigt nur dann eine Liste an, wenn es sie gibt", async () => {
    // `aria-expanded`/`aria-controls` hingen am Offen-Zustand. In den drei
    // Zuständen ohne Listbox (Fehler, Laden, leer) zeigte `aria-controls` auf
    // eine Kennung, die im Dokument nicht existiert.
    rpc.mockResolvedValue({ data: [], error: null });
    renderSuche();
    tippe("anna");
    await entprellen();
    await waitFor(() => expect(screen.getByText(/kein mitglied gefunden/i)).toBeInTheDocument());

    expect(feld()).toHaveAttribute("aria-expanded", "false");
    expect(feld()).not.toHaveAttribute("aria-controls");

    rpc.mockResolvedValue({ data: [member("Anna Beispiel")], error: null });
    tippe("annab");
    await entprellen();
    await screen.findByRole("option", { name: /Anna/ });

    const listenId = screen.getByRole("listbox").id;
    expect(feld()).toHaveAttribute("aria-expanded", "true");
    expect(feld()).toHaveAttribute("aria-controls", listenId);
  });

  it("zeigt ausgeloggt auch KEIN Lupensymbol", () => {
    // Der bestehende Test prüfte nur Combobox und `input` — das Lupensymbol,
    // der einzige Einstieg auf dem Telefon, war von der Zusicherung nicht
    // erfasst.
    auth = { user: null, levelRank: null, tierLoading: false };
    renderSuche();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suche öffnen" })).not.toBeInTheDocument();
  });
});
