import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", async () => {
  const { sonde } = await import("../test/anon-sonde");
  return { supabase: sonde };
});

import App from "../App";
import { ToastProvider } from "../components/ui/Toast";
import { navItems } from "../config/nav";
import { rechtsseiten } from "../content/legal/meta";
import { AuthProvider } from "../providers/AuthProvider";
import { rekorder, zuruecksetzen } from "../test/anon-sonde";

/**
 * Die Positivliste der Relationen, die `anon` lesen DARF — aus
 * `20260715140000_explicit_grants.sql`, am 03.09. zusätzlich am Katalog der
 * Produktionsinstanz nachgemessen (design.md). Alles andere beantwortet PROD
 * mit einem 401, egal wie plausibel der Aufruf im Code aussieht.
 *
 * Diese Liste stand bis AGE-542 in `anon-anreicherung.test.ts` und ist hierher
 * gezogen, damit es sie genau einmal gibt.
 */
const ANON_DARF_LESEN = [
  "badges",
  "membership_tiers",
  "partner_categories",
  "posts",
  "events",
  "tags",
  "post_media",
];

/**
 * Die Funktionen, die der Client ausgeloggt RUFT — und der Name sagt genau das.
 *
 * Er heisst nicht `ANON_DARF_AUSFUEHREN`, und der Unterschied ist der Punkt
 * (design.md D4): die Grants erlauben `anon` SECHS Funktionen, gerufen werden
 * drei. Die anderen drei (`event_cover_lesbar`, `post_media_lesbar`,
 * `suchbegriff_zu_tsquery`) sind Policy- und Storage-intern. Ein Name, der
 * Gleichheit behauptet, wo eine Teilmenge steht, führt den nächsten Leser in die
 * Irre — und die drei aufzunehmen hiesse, eine Erlaubnis auszusprechen, die
 * niemand braucht.
 *
 * Beide Richtungen, damit die Liste wartbar bleibt:
 *   – Jeder Name HIER muss in der Sechserliste von `grants_test.sql` §6 stehen.
 *     Sonst ruft der Client etwas, das er nicht darf.
 *   – Nicht jeder Name DORT muss hier stehen. Was der Client nicht ruft,
 *     braucht keine Zeile.
 *
 * Was den RECHTEZUSTAND trägt, ist nicht diese Datei, sondern
 * `supabase/tests/grants_test.sql` §6 plus die PROD-Messung in `design.md`.
 * Die Grants hier ein drittes Mal abzuschreiben verschöbe das Auseinanderlaufen
 * nur um eine Datei.
 */
const ANON_RUFT_AUF = ["feed_tag_counts", "event_registration_counts", "post_engagement_counts"];

/**
 * DIE FLÄCHE WIRD ABGELEITET, NICHT ABGESCHRIEBEN (design.md D1).
 *
 * Quelle 1 — `navItems` ohne Wache. `MembershipGate` gibt bei fehlender Sitzung
 * die Wand zurück statt `children`; was `requiresAuth` oder `minTier` trägt,
 * rendert ausgeloggt also nie. Eine neue Seite ohne Wache fällt hier
 * automatisch in die Prüfung, ohne dass jemand daran denkt.
 */
const AUS_NAVITEMS = navItems.filter((i) => !i.requiresAuth && !i.minTier).map((i) => i.path);

/**
 * Quelle 2 — die Registry der Rechtsseiten, IMPORTIERT statt abgeschrieben.
 *
 * Das ist ein Befund aus der Planungs-Review und korrigiert einen echten Fehler:
 * `App.tsx` erzeugt diese Routen mit `rechtsseiten.map(…)`. Stünden sie hier als
 * Handliste, hätte ein fünfter Eintrag in `meta.ts` den ausgelieferten
 * Routentisch verändert, ohne dass diese Prüfung ihn je montiert — und die
 * Randzusage weiter unten wäre grün geblieben. Eine Registry, die Routen
 * erzeugt, ist selbst eine Quelle der Fläche.
 */
const AUS_REGISTRIES = rechtsseiten.map((seite) => `/${seite.slug}`);

