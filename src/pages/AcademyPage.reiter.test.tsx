import { readFileSync } from "node:fs";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AcademyPage from "./AcademyPage";
import { fetchFeed } from "../lib/feed";
import { fetchGelikteVideos } from "../lib/academy";

/**
 * Die Reiterzeile und der Ort der Filterspalte (AGE-677).
 *
 * Drei Zusagen, und die dritte ist die, die vorher fehlte: die Spalte stand im
 * Inhalt des Reiters „Alle" statt um die Seite. Sie begann deshalb erst
 * unterhalb der Reiterzeile — und auf „Meine Academy" gab es sie gar nicht.
 *
 * Warum an der Spalte und nicht am Raster geprüft wird: jsdom rechnet kein
 * Layout. „Beginnt auf Höhe der Reiter" ist eine Aussage über Rasterzeilen und
 * damit hier nicht messbar; die Abnahme dafür steht in `tasks.md` §5. Prüfbar
 * ist die Ursache: steht die Spalte AUSSERHALB der Reiter, trägt sie jeder
 * Reiter — steht sie darin, nur einer. Genau das prüfen diese Tests.
 */
vi.mock("../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/feed")>()),
  fetchFeed: vi.fn(),
}));

vi.mock("../lib/academy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/academy")>()),
  fetchGelikteVideos: vi.fn(),
}));

vi.mock("../providers/auth-context", () => ({
  useAuth: () => ({ user: { id: "00000000-0000-0000-0000-0000000000aa" } }),
}));

/** Ein Titel aus `ACADEMY_LESSONS` — der Beleg, dass die Redaktion sichtbar ist. */
const EINE_LEKTION = /Fokus & Beständigkeit/;

