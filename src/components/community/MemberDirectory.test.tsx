import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemberDirectory from "./MemberDirectory";
import type { DirectoryMember } from "../../lib/directory";
import { bildUrl } from "../../lib/bild-url";

/**
 * Kompass-Filter über der Mitgliederliste (AGE-494).
 *
 * Gemockt wird ausschließlich die RPC-GRENZE (`supabase.rpc`) — nicht die
 * Filterlogik und nicht die Komponente selbst. Sonst prüfte der Test seine
 * eigenen Mocks: die interessante Aussage ist, WELCHE Argumente die Auswahl
 * erzeugt, und die entsteht in `filtersToArgs` und im Klick-Handler.
 */
const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    // `bildUrl` löst den Bucket-Pfad hierüber auf. Ohne diesen Zweig wäre
    // `supabase.storage` undefined und die Karte stürzte ab — der Mock bildet
    // die Grenze nach, nicht das Verhalten der Karte.
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (pfad: string) => ({
          data: { publicUrl: `https://test.local/storage/v1/object/public/${bucket}/${pfad}` },
        }),
      }),
    },
  },
}));


/* AGE-595: `MemberDirectory` liest seit den Reitern die eigene Kennung, um
   die Kontaktmenge zu laden. Ohne diesen Mock wirft `useAuth` „muss innerhalb
   von <AuthProvider> verwendet werden" — die Datei praefte dann gar nichts
   mehr. Ein Konto mit Kennung und ohne Kontakte ist hier der neutrale Fall. */
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => ({ user: { id: "00000000-0000-0000-0000-0000000000aa" } }),
}));

function member(overrides: Partial<DirectoryMember> = {}): DirectoryMember {
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
    has_offers: true,
    has_needs: true,
    offer_categories: ["kapital"],
    need_categories: ["experten"],
    ...overrides,
  };
}

function renderDirectory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MemberDirectory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Die Filter liegen seit AGE-566 hinter „Erweiterte Suche" — Chips und
 *  Auswahlfelder sind erst danach im DOM. */
function erweiterteSucheOeffnen() {
  fireEvent.click(screen.getByRole("button", { name: "Erweiterte Suche" }));
}

/** Die zuletzt an `search_directory` übergebenen Argumente. */
function lastArgs(): Record<string, unknown> {
  const call = rpc.mock.calls.at(-1);
  return (call?.[1] ?? {}) as Record<string, unknown>;
}

/**
 * Nur die Aufrufe der TREFFERSUCHE, ohne die Facetten-Baseline.
 *
 * Beide gehen an dieselbe RPC, und sie einfach zu zählen wäre der Fehler:
 * `fetchDirectoryBaseline` ruft `search_directory` **absichtlich ungefiltert**
 * auf, um stabile Dropdown-Optionen zu bekommen. Ein Test, der „keine
 * ungefilterte Abfrage" wörtlich prüft, wäre also dauerhaft rot, ohne dass
 * etwas kaputt ist.
 *
 * Unterscheidbar sind sie an der FORM der Argumente: die Baseline übergibt `{}`,
 * `filtersToArgs` übergibt immer alle acht Schlüssel (teils mit `undefined`).
 */
function trefferAufrufe(): Record<string, unknown>[] {
  return rpc.mock.calls
    .map((c) => (c[1] ?? {}) as Record<string, unknown>)
    .filter((a) => Object.keys(a).length > 0);
}

/**
 * Griff auf `navigate` aus dem Test heraus. Die Übernahme des Suchbegriffs muss
 * am NAVIGATIONSEREIGNIS hängen, nicht am bloßen Wert — das lässt sich nur
 * prüfen, wenn der Test wirklich navigiert, statt die Adresse vorzubelegen.
 */
let navigiere: ((to: string | number) => void) | null = null;
function NavigationsGriff() {
  const n = useNavigate();
  // Zuweisung im Effekt, nicht beim Rendern: eine Variable von außen während
  // des Renderns zu beschreiben ist ein Seiteneffekt im Renderpfad.
  useEffect(() => {
    navigiere = n as (to: string | number) => void;
  }, [n]);
  return null;
}

/** Macht die Adresse prüfbar — gebraucht für das Zurücksetzen. */
function Adresse() {
  const { pathname, search } = useLocation();
  return <span data-testid="adresse">{pathname + search}</span>;
}
function adresse(): string {
  return screen.getByTestId("adresse").textContent ?? "";
}

function renderDirectoryAt(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <NavigationsGriff />
        <Adresse />
        <MemberDirectory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function suchfeld(): HTMLInputElement {
  return screen.getByLabelText("Volltextsuche im Verzeichnis") as HTMLInputElement;
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [member()], error: null });
});
afterEach(() => vi.clearAllMocks());

