import { describe, expect, it } from "vitest";
import { BRANCHEN, matchBranche } from "./branchen";

/**
 * Die Branchen-Zuordnung (AGE-537, C6a).
 *
 * In WordPress gibt es kein Branchenfeld; der Filter im Verzeichnis bliebe nach
 * dem Import leer. C10 leitet die Branche deshalb aus dem Freitextfeld
 * „Business" ab — mit dieser Funktion, die hier entsteht und dort aufgerufen
 * wird.
 *
 * Die Zuordnung DARF ungenau sein: jedes Mitglied kann die Branche im Profil
 * ändern. Sie darf nur nicht RATEN — was nicht eindeutig ist, bleibt leer.
 */

describe("BRANCHEN", () => {
  it("ist eine kuratierte, nicht leere Liste mit eindeutigen Werten", () => {
    expect(BRANCHEN.length).toBeGreaterThanOrEqual(10);
    expect(BRANCHEN.length).toBeLessThanOrEqual(15);
    expect(new Set(BRANCHEN.map((b) => b.value)).size).toBe(BRANCHEN.length);
  });
});

describe("matchBranche", () => {
  it("trifft über ein Stichwort", () => {
    expect(matchBranche("Wir bauen und vermieten Wohnimmobilien")).toBe("Immobilien");
  });

  it("ist gegen Groß- und Kleinschreibung unempfindlich", () => {
    expect(matchBranche("STEUERBERATUNG für den Mittelstand")).toBe(
      matchBranche("steuerberatung für den Mittelstand"),
    );
    expect(matchBranche("STEUERBERATUNG für den Mittelstand")).not.toBeNull();
  });

  it("liefert null, wenn kein Stichwort passt", () => {
    expect(matchBranche("Ich mache viele verschiedene Dinge.")).toBeNull();
  });

  it("liefert null bei leerem oder fehlendem Text", () => {
    expect(matchBranche("")).toBeNull();
    expect(matchBranche("   ")).toBeNull();
    expect(matchBranche(null)).toBeNull();
  });

  it("liefert null, wenn zwei verschiedene Branchen treffen", () => {
    // Sonst entschiede die REIHENFOLGE der Liste, in welcher Branche ein
    // Mitglied landet — und die Reihenfolge ist Redaktion, keine Aussage über
    // den Text. Gemeldet im Fremd-Review zum Change (codex, HIGH).
    const text = "Immobilien und Steuerberatung aus einer Hand";
    expect(matchBranche(text)).toBeNull();
  });

  it("zählt mehrere Stichwörter DERSELBEN Branche nicht als Mehrdeutigkeit", () => {
    expect(matchBranche("Immobilien, Makler und Hausverwaltung")).toBe("Immobilien");
  });

  // Streng, nicht nachsichtig: eine frühere Fassung ließ `null` durch und hätte
  // ein Stichwort, das seine Zuordnung verliert, unbemerkt passieren lassen —
  // der Test hätte dann nur noch bewiesen, dass die Funktion nichts Falsches
  // sagt, nicht dass sie etwas Richtiges sagt. Aus dem Review auf dem Diff
  // (codex, LOW). Nebenbei belegt er, dass kein Stichwort zwei Branchen trifft:
  // wäre eines mehrdeutig, käme hier `null` zurück und der Test fiele.
  it("ordnet JEDES Stichwort genau seiner Branche zu", () => {
    for (const b of BRANCHEN) {
      for (const stichwort of b.keywords) {
        expect(matchBranche(`Tätig im Bereich ${stichwort}.`)).toBe(b.value);
      }
    }
  });
});
