// Übernimmt die Dateien aus `openaiFileIdRefs` (AGE-830).
//
// Die Links gelten fünf Minuten, deshalb wird im selben Aufruf geladen. Jede
// Datei endet als `{ name, art, assetUrl }` oder als `{ name, grund }` — nie
// als Ausnahme. Das Issue hängt nie an einer Datei.
//
// Die Schutzschichten, in dieser Reihenfolge (design.md, Entscheidung 3):
//
//   Form     — Objekt mit `download_link` und erlaubtem `mime_type`. Das
//              Schema sagt `string`, OpenAI schickt Objekte (dokumentiert und
//              am 22.09. gemessen). Ein String wird vermerkt, nicht geworfen.
//   Adresse  — nur `https` und nur OpenAIs Host. Wer den Schlüssel hat,
//              bestimmt die Links; ohne diese Liste lüde die Function jede
//              Adresse und legte das Ergebnis in Linear ab.
//   Umleitung— wird nie verfolgt (`redirect: "manual"`), sonst wäre die
//              Hostliste über einen 302 umgangen. Der Zielhost wird vermerkt:
//              leitet OpenAI in Wirklichkeit weiter, zeigt es der Probelauf.
//   Größe    — 25 MB, geprüft am `Content-Length` vor dem ersten Byte und beim
//              Lesen, damit eine Datei ohne Längenangabe nicht erst ganz im
//              Speicher liegen muss, um abgelehnt zu werden.
//   Inhalt   — die ersten Bytes müssen zum erklärten Typ passen. Die Bilder
//              werden in Linear eingebettet und im Browser angezeigt, unter dem
//              Typ, den wir beim `fileUpload` angeben.
//   Zeit     — 12 s je Datei, 25 s für alle zusammen. ChatGPT bricht nach 45 s
//              ab; es bleiben 8 s für `issueCreate` und Luft für den Weg.
//
// Nacheinander, nicht parallel: im Speicher liegt immer nur eine Datei.

import { bereinige, type Dateiergebnis } from "./beschreibung.ts";

export const MAX_BYTES = 25 * 1024 * 1024;
export const ERLAUBTE_HOSTS = ["files.oaiusercontent.com"];

const ERLAUBTE_TYPEN = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
] as const;
type Typ = (typeof ERLAUBTE_TYPEN)[number];

export interface DateiDeps {
  fetch: typeof fetch;
  /** Legt die Datei bei Linear ab. `null` im Probelauf: geprüft, nicht hochgeladen. */
  hochladen:
    | ((d: { mime: string; name: string; bytes: Uint8Array<ArrayBuffer> }, signal: AbortSignal) => Promise<string>)
    | null;
  fristJeDateiMs: number;
  fristGesamtMs: number;
}

/** Was ins Log darf: kein Name, kein Link (Spec „Das Log trägt keine Inhalte"). */
export interface Protokoll {
  typ?: string;
  groesse?: number;
  host?: string;
  ergebnis: string;
}

export interface Uebernahme {
  ergebnis: Dateiergebnis;
  protokoll: Protokoll;
}

class Abgelehnt extends Error {}

/** Lässt ein Versprechen spätestens mit dem Signal scheitern — auch eines, das das Signal nicht kennt. */
function bisAbbruch<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((ja, nein) => {
    if (signal.aborted) return nein(signal.reason);
    const weg = () => nein(signal.reason);
    signal.addEventListener("abort", weg, { once: true });
    p.then(ja, nein).finally(() => signal.removeEventListener("abort", weg));
  });
}

