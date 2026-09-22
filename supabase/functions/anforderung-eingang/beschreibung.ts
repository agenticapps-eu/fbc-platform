// Baut die Beschreibung des Linear-Issues (AGE-830).
//
// Gliederung, fest: der Text vom GPT unverändert · Abschnitt „Bilder" (nur
// wenn Dateien mitkamen) · Fußzeile mit Einreicher, Zeitpunkt und Route.
//
// Der Text vom GPT ist Markdown und soll es bleiben — er ist gegliedert, und
// Donald liest ihn so. Alles andere, was von außen kommt (Dateiname,
// Einreicher, Route), wird maskiert: ein Dateiname wie
// `a](https://x.example)![b.png` darf keinen eigenen Link öffnen.

import type { Anforderung } from "./pruefung.ts";

export type Dateiergebnis =
  | { name: string; art: "bild" | "video"; assetUrl: string }
  | { name: string; grund: string };

const MAX_NAME = 100;

/** Steuerzeichen (auch Zeilenumbrüche) werden Leerzeichen, dann gekürzt. */
export function bereinige(text: string): string {
  const flach = [...text]
    .map((z) => {
      const c = z.codePointAt(0)!;
      return c < 0x20 || (c >= 0x7f && c <= 0x9f) ? " " : z;
    })
    .join("")
    .trim();
  return [...flach].slice(0, MAX_NAME).join("").trim();
}

/** `bereinige` plus Backslash vor jedem Zeichen, mit dem Markdown etwas öffnet. */
export function maskiere(text: string): string {
  return bereinige(text).replace(/[\\`*_[\]()!<>#|~]/g, "\\$&");
}

const ZEITFORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `TT.MM.JJJJ, HH:MM` in Europe/Berlin — aus Teilen, nicht aus der Locale-Zeichenkette. */
export function formatiereZeitpunkt(zeitpunkt: Date): string {
  const t = Object.fromEntries(
    ZEITFORMAT.formatToParts(zeitpunkt).map((p) => [p.type, p.value]),
  );
  return `${t.day}.${t.month}.${t.year}, ${t.hour}:${t.minute}`;
}

function dateizeile(d: Dateiergebnis): string {
  const name = maskiere(d.name);
  if ("grund" in d) return `- Nicht übertragen: ${name} (${maskiere(d.grund)})`;
  return d.art === "bild" ? `![${name}](${d.assetUrl})` : `[${name}](${d.assetUrl})`;
}

export function baueBeschreibung(
  anforderung: Anforderung,
  dateien: Dateiergebnis[],
  jetzt: Date,
): string {
  const teile = [anforderung.beschreibung];
  if (dateien.length > 0) {
    teile.push(["### Bilder", ...dateien.map(dateizeile)].join("\n\n"));
  }
  const route = anforderung.route === null ? "unklar" : maskiere(anforderung.route);
  teile.push(
    "---",
    `Eingereicht von ${maskiere(anforderung.einreicher)} über ChatGPT · ` +
      `${formatiereZeitpunkt(jetzt)} · Route: ${route}`,
  );
  return teile.join("\n\n");
}
