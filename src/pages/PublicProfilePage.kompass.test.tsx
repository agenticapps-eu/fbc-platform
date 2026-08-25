import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";

vi.mock("../lib/public-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/public-profile")>();
  return { ...actual, fetchPublicProfile: vi.fn() };
});
vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn() };
});
import { fetchPublicProfile, type ExtendedProfile, type PublicProfileData } from "../lib/public-profile";
import { fetchPlatformSettings } from "../lib/platform-settings";
import PublicProfilePage from "./PublicProfilePage";

/**
 * „Ich biete" / „Ich suche" und der entfallene Erfolgsradar (AGE-597).
 *
 * DIE FIXTURES SIND SELBST GESCHRIEBEN, nicht aus dem Bestand kopiert. Dieses
 * Repo ist öffentlich, und wörtliche Kompass-Zeilen tragen Firmen, Orte und URLs
 * auch ohne Klarnamen (Befund codex im Plan-Review; ein früherer Beinahe-Unfall
 * mit 60 Klarnamen ist dokumentiert). Nachgebildet sind die FORMEN, gemessen am
 * 25.08. über alle 112 Zeilen auf PROD mit
 * `scripts/probe-age597-kompass-bestand.ts` — Marke, Marke mit Text, unbekannte
 * Kategorie, Präfix-Titel, mit Auslassungszeichen gekürzter Titel,
 * eigenständiger Titel, `'-`-Artefakt, 1048 Zeichen, elf Marken. Die Inhalte
 * sind erfunden.
 */

const ZIEL = "77777777-7777-7777-7777-777777777777";

type Zeile = ExtendedProfile["offers"][number];

let laufendeId = 0;
function zeile(teil: Partial<Zeile>): Zeile {
  return {
    id: `z${++laufendeId}`,
    source: "editor",
    category: null,
    theme: null,
    title: "",
    description: null,
    ...teil,
  };
}

const BASIS: PublicProfileData = {
  publicProfile: {
    id: ZIEL,
    name: "Fremdes Mitglied",
    avatar_url: null,
    cover_url: null,
    region: null,
    company: null,
    short_bio: null,
    tier: "impact",
    roles: [],
  },
  extended: {
    headline: null,
    branche: null,
    member_since: null,
    potential_score: 0,
    competencies: [],
    videos: [],
    interests: [],
    offers: [],
    needs: [],
    posts: [],
  },
};

