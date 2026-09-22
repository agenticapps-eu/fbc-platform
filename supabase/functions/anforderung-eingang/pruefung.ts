// Prüft den Rumpf der ChatGPT-Action, bevor irgendetwas geschieht (AGE-830).
//
// Das Modell hinter der Action ist kein vertrauenswürdiger Aufrufer: ein GPT
// lässt Felder weg, erfindet Werte oder schickt Text statt Liste. Deshalb steht
// jede Pflicht und jede Grenze hier und nicht nur im OpenAPI-Schema, und jede
// Ablehnung ist ein ganzer deutscher Satz, den der GPT Detlev vorlesen kann.
//
// Grenzen zählen Unicode-Codepoints, wie `maxLength` im OpenAPI-Schema — nicht
// UTF-16-Einheiten (`String.length`), sonst wäre die Function bei Emoji
// strenger als der Vertrag.

export const ARTEN = ["fehler", "aenderung", "funktion", "idee"] as const;
export type Art = (typeof ARTEN)[number];

export const MAX_DATEIEN = 10;

export interface Anforderung {
  titel: string;
  beschreibung: string;
  art: Art;
  einreicher: string;
  route: string | null;
  /** Roh, wie geliefert. Die Form jedes Eintrags prüft `dateien.ts`. */
  dateien: unknown[];
}

export type Pruefergebnis =
  | { ok: true; anforderung: Anforderung }
  | { ok: false; fehler: string };

const zeichen = (s: string) => [...s].length;

function text(wert: unknown): string | null {
  if (typeof wert !== "string") return null;
  const t = wert.trim();
  return t === "" ? null : t;
}

export function pruefeAnforderung(rumpf: unknown): Pruefergebnis {
  if (typeof rumpf !== "object" || rumpf === null || Array.isArray(rumpf)) {
    return { ok: false, fehler: "Die Anfrage enthält keine lesbare Anforderung." };
  }
  const r = rumpf as Record<string, unknown>;
  const maengel: string[] = [];

  const titel = text(r.titel);
  if (titel === null) {
    maengel.push("Der Titel fehlt.");
  } else if (zeichen(titel) > 200) {
    maengel.push("Der Titel ist zu lang, er darf höchstens 200 Zeichen haben.");
  }

  const beschreibung = text(r.beschreibung);
  if (beschreibung === null) {
    maengel.push("Die Beschreibung fehlt.");
  } else if (zeichen(beschreibung) > 8000) {
    maengel.push("Die Beschreibung ist zu lang, sie darf höchstens 8000 Zeichen haben.");
  }

  const art = text(r.art);
  if (art === null) {
    maengel.push(
      "Es fehlt die Angabe, ob es ein Fehler, eine Änderung, eine neue Funktion oder eine Idee ist.",
    );
  } else if (!(ARTEN as readonly string[]).includes(art)) {
    maengel.push(
      "Die Art ist unzulässig, es muss ein Fehler, eine Änderung, eine neue Funktion oder eine Idee sein.",
    );
  }

  const einreicher = text(r.einreicher);
  if (einreicher === null) {
    maengel.push("Es fehlt der Name der Person, die die Anforderung stellt.");
  } else if (zeichen(einreicher) > 120) {
    maengel.push("Der Name ist zu lang, er darf höchstens 120 Zeichen haben.");
  }

  const route = text(r.route);
  if (r.route !== undefined && r.route !== null && typeof r.route !== "string") {
    maengel.push("Die Angabe zur Seite muss ein Text sein.");
  } else if (route !== null && zeichen(route) > 200) {
    maengel.push("Die Angabe zur Seite ist zu lang, sie darf höchstens 200 Zeichen haben.");
  }

  const dateien = r.openaiFileIdRefs ?? [];
  if (!Array.isArray(dateien)) {
    maengel.push("Die Bilder und Videos müssen als Liste übergeben werden.");
  } else if (dateien.length > MAX_DATEIEN) {
    maengel.push("Es sind zu viele Dateien, höchstens zehn dürfen mitgehen.");
  }

  if (maengel.length > 0) return { ok: false, fehler: maengel.join(" ") };

  return {
    ok: true,
    anforderung: {
      titel: titel!,
      beschreibung: beschreibung!,
      art: art as Art,
      einreicher: einreicher!,
      route,
      dateien: dateien as unknown[],
    },
  };
}
