import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import { LEVEL_RANK } from "../config/levels";
import { navItems } from "../config/nav";

/**
 * Der Abschnitt „Support" (AGE-904 für die Einträge, AGE-929 für die Form).
 *
 * Die Zusage ist dreifach, weil die Leiste drei Gestalten hat: offen,
 * eingeklappt und als Schublade. Bis AGE-904 stand hier ein einzelner
 * Feedback-Knopf; ein Test nur an der offenen Leiste wäre grün geblieben,
 * während der Eintrag auf dem Telefon fehlt — und das Telefon ist der Ort, an
 * dem jemand nach Hilfe sucht.
 *
 * SEIT AGE-929 ist er ein gewöhnlicher Abschnitt zwischen „Mein Bereich" und
 * „Administration", kein Sonderbau am Fuss mehr. Damit ist die eigene
 * `<nav aria-label="Support">`-Landmarke fort — die Zusagen unten finden ihn
 * über seine Überschrift, so wie man ihn auch sieht.
 *
 * Auf der untersten Stufe angemeldet (`basic`), nicht als `impact`: Hilfe ist
 * keine Frage der Mitgliedsstufe, und wer sie am nötigsten braucht, hat am
 * wenigsten Rechte. Ein Test als `impact` sähe ein fehlendes `minTier` nie.
 */

const BASIC = fakeAuthValue({
  user: { id: "u1", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "basic",
  levelRank: LEVEL_RANK.basic,
});

/**
 * Dasselbe Konto mit Admin-Rolle — nur für die Reihenfolge der Abschnitte.
 *
 * Ohne sie wäre „Support steht VOR Administration" gar nicht prüfbar: einem
 * Konto ohne Rolle fehlt der Abschnitt, gegen den geprüft wird, und eine
 * Fassung, die Support hinter die Administration hängt, bliebe grün.
 */
/**
 * Ohne Konto. Der Abschnitt steht auch dann da — unbedingt, wie vor AGE-929 —,
 * aber `FeedbackButton` gibt ohne Konto `null` zurück: Feedback ist ohne Konto
 * nicht speicherbar, und ein Knopf, der nur scheitern kann, ist ein Versprechen
 * ins Leere.
 *
 * Die Zusage steht hier, seit der Code-Review darauf gezeigt hat, dass die
 * Anforderung „genau zwei Einträge" den ausgeloggten Fall überdehnte. Am
 * Verhalten ändert dieser Change nichts — nur daran, wie sichtbar es ist: aus
 * einem Block am Fuss ist ein Abschnitt mit eigener Überschrift und eigener
 * Trennlinie geworden.
 */
const ANON = fakeAuthValue({ user: null, tier: null, levelRank: null });

const ADMIN = fakeAuthValue({
  user: { id: "u2", email: "adam@demo.local" } as AuthContextValue["user"],
  tier: "basic",
  levelRank: LEVEL_RANK.basic,
  staffRole: "admin",
});

/** Steuerbares matchMedia — wie in `AppShell.overlay.test.tsx`. */
function breite(breitGenug: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? true : breitGenug,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

/**
 * Die Überschrift der Tutorial-Fläche, abgewartet.
 *
 * `findBy`, nicht `getBy`: die Seite kommt als `lazy()` nach (AGE-642). Und mit
 * eigener Frist statt der voreingestellten Sekunde — im Lauf der GANZEN Suite
 * baut vitest 249 jsdom-Umgebungen nebeneinander auf, und das Nachladen des
 * Moduls dauert dort länger als allein. Einzeln lief die Zusage fünfmal grün
 * und in der vollen Suite rot; ohne diese Zeile wäre sie ein Flake, den beim
 * nächsten roten Lauf jemand für echt hält.
 */
function tutorialUeberschrift() {
  return screen.findByRole(
    "heading",
    { level: 1, name: /so funktioniert der club/i },
    { timeout: 5000 },
  );
}

/**
 * Der Kasten, der den Support-Abschnitt trägt — gefunden über seine
 * Überschrift, nicht über eine Landmarke (die gibt es seit AGE-929 nicht mehr).
 *
 * `closest("div")` ist der Abschnittskasten aus `SidebarNav`: er trägt die
 * Überschrift, die Einträge und den Nachtrag. Ihn zu nehmen statt global zu
 * suchen ist der Unterschied zwischen „die Einträge stehen irgendwo" und „sie
 * stehen IN diesem Abschnitt".
 */
function supportAbschnitt(bereich: HTMLElement = document.body) {
  const griff = within(bereich).getByRole("button", { name: /^Support$/ });
  const kasten = griff.closest("div");
  if (!kasten) throw new Error("Support-Abschnitt hat keinen Kasten");
  return kasten;
}

/**
 * Die Überschriften der klappbaren Abschnitte, in Dokumentreihenfolge.
 *
 * Über `aria-expanded` gefunden, nicht über die Beschriftungen: nur die Griffe
 * der Akkordeons tragen es. Eine Liste bekannter Titel hätte einen vierten
 * Abschnitt übersehen, und seit AGE-929 steht in derselben Landmarke auch der
 * Feedback-Knopf, der kein Griff ist.
 */
function abschnittsgriffe(): string[] {
  const haupt = screen.getByRole("navigation", { name: /hauptnavigation/i });
  return Array.from(haupt.querySelectorAll("button[aria-expanded]")).map((b) =>
    (b.textContent ?? "").trim(),
  );
}

/**
 * Die layoutrelevanten Klassen eines Eintrags, sortiert — Polsterung und
 * Symbolabstand, sonst nichts.
 *
 * Der Ausdruck fängt `gap-`, `gap-x-`, `gap-y-`, `p-` und JEDE gerichtete
 * Polsterung (`px- py- pt- pb- pl- pr- ps- pe-`). Die erste Fassung war
 * `/^(gap|px|py|p)-/` und übersah damit genau die gerichteten — ein Wächter,
 * der nur in eine Richtung hält: `py-2.5` gegen `pt-2 pb-3` zu tauschen wäre
 * unbemerkt durchgegangen.
 *
 * `pointer-events-…` und `placeholder-…` fallen nicht hinein: nach dem `p` muss
 * entweder sofort ein Strich stehen oder genau EIN Buchstabe aus der Liste.
 */
function layout(el: Element): string {
  return Array.from(el.classList)
    .filter((c) => /^(gap(-[xy])?|p[xytblrse]?)-/.test(c))
    .sort()
    .join(" ");
}

function renderApp(start = "/aktivitaet", auth: AuthContextValue = BASIC) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={auth}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[start]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.removeAttribute("style");
});

