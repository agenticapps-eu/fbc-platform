import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { datenschutz } from "./datenschutz";
import type { Block, Inline } from "./types";

/**
 * Die Datenschutzerklaerung gegen die gemessene Wirklichkeit (AGE-497).
 *
 * Zwei Sorten Zusage stehen hier auf dem Spiel, und sie brauchen verschiedene
 * Tests:
 *
 *   1. **Was da IST** — jeder Dienst, der Daten bekommt, muss genannt sein.
 *      Das prueft der Text gegen sich selbst.
 *   2. **Was da NICHT ist** — kein Analytics, kein Captcha, keine fremden
 *      Schriften. Diese Zusage kann der Text nicht selbst belegen. Ein Test,
 *      der nur die Seite nach Abwesenheit von Begriffen durchsucht, bliebe
 *      gruen, wenn jemand morgen `gtag` einbaut. Er muss deshalb den CODE
 *      lesen. Genau das haben beide Plan-Reviewer beanstandet.
 */

function textVon(inhalt: Inline[]): string {
  return inhalt.map((t) => (typeof t === "string" ? t : t.text)).join("");
}

function textVonBlock(b: Block): string {
  if (b.art === "absatz") return textVon(b.inhalt);
  if (b.art === "liste") return b.punkte.map(textVon).join("\n");
  return b.zeilen.map(textVon).join("\n");
}

const volltext = datenschutz.abschnitte
  .map((a) => [a.titel, ...a.bloecke.map(textVonBlock)].join("\n"))
  .join("\n");

describe("Genannte Empfaenger", () => {
  // Zweck, nicht nur Name: „Supabase" allein sagt niemandem, wofuer.
  it.each([
    ["Supabase", /Supabase[^\n]*Datenbank/i],
    ["Cloudflare", /Cloudflare[^\n]*Auslieferung/i],
    ["Resend", /Resend[^\n]*E-Mail/i],
    ["Sentry", /Sentry[^\n]*Fehler/i],
    ["Stripe", /Stripe[^\n]*Zahlung/i],
  ])("%s ist mit Zweck genannt", (_name, muster) => {
    expect(volltext).toMatch(muster);
  });

  it("nennt die eingebetteten Videos von YouTube und Vimeo", () => {
    // Drittinhalt auf der OEFFENTLICHEN Startseite — der Punkt, nach dem der
    // Anwalt ausdruecklich gefragt hat.
    expect(volltext).toMatch(/YouTube/);
    expect(volltext).toMatch(/Vimeo/);
  });

  it("nennt die Aufzeichnung im Fehlerfall, statt sie zu verschweigen", () => {
    // `replaysOnErrorSampleRate: 1.0` in src/instrument.ts — im Fehlerfall
    // entsteht sehr wohl ein Replay. Die Maskierung ist ein Schutz, kein
    // Beleg dafuer, dass nichts passiert.
    expect(volltext).toMatch(/Aufzeichnung/);
    expect(volltext).toMatch(/anlasslose Aufzeichnung findet nicht statt/);
  });
});

describe("Region nur, wo belegt", () => {
  it("nennt die belegten Regionen", () => {
    // Supabase: aws-0-eu-central-1 (scripts/db-push-prod.test.ts).
    expect(volltext).toMatch(/Supabase[^\n]*Frankfurt/i);
    // Sentry: Org `factiv`, EU-Region (docs/foundation-acceptance.md:128).
    expect(volltext).toMatch(/Sentry[^\n]*Europäischen Union/i);
  });

  it.each(["Cloudflare", "Resend", "Stripe"])(
    "sagt bei %s ausdruecklich, dass die Region nicht belegt ist",
    (dienst) => {
      // Der erste Planentwurf haette hier drei Regionen erfunden, um den
      // eigenen Test gruen zu bekommen. Schweigen waere die zweitschlechteste
      // Loesung — es sieht aus wie eine Antwort.
      const zeile = volltext.split("\n").find((z) => z.includes(dienst));
      expect(zeile).toMatch(/noch nicht belegt/);
    },
  );

  it("erklaert, was „noch nicht belegt“ bedeutet", () => {
    expect(volltext).toMatch(/nicht geprüft und geben sie deshalb nicht an/);
  });
});

