// deno test  (aus supabase/functions/anforderung-eingang/)
//
// Die Beschreibung ist das, was Donald in der Triage liest. Diese Tests
// belegen die feste Gliederung (Spec „Die Beschreibung im Issue hat eine feste
// Gliederung") und dass nichts, was von außen kommt — Dateiname, Einreicher,
// Route —, eigenes Markdown öffnen kann.

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  baueBeschreibung,
  bereinige,
  type Dateiergebnis,
  formatiereZeitpunkt,
  maskiere,
} from "./beschreibung.ts";
import type { Anforderung } from "./pruefung.ts";

const ANFORDERUNG: Anforderung = {
  titel: "Suche zu klein",
  beschreibung: "**Was gewünscht ist**\nEin größeres Suchfeld.",
  art: "aenderung",
  einreicher: "Detlev Krause",
  route: "/mitglieder",
  dateien: [],
};

// 22.09.2026 12:30 UTC = 14:30 in Berlin (Sommerzeit).
const JETZT = new Date("2026-09-22T12:30:00Z");

Deno.test("ohne Dateien: Text und Fußzeile, kein Abschnitt Anhänge", () => {
  const b = baueBeschreibung(ANFORDERUNG, [], JETZT);
  assertEquals(
    b,
    "**Was gewünscht ist**\nEin größeres Suchfeld.\n\n---\n\n" +
      "Eingereicht von Detlev Krause über ChatGPT · 22.09.2026, 14:30 · Route: /mitglieder",
  );
  assert(!b.includes("Anhänge"));
});

Deno.test("ohne Route steht „unklar“", () => {
  const b = baueBeschreibung({ ...ANFORDERUNG, route: null }, [], JETZT);
  assert(b.endsWith("Route: unklar"), b);
});

Deno.test("der Text vom GPT geht unverändert hinein, Markdown inklusive", () => {
  const text = "**Was gewünscht ist**\n[Link](https://example.org) und ![x](y)";
  const b = baueBeschreibung({ ...ANFORDERUNG, beschreibung: text }, [], JETZT);
  assert(b.startsWith(text + "\n\n"), b);
});

Deno.test("Reihenfolge: Text, Anhänge, Fußzeile; Bild eingebettet, Video als Link", () => {
  const dateien: Dateiergebnis[] = [
    { name: "screenshot.png", art: "bild", assetUrl: "https://uploads.linear.app/a" },
    { name: "aufnahme.mov", art: "video", assetUrl: "https://uploads.linear.app/b" },
    { name: "ziel.webp", grund: "nicht mehr abrufbar" },
  ];
  const b = baueBeschreibung(ANFORDERUNG, dateien, JETZT);
  const text = b.indexOf("Ein größeres Suchfeld.");
  const bilder = b.indexOf("### Anhänge");
  const bild = b.indexOf("![screenshot.png](https://uploads.linear.app/a)");
  const video = b.indexOf("[aufnahme.mov](https://uploads.linear.app/b)");
  const vermerk = b.indexOf("Nicht übertragen: ziel.webp (nicht mehr abrufbar)");
  const fuss = b.indexOf("Eingereicht von");
  for (const [was, i] of Object.entries({ text, bilder, bild, video, vermerk, fuss })) {
    assert(i >= 0, `${was} fehlt:\n${b}`);
  }
  assert(text < bilder && bilder < bild && bild < video && video < vermerk && vermerk < fuss, b);
  // Das Video ist ein Link, kein eingebettetes Bild.
  assert(!b.includes("![aufnahme.mov]"), b);
});

Deno.test("PDF und Word stehen als Link, nicht eingebettet", () => {
  const dateien: Dateiergebnis[] = [
    { name: "konzept.pdf", art: "dokument", assetUrl: "https://uploads.linear.app/c" },
    { name: "notizen.docx", art: "dokument", assetUrl: "https://uploads.linear.app/d" },
  ];
  const b = baueBeschreibung(ANFORDERUNG, dateien, JETZT);
  assertStringIncludes(b, "### Anhänge");
  assertStringIncludes(b, "[konzept.pdf](https://uploads.linear.app/c)");
  assertStringIncludes(b, "[notizen.docx](https://uploads.linear.app/d)");
  assert(!b.includes("![konzept.pdf]") && !b.includes("![notizen.docx]"), b);
});

Deno.test("Markdown im Dateinamen bleibt Text", () => {
  const name = "a](https://x.example)![b.png";
  const b = baueBeschreibung(
    ANFORDERUNG,
    [{ name, art: "bild", assetUrl: "https://uploads.linear.app/a" }],
    JETZT,
  );
  // Genau ein Link-Ziel steht in der Zeile, und zwar das von Linear.
  const zeile = b.split("\n").find((z) => z.startsWith("!["))!;
  assertEquals(zeile.match(/\]\(/g)?.length, 1, zeile);
  assert(zeile.endsWith("](https://uploads.linear.app/a)"), zeile);
  assert(!/(?<!\\)\]\(https:\/\/x\.example/.test(b), b);
});

Deno.test("Markdown in Einreicher und Route bleibt Text", () => {
  const b = baueBeschreibung(
    { ...ANFORDERUNG, einreicher: "[Klick](https://x.example)", route: "**fett**" },
    [],
    JETZT,
  );
  assertStringIncludes(b, "\\[Klick\\]\\(https://x.example\\)");
  assertStringIncludes(b, "\\*\\*fett\\*\\*");
});

Deno.test("bereinige: Steuerzeichen raus, höchstens 100 Zeichen", () => {
  assertEquals(bereinige("a\u0000b\nc\td\u007f"), "a b c d");
  assertEquals([...bereinige("😀".repeat(150))].length, 100);
  assertEquals(bereinige("  x  "), "x");
});

Deno.test("maskiere entschärft jedes Markdown-Zeichen, das einen Link öffnen kann", () => {
  assertEquals(maskiere("![a](b)"), "\\!\\[a\\]\\(b\\)");
  assertEquals(maskiere("a\\b"), "a\\\\b");
});

Deno.test("Zeitpunkt in Europe/Berlin, über beide Zeitumstellungen", () => {
  // Winterzeit, UTC+1
  assertEquals(formatiereZeitpunkt(new Date("2026-01-05T08:07:00Z")), "05.01.2026, 09:07");
  // 29.03.2026: 01:59 MEZ, danach 03:00 MESZ
  assertEquals(formatiereZeitpunkt(new Date("2026-03-29T00:59:00Z")), "29.03.2026, 01:59");
  assertEquals(formatiereZeitpunkt(new Date("2026-03-29T01:00:00Z")), "29.03.2026, 03:00");
  // 25.10.2026: zurück auf MEZ
  assertEquals(formatiereZeitpunkt(new Date("2026-10-25T00:30:00Z")), "25.10.2026, 02:30");
  assertEquals(formatiereZeitpunkt(new Date("2026-10-25T01:30:00Z")), "25.10.2026, 02:30");
  // Mitternacht ist 00, nicht 24
  assertEquals(formatiereZeitpunkt(new Date("2026-06-30T22:00:00Z")), "01.07.2026, 00:00");
});

Deno.test("Markdown im Grund bleibt Text", () => {
  const b = baueBeschreibung(
    ANFORDERUNG,
    [{ name: "a.png", grund: "Typ nicht erlaubt: x) [Öffnen](https://evil.example)" }],
    JETZT,
  );
  assert(!/(?<!\\)\]\(https:\/\/evil/.test(b), b);
  assertStringIncludes(b, "\\[Öffnen\\]\\(https://evil.example\\)");
});