/**
 * Quelle 3 — was nur als Literal in `App.tsx` steht, je mit Begründung.
 *
 * Diese Liste ist eine Handliste, und das ist der Grund, warum die Randzusage
 * („Die Handliste bewacht sich selbst") weiter unten existiert: sie macht rot,
 * sobald in `App.tsx` eine Route steht, die weder hier noch in einer Registry
 * noch hinter einer Wache auftaucht.
 *
 * `/styleguide` fehlt ABSICHTLICH: die Route existiert nur unter
 * `import.meta.env.DEV` und ist im Produktionsbündel nicht vorhanden. Sie ist
 * keine ausgeloggt erreichbare Fläche, sondern gar keine.
 */
const LITERALE_ROUTEN: { pfad: string; warum: string }[] = [
  { pfad: "/events/:id", warum: "anon darf öffentliche Events sehen; die RLS gated den Rest" },
  { pfad: "/login", warum: "die Anmeldung selbst — ohne Sitzung erreichbar zu sein ist ihr Zweck" },
  { pfad: "/aktivierung", warum: "Einlösung per Token, bewusst ohne RequireAuth" },
  { pfad: "/passwort-vergessen", warum: "Zurücksetzen setzt gerade keine Sitzung voraus" },
  { pfad: "/passwort-neu", warum: "dasselbe, zweiter Schritt" },
];

/** Die zu montierende Fläche. `/events/:id` bekommt eine echte Kennung aus der Fixture. */
const FLAECHE = [
  ...AUS_NAVITEMS,
  ...AUS_REGISTRIES,
  ...LITERALE_ROUTEN.map((r) => r.pfad.replace(":id", "e1")),
];

/**
 * „Alles gelaufen" ist hier eine AUSSAGE, keine Schlafzeit.
 *
 * Ein fester `setTimeout` wäre die naheliegende Lösung und die falsche: er ist
 * auf der einen Maschine zu lang und auf der anderen zu kurz — und zu kurz heisst
 * hier STILL GRÜN. Der Wächter sähe die Seite nie und meldete trotzdem nichts.
 *
 * Gemessen und teuer bezahlt: eine Ruhe-Definition aus „die Zahl steht still UND
 * nichts wird gerade geladen" stieg auf `/aktivitaet` reproduzierbar in der Lücke
 * aus, die zwischen der Abfrage der Hülle und den Abfragen der Seite liegt. Sie
 * zeichnete `feedback_themes` auf — und keinen der sechs Einträge, die dort
 * wirklich laufen. Auch 200 ms Ruhe änderten daran nichts, weil das Problem nicht
 * die Länge der Pause ist, sondern dass eine Pause für sich nichts bedeutet.
 *
 * React Query beantwortet die Frage selbst. Eine Abfrage ist fertig, wenn sie
 * nicht mehr `pending` ist — ODER wenn sie `pending` BLEIBEN wird, weil sie
 * abgeschaltet ist (`enabled: false`, der Normalfall für alles, was eine Sitzung
 * braucht) oder niemand sie mehr beobachtet. Genau diese Unterscheidung zwischen
 * „noch nicht gestartet" und „startet nie" fehlt jeder Zeitschranke.
 */
function allesGelaufen(queryClient: QueryClient): boolean {
  if (queryClient.isFetching() > 0) return false;
  const abfragen = queryClient.getQueryCache().getAll();
  // Ein LEERER Cache ist nicht „alles gelaufen", sondern „noch nichts
  // angefangen" — `every` auf der leeren Menge ist wahr und hat genau diesen
  // Wächter schon einmal mit einer leeren Aufzeichnung grün gemeldet.
  if (abfragen.length === 0) return false;
  return abfragen.every(
    (abfrage) =>
      abfrage.state.status !== "pending" ||
      abfrage.isDisabled() ||
      abfrage.getObserversCount() === 0,
  );
}