describe("Die Zusage über das, was NICHT eingesetzt wird", () => {
  it("steht im Text", () => {
    expect(volltext).toMatch(/keine Reichweiten- oder Nutzungsanalyse/);
    expect(volltext).toMatch(/kein Captcha/i);
    expect(volltext).toMatch(/auf unserem eigenen Server/);
  });

  it("haelt dem Quelltext stand", () => {
    // DIESER Test ist die eigentliche Zusage. Er liest den Code, nicht die
    // Seite: die Seite wuerde ihre eigene Behauptung nie widerlegen.
    const verboten = [
      "fonts.googleapis",
      "fonts.gstatic",
      "google-analytics",
      "googletagmanager",
      "gtag(",
      "plausible.io",
      "matomo",
      "recaptcha",
      "hcaptcha",
      "maps.googleapis",
    ];
    let treffer: string;
    try {
      treffer = execFileSync(
        "grep",
        [
          "-rniE",
          verboten.map((v) => v.replace("(", "\\(")).join("|"),
          "src",
          "index.html",
          "public",
        ],
        { encoding: "utf8" },
      );
    } catch (fehler) {
      // **Nur Status 1 ist der Erfolgsfall** („nichts gefunden"). Status 2
      // heisst, dass grep gar nicht suchen konnte — falsches
      // Arbeitsverzeichnis, fehlendes `public/`, grep nicht im PATH. Ein
      // pauschales `catch` haette das zu „keine Treffer" gemacht und den Test
      // gruen gelassen, ohne dass je gesucht wurde. Genau die Sorte Zusage,
      // die dieser Test verhindern soll — im Test selbst.
      const status = (fehler as { status?: number }).status;
      if (status !== 1) throw fehler;
      treffer = "";
    }
    // Der eigene Quelltext dieser Datei zaehlt nicht: die Begriffe stehen hier
    // als Suchmuster, nicht als Einbindung.
    const echte = treffer
      .split("\n")
      .filter((z) => z.trim() && !z.startsWith("src/content/legal/datenschutz.test.ts"));
    expect(echte).toEqual([]);
  });
});

describe("Kuratierung des Anwaltsentwurfs", () => {
  it("enthaelt keine Kommentare des Anwalts an Donald", () => {
    // Der Entwurf ist ein Arbeitsdokument. „Hinweis fuer Donald: Bitte
    // Anschrift … pruefen" auf einer veroeffentlichten Rechtsseite waere
    // peinlich und irrefuehrend zugleich.
    for (const spur of [
      "für Donald",
      "Vor Livegang",
      "Ich würde",
      "Schick Donald",
      "nicht seriös für euch erfinden",
    ]) {
      expect(volltext).not.toContain(spur);
    }
  });

  it("nennt als Verantwortlichen den Fair Business Club", () => {
    const v = datenschutz.abschnitte.find((a) => a.titel.startsWith("2. Verantwortlicher"))!;
    const t = v.bloecke.map(textVonBlock).join("\n");
    expect(t).toMatch(/Fair Business Club/);
    expect(t).toMatch(/Stockholmer Platz 1/);
    // Die abweichende Angabe des Entwurfs gehoert NICHT in den Fliesstext …
    expect(t).not.toMatch(/DK Real Invest/);
  });

  it("fuehrt die Abweichung vom Entwurf als offenen Punkt", () => {
    // … sondern sichtbar in den offenen Punkt, damit sie nicht still passiert.
    expect(datenschutz.offenePunkte.join("\n")).toMatch(/DK Real Invest eG/);
  });
});