describe("Support-Abschnitt — offen, eingeklappt, in der Schublade", () => {
  it("führt in der offenen Leiste genau zwei Einträge unter „Support“", () => {
    breite(true);
    renderApp();

    const support = supportAbschnitt();
    expect(within(support).getByRole("button", { name: /^Support$/ })).toBeInTheDocument();
    expect(within(support).getByRole("link", { name: "Tutorials" })).toHaveAttribute(
      "href",
      "/hilfe/tutorials",
    );
    expect(within(support).getByRole("button", { name: /^feedback$/i })).toBeInTheDocument();
    // Genau zwei: ein dritter Weg (etwa zur Mitgliedschaft) gehört nicht in
    // einen Supportbereich, und AGE-907 macht ihn gerade unerreichbar.
    //
    // Zwei Knöpfe, nicht einer: seit AGE-929 ist die Überschrift selbst ein
    // Bedienelement (der Griff des Akkordeons). Sie mitzuzählen ist kein
    // Schönheitsfehler der Zusage, sondern genau das, was den Abschnitt zu
    // einem Abschnitt macht.
    expect(within(support).getAllByRole("link")).toHaveLength(1);
    expect(within(support).getAllByRole("button")).toHaveLength(2);
  });

  it("steht zwischen „Mein Bereich“ und „Administration“", () => {
    // Die Reihenfolge ist die Anforderung (AGE-929), und sie ist nur mit
    // Admin-Rolle vollständig prüfbar — ohne sie fehlt der Abschnitt dahinter.
    breite(true);
    renderApp("/aktivitaet", ADMIN);

    // Die ABSCHNITTSGRIFFE, nicht alle Knöpfe: seit AGE-929 liegt auch der
    // Feedback-Knopf in dieser Landmarke. Griffe sind die einzigen Knöpfe mit
    // `aria-expanded` — das unterscheidet sie, ohne ihre Beschriftungen
    // aufzählen zu müssen.
    expect(abschnittsgriffe()).toEqual(["Mein Bereich", "Support", "Administration"]);
  });

  it("beschliesst die Leiste, wenn das Konto keine Admin-Rolle hat", () => {
    breite(true);
    renderApp();

    expect(abschnittsgriffe()).toEqual(["Mein Bereich", "Support"]);
  });

  it("lässt „Feedback“ weg, wenn niemand angemeldet ist", () => {
    breite(true);
    renderApp("/", ANON);

    // Der Abschnitt steht, „Tutorials" steht — beides unverändert gegenüber dem
    // Zustand vor AGE-929.
    expect(screen.getByRole("button", { name: /^Support$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tutorials" })).toBeInTheDocument();
    // Der Feedback-Eintrag nicht: ohne Konto könnte er nur scheitern.
    expect(screen.queryByRole("button", { name: /^feedback$/i })).toBeNull();
  });

  it("klappt über seine Überschrift zu und wieder auf", () => {
    // Das ist der Unterschied zum Sonderbau: seine Überschrift war ein totes
    // `<p>`. Eine Fassung, die Support ohne `klappbar` einreiht, sieht offen
    // identisch aus und fällt nur hier auf.
    breite(true);
    renderApp();

    const griff = () => screen.getByRole("button", { name: /^Support$/ });
    expect(griff()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(griff());
    expect(griff()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Tutorials" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^feedback$/i })).toBeNull();

    fireEvent.click(griff());
    expect(screen.getByRole("link", { name: "Tutorials" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^feedback$/i })).toBeInTheDocument();
  });

  it("setzt „Feedback“ in dieselbe Form wie „Tutorials“", () => {
    // Die Abnahme verlangt „optisch nicht von den anderen Abschnitten zu
    // unterscheiden". Gemessen an dem, was vorher abwich: Symbolabstand und
    // Polsterung (gap-2/py-2 gegen gap-3/py-2).
    //
    // GLEICHHEIT der layoutrelevanten Klassen, nicht `toContain`: eine
    // `toContain`-Zusage überlebt es, wenn jemand Klassen HINZUFÜGT — beide
    // Teilzeichenketten stünden weiter da, während die Form auseinanderläuft.
    breite(true);
    renderApp();

    const support = supportAbschnitt();
    const tutorials = within(support).getByRole("link", { name: "Tutorials" });
    const feedback = within(support).getByRole("button", { name: /^feedback$/i });
    expect(layout(feedback)).toBe(layout(tutorials));
    // Und die Form ist die der Leiste, nicht irgendeine gemeinsame: liefe
    // jemand beide auf `gap-2` zurück, wäre die Zusage oben weiter grün.
    expect(layout(tutorials)).toBe("gap-3 px-3 py-2");
  });

  it("gibt „Tutorials“ ein eigenes Symbol statt des Platzhalters", () => {
    // `NavIcon` fällt auf `dot` zurück, wenn ein Pfad in `NACH_ROUTE` fehlt —
    // still, nichts schlägt fehl, das Symbol sagt nur nichts mehr. Beim Umzug
    // des Eintrags aus dem Sonderbau nach `SidebarNav` war das der eine
    // lautlose Verlust.
    breite(true);
    renderApp();

    const support = supportAbschnitt();
    const tutorials = within(support).getByRole("link", { name: "Tutorials" });
    const svg = tutorials.querySelector("svg");
    expect(svg).not.toBeNull();
    // Der Platzhalter ist ein einzelner Kreis mit r="3.4"; die Glühbirne sind
    // zwei Pfade. Gegen die FORM geprüft, weil der Glyphname nicht im Markup
    // steht.
    expect(svg?.querySelector('circle[r="3.4"]')).toBeNull();
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("hält beide Einträge eingeklappt benennbar, obwohl die Beschriftung fehlt", () => {
    // Eingeklappt ist das Symbol der einzige Anker, den ein Eintrag hat. Ohne
    // zugänglichen Namen wäre er für Vorlesesoftware ein leerer Knopf.
    localStorage.setItem("fbc.sidebarCollapsed", "1");
    breite(true);
    renderApp();

    const tutorials = screen.getByRole("link", { name: "Tutorials" });
    const feedback = screen.getByRole("button", { name: "Feedback" });
    expect(tutorials).toBeInTheDocument();
    expect(feedback).toBeInTheDocument();
    // Die Überschrift fällt weg — in einem Rail von Symbolbreite hat sie keinen
    // Platz, und damit auch der Griff. Die Namen oben tragen den Abschnitt
    // allein.
    expect(screen.queryByText("Support")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Support$/ })).toBeNull();

    // Die ZWEITE Hälfte der Angleichung. Offen wurde `gap-2` zu `gap-3`,
    // eingeklappt `py-2` zu `py-2.5` — und bis der Code-Review es fand, hielt
    // nur die erste eine Zusage. `py-2.5` zurückzudrehen wäre durch die ganze
    // Suite gerutscht, in genau dem Zustand, für den die Zusage geschrieben
    // wurde.
    expect(layout(feedback)).toBe(layout(tutorials));
    expect(layout(tutorials)).toBe("px-2 py-2.5");
  });

  it("trägt beide Einträge auch in der Schublade", () => {
    breite(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    const schublade = screen.getByRole("dialog", { name: /navigation/i });
    const support = supportAbschnitt(schublade);
    expect(within(support).getByRole("link", { name: "Tutorials" })).toBeInTheDocument();
    expect(within(support).getByRole("button", { name: /^feedback$/i })).toBeInTheDocument();
  });

  it("schliesst die Schublade, wenn jemand aus ihr ins Tutorial geht", async () => {
    // Über den bestehenden `onNavigate`-Weg. Bliebe sie offen, stünde die
    // Navigation über der Seite, die gerade geöffnet wurde — und die Seite
    // dahinter bliebe gesperrt.
    breite(false);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /menü öffnen/i }));

    const schublade = screen.getByRole("dialog", { name: /navigation/i });
    fireEvent.click(within(schublade).getByRole("link", { name: "Tutorials" }));

    expect(screen.queryByRole("dialog", { name: /navigation/i })).toBeNull();
    expect(await tutorialUeberschrift()).toBeInTheDocument();
  });

  it("zeigt die Fläche einem Konto der untersten Stufe vollständig", async () => {
    // Kein `minTier`: was die Anwendung kann, ist keine Frage der Stufe. Stünde
    // hier eine Schranke, käme statt des Tutorials die Wand „Mitglied werden".
    // Die Route wird DIREKT angesteuert und nicht über den Eintrag geklickt:
    // dass der Weg dorthin führt, steht in der Zusage darüber; hier geht es um
    // die Schranke, und die entscheidet sich an der Route, nicht am Klick.
    breite(false);
    renderApp("/hilfe/tutorials");

    expect(await tutorialUeberschrift()).toBeInTheDocument();
    expect(screen.queryByText(/mitglied werden/i)).toBeNull();
  });

  it("lässt die Hauptnavigation unangetastet — der Support ist kein achter Menüeintrag", () => {
    // UMGESTELLT mit AGE-929. Bis dahin prüfte diese Zusage, dass „Tutorials"
    // NICHT in der Hauptnavigations-Landmarke steht — der Sonderbau hatte eine
    // eigene. Seit der Abschnitt ein gewöhnlicher ist, liegt er in derselben
    // Landmarke wie „Mein Bereich" und „Administration", und die alte Fassung
    // wäre schlicht falsch.
    //
    // Was sie MEINTE, gilt unverändert: Tutorials ist keiner der sichtbaren
    // Menüeinträge. Das steht an zwei Stellen, und beide werden geprüft — der
    // Abschnittsschlüssel in `navItems` und die Zahl der sichtbaren Einträge.
    expect(navItems.find((i) => i.path === "/hilfe/tutorials")?.section).toBe("sub");
    expect(navItems.filter((i) => i.section !== "sub")).toHaveLength(7);

    breite(true);
    renderApp();
    const haupt = screen.getByRole("navigation", { name: /hauptnavigation/i });
    // Der Eintrag steht IM Support-Abschnitt und in keinem anderen.
    const support = supportAbschnitt();
    const tutorials = within(haupt).getByRole("link", { name: "Tutorials" });
    expect(support.contains(tutorials)).toBe(true);
    expect(within(haupt).getAllByRole("link", { name: "Tutorials" })).toHaveLength(1);
  });
});
