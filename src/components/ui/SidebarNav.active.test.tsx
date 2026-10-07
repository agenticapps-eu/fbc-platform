import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SidebarNav } from "./SidebarNav";
import { NavIcon } from "./NavIcon";
import { navItems } from "../../config/nav";

/**
 * Die FASSUNG eines Symbols, am DOM gelesen statt an einer Klasse.
 *
 * `Icon` setzt `fill="currentColor" stroke="none"` fuer die massive Fassung und
 * `fill="none" stroke="currentColor"` fuer die Kontur. Das ist der Unterschied,
 * den ein Auge sieht — und er haengt an keiner Klasse und an keinem Namen,
 * sondern an genau den Attributen, die der Browser malt.
 */
function form(wurzel: Element): "massiv" | "kontur" | "unklar" {
  const svg = wurzel.querySelector("svg");
  if (!svg) return "unklar";
  const fuellung = svg.getAttribute("fill");
  if (fuellung === "currentColor") return "massiv";
  if (fuellung === "none") return "kontur";
  return "unklar";
}

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

  it("eingeklappt: KEIN Balken, KEINE Beschriftung — die SymbolFORM traegt es allein", () => {
    // SEIT AGE-1018 traegt die Form es ALLEIN, und das ist eine bewusste
    // Verringerung von zwei Merkmalen auf eines.
    //
    // Bis dahin kam die Symbolfarbe hinzu: #FFFFFF aktiv gegen #9FB4D2 ruhend.
    // AGE-1018 setzt ruhende Eintraege auf denselben Weisston wie die
    // Nachrichtenleiste, und `NavIcon` nimmt KEINE Farbe an — es erbt
    // `currentColor` von der Textklasse seines Links. Damit ist die Farbe kein
    // Unterschied mehr.
    //
    // Was bleibt, ist die FORM: `NavIcon` schaltet von `line` auf `solid`, und
    // das schlaegt im DOM auf `fill`/`stroke` durch. Die Norm haelt — 1.4.1
    // verlangt, dass Farbe nicht das EINZIGE Mittel ist, und eine Form ist kein
    // Farbmittel. Die Fuellung der Zeile (2,00:1) zaehlt ausdruecklich NICHT
    // als Merkmal, so steht es in der Spec seit AGE-1003.
    const { container } = renderNav(true);
    const aktiv = container.querySelector('[aria-current="page"]')!;
    expect(
      aktiv.querySelector(".bg-on-chrome-active"),
      "eingeklappt gibt es keinen Balken",
    ).toBeNull();
    expect(aktiv.textContent?.trim(), "eingeklappt steht keine Beschriftung da").toBe("");

    const ruhend = container.querySelector("a:not([aria-current])")!;
    expect(form(aktiv), "das aktive Symbol ist nicht massiv").toBe("massiv");
    expect(form(ruhend), "das ruhende Symbol ist keine Kontur").toBe("kontur");

    // Und die Gegenprobe zur Begruendung: die FARBE unterscheidet die beiden
    // nicht mehr. Ohne diese Zeile liesse sich der Kommentar darueber
    // stillschweigend falsch werden — jemand dreht `--leiste-ink` zurueck, und
    // der Test bliebe gruen, waehrend die Erklaerung nicht mehr stimmt.
    const klassen = (el: Element) => new Set(el.className.split(/\s+/));
    expect(klassen(aktiv), "das aktive Symbol ist weiss").toContain("text-on-chrome-active");
    expect(
      klassen(ruhend),
      "das ruhende Symbol traegt nicht mehr den gedaempften Ton",
    ).not.toContain("text-on-chrome");
  });
});

/**
 * Das Versprechen aus dem Kopf von `MASSIV` (`ui/icons.tsx`), fuer JEDEN Pfad
 * der Leiste geprueft (AGE-1018).
 *
 * Es lautet dort: „Das traegt die Auswahl auch dann, wenn die Leiste
 * eingeklappt ist und kein Label danebensteht." Gemessen hielt es fuer neun von
 * DREIZEHN Eintraegen — `/hilfe/tutorials` (`bulb`) sowie `/admin/mitglieder`,
 * `/admin/feedback` und `/admin/neuigkeiten` (Rueckfall `dot`) hatten keine
 * gefuellte Fassung. Seit
 * AGE-1018 ist das die EINZIGE Unterscheidung im eingeklappten Zustand, also
 * muss sie fuer alle gelten.
 *
 * DIE LISTE WIRD ABGELEITET, NICHT ABGESCHRIEBEN — und sie hat ZWEI Quellen,
 * weil die Leiste zwei hat: `navItems` fuer „Entdecken" und „Mein Bereich", und
 * die Nachschuebe in `AppShell` fuer „Meine Anfragen", „Support" und
 * „Administration". Eine Liste aus nur einer Quelle hat bei der ersten Messung
 * dieses Changes genau die drei Luecken uebersehen, weil sie alle in der
 * zweiten lagen.
 */
const AUS_NAVITEMS = navItems
  .filter((i) => i.section === "entdecken" || i.section === "mein-bereich")
  .map((i) => i.path);

/** Was `AppShell` zusaetzlich einhaengt — mit Zeilenverweis, nicht geraten. */
const AUS_APPSHELL = [
  "/kontakte", // „Meine Anfragen", wenn offene vorliegen
  "/hilfe/tutorials", // Abschnitt „Support"
  "/admin",
  "/admin/mitglieder",
  "/admin/feedback",
  // AGE-631, und er hat beim ersten Durchgang GEFEHLT — gefunden vom
  // Code-Review. Genau der Fehler, gegen den der Kommentar darueber
  // argumentiert, eine Ebene tiefer wiederholt: diese Haelfte der Liste ist
  // abgeschrieben, nicht abgeleitet, weil `AppShell` die Abschnitte im Rumpf
  // einer Komponente baut und sie sich nicht importieren lassen. Wer dort
  // einen Eintrag nachschiebt, muss ihn HIER nachtragen.
  "/admin/neuigkeiten",
];

describe("Jedes Symbol der Leiste wechselt aktiv seine FORM", () => {
  it("leitet die Pfadliste aus beiden Quellen ab und findet dort etwas", () => {
    // Positivkontrolle: ohne sie waere eine leere Liste gruen, und der Fall
    // darunter prueefte nichts.
    expect(AUS_NAVITEMS.length).toBeGreaterThan(0);
    expect(AUS_APPSHELL.length).toBeGreaterThan(0);
  });

  it.each([...AUS_NAVITEMS, ...AUS_APPSHELL])(
    "%s: aktiv massiv, ruhend Kontur",
    (pfad) => {
      const aktiv = render(<NavIcon path={pfad} active />);
      expect(form(aktiv.container), `${pfad} aktiv`).toBe("massiv");
      aktiv.unmount();

      const ruhend = render(<NavIcon path={pfad} />);
      expect(form(ruhend.container), `${pfad} ruhend`).toBe("kontur");
      ruhend.unmount();
    },
  );
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
