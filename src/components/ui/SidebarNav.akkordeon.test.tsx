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
