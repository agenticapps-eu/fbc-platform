/**
 * Wächter für die kuratierten Release-Geschichten (AGE-705).
 *
 * Sie prüfen den Text, den ein Mensch geschrieben hat, bevor er in ein
 * Repository wandert, das öffentlich ist. Beide geben die gefundene Stelle
 * zurück statt nur `true`/`false` — wer den Test rot sieht, soll ohne Suchen
 * wissen, welche Zeichenfolge gemeint ist.
 *
 * Sie liegen hier und nicht unter `scripts/`, weil `src/content/` sie
 * importiert; dieselbe Trennung wie bei `release-entwurf.ts`.
 */

/**
 * Auszeichnungssprachen, nach denen gesucht wird.
 *
 * Der Grund ist keine Stilfrage: derselbe Text kann in eine Zustellung wandern,
 * und `ReleaseNoteModal` rendert ihn unverändert als Klartext. Sternchen wären
 * dort als Sternchen zu sehen.
 *
 * Backticks stehen mit auf der Liste, obwohl sie nichts kaputt machen: der
 * realistische Weg, auf dem Markup hereinkommt, ist Abschreiben aus dem
 * Archiveintrag, und dort stehen Tabellen- und Spaltennamen durchgehend darin.
 */
const MARKUP: RegExp[] = [
  /<\/?[a-zA-Z][^<>]*>/, // HTML-Element
  /\*\*[^*\n]+\*\*/, // Markdown-Betonung
  /__[^_\n]+__/, // dieselbe mit Unterstrichen
  /\[[^\]\n]*\]\([^)\n]*\)/, // Markdown-Link
  /`[^`\n]+`/, // Backtick-Auszeichnung
];

/** Die erste Auszeichnung im Text, oder `null` für reinen Klartext. */
export function findeMarkup(text: string): string | null {
  for (const muster of MARKUP) {
    const treffer = muster.exec(text);
    if (treffer) return treffer[0];
  }
  return null;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/**
 * Zwei oder mehr Zifferngruppen, durch Leerzeichen, Schrägstrich oder
 * Bindestrich getrennt, mit optionaler Ländervorwahl.
 *
 * Der Punkt ist NICHT als Trenner zugelassen und die Gruppen zählen mindestens
 * zwei Ziffern: sonst wäre „ab dem 07.09.2026" eine Rufnummer. Wie viele
 * Ziffern insgesamt zusammenkommen müssen, entscheidet danach `TELEFON_ZIFFERN`
 * — „Tag 1 bis 31" soll durchkommen.
 */
const TELEFON_KANDIDAT = /(?:\+\d{1,3}[\s/-]?)?\d{2,}(?:[\s/-]\d{2,}){1,4}/g;
const TELEFON_ZIFFERN = 9;

const ANSCHRIFT: RegExp[] = [
  // Straßenname plus Hausnummer.
  /\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]*(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm)\s+\d{1,4}\b/,
  // Postleitzahl plus Ort.
  /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/,
];

/**
 * Die erste Stelle mit Personenbezug, oder `null`.
 *
 * **Ein Netz, keine Zusage.** Er fängt, was eine Gestalt hat — Adressen,
 * Rufnummern, Anschriften. Einen Klarnamen erkennt er nicht, und deshalb steht
 * der Durchgang von Hand neben ihm und nicht hinter ihm.
 *
 * Er greift vor dem Commit, nicht vor dem Deploy: das Repository ist
 * öffentlich, ein solcher Text wäre mit dem Commit offengelegt.
 */
export function findePersonenbezug(text: string): string | null {
  const email = EMAIL.exec(text);
  if (email) return email[0];

  for (const treffer of text.matchAll(TELEFON_KANDIDAT)) {
    const ziffern = treffer[0].replace(/\D/g, "").length;
    if (ziffern >= TELEFON_ZIFFERN) return treffer[0];
  }

  for (const muster of ANSCHRIFT) {
    const treffer = muster.exec(text);
    if (treffer) return treffer[0];
  }
  return null;
}
