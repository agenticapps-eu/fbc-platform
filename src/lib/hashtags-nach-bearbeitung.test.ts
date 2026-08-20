import { describe, expect, it } from "vitest";

import { hashtagsNachBearbeitung } from "./feed";

/**
 * Schlagworte nach einer Textänderung (AGE-566).
 *
 * `posts.hashtags` trägt zwei ununterscheidbare Quellen: die aus dem Text
 * geparsten und die im Composer angeklickten kuratierten — `create_post_with_media`
 * vereinigt `p_hashtags` und `p_tags` in EINE Spalte. Ein blosses
 * `parseHashtags(neuerText)` beim Speichern räumte die angeklickten deshalb
 * stillschweigend weg: das Korrigieren eines Tippfehlers hätte den Beitrag
 * seine Einordnung gekostet.
 *
 * Genau dieser Verlust ist hier die Zusage — und er ist der Grund, dass es
 * diese Funktion überhaupt gibt.
 */
describe("hashtagsNachBearbeitung", () => {
  it("übernimmt Schlagworte aus dem neuen Text", () => {
    expect(hashtagsNachBearbeitung("Alt #eins", ["eins"], "Neu #zwei")).toEqual(["zwei"]);
  });

  it("BEHÄLT ein kuratiertes Schlagwort, das nie im Text stand", () => {
    // „leadership" kam aus der Tag-Auswahl, nicht aus dem Text. Ohne diese
    // Zusage verschwände es beim ersten Speichern.
    expect(hashtagsNachBearbeitung("Alt #eins", ["eins", "leadership"], "Neu #zwei")).toEqual([
      "zwei",
      "leadership",
    ]);
  });

  it("entfernt ein Schlagwort, das der Verfasser aus dem Text nimmt", () => {
    // Es kam aus dem alten Text — wer es dort streicht, will es weghaben.
    expect(hashtagsNachBearbeitung("Alt #eins #zwei", ["eins", "zwei"], "Alt #eins")).toEqual([
      "eins",
    ]);
  });

  it("erzeugt keine Dublette, wenn ein kuratiertes Wort nun auch im Text steht", () => {
    expect(
      hashtagsNachBearbeitung("Alt", ["leadership"], "Jetzt schreibe ich #Leadership dazu"),
    ).toEqual(["leadership"]);
  });

  it("kommt mit einem Beitrag ohne Schlagworte klar", () => {
    expect(hashtagsNachBearbeitung("Alt", [], "Neu")).toEqual([]);
  });

  it("behält die Reihenfolge des Textes vor den kuratierten", () => {
    expect(hashtagsNachBearbeitung("Alt", ["kuratiert"], "#eins und #zwei")).toEqual([
      "eins",
      "zwei",
      "kuratiert",
    ]);
  });
});