function renderAcademy() {
  vi.mocked(fetchFeed).mockResolvedValue({ posts: [], nextCursor: null });
  vi.mocked(fetchGelikteVideos).mockResolvedValue({ posts: [], nextCursor: null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/academy"]}>
        <AcademyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Der Schalter, den `FilterSpalte` immer rendert — ihr Nachweis im Baum. */
const spalte = () => screen.queryByRole("button", { name: "Filter" });

beforeEach(() => {
  vi.mocked(fetchFeed).mockReset();
  vi.mocked(fetchGelikteVideos).mockReset();
});

describe("Academy: drei Reiter, Spalte um die Seite", () => {
  it("trägt Alle, Meine Academy und Redaktion in dieser Reihenfolge", () => {
    renderAcademy();

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Alle",
      "Meine Academy",
      "Redaktion",
    ]);
  });

  it("startet auf „Alle“", () => {
    renderAcademy();

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Alle");
  });

  it("zeigt die kuratierten Lektionen NICHT mehr über der Reiterzeile", () => {
    renderAcademy();

    // Vorher stand der Block als eigener `<section>` über den Reitern und war
    // damit immer sichtbar. Jetzt gehört er in seinen Reiter.
    expect(screen.queryByText(EINE_LEKTION)).toBeNull();
  });

  it("zeigt sie im Reiter „Redaktion“", () => {
    renderAcademy();

    fireEvent.click(screen.getByRole("tab", { name: "Redaktion" }));

    expect(screen.getByText(EINE_LEKTION)).toBeInTheDocument();
  });

  it("stellt die Spalte auf JEDEN der drei Reiter", () => {
    renderAcademy();

    for (const reiter of ["Alle", "Meine Academy", "Redaktion"]) {
      fireEvent.click(screen.getByRole("tab", { name: reiter }));
      expect(spalte(), `Spalte fehlt auf „${reiter}“`).not.toBeNull();
    }
  });

  it("bietet auf „Redaktion“ keine Felder an, lässt die Spalte aber stehen", () => {
    renderAcademy();

    fireEvent.click(screen.getByRole("tab", { name: "Redaktion" }));

    // Kein Suchfeld: die Lektionen sind eine Konstante im Code, ein Feld, das
    // sie nicht durchsucht, wäre eine Zusage ohne Deckung.
    expect(screen.queryByRole("searchbox", { name: "Suche" })).toBeNull();
    // Aber die Spalte bleibt — verschwände sie, spränge die Inhaltsbreite beim
    // Reiterwechsel um 16rem.
    expect(spalte()).not.toBeNull();
  });

  it("bietet die Suche auf „Alle“ weiterhin an", () => {
    renderAcademy();

    expect(screen.getByRole("searchbox", { name: "Suche" })).toBeInTheDocument();
  });
});

/**
 * Der Streifen wird am QUELLTEXT geprüft, nicht am Baum.
 *
 * jsdom rechnet kein Layout und wertet keine Containerabfragen aus:
 * `getComputedStyle` liefert für `@[30rem]:flex-row` nie ein aufgelöstes
 * `flex-direction`. Ein Test, der das trotzdem behauptete, wäre grün, ohne
 * etwas zu messen.
 *
 * Prüfbar ist die Entscheidung dahinter — Behälter statt Fenster. Und die ist
 * hier nicht schon durch `kartenraster.test.ts` gedeckt: jener Wächter kennt
 * nur `grid-cols-N`. Ein `lg:flex-row` an dieser Kachel liefe an ihm vorbei,
 * und genau das wäre der Rückfall, gegen den AGE-629 angetreten ist.
 */
/** Fluss-Richtungen, die an einem VIEWPORT-Breakpoint hängen. */
function viewportFlussVerstoesse(quelle: string): string[] {
  // `@` gehört zu den Zeichen, die davorstehen dürfen: `@lg:` ist eine
  // Containerabfrage mit demselben Namen wie der Breakpoint und unterscheidet
  // sich allein daran. Ohne diese Ausnahme verböte der Wächter genau das, wozu
  // er zwingen will. `2xl` steht vorn, sonst scheiterte der Ausdruck an der `2`.
  // Der Treffer steht in einer GRUPPE, nicht in `m[0]`: das führende Zeichen
  // gehört zur Bedingung, aber nicht zur Meldung — sonst zitierte sie
  // `"lg:flex-row` samt Anführungszeichen und schickte den Leser an die
  // falsche Stelle. Dieselbe Falle wie in `kartenraster.test.ts`.
  return [...quelle.matchAll(/(?:^|[^a-z0-9@[\]])((?:2xl|sm|md|lg|xl):flex-(?:row|col))/g)].map(
    (m) => m[1],
  );
}

describe("Der Streifen schaltet am Behälter, nicht am Fenster", () => {
  const quelle = readFileSync("src/pages/AcademyPage.tsx", "utf8");

  it("richtet die Kachel an einer Containerabfrage aus", () => {
    expect(quelle).toMatch(/@\[\d+rem\]:flex-row/);
  });

  /**
   * Verbiegungsprobe. Eine Verneinung ohne Positivkontrolle ist wertlos: läuft
   * der Ausdruck ins Leere, meldet sie „kein Verstoss" und sieht aus wie
   * Erfolg. Diese Fälle sind erfunden und decken die Ränder ab.
   */
  it("erkennt Viewport-Präfixe und lässt Containerabfragen in Ruhe", () => {
    expect(viewportFlussVerstoesse('className="lg:flex-row"')).toEqual(["lg:flex-row"]);
    expect(viewportFlussVerstoesse('className="flex-col sm:flex-row"')).toEqual(["sm:flex-row"]);
    expect(viewportFlussVerstoesse('className="2xl:flex-col"')).toEqual(["2xl:flex-col"]);

    // Der Zielzustand — und `@lg:` als der Fall, der sich allein am `@` vom
    // Breakpoint unterscheidet.
    expect(viewportFlussVerstoesse('className="@[30rem]:flex-row"')).toEqual([]);
    expect(viewportFlussVerstoesse('className="@lg:flex-row"')).toEqual([]);
    expect(viewportFlussVerstoesse('className="flex flex-col"')).toEqual([]);
  });

  it("hängt keine Fluss-Richtung an einen Viewport-Breakpoint", () => {
    const gefunden = viewportFlussVerstoesse(quelle);
    expect(gefunden, gefunden.join(", ")).toEqual([]);
  });
});
