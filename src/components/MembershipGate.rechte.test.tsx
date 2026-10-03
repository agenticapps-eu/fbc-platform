import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MembershipGate from "./MembershipGate";
import type { Berechtigung } from "../config/berechtigungen";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";

/**
 * `MembershipGate` mit einem Feature-Recht — und der Unterschied zwischen
 * „weiss ich noch nicht" und „kann ich nicht wissen" (AGE-1000).
 *
 * ══ WARUM EINE EIGENE DATEI ═══════════════════════════════════════════════
 * `MembershipGate.test.tsx` geht über den echten `App`-Baum und den echten
 * Hook; die Rechte kommen dort aus dem geseeten Query-Cache. Ein FEHLER lässt
 * sich so nicht herstellen — `setQueryData` kennt keinen Fehlerzustand. Diese
 * Datei mockt deshalb `useMeineRechte` und prüft genau die drei Zustände, die
 * das Gate unterscheiden muss.
 *
 * ══ DIE REGEL, DIE HIER GEMESSEN WIRD ═════════════════════════════════════
 *  * `laedt`  → nichts rendern. Kein Flackern; der Zustand löst sich auf.
 *  * `fehler` → DURCHLASSEN. Die Wand ist Komfort, die Grenze ist die RLS.
 *    Wer hier mauert, nimmt einem berechtigten Mitglied den Bereich weg, weil
 *    das Netz gewackelt hat — und behauptet dabei etwas über seine Stufe, das
 *    er nicht weiss.
 *  * sonst    → das Recht entscheidet.
 *
 * Befund des Diff-Reviews (codex, MEDIUM): die erste Fassung machte aus einem
 * Abruffehler ein leeres Rechte-Array und zeigte die Wand. Dasselbe Muster wie
 * `(levelRank ?? 0)` in AGE-903, nur eine Ebene höher.
 */

let rechte: Berechtigung[] = [];
let laedt = false;
let fehler = false;
vi.mock("../hooks/useDarf", () => ({
  useMeineRechte: () => ({ rechte, laedt, fehler }),
  useDarf: (k: Berechtigung) => ({ darf: rechte.includes(k), laedt, fehler }),
}));

function zeige() {
  return render(
    <AuthFixture value={authAsTier("impact")}>
      <MemoryRouter>
        <MembershipGate darf="verzeichnis.suchen">
          <p>Inhalt</p>
        </MembershipGate>
      </MemoryRouter>
    </AuthFixture>,
  );
}

const inhalt = () => screen.queryByText("Inhalt");
const wand = () => screen.queryByRole("heading", { name: /Dieser Bereich ist ab/ });

describe("MembershipGate mit einem Feature-Recht", () => {
  beforeEach(() => {
    rechte = [];
    laedt = false;
    fehler = false;
  });

  it("zeigt den Inhalt, wenn das Recht da ist", () => {
    rechte = ["verzeichnis.suchen"];
    zeige();
    expect(inhalt()).toBeInTheDocument();
    expect(wand()).not.toBeInTheDocument();
  });

  it("zeigt die Wand, wenn das Recht fehlt", () => {
    rechte = ["suche_biete"];
    zeige();
    expect(wand()).toBeInTheDocument();
    expect(inhalt()).not.toBeInTheDocument();
  });

  it("zeigt WEDER Inhalt NOCH Wand, solange die Rechte laden", () => {
    // Beides prüfen, nicht nur die Wand: „nichts" ist der gemeinte Zustand, und
    // ein Test nur auf die Abwesenheit der Wand wäre auch erfüllt, wenn das
    // Gate im Ladefenster den Inhalt durchliesse.
    laedt = true;
    zeige();
    expect(wand()).not.toBeInTheDocument();
    expect(inhalt()).not.toBeInTheDocument();
  });

  it("lässt bei einem gescheiterten Abruf DURCH statt zu mauern", () => {
    fehler = true;
    zeige();
    expect(inhalt()).toBeInTheDocument();
    expect(wand()).not.toBeInTheDocument();
  });

  it("lässt durch, auch wenn der Fehler mit fehlendem Recht zusammenfällt", () => {
    // Der teuerste Fall: die Antwort ist leer UND der Abruf gescheitert. Ohne
    // diese Zusage wäre die Zeile darüber auch von einem Gate erfüllt, das bloss
    // auf ein nichtleeres Rechte-Array schaut.
    rechte = [];
    fehler = true;
    zeige();
    expect(inhalt()).toBeInTheDocument();
  });
});
