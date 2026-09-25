import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SidebarNav, type SidebarNavSection } from "./SidebarNav";

/**
 * Der persönliche Bereich als Inline-Akkordeon (AGE-292/AGE-293).
 *
 * ZWEI ANLIEGEN, EIN MECHANISMUS. AGE-293 will die toten Sektions-Labels los
 * („weniger ist mehr"), AGE-292 will den persönlichen Bereich klappbar. Ein
 * Akkordeon löst beides mit derselben Zeile: aus der Überschrift, die nur
 * dastand, wird eine Schaltfläche, die etwas tut. Was bleibt, ist kein Label
 * mehr, sondern ein Bedienelement.
 *
 * Das erste Element BEHÄLT keine Überschrift: über der Hauptnavigation sagt ein
 * Wort wie „Entdecken" nichts, was die Einträge nicht selbst sagen.
 *
 * EINGEKLAPPTE LEISTE IST DIE AUSNAHME. In der 4,5-rem-Leiste (`collapsed`) gibt
 * es keine Überschrift und damit keinen Auslöser — die Einträge SIND dort die
 * Navigation, und ein Akkordeon ohne sichtbaren Griff versteckte sie unerreichbar.
 */
const ABSCHNITTE: SidebarNavSection[] = [
  { items: [{ path: "/", label: "Start" }, { path: "/events", label: "Events" }] },
  {
    title: "Mein Bereich",
    klappbar: true,
    items: [
      { path: "/profil", label: "Mein Profil" },
      { path: "/einstellungen", label: "Einstellungen" },
    ],
  },
  // Ein Abschnitt MIT Titel, aber OHNE `klappbar`. Er steht hier nur für die
  // Gegenprobe unten — heute trägt die Anwendung keinen solchen, und genau
  // deshalb braucht es ihn: eine Fassung, die JEDEN betitelten Abschnitt
  // klappbar macht, wäre ohne ihn grün geblieben (in der Mutationsprobe
  // gemessen, nicht vermutet).
  {
    title: "Fester Abschnitt",
    items: [{ path: "/fest", label: "Fester Eintrag" }],
  },
];

function renderNav(collapsed = false) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <SidebarNav sections={ABSCHNITTE} collapsed={collapsed} />
    </MemoryRouter>,
  );
}

const griff = () => screen.getByRole("button", { name: /Mein Bereich/i });