function passtZumTyp(b: Uint8Array, typ: Typ): boolean {
  const ab = (o: number, s: number[]) => s.every((x, i) => b[o + i] === x);
  const text = (o: number, s: string) => ab(o, [...s].map((c) => c.charCodeAt(0)));
  switch (typ) {
    case "image/png":
      return ab(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return ab(0, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return text(0, "GIF8");
    case "image/webp":
      return text(0, "RIFF") && text(8, "WEBP");
    case "video/mp4":
      return text(4, "ftyp");
    case "video/quicktime":
      // Ältere QuickTime-Dateien beginnen ohne `ftyp` direkt mit einem Atom.
      return ["ftyp", "moov", "mdat", "wide", "free"].some((a) => text(4, a));
  }
}

async function leseBegrenzt(
  body: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const teile: Uint8Array[] = [];
  let n = 0;
  if (body) {
    const leser = body.getReader();
    while (true) {
      const { done, value } = await bisAbbruch(leser.read(), signal);
      if (done) break;
      n += value.byteLength;
      if (n > MAX_BYTES) {
        await leser.cancel().catch(() => {});
        throw new Abgelehnt("zu groß (mehr als 25 MB)");
      }
      teile.push(value);
    }
  }
  const alles = new Uint8Array(n);
  let o = 0;
  for (const t of teile) {
    alles.set(t, o);
    o += t.byteLength;
  }
  return alles;
}

async function uebernehmeEine(
  eintrag: unknown,
  nummer: number,
  deps: DateiDeps,
  signal: AbortSignal,
): Promise<Uebernahme> {
  const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<string, unknown>;
  const roh = typeof eintrag === "string" ? eintrag : typeof e.name === "string" ? e.name : "";
  const name = bereinige(roh) || `Datei ${nummer}`;
  const protokoll: Protokoll = { ergebnis: "" };
  const abgelehnt = (grund: string): Uebernahme => ({
    ergebnis: { name, grund },
    protokoll: { ...protokoll, ergebnis: grund },
  });

  if (typeof eintrag !== "object" || eintrag === null) return abgelehnt("keine Angaben zur Datei");
  if (typeof e.download_link !== "string") return abgelehnt("kein Download-Link");
  const typ = e.mime_type;
  if (!(ERLAUBTE_TYPEN as readonly unknown[]).includes(typ)) {
    return abgelehnt(`Typ nicht erlaubt: ${bereinige(String(typ ?? "unbekannt"))}`);
  }
  protokoll.typ = typ as Typ;

  let url: URL;
  try {
    url = new URL(e.download_link);
  } catch {
    return abgelehnt("Adresse nicht lesbar");
  }
  if (url.protocol !== "https:" || !ERLAUBTE_HOSTS.includes(url.hostname)) {
    return abgelehnt(`Adresse nicht erlaubt: ${bereinige(url.hostname)}`);
  }
  protokoll.host = url.hostname;

  try {
    if (signal.aborted) throw signal.reason;
    const res = await bisAbbruch(deps.fetch(url, { redirect: "manual", signal }), signal);
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => {});
      let ziel = "unbekannt";
      try {
        ziel = new URL(res.headers.get("location") ?? "", url).hostname;
      } catch { /* bleibt „unbekannt" */ }
      throw new Abgelehnt(`weitergeleitet nach ${bereinige(ziel)}`);
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Abgelehnt(
        [403, 404, 410].includes(res.status)
          ? "nicht mehr abrufbar"
          : `Download fehlgeschlagen (HTTP ${res.status})`,
      );
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
      await res.body?.cancel().catch(() => {});
      throw new Abgelehnt("zu groß (mehr als 25 MB)");
    }
    const bytes = await leseBegrenzt(res.body, signal);
    protokoll.groesse = bytes.byteLength;
    if (!passtZumTyp(bytes, typ as Typ)) throw new Abgelehnt("Inhalt passt nicht zum Typ");

    const art = (typ as string).startsWith("image/") ? "bild" : "video";
    if (deps.hochladen === null) {
      return { ergebnis: { name, art, assetUrl: "" }, protokoll: { ...protokoll, ergebnis: "geprüft" } };
    }
    let assetUrl: string;
    try {
      assetUrl = await bisAbbruch(deps.hochladen({ mime: typ as string, name, bytes }, signal), signal);
    } catch (err) {
      if (signal.aborted) throw err;
      throw new Abgelehnt("Hochladen fehlgeschlagen");
    }
    return { ergebnis: { name, art, assetUrl }, protokoll: { ...protokoll, ergebnis: "übernommen" } };
  } catch (err) {
    if (err instanceof Abgelehnt) return abgelehnt(err.message);
    if (signal.aborted) return abgelehnt("Zeit überschritten");
    return abgelehnt("Download fehlgeschlagen");
  }
}

export async function uebernehmeDateien(eintraege: unknown[], deps: DateiDeps): Promise<Uebernahme[]> {
  // EIN Signal für die Gesamtfrist, je Datei mit einem eigenen verknüpft. Ein
  // aus `Date.now()` nachgerechneter Rest ließe einen minimal zu früh
  // feuernden Timer als „noch 1 ms übrig" durch.
  const gesamt = AbortSignal.timeout(deps.fristGesamtMs);
  const ergebnisse: Uebernahme[] = [];
  for (const [i, eintrag] of eintraege.entries()) {
    const signal = AbortSignal.any([gesamt, AbortSignal.timeout(deps.fristJeDateiMs)]);
    ergebnisse.push(await uebernehmeEine(eintrag, i + 1, deps, signal));
  }
  return ergebnisse;
}
