import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SidebarNav } from "./SidebarNav";

/**
 * Welcher Eintrag leuchtet (AGE-566, Diff-Review).
 *
 * `NavLink` matcht ohne `end` als PRÄFIX. Der Admin-Abschnitt trägt seit der
 * Mitgliederliste zwei Einträge, deren einer der Pfadanfang des anderen ist —
 * auf `/admin/mitglieder` waren dadurch BEIDE aktiv, und eine Leiste, die zwei
 * Orte gleichzeitig behauptet, sagt keinen.
 *
 * Geprüft wird `aria-current`, nicht eine CSS-Klasse: das ist die Zusage, auf
 * die sich auch ein Screenreader verlässt, und sie überlebt jeden Umbau der
 * Klassennamen.
 *
 * Die Einträge unten tragen KEINE Flagge — sie sind exakt die aus `AppShell`.
 * Das ist Absicht: müsste der Aufrufer etwas setzen, prüfte dieser Test nur
 * seine eigene Fixture und bliebe grün, während die Leiste in der Anwendung
 * falsch leuchtet.
 */
function renderAt(pfad: string) {
  return render(
    <MemoryRouter initialEntries={[pfad]}>
      <SidebarNav
        sections={[
          {
            title: "Administration",
            items: [
              { path: "/admin", label: "Administration" },
              { path: "/admin/mitglieder", label: "Mitglieder" },
            ],
          },
        ]}
      />
    </MemoryRouter>,
  );
}

describe("SidebarNav: woran der aktive Eintrag erkennbar ist", () => {
  // AGE-1003, Befund des Code-Reviews. Die Aktivflaeche `#1F53B0` traegt gegen
  // die Leiste nur 2,00:1 und hielt die 3:1 noch nie. Der Change erklaert das
  // fuer vertretbar, WEIL der Zustand an weiteren Merkmalen haengt — und diese
  // Begruendung muss gemessen werden, nicht behauptet.
  //
  // Die erste Fassung hat sie mit einer Textsuche ueber die Quelldatei
  // „geprueft". Die konnte die Bedingung `isActive && !collapsed` nicht sehen
  // und haette den eingeklappten Zustand nie gemessen — wo es den Balken und
  // die Beschriftung GAR NICHT GIBT. Deshalb hier gerendert, und beide
  // Zustaende getrennt.
  function renderNav(collapsed: boolean) {
    return render(
      <MemoryRouter initialEntries={["/admin"]}>
        <SidebarNav
          collapsed={collapsed}
          sections={[
            {
              title: "Administration",
              items: [
                { path: "/admin", label: "Administration" },
                { path: "/admin/mitglieder", label: "Mitglieder" },
              ],
            },
          ]}
        />
      </MemoryRouter>,
    );
  }

  it("aufgeklappt: halbfette Schrift UND der weisse Linksbalken", () => {
    const { container } = renderNav(false);
    const aktiv = container.querySelector('[aria-current="page"]')!;
    expect(aktiv.className).toContain("font-semibold");
    expect(aktiv.className).toContain("text-on-chrome-active");
    expect(
      aktiv.querySelector(".bg-on-chrome-active"),
      "der weisse Linksbalken fehlt",
    ).not.toBeNull();
  });

  it("eingeklappt: KEIN Balken, KEINE Beschriftung — das Symbol traegt es allein", () => {
    // Das ist die ehrliche Fassung der Begruendung, und sie ist schwaecher als
    // die aufgeklappte: uebrig bleiben die Fuellung (2,00:1, bewusst unter der
    // Schwelle), die Farbe des Symbols (#FFFFFF statt #9FB4D2, 14,34:1 statt
    // 6,78:1 gegen die Leiste) und seine FORM — `NavIcon` schaltet von `line`
    // auf `solid`. Form und Farbe zusammen, nicht Farbe allein: genau das
    // verlangt die Anforderung „Farbe traegt nie allein eine Bedeutung".
    const { container } = renderNav(true);
    const aktiv = container.querySelector('[aria-current="page"]')!;
    expect(
      aktiv.querySelector(".bg-on-chrome-active"),
      "eingeklappt gibt es keinen Balken",
    ).toBeNull();
    expect(aktiv.textContent?.trim(), "eingeklappt steht keine Beschriftung da").toBe("");
    // Auf die EINZELNE Klasse geprüft, nicht auf den Klassentext: der ruhende
    // Eintrag trägt `hover:text-on-chrome-active`, und eine Textsuche fände das
    // mit — sie bestätigte dann einen Unterschied, den es nicht gibt.
    const klassen = (el: Element) => new Set(el.className.split(/\s+/));
    const ruhend = container.querySelector("a:not([aria-current])")!;
    expect(klassen(aktiv), "das aktive Symbol ist weiss").toContain("text-on-chrome-active");
    expect(klassen(ruhend), "das ruhende Symbol ist gedämpft").toContain("text-on-chrome");
    expect(klassen(ruhend), "das ruhende Symbol ist nicht weiss").not.toContain(
      "text-on-chrome-active",
    );
  });
});

describe("SidebarNav: genau ein Eintrag ist aktiv", () => {
  it("markiert auf /admin/mitglieder nur die Mitgliederliste", () => {
    renderAt("/admin/mitglieder");

    expect(screen.getByRole("link", { name: "Mitglieder" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Administration" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("markiert auf /admin nur die Administration", () => {
    renderAt("/admin");

    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Mitglieder" })).not.toHaveAttribute("aria-current");
  });
});