describe("Kompass-Filter (AGE-494)", () => {
  it("schickt ohne Auswahl keine Kategorie-Argumente", async () => {
    renderDirectory();
    erweiterteSucheOeffnen();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    expect(lastArgs().p_offers).toBeUndefined();
    expect(lastArgs().p_needs).toBeUndefined();
  });

  it("sammelt mehrere Chips einer Gruppe in EIN Argument (ODER-Verknüpfung)", async () => {
    renderDirectory();
    erweiterteSucheOeffnen();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Kapital & Beteiligungen" }));
    fireEvent.click(screen.getByRole("button", { name: "Mentoring & Sparring" }));

    await waitFor(() => expect(lastArgs().p_offers).toEqual(["kapital", "mentoring"]));
    // Die andere Gruppe bleibt unberührt — sonst wäre aus ODER ein UND geworden.
    expect(lastArgs().p_needs).toBeUndefined();
  });

  it("führt beide Gruppen getrennt (UND zwischen ihnen)", async () => {
    renderDirectory();
    erweiterteSucheOeffnen();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Kapital & Beteiligungen" }));
    fireEvent.click(screen.getByRole("button", { name: "Experten & Berater" }));

    await waitFor(() => {
      expect(lastArgs().p_offers).toEqual(["kapital"]);
      expect(lastArgs().p_needs).toEqual(["experten"]);
    });
  });

  it("nimmt einen abgewählten Chip wieder aus dem Argument", async () => {
    renderDirectory();
    erweiterteSucheOeffnen();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    const chip = screen.getByRole("button", { name: "Kapital & Beteiligungen" });
    fireEvent.click(chip);
    await waitFor(() => expect(lastArgs().p_offers).toEqual(["kapital"]));

    fireEvent.click(chip);
    // Leere Auswahl heißt KEIN Filter — nicht „leeres Array".
    await waitFor(() => expect(lastArgs().p_offers).toBeUndefined());
  });

  it("räumt mit „Filter zurücksetzen“ auch die Chips ab", async () => {
    renderDirectory();
    erweiterteSucheOeffnen();
    await waitFor(() => expect(rpc).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Kapital & Beteiligungen" }));
    await waitFor(() => expect(lastArgs().p_offers).toEqual(["kapital"]));

    fireEvent.click(screen.getByRole("button", { name: "Filter zurücksetzen" }));
    await waitFor(() => expect(lastArgs().p_offers).toBeUndefined());
    expect(screen.getByRole("button", { name: "Kapital & Beteiligungen" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  /* AGE-595 dreht AGE-494 an DIESER Stelle um — und nur hier. Der Grund ist
     Menge, nicht Richtigkeit: ein gepflegter Kompass trug zehn Marken, die
     Karte wurde doppelt so hoch wie ihre Nachbarn, und im Raster liest sich
     das als Unordnung. Filter und Profil behalten die Kategorien. */
  it("zeigt auf der Karte KEINE Kompass-Marken mehr", async () => {
    renderDirectory();
    erweiterteSucheOeffnen();

    const karte = within(await screen.findByRole("link", { name: /Anna Beispiel/ }));
    expect(karte.queryByText("Bietet: Kapital")).not.toBeInTheDocument();
    expect(karte.queryByText("Sucht: Experten")).not.toBeInTheDocument();
    expect(karte.queryByText(/^Bietet: /)).not.toBeInTheDocument();
    expect(karte.queryByText(/^Sucht: /)).not.toBeInTheDocument();
  });

  /* Die Kategorien sollen NUR aus der Karte verschwinden. Ohne diese Zusage
     wäre „alle Marken weg" auch von einem Diff erfüllt, der den Filter mit
     abräumt — und der Filter ist der Ort, an dem sie eine Frage beantworten. */
  it("… behält sie aber im Filter über der Liste", async () => {
    renderDirectory();
    erweiterteSucheOeffnen();

    expect(
      await screen.findByRole("button", { name: "Kapital & Beteiligungen" }),
    ).toBeInTheDocument();
  });

  it("zeigt die Branche weiterhin", async () => {
    rpc.mockResolvedValue({ data: [member({ branche: "Beratung" })], error: null });
    renderDirectory();
    erweiterteSucheOeffnen();

    const karte = within(await screen.findByRole("link", { name: /Anna Beispiel/ }));
    expect(karte.getByText("Beratung")).toBeInTheDocument();
  });

  /* AGE-494, Deploy-Fenster: Das Frontend geht bei einem Merge automatisch live,
     die Migration erreicht Prod nur per manuellem `supabase db push`. Dazwischen
     antwortet die ALTE RPC — ohne `offer_categories`/`need_categories`. Die
     Mitgliederseite darf daran nicht zerbrechen; sie zeigt dann eben die
     pauschalen Marken. (Genau dieser Fall hat lokal die Seite weiß gemacht.) */
  it("überlebt eine Antwort der alten RPC ohne Kategorie-Felder", async () => {
    const alteAntwort = member();
    delete (alteAntwort as Partial<DirectoryMember>).offer_categories;
    delete (alteAntwort as Partial<DirectoryMember>).need_categories;
    rpc.mockResolvedValue({ data: [alteAntwort], error: null });

    renderDirectory();
    erweiterteSucheOeffnen();

    expect(await screen.findByText("Anna Beispiel")).toBeInTheDocument();
    // Seit AGE-595 trägt die Karte gar keine Marken mehr, also ist die Zusage
    // nicht mehr „sie fällt auf die pauschale Marke zurück", sondern die
    // eigentliche: die Seite wird nicht weiß. Das Deploy-Fenster gilt jetzt
    // zusätzlich für `cover_url` — die alte Signatur liefert das Feld nicht.
    const karte = within(screen.getByRole("link", { name: /Anna Beispiel/ }));
    expect(karte.queryByText("Bietet")).not.toBeInTheDocument();
    expect(karte.queryByText("Sucht")).not.toBeInTheDocument();
  });

  it("überlebt eine Antwort der alten RPC ohne cover_url", async () => {
    const alteAntwort = member();
    delete (alteAntwort as Partial<DirectoryMember>).cover_url;
    rpc.mockResolvedValue({ data: [alteAntwort], error: null });

    renderDirectory();
    erweiterteSucheOeffnen();

    const karte = within(await screen.findByRole("link", { name: /Anna Beispiel/ }));
    expect(karte.queryByRole("presentation")).not.toBeInTheDocument();
    expect(screen.getByText("Anna Beispiel")).toBeInTheDocument();
  });

  /* Altbestand: eine offers-Zeile ohne `category` setzt `has_offers`, taucht aber
     in keinem Array auf. Bis AGE-595 fiel die Karte dafür auf eine NACKTE Marke
     „Bietet" zurück. Auch die fällt weg — sie war der Zweig, der auf dem
     Screenshot als einzelnes, zusammenhangloses Wort stand. */
  it("erzeugt für kategorielose Einträge auch keine nackte Marke", async () => {
    rpc.mockResolvedValue({
      data: [member({ offer_categories: [], need_categories: [], has_needs: false })],
      error: null,
    });
    renderDirectory();
    erweiterteSucheOeffnen();

    const karte = within(await screen.findByRole("link", { name: /Anna Beispiel/ }));
    expect(karte.queryByText("Bietet")).not.toBeInTheDocument();
    expect(karte.queryByText(/^Bietet: /)).not.toBeInTheDocument();
  });

  /* ── Das Cover auf der Karte (AGE-595) ──────────────────────────────────
     Die Zusagen sind ausdrücklich STRUKTURELL, wie bei `EventCover`: jsdom
     rechnet kein Layout, also belegt hier NICHTS eine gemessene Höhe. Was sie
     belegen, ist der Vertrag, aus dem die Höhe folgt — ein 3:1-Feld, das auch
     ohne Bild im Baum steht, und ein eingepasstes statt beschnittenes Bild.
     Die Höhe selbst gehört in die Sichtprobe im Browser. */
  const COVER_PFAD = "b1000000-0000-0000-0000-000000000005/1699999999.webp";
  const bildfeld = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-testid="karten-cover"]');

  it("zeigt das Cover über den Bild-Auflöser, nicht als rohen Pfad", async () => {
    rpc.mockResolvedValue({ data: [member({ cover_url: COVER_PFAD })], error: null });
    const { container } = renderDirectory();
    erweiterteSucheOeffnen();
    await screen.findByText("Anna Beispiel");

    const img = bildfeld(container)?.querySelector("img");
    expect(img).not.toBeNull();
    // Der springende Punkt: `cover_url` trägt seit AGE-580 einen PFAD. Wer ihn
    // direkt in `src` schreibt, rendert tote Bilder — und ein Fixture mit
    // `https://…` wäre dabei grün. Deshalb beides: aufgelöst wie der echte
    // Auflöser es tut, UND nachweislich nicht der rohe Wert.
    expect(img?.getAttribute("src")).toBe(bildUrl("covers", COVER_PFAD));
    expect(img?.getAttribute("src")).not.toBe(COVER_PFAD);
  });

  it("passt das Bild ein, statt es zu beschneiden", async () => {
    rpc.mockResolvedValue({ data: [member({ cover_url: COVER_PFAD })], error: null });
    const { container } = renderDirectory();
    erweiterteSucheOeffnen();
    await screen.findByText("Anna Beispiel");

    const feld = bildfeld(container);
    expect(feld?.className).toMatch(/aspect-\[3\/1\]/);
    const img = feld?.querySelector("img");
    expect(img?.className).toMatch(/object-contain/);
    expect(img?.className).not.toMatch(/object-cover/);
  });

  /* Der Kommentar an der Karte behauptet „randlos über der Karte". Diese Zusage
     prüft, dass er WAHR ist — und sie fehlte: die Sichtprobe hat Höhe und
     Verhältnis gemessen und dabei übersehen, dass das Feld 25 px eingerückt
     stand.

     Der Grund ist `cn()`: ein reiner Join ohne tailwind-merge. Ein `p-0` in der
     `className` LÖSCHT das `p-6` nicht, das `Card` unter `padded` (Vorgabe
     `true`) selbst setzt — beide stehen im Attribut, und bei gleicher
     Spezifität entscheidet die Reihenfolge im Stylesheet, nicht die im
     Attribut. Der Weg ist `padded={false}`, die eigene API der Komponente.

     jsdom rechnet kein Layout, also prüft die Zusage den Klassenvertrag; die
     Breite selbst gehört in die Sichtprobe. */
  it("lässt das Cover randlos sitzen — keine geerbte Kartenpolsterung", async () => {
    rpc.mockResolvedValue({ data: [member({ cover_url: COVER_PFAD })], error: null });
    const { container } = renderDirectory();
    erweiterteSucheOeffnen();
    await screen.findByText("Anna Beispiel");

    const karte = container.querySelector<HTMLElement>(".fbc-card");
    expect(karte?.className).not.toMatch(/\bp-6\b/);
  });

  it("behält das Bildfeld auch ohne Cover — sonst franst das Raster aus", async () => {
    rpc.mockResolvedValue({ data: [member({ cover_url: null })], error: null });
    const { container } = renderDirectory();
    erweiterteSucheOeffnen();
    await screen.findByText("Anna Beispiel");

    const feld = bildfeld(container);
    // Das Feld steht da, in derselben Bauart — nur ohne Bild darin. Genau das
    // hält zwei Karten nebeneinander auf gleicher Höhe.
    expect(feld).not.toBeNull();
    expect(feld?.className).toMatch(/aspect-\[3\/1\]/);
    expect(feld?.querySelector("img")).toBeNull();
  });
});

/**
 * Übergabe des Suchbegriffs aus der Kopfzeile (AGE-540).
 *
 * Die Kopfzeile ist der EINZIGE Schreiber des Parameters; das Verzeichnis liest
 * ihn und schreibt beim Tippen nicht zurück. Geprüft wird deshalb nicht, dass
 * ein vorbelegter Parameter ankommt (das wäre vorher wie nachher grün), sondern
 * die drei Fälle, in denen es schiefgeht.
 */
describe("Suchbegriff aus der Adresszeile (AGE-540)", () => {
  it("läuft beim Aufbau mit Parameter nie mit leerer Suche los", async () => {
    // Der Befund aus dem Plan-Review: holt ein Effekt den Parameter erst NACH
    // dem ersten Rendern nach, läuft dazwischen eine Trefferabfrage über das
    // GANZE Verzeichnis — sie blitzt auf und landet im Zwischenspeicher.
    renderDirectoryAt("/mitglieder?q=anna");
    await waitFor(() => expect(trefferAufrufe().length).toBeGreaterThan(0));

    expect(trefferAufrufe().map((a) => a.p_query)).not.toContain(undefined);
    expect(trefferAufrufe()[0].p_query).toBe("anna");
    expect(suchfeld().value).toBe("anna");
  });

  it("zieht einen Begriff nach, der erst nach dem Aufbau eintrifft", async () => {
    // `useState(wert)` würde einen Wert, der erst danach eintrifft, nie
    // annehmen — grüner Test, kaputte App. Deshalb wird hier wirklich navigiert.
    renderDirectoryAt("/mitglieder");
    await waitFor(() => expect(trefferAufrufe().length).toBeGreaterThan(0));

    act(() => navigiere!("/mitglieder?q=beispiel"));

    await waitFor(() => expect(suchfeld().value).toBe("beispiel"));
    await waitFor(() => expect(lastArgs().p_query).toBe("beispiel"));
  });

  it("springt auf denselben Begriff zurück, wenn lokal weitergetippt wurde", async () => {
    // Der Fall, an dem ein Modell „Parameter als fortlaufende Quelle" scheitert:
    // der WERT ändert sich nicht, das Ereignis schon.
    renderDirectoryAt("/mitglieder?q=anna");
    await waitFor(() => expect(lastArgs().p_query).toBe("anna"));

    fireEvent.change(suchfeld(), { target: { value: "lokal getippt" } });
    await waitFor(() => expect(lastArgs().p_query).toBe("lokal getippt"));

    act(() => navigiere!("/mitglieder?q=anna"));

    await waitFor(() => expect(suchfeld().value).toBe("anna"));
    await waitFor(() => expect(lastArgs().p_query).toBe("anna"));
  });

  it("wirft bei einem Wechsel des Begriffs die übrigen Filter nicht weg", async () => {
    renderDirectoryAt("/mitglieder");
    await waitFor(() => expect(trefferAufrufe().length).toBeGreaterThan(0));
    erweiterteSucheOeffnen();

    fireEvent.click(screen.getByRole("button", { name: "Kapital & Beteiligungen" }));
    await waitFor(() => expect(lastArgs().p_offers).toEqual(["kapital"]));

    act(() => navigiere!("/mitglieder?q=beispiel"));

    await waitFor(() => expect(lastArgs().p_query).toBe("beispiel"));
    expect(lastArgs().p_offers).toEqual(["kapital"]);
  });

  it("nimmt „Filter zurücksetzen“ den Begriff auch aus der Adresszeile", async () => {
    // Befund des Code-Reviews: bliebe `?q=` stehen, brächte ein Neuladen genau
    // die Suche zurück, die gerade zurückgesetzt wurde.
    renderDirectoryAt("/mitglieder?q=anna");
    await waitFor(() => expect(lastArgs().p_query).toBe("anna"));

    fireEvent.click(screen.getByRole("button", { name: "Filter zurücksetzen" }));

    await waitFor(() => expect(adresse()).toBe("/mitglieder"));
    expect(suchfeld().value).toBe("");
    // Ein leerer Filter reist als `undefined`, nicht als leerer Text — geprüft
    // wird deshalb, dass der Begriff WEG ist, nicht seine genaue leere Form.
    await waitFor(() => expect(lastArgs().p_query).toBeFalsy());
  });

  it("führt der Zurück-Weg zur vorigen Suche", async () => {
    renderDirectoryAt("/mitglieder?q=anna");
    await waitFor(() => expect(lastArgs().p_query).toBe("anna"));

    act(() => navigiere!("/mitglieder?q=beispiel"));
    await waitFor(() => expect(lastArgs().p_query).toBe("beispiel"));

    act(() => navigiere!(-1));

    await waitFor(() => expect(suchfeld().value).toBe("anna"));
    await waitFor(() => expect(lastArgs().p_query).toBe("anna"));
  });
});

/**
 * REGRESSIONSTEST (AGE-566, Aufgabe 5.4) — er startet grün und muss es
 * bleiben.
 *
 * Die Admin-Fläche will dieselbe Karte benutzen, aber auf `/admin/mitglied/:id`
 * verweisen. Dafür wird `MemberCard` exportiert und bekommt ihr Ziel als Prop;
 * bis dahin ist sie privat und verdrahtet `/p/:id` fest. Der erste Entwurf des
 * Changes behauptete noch, dabei werde „kein mitgliedersichtbarer Code
 * angefasst" — das war falsch, und der Plan-Review hat es widerlegt.
 *
 * Was hier gesichert wird, ist die Gegenrichtung: ein unachtsamer Umbau lenkte
 * sonst das ÖFFENTLICHE Verzeichnis in den Admin-Bereich, wo jedes Mitglied vor
 * einer Weiterleitung landete.
 */
describe("Das öffentliche Verzeichnis verweist weiter auf /p/:id (AGE-566)", () => {
  it("verlinkt die Karte eines Mitglieds auf seine öffentliche Profilseite", async () => {
    const anna = member({ name: "Anna Beispiel" });
    rpc.mockResolvedValue({ data: [anna], error: null });
    renderDirectory();
    erweiterteSucheOeffnen();

    const link = await screen.findByRole("link", { name: /Anna Beispiel/ });
    expect(link).toHaveAttribute("href", `/p/${anna.id}`);
    // Und ausdrücklich NICHT in den Admin-Bereich.
    expect(link.getAttribute("href")).not.toContain("/admin");
  });
});
