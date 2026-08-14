/**
 * Die Feldparser des WordPress-Imports (AGE-534). Ohne Datenbank, ohne Netz,
 * ohne Dateizugriff — jede Funktion ist für sich prüfbar.
 *
 * ÜBERTRAGEN AUS `wp_feld_parser.py` (13.08.2026, 15:51), nicht aus `parser.py`
 * (15:17). Der Plan-Review-Vorlauf hat gegen die ältere der beiden Dateien
 * gemessen und daraus geschlossen, Datum und Telefon seien noch zu schreiben.
 * Beide liegen in der späteren Fassung vor; die Übertragung ist trotzdem Arbeit,
 * weil Python-Semantik hier nicht trägt (siehe `\b` bei Umlauten und die
 * Zeitzonenfalle unten).
 *
 * DREI STELLEN WEICHEN BEWUSST AB:
 *
 *   1. Kein Rückfall vom Wohnort auf die Regionalgruppe. Die Vorlage füllt einen
 *      fehlenden Ort aus `ort_27_28` auf; die Abbildungsmatrix hält ausdrücklich
 *      fest, dass das die Regionalgruppe ist und **nicht** der Wohnort. Ein
 *      aufgefüllter Wohnort sähe sicher aus und wäre geraten.
 *   2. Keine zweistelligen Jahreszahlen. Die Vorlage kennt `%d.%m.%y`; kein
 *      einziger Datensatz trägt so etwas, und „22.07.20" ist zwischen 1920 und
 *      2020 nicht zu entscheiden.
 *   3. Datumsangaben werden als Zeichenkette geführt, nie als `Date`. Ein
 *      `new Date("2020-07-22")` steht auf UTC-Mitternacht und wird westlich von
 *      Greenwich als der 21. formatiert.
 */

/** Güteklasse der Ortsangabe — gehört in den Bericht, nicht nur ins Profil. */
export type OrtGuete = "ok" | "nur_plz" | "nur_ort" | "leer";

export type Ort = { plz: string; ort: string; land: string; guete: OrtGuete };

/** Wie genau die Rohangabe war, bevor auf den Monatsersten aufgefüllt wurde. */
export type DatumGrad = "tag" | "monat" | "jahr";

export type Datum = { datum: string; grad: DatumGrad; roh: string };

/**
 * Liest ein serialisiertes PHP-Array. Bewusst ohne echte Deserialisierung: in
 * diesen Daten kommen ausschliesslich flache String-Arrays vor, ein voller
 * Parser wäre mehr Angriffsfläche für nichts.
 *
 * `a:0:{}` und ein leeres Feld ergeben beide die leere Liste — sie sind aber
 * nicht dasselbe: 6 der 49 befüllten `WhatsApp`-Felder tragen das leere Array.
 * Wer „befüllt" zählen will, zählt vor dieser Funktion.
 */
export function phpArray(roh: string): string[] {
  const s = (roh ?? "").trim();
  if (s === "") return [];
  if (!s.startsWith("a:")) return [s]; // jemand hat Klartext statt Auswahl eingetragen
  if (s.startsWith("a:0:")) return [];

  const werte: string[] = [];
  for (const treffer of s.matchAll(/s:\d+:"(.*?)";/gs)) {
    const wert = treffer[1].trim();
    if (wert !== "") werte.push(wert);
  }
  return werte;
}

const LAENDER: ReadonlyArray<readonly [string, string]> = [
  ["germany", "DE"],
  ["deutschland", "DE"],
  ["d", "DE"],
  ["de", "DE"],
  ["österreich", "AT"],
  ["oesterreich", "AT"],
  ["austria", "AT"],
  ["at", "AT"],
  ["schweiz", "CH"],
  ["switzerland", "CH"],
  ["ch", "CH"],
];

/**
 * Zerlegt das eine Freitextfeld `ort` in PLZ, Ort und Land. 50 der 70
 * Datensätze sind befüllt, davon 33 mit beidem, 15 nur mit einem Ortsnamen und
 * 2 nur mit einer PLZ.
 */
export function ortParsen(roh: string): Ort {
  let s = (roh ?? "").replace(/<[^>]+>/g, " ");
  s = s
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .trim();
  s = beschneide(s, " ,.;\t\n");
  if (s === "") return { plz: "", ort: "", land: "", guete: "leer" };

  let land = "";

  // Führendes Länderkürzel: „D-70173 Stuttgart"
  const kuerzel = s.match(/^([A-Za-z]{1,3})\s*-\s*(?=\d)/);
  if (kuerzel) {
    const treffer = LAENDER.find(([wort]) => wort === kuerzel[1].toLowerCase());
    if (treffer) {
      land = treffer[1];
      s = s.slice(kuerzel[0].length);
    }
  }

  // Ausgeschriebenes Land irgendwo im Text. Die Wortgrenze steht als
  // Lookaround da, nicht als `\b`: „Ö" ist in JavaScript kein Wortzeichen, ein
  // `\bösterreich\b` fände die Angabe also nie.
  for (const [wort, code] of LAENDER) {
    if (wort.length <= 2) continue;
    const muster = new RegExp(`(?<![\\p{L}\\p{N}])${wort}(?![\\p{L}\\p{N}])`, "giu");
    if (muster.test(s)) {
      land = land || code;
      s = s.replace(muster, " ");
    }
  }

  const plzTreffer = s.match(/\b(\d{4,5})\b/);
  const plz = plzTreffer ? plzTreffer[1] : "";
  const rest = plzTreffer
    ? s.slice(0, plzTreffer.index) + " " + s.slice((plzTreffer.index ?? 0) + plzTreffer[0].length)
    : s;
  const ort = beschneide(rest.replace(/\s+/g, " ").trim(), " ,-–/.;");

  if (plz && !land) land = plz.length === 5 ? "DE" : "";

  let guete: OrtGuete;
  if (plz && ort) guete = "ok";
  else if (plz) guete = "nur_plz";
  else if (ort) guete = "nur_ort";
  else guete = "leer";

  return { plz, ort, land: land || "DE", guete };
}

