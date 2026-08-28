import { describe, expect, it } from "vitest";
import { ersetzeEmoticons } from "./emoticons";

describe("ersetzeEmoticons", () => {
  describe("ersetzt, was allein steht", () => {
    it("die Nasenvariante", () => {
      expect(ersetzeEmoticons(":-)")).toBe("🙂");
    });

    it("die Form ohne Nase", () => {
      expect(ersetzeEmoticons(":)")).toBe("🙂");
    });

    it("mitten im Satz, zwischen Leerraum", () => {
      expect(ersetzeEmoticons("na :-) fein")).toBe("na 🙂 fein");
    });

    it("mehrere in einem Text", () => {
      expect(ersetzeEmoticons(":-) und ;-)")).toBe("🙂 und 😉");
    });

    it("das Herz", () => {
      expect(ersetzeEmoticons("<3")).toBe("❤️");
    });
  });

  // Der Befund des Plan-Reviewers (opencode, HIGH): eine Grenze, die nur
  // Leerraum zulässt, lässt den häufigsten echten Fall aus. In deutscher
  // Chat-Prosa steht hinter dem Smiley fast immer ein Satzzeichen.
  describe("Satzzeichen rechts sind ein Treffer, kein Ausschluss", () => {
    it("Punkt am Satzende", () => {
      expect(ersetzeEmoticons("Toll :-).")).toBe("Toll 🙂.");
    });

    it("Ausrufezeichen", () => {
      expect(ersetzeEmoticons("Schön :)!")).toBe("Schön 🙂!");
    });

    it("in Klammern", () => {
      expect(ersetzeEmoticons("(danke :-))")).toBe("(danke 🙂)");
    });

    it("Komma", () => {
      expect(ersetzeEmoticons("ja :-), gern")).toBe("ja 🙂, gern");
    });
  });

  // Die LINKE Grenze ist es, die URLs rettet — nicht die rechte. Deshalb muss
  // die Gegenprobe auch den Fall mit folgendem Satzzeichen enthalten.
  describe("lässt in Ruhe, was eingebettet ist", () => {
    it("mitten in einer URL", () => {
      expect(ersetzeEmoticons("http://x.de/a:-)b")).toBe("http://x.de/a:-)b");
    });

    it("in einer URL am Satzende", () => {
      expect(ersetzeEmoticons("http://x.de/a:-).")).toBe("http://x.de/a:-).");
    });

    it("ohne Leerraum davor", () => {
      expect(ersetzeEmoticons("foo:)bar")).toBe("foo:)bar");
    });

    it("die Hausnummer aus dem Ticket trifft gar keinen Eintrag", () => {
      expect(ersetzeEmoticons("Hausnummer 8-)")).toBe("Hausnummer 8-)");
    });
  });

  // Diese vier Fälle fehlten in der ersten Fassung, und die Gegenprobe hat es
  // aufgedeckt: die RECHTE Grenze liess sich ersatzlos streichen, ohne dass ein
  // einziger Test rot wurde. Sie war damit reine Behauptung. Die Fälle hier
  // sind die, an denen sie wirklich hängt — jeder von ihnen fällt, sobald die
  // Vorschau entfernt wird.
  describe("lässt in Ruhe, was rechts weitergeht", () => {
    it("am Textanfang, aber mit angehängtem Zeichen", () => {
      expect(ersetzeEmoticons(":-)x")).toBe(":-)x");
    });

    it("nach Leerraum, aber mit angehängtem Zeichen", () => {
      expect(ersetzeEmoticons("na :)x")).toBe("na :)x");
    });

    // Der teuerste Fehlalarm der ganzen Liste: „unter 3000 Euro" schreibt sich
    // im Deutschen als „<3000", und die linke Grenze greift hier NICHT, weil
    // links der Textanfang steht.
    it("eine Zahlenangabe mit Kleinerzeichen", () => {
      expect(ersetzeEmoticons("<3000 Euro")).toBe("<3000 Euro");
    });

    it("dasselbe mitten im Satz", () => {
      expect(ersetzeEmoticons("Budget <3000 Euro")).toBe("Budget <3000 Euro");
    });

    // Und die Schreibweise, die im Deutschen die ÜBLICHERE ist: der Punkt
    // trennt die Tausender, das Komma die Nachkommastellen. Beide stehen in der
    // rechten Grenze, weil „Toll :-)." der häufigste echte Fall ist — womit
    // ausgerechnet die Zahlenschreibweise durch dieselbe Tür kam, die der Test
    // darüber schliessen sollte. Gefunden von einem fremden Reviewer, der die
    // Funktion ausgeführt statt gelesen hat.
    it("eine Zahl mit Tausenderpunkt", () => {
      expect(ersetzeEmoticons("Budget <3.000 Euro")).toBe("Budget <3.000 Euro");
    });

    it("eine Zahl mit Dezimalkomma", () => {
      expect(ersetzeEmoticons("Budget <3,50 Euro")).toBe("Budget <3,50 Euro");
    });
  });

  describe("ohne Rücksicht auf Schreibweise", () => {
    it("kleines p wie grosses", () => {
      expect(ersetzeEmoticons(":p")).toBe(ersetzeEmoticons(":P"));
      expect(ersetzeEmoticons(":p")).toBe("😛");
    });

    it("kleines d wie grosses", () => {
      expect(ersetzeEmoticons(":d")).toBe("😄");
    });
  });

  describe("Nasenvariante und Kurzform führen zum selben Emoji", () => {
    // Ehrlichkeitshalber: dieser Block prüft KEINE Reihenfolge. In der heutigen
    // Liste ist keine Form Präfix einer anderen (`:)` steckt nicht in `:-)`),
    // also ist „längste zuerst" hier durch nichts zu widerlegen. Die Sortierung
    // im Muster ist Vorsorge für spätere Einträge; sobald eine Form hinzukommt,
    // die in einer anderen steckt, gehört hier ein Test hin, der sie festnagelt.
    it("mit und ohne Nase", () => {
      expect(ersetzeEmoticons(":-D")).toBe("😄");
      expect(ersetzeEmoticons(":D")).toBe("😄");
    });
  });

  describe("lässt unberührt, was kein Emoticon ist", () => {
    it("leerer Text", () => {
      expect(ersetzeEmoticons("")).toBe("");
    });

    it("gewöhnlicher Satz", () => {
      expect(ersetzeEmoticons("Guten Morgen, Detlev.")).toBe("Guten Morgen, Detlev.");
    });

    it("ein Doppelpunkt allein", () => {
      expect(ersetzeEmoticons("Betreff: Termin")).toBe("Betreff: Termin");
    });

    it("Uhrzeit bleibt Uhrzeit", () => {
      expect(ersetzeEmoticons("um 14:30")).toBe("um 14:30");
    });
  });
});
