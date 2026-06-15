import { describe, expect, it } from "vitest";
import {
  buildMentionResolver,
  extractFirstVideo,
  parseHashtags,
  parseVideoUrl,
  tokenizePostBody,
  type FeedAuthor,
} from "./feed";

describe("parseHashtags", () => {
  it("extrahiert Hashtags ohne #, normalisiert klein, dedupliziert, Reihenfolge bleibt", () => {
    expect(parseHashtags("Hallo #FairBusiness und #fairbusiness #Netzwerk")).toEqual([
      "fairbusiness",
      "netzwerk",
    ]);
  });

  it("liefert [] ohne Hashtags", () => {
    expect(parseHashtags("kein hashtag hier")).toEqual([]);
    expect(parseHashtags("")).toEqual([]);
  });

  it("erkennt Umlaute und Ziffern, aber nicht ein einzelnes #", () => {
    expect(parseHashtags("#Geschäftsführung #2026 # leer")).toEqual(["geschäftsführung", "2026"]);
  });

  it("erkennt nur am Wortanfang (kein C#programming-Fehltreffer)", () => {
    expect(parseHashtags("Sprache C#programming")).toEqual([]);
    expect(parseHashtags("Start #klappt")).toEqual(["klappt"]);
  });
});

describe("tokenizePostBody", () => {
  it("zerlegt Text, Hashtags, Erwähnungen und URLs in Reihenfolge", () => {
    const segs = tokenizePostBody("Hi @maximilian, schau #FBC https://example.com an");
    expect(segs).toEqual([
      { type: "text", value: "Hi ", raw: "Hi " },
      { type: "mention", value: "maximilian", raw: "@maximilian" },
      { type: "text", value: ", schau ", raw: ", schau " },
      { type: "hashtag", value: "fbc", raw: "#FBC" },
      { type: "text", value: " ", raw: " " },
      { type: "url", value: "https://example.com", raw: "https://example.com" },
      { type: "text", value: " an", raw: " an" },
    ]);
  });

  it("reiner Text bleibt ein einzelnes Text-Segment", () => {
    expect(tokenizePostBody("nur text")).toEqual([
      { type: "text", value: "nur text", raw: "nur text" },
    ]);
  });

  it("trennt nachgestellte Satzzeichen von einer URL ab", () => {
    const segs = tokenizePostBody("siehe https://youtu.be/abc.");
    expect(segs).toEqual([
      { type: "text", value: "siehe ", raw: "siehe " },
      { type: "url", value: "https://youtu.be/abc", raw: "https://youtu.be/abc" },
      { type: "text", value: ".", raw: "." },
    ]);
  });

  it("zerreißt keine URL mit echten Klammern (z. B. Wikipedia _(bar))", () => {
    const segs = tokenizePostBody("https://en.wikipedia.org/wiki/Foo_(bar)");
    expect(segs).toEqual([
      {
        type: "url",
        value: "https://en.wikipedia.org/wiki/Foo_(bar)",
        raw: "https://en.wikipedia.org/wiki/Foo_(bar)",
      },
    ]);
  });
});

describe("extractFirstVideo", () => {
  it("liefert das erste einbettbare Video mit roher Quell-URL", () => {
    expect(extractFirstVideo("Schau https://example.com und https://youtu.be/abc an")).toEqual({
      url: "https://youtu.be/abc",
      provider: "youtube",
      embedUrl: "https://www.youtube.com/embed/abc",
    });
  });

  it("null ohne Video-URL", () => {
    expect(extractFirstVideo("nur text https://example.com")).toBeNull();
  });
});

describe("buildMentionResolver", () => {
  const author = (id: string, name: string): FeedAuthor => ({
    id,
    name,
    avatarUrl: null,
    tier: null,
  });

  it("trifft per vollem Namen und per Vornamen", () => {
    const resolve = buildMentionResolver([author("u1", "Maximilian Bauer")]);
    expect(resolve("maximilianbauer")).toBe("u1");
    expect(resolve("maximilian")).toBe("u1");
    expect(resolve("@unbekannt".slice(1))).toBeNull();
  });

  it("Vornamens-Kollision: erster Autor gewinnt; leerer Handle → null", () => {
    const resolve = buildMentionResolver([author("a", "Anna Müller"), author("b", "Anna Schmidt")]);
    expect(resolve("anna")).toBe("a");
    expect(resolve("")).toBeNull();
  });
});

describe("parseVideoUrl", () => {
  it("YouTube watch/short/embed → sichere Embed-URL", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=42")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
    expect(parseVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  });

  it("Vimeo → Player-Embed-URL", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")).toEqual({
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/123456789",
    });
  });

  it("akzeptiert m.youtube.com und player.vimeo.com", () => {
    expect(parseVideoUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
    expect(parseVideoUrl("https://player.vimeo.com/video/123456789")).toEqual({
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/123456789",
    });
  });

  it("lehnt korrekte Hosts mit fehlender/leerer ID ab", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch")).toBeNull();
    expect(parseVideoUrl("https://youtu.be/")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/feed/trending")).toBeNull();
  });

  it("lehnt Fremd-/unsichere URLs ab", () => {
    expect(parseVideoUrl("https://evil.example.com/embed/x")).toBeNull();
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
    expect(parseVideoUrl("nur text")).toBeNull();
    expect(parseVideoUrl("")).toBeNull();
  });
});
