import { describe, expect, it } from "vitest";

import { ohneSchlussHashtags, tokenizePostBody } from "./video-url";

/**
 * Der abschliessende Hashtag-Block verschwindet aus dem Fliesstext (AGE-566).
 *
 * Er steht als Chip unter dem Beitrag; beides zusammen zeigte dasselbe Wort
 * zweimal. Die Anforderung „ein Tag pro Beitrag an genau einer Stelle"
 * (community-feed) war damit nur dem Titel nach erfüllt.
 *
 * Geprüft wird der TEXT, der übrig bleibt — nicht die Zahl der Segmente: eine
 * Zusage über Segmentzahlen bestünde auch, wenn das falsche verschwindet.
 */
const text = (body: string) =>
  ohneSchlussHashtags(tokenizePostBody(body))
    .map((s) => s.raw)
    .join("");

describe("ohneSchlussHashtags", () => {
  it("entfernt einen einzelnen Hashtag am Ende samt Leerraum davor", () => {
    expect(text("Ehrlichste halbe Stunde zum Thema. #Persönlichkeitsentwicklung")).toBe(
      "Ehrlichste halbe Stunde zum Thema.",
    );
  });

  it("entfernt auch mehrere am Ende", () => {
    expect(text("Danke an alle. #Netzwerken #Rückblick")).toBe("Danke an alle.");
  });

  it("LÄSST einen Hashtag im Satzinneren stehen", () => {
    // Ohne diese Zusage würde aus dem Satz „Wir waren beim und haben viel
    // mitgenommen." — die Grammatik hängt am Wort.
    expect(text("Wir waren beim #Sommerfest und haben viel mitgenommen.")).toBe(
      "Wir waren beim #Sommerfest und haben viel mitgenommen.",
    );
  });

  it("lässt einen Hashtag stehen, auf den noch Text folgt", () => {
    expect(text("Thema #Leadership – dazu ein Vortrag")).toBe(
      "Thema #Leadership – dazu ein Vortrag",
    );
  });

  it("lässt einen Beitrag unverändert, der NUR aus Hashtags besteht", () => {
    // Ein leerer Beitragstext wäre schlechter als eine Dopplung.
    expect(text("#Netzwerken #Impact")).toBe("#Netzwerken #Impact");
  });

  it("rührt einen Beitrag ohne Hashtags nicht an", () => {
    expect(text("Ganz normaler Satz ohne alles.")).toBe("Ganz normaler Satz ohne alles.");
  });

  it("behandelt eine URL vor dem Schlussblock als Ende des Textes", () => {
    // Genau die Form, die der Seed schreibt: Text, Video, dann Schlagworte.
    expect(text("Sehenswert. https://www.youtube.com/watch?v=abc #Leadership")).toBe(
      "Sehenswert. https://www.youtube.com/watch?v=abc",
    );
  });

  it("lässt eine Erwähnung am Ende unberührt", () => {
    // Nur Hashtags bilden den Block — eine Erwähnung ist Anrede, kein Schlagwort.
    expect(text("Danke dafür @marvin")).toBe("Danke dafür @marvin");
  });
});