describe("Inline-Akkordeon im persönlichen Bereich (AGE-292)", () => {
  it("macht aus der Überschrift eine Schaltfläche, nicht ein totes Label", () => {
    renderNav();

    expect(griff()).toHaveAttribute("aria-expanded", "true");
  });

  it("zeigt die Einträge zunächst — der Weg zum Profil bleibt ein Klick", () => {
    renderNav();

    expect(screen.getByRole("link", { name: "Mein Profil" })).toBeInTheDocument();
  });

  it("klappt auf Klick zu und wieder auf", () => {
    renderNav();

    fireEvent.click(griff());
    expect(griff()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Mein Profil" })).toBeNull();

    fireEvent.click(griff());
    expect(griff()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Mein Profil" })).toBeInTheDocument();
  });

  /**
   * Die Gegenprobe: ein NICHT klappbarer Abschnitt darf keinen Griff bekommen und
   * seine Einträge nie verlieren. Ohne sie wären die Zusagen oben auch von einer
   * Fassung erfüllt, die JEDEN Abschnitt klappbar macht — und dann verschwände
   * die Hauptnavigation hinter einem Klick.
   */
  /**
   * Die dritte Gegenprobe, und die einzige, die eine gemessene Lücke schließt:
   * `klappbar` allein entscheidet, nicht das Vorhandensein eines Titels. Ohne
   * sie blieb die Datei grün, während jeder betitelte Abschnitt klappbar wurde.
   */
  it("lässt einen betitelten Abschnitt OHNE klappbar unangetastet", () => {
    renderNav();

    expect(screen.queryByRole("button", { name: /Fester Abschnitt/i })).toBeNull();
    expect(screen.getByText("Fester Abschnitt").tagName).toBe("P");
    expect(screen.getByRole("link", { name: "Fester Eintrag" })).toBeInTheDocument();
  });

  it("lässt den Abschnitt ohne Titel unangetastet", () => {
    renderNav();

    expect(screen.queryByRole("button", { name: /Start|Entdecken/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Start" })).toBeInTheDocument();
  });

  /**
   * Die zweite Gegenprobe. In der schmalen Leiste gibt es keine Überschriften;
   * ein Akkordeon hätte dort keinen Griff. Blendete es trotzdem aus, wären
   * Profil und Einstellungen gar nicht mehr erreichbar.
   */
  it("klappt in der schmalen Leiste GAR NICHT — dort gibt es keinen Griff", () => {
    renderNav(true);

    expect(screen.queryByRole("button", { name: /Mein Bereich/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Mein Profil" })).toBeInTheDocument();
  });
});

describe("Die toten Sektions-Labels sind fort (AGE-293)", () => {
  it("rendert über der Hauptnavigation keine Überschrift", () => {
    renderNav();

    // Weder als Text noch als Schaltfläche — „Entdecken" kommt gar nicht mehr vor.
    expect(screen.queryByText("Entdecken")).toBeNull();
  });

  /**
   * Und der Titel, der bleibt, ist keiner mehr: er ist der Griff. Ein `<p>` mit
   * demselben Wort wäre von der Zusage darüber nicht zu unterscheiden.
   */
  it("lässt den persönlichen Bereich nur noch als Bedienelement stehen", () => {
    const { container } = renderNav();

    expect(griff()).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("p")).some((p) => p.textContent === "Mein Bereich"),
    ).toBe(false);
  });
});

/**
 * Der Eintrag mit AKTION statt Pfad (AGE-929).
 *
 * „Feedback" öffnet kein Ziel, sondern ein Overlay — es ist kein `NavLink` und
 * kann keiner sein. Der Abschnitt trägt es deshalb als `nachtrag`, hinter
 * seinen Einträgen.
 *
 * Die zweite Zusage ist die eigentliche: der Nachtrag muss dem Akkordeon
 * GEHORCHEN. Eine Fassung, die ihn ausserhalb der `offen`-Bedingung rendert,
 * sieht offen völlig richtig aus und lässt beim Zuklappen einen Knopf unter
 * einer zugeklappten Überschrift stehen — sichtbar nur, wenn jemand klappt.
 */
const MIT_NACHTRAG: SidebarNavSection[] = [
  {
    title: "Support",
    klappbar: true,
    items: [{ path: "/hilfe/tutorials", label: "Tutorials" }],
    nachtrag: (
      <button type="button" onClick={() => {}}>
        Feedback
      </button>
    ),
  },
];

function renderMitNachtrag(collapsed = false) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <SidebarNav sections={MIT_NACHTRAG} collapsed={collapsed} />
    </MemoryRouter>,
  );
}

const supportGriff = () => screen.getByRole("button", { name: /^Support$/i });

describe("Ein Abschnitt kann einen Eintrag mit Aktion tragen (AGE-929)", () => {
  it("rendert den Nachtrag hinter den Einträgen des Abschnitts", () => {
    renderMitNachtrag();

    const tutorials = screen.getByRole("link", { name: "Tutorials" });
    const feedback = screen.getByRole("button", { name: "Feedback" });

    // Dokumentreihenfolge, nicht bloss „beide da": der Nachtrag ist der ZWEITE
    // Eintrag des Abschnitts. `compareDocumentPosition` liefert
    // DOCUMENT_POSITION_FOLLOWING, wenn `feedback` hinter `tutorials` steht.
    expect(tutorials.compareDocumentPosition(feedback) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // Und im selben Abschnitt, nicht irgendwo darunter: derselbe Kasten trägt
    // beide. Ohne diese Zeile wäre auch eine Fassung grün, die den Nachtrag
    // hinter ALLE Abschnitte hängt.
    expect(tutorials.closest("div")).toBe(feedback.closest("div"));
  });

  it("klappt den Nachtrag mit zu — ein Knopf unter zugeklappter Überschrift wäre der Fehler", () => {
    renderMitNachtrag();

    fireEvent.click(supportGriff());
    expect(screen.queryByRole("link", { name: "Tutorials" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Feedback" })).toBeNull();

    fireEvent.click(supportGriff());
    expect(screen.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
  });

  it("trägt den Nachtrag auch in der schmalen Leiste", () => {
    renderMitNachtrag(true);

    // Dort gibt es keinen Griff, also auch nichts zum Zuklappen — der Eintrag
    // muss bedienbar bleiben, wie jeder andere.
    expect(screen.queryByRole("button", { name: /^Support$/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
  });

  it("lässt einen Abschnitt OHNE Nachtrag unangetastet", () => {
    renderNav();

    // Die Gegenprobe: `nachtrag` ist optional, und ein Abschnitt ohne ihn darf
    // nichts Zusätzliches rendern.
    expect(screen.queryByRole("button", { name: "Feedback" })).toBeNull();
  });
});
