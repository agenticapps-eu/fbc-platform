import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import type { DashboardData } from "../lib/dashboard";

vi.mock("../lib/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/dashboard")>();
  return { ...actual, fetchDashboard: vi.fn() };
});
import { fetchDashboard } from "../lib/dashboard";
import {
  AuszeichnungenWidget,
  BeitraegeWidget,
  EntwicklungWidget,
  ErfolgsradarWidget,
  ZieleWidget,
} from "../components/mein-bereich/profil-widgets";
import ProfilAnsichtPage from "./ProfilAnsichtPage";

const mockedFetch = vi.mocked(fetchDashboard);

// Das importierte Mitglied (AGE-539): nichts gepflegt, kein Beitrittsdatum,
// keine Beiträge. Nach dem 17.08. der mit Abstand häufigste Zustand.
const LEER: DashboardData = {
  profile: {
    id: "test-user",
    name: "Eleonora Voss",
    avatar_url: null,
    cover_url: null,
    region: "Berlin",
    company: "Voss Ventures",
    short_bio: null,
    tier: "legacy",
    roles: ["Investorin"],
    headline: null,
    member_number: null,
    member_since: null,
    potential_score: 82,
    profile_completion: 60,
    dev_focus: null,
    dev_progress: 0,
    next_steps: [],
  },
  themeScores: [],
  scoreBreakdown: null,
  interests: [],
  goals: [],
  offers: [],
  needs: [],
  badges: [],
  matchStats: { active: 0, successful: 1, avgScore: 0 },
  contactsCount: 1,
  eventsCount: 2,
  events: [],
  hostedEvents: [],
  posts: [],
};

// Die Gegenprobe. Sie ist der eigentliche Beweis: eine Umsetzung, die die
// vertagten Widgets nur bei LEEREN Daten ausblendet, besteht jeden Test gegen
// `LEER` und zeigt dem Mitglied mit Daten trotzdem den Kompass.
// (Fremd-Review zum Plan, codex, MEDIUM.)
const GEFUELLT: DashboardData = {
  ...LEER,
  profile: {
    ...LEER.profile,
    member_since: "2019-03-04",
    member_number: "FBC-0042",
    dev_focus: "tun",
    dev_progress: 40,
    next_steps: ["Erstes Vernetzungsgespräch"],
  },
  themeScores: [
    { theme: "sein", score: 7 },
    { theme: "tun", score: 5 },
  ],
  interests: [{ theme: "tun", label: "Impact Investing" }],
  goals: [{ category: "unternehmerisch", title: "Zwei neue Partner", progress: 30 }],
  badges: [
    { key: "gruender", label: "Gründungsmitglied", icon: null, awarded_at: "2019-03-04" },
  ],
  matchStats: { active: 3, successful: 4, avgScore: 71 },
  posts: [
    {
      id: "p1",
      body: "Kurzer echter Beitrag von mir.",
      hashtags: [],
      created_at: "2026-08-01T09:00:00Z",
      visibility: "members",
    },
  ],
};

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(LEER);
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("impact")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilAnsichtPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

/** Wartet, bis die Seite steht — sonst prüft ein queryBy… nur das Skelett. */
async function renderUndWarten() {
  renderPage();
  await screen.findByRole("heading", { name: "Eleonora Voss" });
}

describe("ProfilAnsichtPage — Grundgerüst", () => {
  it("zeigt Name und Bearbeiten-Link", async () => {
    await renderUndWarten();
    expect(screen.getByRole("link", { name: "Profil bearbeiten" })).toHaveAttribute(
      "href",
      "/profil/bearbeiten",
    );
  });

  it("zeigt die Kacheln Netzwerk und Events", async () => {
    await renderUndWarten();
    expect(screen.getByText("Netzwerk")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
  });
});

// AGE-539: Der Kompass ist für den Go-Live vertagt (AGE-494), seine
// Profil-Oberflächen blieben aber stehen. Jede dieser Erwartungen wird EINZELN
// geprüft — mehrere in einem Block hielten beim ersten Fehlschlag an.
describe("ProfilAnsichtPage — vertagte Kompass-Oberflächen (leeres Profil)", () => {
  it("zeigt kein Erfolgsradar", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Mein Erfolgsradar" })).toBeNull();
  });

  it("zeigt keine Auszeichnungen", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Meine Auszeichnungen" })).toBeNull();
  });

  it("zeigt keine Ziele", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Meine Ziele" })).toBeNull();
  });

  it("zeigt keine Entwicklung", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Meine Entwicklung" })).toBeNull();
  });

  it("zeigt keine Matches-Kachel", async () => {
    await renderUndWarten();
    expect(screen.queryByText("Matches")).toBeNull();
  });

  it("führt nicht auf eine persönliche Roadmap", async () => {
    await renderUndWarten();
    expect(screen.queryByText("Zur persönlichen Roadmap")).toBeNull();
  });
});