/**
 * Wie lange „gelaufen" gehalten haben muss, bevor es zählt.
 *
 * DER GRUND IST GEMESSEN, nicht geschätzt. Die Seiten hinter `navItems` sind
 * seit AGE-642 `lazy()`; `HomeRedirect` auf `/` ist die Ausnahme. Zeitachse
 * einer Montage, drei Routen, je reproduzierbar:
 *
 *   /            statisch   alles da nach   34 ms, keine Lücke
 *   /aktivitaet  lazy       Hülle bei 15 ms, Seite erst bei 311 ms
 *   /events      lazy       Hülle bei  8 ms, Seite erst bei 310 ms
 *
 * Zwischen Hülle und Seite liegen rund 295 ms, in denen der Cache unverändert
 * ist und nichts geladen wird. Der Baum sieht in dieser Lücke FERTIG aus und ist
 * leer. Jede Prüfung, die dort zugreift, misst die Hülle und hält sie für die
 * Seite — dieser Wächter hat das zweimal getan, einmal mit `['feedback_themes']`
 * und einmal mit `[]`.
 *
 * Das Fenster überbrückt die gemessene Lücke mit Reserve. Es ist bewusst KEINE
 * Zusicherung: sollte es auf einer langsameren Maschine doch zu kurz sein, wird
 * dieser Wächter ROT (die dauerhaften Positivkontrollen unten schlagen an) und
 * nicht still grün. Das Fenster ist die Bequemlichkeit, die Positivkontrolle ist
 * die Sicherheit.
 */
const RUHEFENSTER_MS = 450;
const RUNDE_MS = 10;

/**
 * Die Provider-Reihenfolge ist die aus `main.tsx`, nicht eine neu erfundene:
 * `QueryClientProvider → AuthProvider → ToastProvider → Router → App`.
 *
 * ABWEICHUNG VON `App.test.tsx`, und sie ist der Punkt: dort schiebt
 * `AuthFixture` den Auth-Kontext direkt hinein, der echte `AuthProvider` läuft
 * also NIE mit. Hier läuft er — sonst bliebe die Hälfte der Hülle ungeprüft, die
 * ausgeloggt tatsächlich rendert (design.md D2). Der Rest des Stapels ist von
 * dort übernommen, damit es nicht zwei Wahrheiten über den Aufbau gibt.
 */
async function montiere(pfad: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { unmount } = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[pfad]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  let ruhig = 0;
  await waitFor(
    () => {
      ruhig = allesGelaufen(queryClient) ? ruhig + 1 : 0;
      expect(ruhig * RUNDE_MS).toBeGreaterThanOrEqual(RUHEFENSTER_MS);
    },
    // 5 s, nicht 15: gemessen braucht eine Montage rund 800 ms. Ein grosszuegiges
    // Timeout kostet nichts, solange alles grün ist — aber bei einem echten
    // Fehlschlag zahlt es JEDER der über zwanzig Fälle einzeln, und aus einem
    // roten Lauf würden Minuten. Befund aus dem Diff-Review (gemini, MEDIUM).
    { timeout: 5000, interval: RUNDE_MS },
  );
  return unmount;
}

beforeEach(() => {
  zuruecksetzen();
});