function zeige(teil: Partial<ExtendedProfile>) {
  vi.mocked(fetchPublicProfile).mockResolvedValue({
    ...BASIS,
    extended: { ...BASIS.extended!, ...teil },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthFixture value={authAsTier("impact")}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/p/${ZIEL}`]}>
            <Routes>
              <Route path="/p/:id" element={<PublicProfilePage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  laufendeId = 0;
  vi.mocked(fetchPublicProfile).mockReset();
  vi.mocked(fetchPlatformSettings).mockReset().mockResolvedValue({ openContact: false });
});

describe("Marken-Einträge (source = chip)", () => {
  it("zeigt den Klartext der Kategorie — nicht den rohen Schlüssel und nicht den Titel", async () => {
    // Der Titel ist hier ABSICHTLICH nicht der Kategoriename: sonst wäre „kein
    // zusätzlicher Titel" am Text gar nicht von „Titel gezeigt" zu unterscheiden.
    zeige({ offers: [zeile({ source: "chip", category: "know_how", title: "Know-how (Altwert)" })] });

    expect(await screen.findByText("Know-how")).toBeInTheDocument();
    expect(screen.queryByText("know_how")).not.toBeInTheDocument();
    expect(screen.queryByText("Know-how (Altwert)")).not.toBeInTheDocument();
  });

  it("verliert die Beschreibung einer Marken-Zeile nicht", async () => {
    // Kommt im Bestand nicht vor (0 von 19), der Editor kann es aber anlegen.
    zeige({
      offers: [
        zeile({
          source: "chip",
          category: "mentoring",
          title: "Mentoring",
          description: "Zwei Stunden im Monat, bevorzugt für Handwerksbetriebe.",
        }),
      ],
    });

    expect(await screen.findByText("Mentoring")).toBeInTheDocument();
    expect(
      screen.getByText("Zwei Stunden im Monat, bevorzugt für Handwerksbetriebe."),
    ).toBeInTheDocument();
  });

  it("zeigt für eine unbekannte Kategorie GAR KEINE Marke — auch nicht den großgeschriebenen Schlüssel", async () => {
    zeige({ offers: [zeile({ source: "chip", category: "zeitreisen", title: "Zeitreisen" })] });

    await screen.findByRole("heading", { name: "Ich biete" });
    expect(screen.queryByText(/zeitreisen/i)).not.toBeInTheDocument();
  });

  it("stellt sieben Marken in EINE umlaufende Reihe, nicht in sieben Kästen", async () => {
    // Gemessen am 25.08.: elf Marken auf einem Profil, verteilt auf beide
    // Abschnitte — eine einzelne Reihe trägt höchstens sechs. Geprüft wird mit
    // sieben, also über dem Höchstwert.
    const schluessel = [
      "kapital",
      "kontakte",
      "know_how",
      "immobilien",
      "beteiligungen",
      "leistungen",
      "mentoring",
    ];
    zeige({
      offers: schluessel.map((k) => zeile({ source: "chip", category: k, title: k })),
      needs: ["investoren", "projekte", "partner", "experten"].map((k) =>
        zeile({ source: "chip", category: k, title: k }),
      ),
    });

    const marke = await screen.findByText("Kapital");
    const reihe = marke.closest("ul");
    expect(reihe).not.toBeNull();
    // Umlauf statt Sprengen der Karte — die Klasse bewirkt ihn im Browser,
    // jsdom rechnet kein Layout. Den sichtbaren Beleg gibt die Sichtprobe.
    expect(reihe!.className).toContain("flex-wrap");
    // Alle sieben Angebote in DERSELBEN Reihe: sieben eigene Listen wären
    // sieben Kästen untereinander, und genau das war der Befund.
    for (const label of ["Kontakte", "Know-how", "Immobilien", "Beteiligungen", "Leistungen", "Mentoring"]) {
      expect(screen.getByText(label).closest("ul")).toBe(reihe);
    }
  });
});

describe("Freitext-Einträge (source = editor)", () => {
  it("bewahrt die Absätze der Beschreibung", async () => {
    zeige({
      offers: [
        zeile({
          title: "Imkerei",
          description: "Bienenvölker im Stadtgebiet.\nHonig aus eigener Schleuderei.",
        }),
      ],
    });

    const text = await screen.findByText(/Bienenvölker im Stadtgebiet/);
    expect(text.className).toContain("whitespace-pre-line");
  });

  it("lässt einen Titel weg, der nur der Anfang der Beschreibung ist", async () => {
    zeige({
      offers: [
        zeile({
          title: "Wir bauen Segelboote in Handarbeit",
          description:
            "Wir bauen Segelboote in Handarbeit und restaurieren klassische Yachten.\nWerkstatt seit 1998.",
        }),
      ],
    });

    await screen.findByRole("heading", { name: "Ich biete" });
    expect(screen.queryByText("Wir bauen Segelboote in Handarbeit")).not.toBeInTheDocument();
    expect(screen.getByText(/Werkstatt seit 1998/)).toBeInTheDocument();
  });

  it("lässt auch einen mit Auslassungszeichen gekürzten Titel weg", async () => {
    // Gemessen: der Import kürzt an der Wortgrenze und hängt U+2026 an — 35 von
    // 93 Zeilen, davon drei bei exakt 80 Zeichen. Ein zeichengleiches Präfix
    // entsteht dabei NICHT, die Regel muss das Zeichen abschneiden.
    zeige({
      offers: [
        zeile({
          title: "Wir bauen Segelboote in Handarbeit und restaurieren klassische Yachten für…",
          description:
            "Wir bauen Segelboote in Handarbeit und restaurieren klassische Yachten für Liebhaber.",
        }),
      ],
    });

    await screen.findByRole("heading", { name: "Ich biete" });
    expect(screen.queryByText(/Yachten für…$/)).not.toBeInTheDocument();
    expect(screen.getByText(/Yachten für Liebhaber/)).toBeInTheDocument();
  });

  it("lässt einen eigenständigen Titel stehen", async () => {
    zeige({
      offers: [
        zeile({
          title: "Werkstattführung nach Absprache",
          description: "Wir bauen Segelboote in Handarbeit.",
        }),
      ],
    });

    expect(await screen.findByText("Werkstattführung nach Absprache")).toBeInTheDocument();
  });

  it("behält einen Titel, der mit der Beschreibung nur die ersten Worte teilt", async () => {
    // Die naheliegende Regel „bis zur letzten Wortgrenze vergleichen" fasst
    // gemessen 81 statt 61 Zeilen und würfe genau solche Titel weg. Dieser Test
    // ist die Sperre dagegen.
    zeige({
      offers: [
        zeile({
          title: "Segelboote und Yachten aus Holz",
          description: "Segelboote und Yachten aus Kunststoff bauen wir nicht.",
        }),
      ],
    });

    expect(await screen.findByText("Segelboote und Yachten aus Holz")).toBeInTheDocument();
  });

  it("putzt die Import-Aufzählungszeichen aus Titel UND Beschreibung, ohne den gespeicherten Wert anzufassen", async () => {
    const eintrag = zeile({
      title: "'- Imkerei",
      description: "'- Bienenvölker im Stadtgebiet\n'- Honig aus eigener Schleuderei",
    });
    zeige({ offers: [eintrag] });

    expect(await screen.findByText("Imkerei")).toBeInTheDocument();
    expect(screen.getByText(/Bienenvölker im Stadtgebiet/).textContent).not.toContain("'-");
    // Der gespeicherte Wert bleibt unberührt: geputzt wird beim DARSTELLEN.
    expect(eintrag.title).toBe("'- Imkerei");
    expect(eintrag.description).toBe(
      "'- Bienenvölker im Stadtgebiet\n'- Honig aus eigener Schleuderei",
    );
  });

  it("zeigt die längste Beschreibung des Bestands vollständig", async () => {
    const lang = "Wir bauen Segelboote. ".repeat(50).slice(0, 1048);
    zeige({ offers: [zeile({ title: "Bootsbau", description: lang })] });

    const text = await screen.findByText(lang.trim());
    expect(text.textContent!.length).toBeGreaterThanOrEqual(1040);
  });
});

describe("Der Erfolgsradar ist fort (AGE-597)", () => {
  it("zeigt auf der fremden Profilansicht keinen Erfolgsradar", async () => {
    zeige({ interests: [{ theme: "tun", label: "Segeln" }], videos: [] });

    // Gegenprobe zuerst: die erweiterte Sicht IST da …
    expect(await screen.findByRole("heading", { name: "Hobbys" })).toBeInTheDocument();
    // … und trotzdem kein Radar. Dass er nicht bloß mangels Daten fehlt,
    // erzwingt der Typ: `ExtendedProfile` trägt keine Themen-Scores mehr, und
    // die Abfrage ist in `public-profile.test.ts` als entfallen belegt.
    expect(screen.queryByRole("heading", { name: "Erfolgsradar" })).not.toBeInTheDocument();
  });

  it("lässt die Videos stehen, obwohl der Radar davor entfallen ist", async () => {
    zeige({ videos: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"] });

    expect(await screen.findByRole("heading", { name: "Videos" })).toBeInTheDocument();
  });

  it("nennt den Erfolgsradar nicht mehr im Hinweis für die eingeschränkte Ansicht", async () => {
    vi.mocked(fetchPublicProfile).mockResolvedValue({ ...BASIS, extended: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthFixture value={authAsTier("basic")}>
          <ToastProvider>
            <MemoryRouter initialEntries={[`/p/${ZIEL}`]}>
              <Routes>
                <Route path="/p/:id" element={<PublicProfilePage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthFixture>
      </QueryClientProvider>,
    );

    const hinweis = await screen.findByRole("heading", { name: "Erweiterte Profilangaben" });
    expect(hinweis.parentElement!.textContent).not.toContain("Erfolgsradar");
    // Gegenprobe: der Hinweis wirbt weiterhin mit dem, was es GIBT.
    expect(hinweis.parentElement!.textContent).toContain("Such-/Bieteprofil");
  });
});