const MONATE: Readonly<Record<string, number>> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

/**
 * Liest „Mitglied seit" aus `infos_16`. 52 der 70 Datensätze sind befüllt, in
 * elf Schreibweisen (neun, wenn man Markup und einen führenden Punkt
 * wegnormalisiert). 16 davon tragen keinen Tag, 6 nicht einmal einen Monat.
 *
 * Fehlender Tag wird auf den Monatsersten aufgefüllt, fehlender Monat auf den
 * 1. Januar. `member_since` ist `date` und erzwingt einen Tag; nur vollständige
 * Angaben zu übernehmen verlöre die 19 Altmitglieder. Der Auffüllgrad und die
 * Rohangabe fahren deshalb mit — der Bericht ist der einzige Ort, an dem die
 * Rohangabe erhalten bleibt.
 */
export function datumParsen(roh: string): Datum | null {
  const original = roh ?? "";
  let s = original.replace(/<[^>]+>/g, " ");
  s = s
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .trim();
  s = beschneide(s, " .,;\t\n");
  if (s === "") return null;

  const fertig = (jahr: number, monat: number, tag: number, grad: DatumGrad): Datum | null => {
    if (monat < 1 || monat > 12) return null;
    if (tag < 1 || tag > tageImMonat(jahr, monat)) return null;
    return { datum: `${jahr}-${pad(monat)}-${pad(tag)}`, grad, roh: original };
  };

  const monatsname = s.match(/^(\p{L}+)\s+(\d{4})$/u);
  if (monatsname) {
    const monat = MONATE[monatsname[1].toLowerCase()];
    if (monat) return fertig(Number(monatsname[2]), monat, 1, "monat");
    return null;
  }

  const tagMonatJahr = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (tagMonatJahr) {
    return fertig(Number(tagMonatJahr[3]), Number(tagMonatJahr[2]), Number(tagMonatJahr[1]), "tag");
  }

  const monatJahr = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (monatJahr) return fertig(Number(monatJahr[2]), Number(monatJahr[1]), 1, "monat");

  const jahrMonat = s.match(/^(\d{4})-(\d{1,2})$/);
  if (jahrMonat) return fertig(Number(jahrMonat[1]), Number(jahrMonat[2]), 1, "monat");

  const nurJahr = s.match(/^(\d{4})$/);
  if (nurJahr) return fertig(Number(nurJahr[1]), 1, 1, "jahr");

  return null;
}

function tageImMonat(jahr: number, monat: number): number {
  if (monat === 2) return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(monat) ? 30 : 31;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Der Exporter setzt ein Apostroph vor die Nummer, damit Excel keine Formel
 * daraus macht — 17 der 52 befüllten Nummern tragen es. Es ist kein Bestandteil
 * der Nummer.
 */
export function telefonParsen(roh: string): string {
  return (roh ?? "").trim().replace(/^'/, "").trim().replace(/\s+/g, " ");
}

const ENTITAETEN: Readonly<Record<string, string>> = {
  nbsp: "\u00a0",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/**
 * Entfernt Markup aus den Freitextfeldern und löst Entitäten auf. Beides ist
 * nötig: 14 Vorkommen über `infos`, `infos_15`, `infos_16` und `infos_28`
 * tragen Markup aus einem früheren Editor, teils mit Fremd-CSS — und ohne
 * Auflösung stünde am Go-Live-Tag `&nbsp;` im Profil.
 *
 * Entitäten werden in **einem** Durchgang ersetzt. Zwei Durchgänge machten aus
 * `&amp;lt;` ein `<`, also aus einem Text über HTML wieder HTML.
 */
export function htmlEntfernen(roh: string): string {
  if (!roh) return "";

  let s = roh.replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (ganz, kern: string) => {
    if (kern.startsWith("#x") || kern.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(kern.slice(2), 16));
    }
    if (kern.startsWith("#")) return String.fromCodePoint(Number.parseInt(kern.slice(1), 10));
    const wert = ENTITAETEN[kern.toLowerCase()];
    return wert ?? ganz;
  });
  s = s.replace(/\u00a0/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  // Leerraum um die geretteten Umbrüche herum wegnehmen — sonst beginnt jede
  // Folgezeile mit dem Leerzeichen, das aus dem geöffneten Tag entstanden ist.
  s = s.replace(/[ \t]*\n[ \t]*/g, "\n");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Die Anmeldeadresse ist der eine Schlüssel der Wiedererkennung, wo keine
 * Kennung vorliegt. Sie wird getrimmt und case-gefaltet.
 */
export function normalisiereAdresse(roh: string): string | null {
  const s = (roh ?? "").trim().toLowerCase();
  return s === "" ? null : s;
}

/**
 * Die Kennung aus dem Altsystem wird nur getrimmt. Case-Folding hiesse, zwei
 * verschiedene Kennungen zusammenwerfen zu können — sie ist ein Schlüssel, kein
 * Text.
 */
export function normalisiereKennung(roh: string): string | null {
  const s = (roh ?? "").trim();
  return s === "" ? null : s;
}

/** `String.prototype.trim` kennt keine Zeichenauswahl; Pythons `strip` schon. */
function beschneide(s: string, zeichen: string): string {
  let start = 0;
  let ende = s.length;
  while (start < ende && zeichen.includes(s[start])) start++;
  while (ende > start && zeichen.includes(s[ende - 1])) ende--;
  return s.slice(start, ende);
}
