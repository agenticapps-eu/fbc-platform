import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MembershipSummary } from "./MembershipSummary";

// AGE-907: ohne `MemoryRouter`. Die Karte enthält keinen Link mehr, seit
// `showManageCta` mit dem Kaufweg entfallen ist — ein Router drumherum wäre
// Kulisse und ließe den nächsten Leser eine Navigation vermuten, die es hier
// nicht gibt.
function renderSummary(current: string | null) {
  render(<MembershipSummary current={current} />);
}

describe("MembershipSummary", () => {
  /**
   * AGE-969: DIESE ZUSAGE IST GEKIPPT, und zwar absichtlich.
   *
   * Sie hielt fest, dass die Karte für ACTIVE den Namen „Active" und als
   * nächsten Schritt „Boost" zeigt — also genau das, was die Oberfläche seit
   * AGE-969 nicht mehr sagt. Der nächste Schritt wird jetzt aus den GENANNTEN
   * Stufen gesucht, und über ACTIVE liegt darin keine.
   *
   * Die alte Fassung steht in der Historie dieses Commits; was sie prüfte,
   * prüft jetzt die Zeile darunter in der anderen Richtung.
   */
  it("nennt für eine Stufe ausserhalb des Clubs weder Namen noch nächsten Schritt", () => {
    renderSummary("active");
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.queryByText(/Nächster Schritt/)).toBeNull();
    // Positivkontrolle: die Karte rendert sehr wohl etwas, nur eben keine
    // Stufe. Ohne diese Zeile wäre der Test auch grün, wenn sie leer bliebe.
    expect(screen.getByText(/Clubzugang beginnt bei Discover/)).toBeInTheDocument();
  });

  it("nennt innerhalb des Clubs Namen und nächsten Schritt", () => {
    // Die Gegenprobe zur Zeile darüber — und zugleich der Ersatz für das, was
    // die gekippte Zusage ursprünglich meinte.
    renderSummary("discover");
    expect(screen.getByText("Discover")).toBeInTheDocument();
    expect(screen.getByText(/Nächster Schritt: Focus/)).toBeInTheDocument();
  });

  it("has no next step for the top tier", () => {
    renderSummary("impact");
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.queryByText(/Nächster Schritt/)).toBeNull();
  });

  /**
   * AGE-969: AUCH DIESE ZUSAGE IST GEKIPPT. Der Rückfall auf `DEFAULT_LEVEL`
   * besteht weiter — er liegt nur ausserhalb des Clubs und wird deshalb nicht
   * mehr benannt. Geprüft wird jetzt, dass daraus kein roher Schlüssel und
   * kein Ersatzname wird.
   */
  it("fällt bei null auf die Vorgabestufe zurück, ohne sie zu benennen", () => {
    renderSummary(null);
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.queryByText("active")).toBeNull();
    expect(screen.getByText(/Clubzugang beginnt bei Discover/)).toBeInTheDocument();
  });

  // AGE-907: Zwei Zusagen standen hier — „renders the manage CTA only when
  // requested" und „hides the CTA by default". Der Knopf ist mit dem ruhenden
  // Kaufweg entfallen, also gibt es keine Bedingung mehr zu prüfen, sondern nur
  // noch eine Abwesenheit. Und die trägt eine Positivkontrolle: ohne die zweite
  // Zeile wäre der Test auch grün, wenn die Karte gar nichts mehr rendert.
  it("trägt überhaupt keinen Weg zur Mitgliedschaft mehr", () => {
    renderSummary("discover");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Deine Mitgliedschaft")).toBeInTheDocument();
  });
});