// Die Gegenprobe: dieselben Abwesenheiten, aber mit Daten in JEDEM der vier
// Bereiche und einem Matchstand über null.
describe("ProfilAnsichtPage — vertagte Oberflächen bleiben auch MIT Daten fort", () => {
  beforeEach(() => {
    mockedFetch.mockResolvedValue(GEFUELLT);
  });

  it("zeigt kein Erfolgsradar, obwohl Themen-Scores vorliegen", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Mein Erfolgsradar" })).toBeNull();
  });

  it("zeigt keine Auszeichnungen, obwohl eine vergeben ist", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Meine Auszeichnungen" })).toBeNull();
    expect(screen.queryByText("Gründungsmitglied")).toBeNull();
  });

  it("zeigt keine Ziele, obwohl eines gepflegt ist", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Meine Ziele" })).toBeNull();
    expect(screen.queryByText("Zwei neue Partner")).toBeNull();
  });

  it("zeigt keine Entwicklung, obwohl ein Fokus gesetzt ist", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Meine Entwicklung" })).toBeNull();
    expect(screen.queryByText("Erstes Vernetzungsgespräch")).toBeNull();
  });

  it("zeigt keine Matches-Kachel, obwohl der Stand über null liegt", async () => {
    await renderUndWarten();
    expect(screen.queryByText("Matches")).toBeNull();
  });
});

// AGE-539 §3: fest verdrahtete Fantasiedaten auf dem echten Profil.
describe("ProfilAnsichtPage — keine erfundenen Beiträge", () => {
  it("zeigt keinen Demo-Beitragstitel", async () => {
    await renderUndWarten();
    expect(
      screen.queryByText("Warum Ökosysteme die Zukunft des Mittelstands sind"),
    ).toBeNull();
    expect(screen.queryByText("Deal-Keeping im Family Office (Podcast)")).toBeNull();
  });

  it("zeigt keine erfundenen Reichweiten", async () => {
    await renderUndWarten();
    expect(screen.queryByText(/1,2k Views/)).toBeNull();
    expect(screen.queryByText(/84 Likes/)).toBeNull();
  });

  it("trägt nirgends eine Demo-Marke", async () => {
    await renderUndWarten();
    expect(screen.queryByText("Demo")).toBeNull();
  });
});