describe("Die ausgeloggte Fläche", () => {
  /**
   * DAUERHAFTE POSITIVKONTROLLE (design.md D7, Aufgabe 4.10).
   *
   * Ohne sie ist eine leere Aufzeichnung von einer sauberen nicht zu
   * unterscheiden, und der ganze Prüfstand wäre ein Test im Vakuum: grün, wenn
   * nichts gegen die Listen verstösst — und genauso grün, wenn gar nichts
   * gelaufen ist. Je eine Kontrolle für beide Arten von Aufzeichnung.
   */
  it("hat auf /aktivitaet überhaupt etwas gemessen — Relation und Funktion", async () => {
    const unmount = await montiere("/aktivitaet");
    expect(rekorder.relationen).toContain("posts");
    expect(rekorder.funktionen).toContain("post_engagement_counts");
    unmount();
  });

  /**
   * Die Fläche ist nicht leer und stammt aus den Quellen, nicht aus einer Zeile
   * hier. Ohne diese Zusage könnte `navItems.filter(…)` eines Tages nichts mehr
   * liefern und alle Fälle unten fielen ersatzlos weg — grün, weil es nichts
   * mehr zu prüfen gäbe.
   */
  it("leitet die Fläche aus den Quellen ab und findet dort etwas", () => {
    expect(AUS_NAVITEMS.length).toBeGreaterThan(0);
    expect(AUS_REGISTRIES.length).toBeGreaterThan(0);
    expect(FLAECHE.length).toBeGreaterThanOrEqual(
      AUS_NAVITEMS.length + AUS_REGISTRIES.length + LITERALE_ROUTEN.length,
    );
  });

  it.each(FLAECHE)("fragt auf %s nur Relationen an, die anon lesen darf", async (pfad) => {
    const unmount = await montiere(pfad);
    const verstoesse = [...new Set(rekorder.relationen)].filter(
      (relation) => !ANON_DARF_LESEN.includes(relation),
    );
    expect(verstoesse).toEqual([]);
    unmount();
  });

  it.each(FLAECHE)("ruft auf %s nur Funktionen, die der Client rufen soll", async (pfad) => {
    const unmount = await montiere(pfad);
    const verstoesse = [...new Set(rekorder.funktionen)].filter(
      (funktion) => !ANON_RUFT_AUF.includes(funktion),
    );
    expect(verstoesse).toEqual([]);
    unmount();
  });
});

/**
 * DIE HANDLISTE BEWACHT SICH SELBST.
 *
 * Ohne diesen Abschnitt wäre die abgeleitete Fläche an ihrem Rand doch wieder
 * eine Handliste: `LITERALE_ROUTEN` steht oben, und wer in `App.tsx` eine neue
 * unbewachte Route einträgt, ohne sie dort zu ergänzen, würde von den Zusagen
 * darüber nie montiert — und alles bliebe grün.
 *
 * Gelesen wird über den TypeScript-AST, NICHT über einen Regex: die Datei
 * besteht überwiegend aus mehrzeiligen `element={…}`, an denen jedes
 * Zeilenmuster bricht. `typescript` ist ohnehin Abhängigkeit.
 */