describe("ProfilAnsichtPage — Leerzustände", () => {
  // Die Ausnahme aus §4: Beiträge gibt es wirklich, das Ziel (/aktivitaet) steht
  // sonst nirgends auf der Seite. Geprüft wird der AUFRUF, nicht das Linkziel —
  // „Alle anzeigen" zeigt schon heute dorthin und bestünde jeden Zieltest.
  it("lädt ohne Beiträge zum Schreiben ein", async () => {
    await renderUndWarten();
    expect(screen.getByRole("heading", { name: "Meine Beiträge" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Beitrag schreiben" })).toHaveAttribute(
      "href",
      "/aktivitaet",
    );
  });

  it("zeigt mit Beiträgen die echten und keine Einladung", async () => {
    mockedFetch.mockResolvedValue(GEFUELLT);
    await renderUndWarten();
    expect(screen.getByText("Kurzer echter Beitrag von mir.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beitrag schreiben" })).toBeNull();
  });

  // Keine Ausnahme: „Bearbeiten" führt in denselben Editor wie die Einladung
  // weiter oben auf der Seite. Zwei Einladungen mit einem Ziel sind Wiederholung.
  it("zeigt ohne Interessen keinen Interessenbereich", async () => {
    await renderUndWarten();
    expect(screen.queryByRole("heading", { name: "Meine Interessen" })).toBeNull();
  });

  it("zeigt mit Interessen den Interessenbereich", async () => {
    mockedFetch.mockResolvedValue(GEFUELLT);
    await renderUndWarten();
    expect(screen.getByRole("heading", { name: "Meine Interessen" })).toBeInTheDocument();
    expect(screen.getByText("Impact Investing")).toBeInTheDocument();
  });
});

// AGE-539 §4 und design §6a: Datum und Nummer stehen heute in EINEM Absatz.
// Der naheliegende Wrapper um `member_since` verschluckt die Mitgliedsnummer —
// nach dem Import bei 18 von 70 Konten. Deshalb vier Fälle.
describe("ProfilAnsichtPage — Eckdaten im Profilkopf", () => {
  // Kein seitenweites queryByText(/—/): der Gedankenstrich ist hier normale
  // Typografie und steht in zwei Fließtexten. Dass gar keine Zeile entsteht —
  // und damit auch kein Platzhalter — belegen die beiden Abwesenheiten.
  it("zeigt keine Eckdatenzeile, wenn beides fehlt", async () => {
    await renderUndWarten();
    expect(screen.queryByText(/Mitglied seit/)).toBeNull();
    expect(screen.queryByText(/Mitgliedsnummer/)).toBeNull();
  });

  it("zeigt die Mitgliedsnummer auch ohne Beitrittsdatum", async () => {
    mockedFetch.mockResolvedValue({
      ...LEER,
      profile: { ...LEER.profile, member_number: "FBC-0042" },
    });
    await renderUndWarten();
    expect(screen.getByText(/FBC-0042/)).toBeInTheDocument();
    expect(screen.queryByText(/Mitglied seit/)).toBeNull();
  });

  it("zeigt das Beitrittsdatum ohne Trenner, wenn die Nummer fehlt", async () => {
    mockedFetch.mockResolvedValue({
      ...LEER,
      profile: { ...LEER.profile, member_since: "2019-03-04" },
    });
    await renderUndWarten();
    // Auf den Absatz eingegrenzt: der Trenner „·" steht auch im Hero zwischen
    // Region und Firma. Ein seitenweites queryByText(/·/) fände ihn dort und
    // wäre rot, ohne über die Eckdaten etwas zu sagen.
    const zeile = screen.getByText(/Mitglied seit: März 2019/);
    expect(zeile.textContent).not.toContain("·");
    expect(zeile.textContent).not.toContain("Mitgliedsnummer");
  });

  it("zeigt beides mit Trenner", async () => {
    mockedFetch.mockResolvedValue(GEFUELLT);
    await renderUndWarten();
    // Auf den Absatz und den Trenner geprüft: zwei getrennte Vorhandenseins-
    // Erwartungen bestünden auch bei „März 2019Mitgliedsnummer: FBC-0042".
    const zeile = screen.getByText(/Mitglied seit: März 2019/);
    expect(zeile.textContent).toBe("Mitglied seit: März 2019 · Mitgliedsnummer: FBC-0042");
  });
});

// Die Anforderung sagt nicht nur „nicht rendern", sondern auch „im Code
// behalten" — das Zurückholen soll eine Zeile sein. Die Abwesenheitstests oben
// bestünden aber auch, wenn jemand die vier Komponenten LÖSCHT. Erst diese
// Fälle halten die zweite Hälfte der Zusage fest.
// (Fremd-Review auf dem Diff, codex, MEDIUM.)
describe("Die vertagten Widgets bleiben lauffähig im Code", () => {
  function renderWidget(node: React.ReactNode) {
    return render(<MemoryRouter>{node}</MemoryRouter>);
  }

  it("ErfolgsradarWidget rendert weiterhin", () => {
    renderWidget(<ErfolgsradarWidget data={{ ...GEFUELLT, themeScores: [] }} />);
    expect(screen.getByRole("heading", { name: "Mein Erfolgsradar" })).toBeInTheDocument();
  });

  it("AuszeichnungenWidget rendert weiterhin", () => {
    renderWidget(<AuszeichnungenWidget badges={GEFUELLT.badges} />);
    expect(screen.getByRole("heading", { name: "Meine Auszeichnungen" })).toBeInTheDocument();
    expect(screen.getByText("Gründungsmitglied")).toBeInTheDocument();
  });

  it("ZieleWidget rendert weiterhin", () => {
    renderWidget(<ZieleWidget data={GEFUELLT} />);
    expect(screen.getByRole("heading", { name: "Meine Ziele" })).toBeInTheDocument();
    expect(screen.getByText("Zwei neue Partner")).toBeInTheDocument();
  });

  it("EntwicklungWidget rendert weiterhin", () => {
    renderWidget(<EntwicklungWidget profile={GEFUELLT.profile} />);
    expect(screen.getByRole("heading", { name: "Meine Entwicklung" })).toBeInTheDocument();
    expect(screen.getByText("Erstes Vernetzungsgespräch")).toBeInTheDocument();
  });
});

/**
 * „Meine Beiträge" führt in den Feed (AGE-587, Abschnitt 8).
 *
 * DIESELBE Zusage steht in `PublicProfilePage.test.tsx` für die
 * Aktivitäten-Karte der öffentlichen Seite. Das Spec-Delta sagt „jede Zeile,
 * auf JEDEM Profil"; der erste Plan verlinkte nur die öffentliche und hätte
 * die eigene stumm gelassen (Befund codex). Wer eine der beiden ändert, soll
 * die andere finden.
 */
describe("Meine Beiträge: jede Zeile führt zu ihrem Beitrag (AGE-587)", () => {
  function renderWidget(data: DashboardData) {
    return render(
      <MemoryRouter>
        <BeitraegeWidget data={data} />
      </MemoryRouter>,
    );
  }

  const mitBeitraegen = (posts: DashboardData["posts"]): DashboardData => ({
    ...GEFUELLT,
    posts,
  });

  it("macht jede Zeile zu einem Link auf IHREN Beitrag", () => {
    renderWidget(
      mitBeitraegen([
        {
          id: "post-eins",
          body: "Erster Gedanke",
          hashtags: [],
          created_at: "2026-08-01T09:00:00Z",
          visibility: "members",
        },
        {
          id: "post-zwei",
          body: "Zweiter Gedanke",
          hashtags: [],
          created_at: "2026-08-02T09:00:00Z",
          visibility: "members",
        },
      ]),
    );

    expect(screen.getByRole("link", { name: /Erster Gedanke/ })).toHaveAttribute(
      "href",
      "/aktivitaet?post=post-eins",
    );
    expect(screen.getByRole("link", { name: /Zweiter Gedanke/ })).toHaveAttribute(
      "href",
      "/aktivitaet?post=post-zwei",
    );
  });

  /** Ein `div` mit `onClick` bestünde `fireEvent.click` und wäre trotzdem nicht
   *  bedienbar (Befund gemini). Geprüft wird die Rolle, nicht ein Klick. */
  it("ist ein echtes Verweiselement, kein anklickbarer Kasten", () => {
    renderWidget(
      mitBeitraegen([
        {
          id: "p1",
          body: "Ein Gedanke",
          hashtags: [],
          created_at: "2026-08-01T09:00:00Z",
          visibility: "members",
        },
      ]),
    );

    const link = screen.getByRole("link", { name: /Ein Gedanke/ });
    expect(link.tagName).toBe("A");
  });

  /** „Beitrag ohne Text", nicht „Beitrag mit Bild" — die Karte weiss nichts
   *  über Bilder, und ein leerer Text hat mindestens zwei andere Ursachen. */
  it("gibt einer textlosen Zeile einen Ersatztext, statt leer zu bleiben", () => {
    renderWidget(
      mitBeitraegen([
        {
          id: "p-leer",
          body: "",
          hashtags: [],
          created_at: "2026-08-01T09:00:00Z",
          visibility: "members",
        },
      ]),
    );

    expect(screen.getByRole("link", { name: /Beitrag ohne Text/ })).toHaveAttribute(
      "href",
      "/aktivitaet?post=p-leer",
    );
    expect(screen.queryByText(/Beitrag mit Bild/)).not.toBeInTheDocument();
  });

  /** Der Leerzustand bleibt, was er war: eine Einladung, keine Liste mit einer
   *  Ersatzzeile darin (AGE-539). */
  it("lässt den Leerzustand unangetastet", () => {
    renderWidget(mitBeitraegen([]));

    expect(screen.getByText(/noch nichts zu lesen/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Beitrag ohne Text/ })).not.toBeInTheDocument();
  });
});