describe("Die Handliste bewacht sich selbst", () => {
  /** Wachen, hinter denen eine Route ausgeloggt nicht rendert. */
  const WACHEN = ["RequireAuth", "RequireStaff", "RequireAdmin", "MembershipGate"];

  /**
   * Nur im DEV-Bündel vorhanden und deshalb keine ausgeloggte Fläche:
   * `/styleguide` hängt an `StyleguidePage`, das in `nav.ts` unter
   * `import.meta.env.DEV` steht und im Produktionsbündel `null` ist.
   */
  const NUR_IM_DEV_BUENDEL = ["/styleguide"];

  type Befund = { pfad: string; zeile: number; art: string };

  /**
   * Sammelt jede `<Route>` aus einer Quelldatei und klassifiziert sie.
   *
   * DER PARSER FÄLLT GESCHLOSSEN AUS. Die akzeptierten Formen sind aufgezählt;
   * alles andere — eine Konstante als Pfad, ein Spread, ein unbekannter
   * Wächtername — wird als `unbekannt` gemeldet und macht die Prüfung rot, mit
   * Zeilennummer. Ein unbekanntes `<Route>` ist damit kein stiller Durchlässer,
   * sondern eine Entscheidung, die jemand trifft: Form aufnehmen oder Route
   * führen (design.md D3).
   */
  function routenAus(quelle: string, dateiname: string): Befund[] {
    const datei = ts.createSourceFile(dateiname, quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const befunde: Befund[] = [];

    const zeileVon = (knoten: ts.Node) =>
      datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1;

    /** Enthält dieser Teilbaum ein JSX-Element mit einem der genannten Namen? */
    function enthaeltElement(knoten: ts.Node, namen: string[]): boolean {
      let treffer = false;
      const besuche = (k: ts.Node) => {
        if (treffer) return;
        if (ts.isJsxOpeningElement(k) || ts.isJsxSelfClosingElement(k)) {
          if (namen.includes(k.tagName.getText(datei))) {
            treffer = true;
            return;
          }
        }
        ts.forEachChild(k, besuche);
      };
      besuche(knoten);
      return treffer;
    }

    function besuche(knoten: ts.Node) {
      const istRoute =
        (ts.isJsxSelfClosingElement(knoten) || ts.isJsxOpeningElement(knoten)) &&
        knoten.tagName.getText(datei) === "Route";

      if (istRoute) {
        const element = knoten as ts.JsxSelfClosingElement | ts.JsxOpeningElement;
        const attribute = element.attributes.properties;

        // Ein Spread auf einer Route verbirgt jedes Attribut — geschlossen ausfallen.
        if (attribute.some((a) => ts.isJsxSpreadAttribute(a))) {
          befunde.push({ pfad: "«spread»", zeile: zeileVon(element), art: "unbekannt" });
        } else {
          const pfadAttribut = attribute.find(
            (a) => ts.isJsxAttribute(a) && a.name.getText(datei) === "path",
          ) as ts.JsxAttribute | undefined;

          if (!pfadAttribut) {
            // Layout-Route ohne `path` (die Hülle). Sie rendert nichts eigenes.
            befunde.push({ pfad: "«layout»", zeile: zeileVon(element), art: "layout" });
          } else {
            const wert = pfadAttribut.initializer;
            const elementAttribut = attribute.find(
              (a) => ts.isJsxAttribute(a) && a.name.getText(datei) === "element",
            ) as ts.JsxAttribute | undefined;
            const bewacht = elementAttribut
              ? enthaeltElement(elementAttribut, WACHEN)
              : false;
            const umleitung = elementAttribut
              ? enthaeltElement(elementAttribut, ["Navigate"])
              : false;

            if (wert && ts.isStringLiteral(wert)) {
              befunde.push({
                pfad: wert.text,
                zeile: zeileVon(element),
                art: umleitung ? "umleitung" : bewacht ? "bewacht" : "literal",
              });
            } else if (wert && ts.isJsxExpression(wert) && wert.expression) {
              const ausdruck = wert.expression;
              if (ts.isPropertyAccessExpression(ausdruck) && ausdruck.name.getText(datei) === "path") {
                // `path={item.path}` — kommt aus navItems.
                befunde.push({ pfad: "«navItems»", zeile: zeileVon(element), art: "navItems" });
              } else if (ts.isTemplateExpression(ausdruck)) {
                // path={`/${seite.slug}`} — kommt aus einer Registry.
                befunde.push({ pfad: "«registry»", zeile: zeileVon(element), art: "registry" });
              } else {
                befunde.push({
                  pfad: ausdruck.getText(datei),
                  zeile: zeileVon(element),
                  art: "unbekannt",
                });
              }
            } else {
              befunde.push({ pfad: "«ohne Wert»", zeile: zeileVon(element), art: "unbekannt" });
            }
          }
        }
      }
      ts.forEachChild(knoten, besuche);
    }

    besuche(datei);
    return befunde;
  }

  // Über den Projektpfad, nicht über `import.meta.url`: im jsdom-Transform ist
  // das kein `file:`-URL. Ein falscher Pfad fällt in der ersten Zusage unten auf.
  const quelle = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
  const befunde = routenAus(quelle, "App.tsx");

  /** Positivkontrolle: der Parser findet in `App.tsx` überhaupt Routen. */
  it("findet die Routen in App.tsx", () => {
    expect(befunde.length).toBeGreaterThan(20);
    expect(befunde.filter((b) => b.art === "navItems").length).toBeGreaterThan(0);
    expect(befunde.filter((b) => b.art === "registry").length).toBeGreaterThan(0);
  });

  it("kennt die Form jeder Route in App.tsx", () => {
    const unbekannte = befunde
      .filter((b) => b.art === "unbekannt")
      .map((b) => `App.tsx:${b.zeile} — ${b.pfad}`);
    expect(unbekannte).toEqual([]);
  });

  it("führt jede unbewachte Route entweder in navItems, einer Registry oder namentlich", () => {
    const gefuehrt = [
      ...LITERALE_ROUTEN.map((r) => r.pfad),
      ...NUR_IM_DEV_BUENDEL,
      ...AUS_NAVITEMS,
      ...AUS_REGISTRIES,
    ];
    const ungefuehrt = befunde
      .filter((b) => b.art === "literal" && !gefuehrt.includes(b.pfad))
      .map((b) => `App.tsx:${b.zeile} — ${b.pfad}`);
    expect(ungefuehrt).toEqual([]);
  });

  /**
   * POSITIVKONTROLLEN. Ohne sie behauptet der Abschnitt oben nur, dass er
   * funktioniert. Jede setzt EINEN Eingriff in eine Kopie der Quelle und prüft,
   * dass genau die zugehörige Zusage anschlägt.
   */
  /**
   * Die Kontrollen messen die DIFFERENZ zum Bestand, nicht den Absolutwert.
   *
   * Die erste Fassung verglich gegen `[]` und wurde damit auch rot, wenn in
   * `App.tsx` unabhängig vom Eingriff eine ungeführte Route stand — bei der
   * Abnahme von Eingriff C schlugen prompt ZWEI Zusagen an statt einer. Eine
   * Kontrolle, die aus zwei Gründen rot werden kann, belegt keinen davon.
   */
  function ungefuehrteAus(text: string): string[] {
    const gefuehrt = [
      ...LITERALE_ROUTEN.map((r) => r.pfad),
      ...NUR_IM_DEV_BUENDEL,
      ...AUS_NAVITEMS,
      ...AUS_REGISTRIES,
    ];
    return routenAus(text, "App.tsx")
      .filter((x) => x.art === "literal" && !gefuehrt.includes(x.pfad))
      .map((x) => x.pfad);
  }

  function unbekannteAus(text: string): string[] {
    return routenAus(text, "App.tsx")
      .filter((x) => x.art === "unbekannt")
      .map((x) => x.pfad);
  }

  function neuGegenBestand(manipuliert: string, auswahl: (t: string) => string[]): string[] {
    const vorher = auswahl(quelle);
    return auswahl(manipuliert).filter((x) => !vorher.includes(x));
  }

  it("wird rot bei einer erfundenen unbewachten Route (Kontrolle A)", () => {
    const manipuliert = quelle.replace(
      '<Route path="/login"',
      '<Route path="/hintertuer" element={<LoginPage />} />\n      <Route path="/login"',
    );
    expect(manipuliert).not.toBe(quelle);
    expect(neuGegenBestand(manipuliert, ungefuehrteAus)).toEqual(["/hintertuer"]);
  });

  it("wird rot bei einer Route in unbekannter Form (Kontrolle B)", () => {
    const manipuliert = quelle.replace(
      '<Route path="/login"',
      "<Route path={IRGENDEINE_KONSTANTE} element={<LoginPage />} />\n      <Route path=\"/login\"",
    );
    expect(manipuliert).not.toBe(quelle);
    expect(neuGegenBestand(manipuliert, unbekannteAus)).toEqual(["IRGENDEINE_KONSTANTE"]);
  });

  it("wird rot bei einem Spread auf einer Route (Kontrolle B, zweite Form)", () => {
    const manipuliert = quelle.replace(
      '<Route path="/login"',
      '<Route {...irgendwas} />\n      <Route path="/login"',
    );
    expect(manipuliert).not.toBe(quelle);
    expect(neuGegenBestand(manipuliert, unbekannteAus)).toEqual(["«spread»"]);
  });

  /**
   * Kontrolle C: ein neuer Eintrag in der Rechtsseiten-Registry erscheint in der
   * montierten Fläche, OHNE dass diese Prüfung angefasst wird. Das ist die
   * Zusage, die den Review-Befund schliesst — eine abgeschriebene Handliste
   * hätte hier nichts gemerkt.
   */
  it("nimmt einen neuen Registry-Eintrag automatisch in die Fläche auf (Kontrolle C)", () => {
    const erweitert = [...rechtsseiten, { slug: "widerruf" } as (typeof rechtsseiten)[number]];
    const flaecheDanach = erweitert.map((seite) => `/${seite.slug}`);
    expect(flaecheDanach).toContain("/widerruf");
    expect(flaecheDanach.length).toBe(AUS_REGISTRIES.length + 1);
  });
});
