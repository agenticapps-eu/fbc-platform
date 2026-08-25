import { findCategory, type MatchingSide } from "../config/matching";

/**
 * Die Anzeigeregeln für „Ich biete" / „Ich suche" (AGE-597).
 *
 * Sie stehen hier und nicht in der Seite, damit
 * `scripts/probe-age597-kompass-bestand.ts` den ECHTEN Code über den ganzen
 * Bestand laufen lassen kann. Eine zweite, nachgebaute Fassung im Prüfskript
 * hätte gemessen, was das Skript tut — nicht, was die Seite zeigt.
 */

/**
 * Der Import kürzt lange Titel an der Wortgrenze und hängt U+2026 an. GEMESSEN,
 * nicht angenommen: alle drei 80-Zeichen-Titel auf PROD enden auf dieses
 * Zeichen, und die Beschreibung trägt an genau dieser Stelle ein Leerzeichen
 * (25.08., `scripts/probe-age597-kompass-bestand.ts`).
 */
const AUSLASSUNG = "\u2026";

/**
 * Führende Aufzählungszeichen aus dem Altbestand — Apostroph-Bindestrich am
 * Zeilenanfang, 13-mal in Titeln und 13-mal in Beschreibungen.
 *
 * Geputzt wird BEIM DARSTELLEN. Ein UPDATE wäre sauberer an der Quelle, ist aber
 * ein Schreibzugriff auf Mitgliederinhalte ohne deren Zutun — den rechtfertigt
 * eine Anzeigefrage nicht (Donald, 25.08.).
 */
const AUFZAEHLUNGSZEICHEN = /^[ \t]*'-[ \t]*/gm;

export function putzen(text: string): string {
  return text.replace(AUFZAEHLUNGSZEICHEN, "").trim();
}

/**
 * Wiederholt der Titel nur den Anfang der Beschreibung? Verglichen wird nach dem
 * Putzen und Trimmen gegen die erste nichtleere Zeile — und ein abschließendes
 * Auslassungszeichen wird vorher abgeschnitten, weil dort kein zeichengleiches
 * Präfix entstehen kann.
 *
 * WARUM NICHT „bis zur letzten Wortgrenze": diese naheliegende Regel fasst über
 * den Bestand 81 statt 61 Zeilen. Die 20 zusätzlichen sind Titel, die mit ihrer
 * Beschreibung nur die ersten Worte teilen — sie zu schlucken wäre derselbe
 * Datenverlust in die andere Richtung.
 */
export function wiederholtDenAnfang(rohTitel: string, beschreibung: string): boolean {
  const titel = putzen(rohTitel);
  const erste = putzen(beschreibung).split("\n").find((z) => z.trim() !== "")?.trim() ?? "";
  if (titel === "" || erste === "") return false;
  const ohneKuerzung = titel.endsWith(AUSLASSUNG) ? titel.slice(0, -1).trimEnd() : titel;
  return ohneKuerzung !== "" && erste.startsWith(ohneKuerzung);
}

export interface KompassZeile {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  source: string;
}

export interface KompassAnzeige {
  /** Klartext-Namen der Kategorien, eine umlaufende Reihe. */
  marken: string[];
  /** Was darunter als Text steht — Titel nur, wo er nicht schon dasteht. */
  eintraege: { id: string; titel: string; text: string }[];
}

/**
 * Was ein Abschnitt tatsächlich zeigt.
 *
 * Die Marke hängt an der **Kategorie**, nicht an `source`: der reiche Editor
 * unter `/kompass` verlangt für jede Zeile eine Kategorie aus der bekannten
 * Liste, und `source` überlebt das Speichern. Sobald ein Mitglied dort einmal
 * speichert, trägt auch jede `editor`-Zeile eine — eine Reihe, die nur `chip`
 * ansieht, verschwiege sie.
 *
 * Der Titel hängt ebenfalls nicht an `source`, sondern daran, ob er etwas
 * wiederholt, das ohnehin schon dasteht: den Klartext seiner eigenen Kategorie
 * oder den Anfang seiner Beschreibung. Derselbe Editor stellt für JEDE Zeile
 * ein Pflichtfeld „Titel", also kann eine `chip`-Zeile sehr wohl einen selbst
 * geschriebenen Titel tragen — ihn an `source` festzumachen löschte ihn von der
 * Seite, während das Formular ihn weiter anzeigt.
 *
 * Für eine Kategorie ohne hinterlegten Klartext entfällt die Marke, statt den
 * Schlüssel zu zeigen: `categoryLabel` fiele auf `future_key` → „Future_key"
 * zurück und hielte die Zusage „kein roher Schlüssel" nicht ein.
 */
export function kompassAnzeige(zeilen: KompassZeile[], side: MatchingSide): KompassAnzeige {
  const marken: string[] = [];
  const eintraege: KompassAnzeige["eintraege"] = [];

  for (const z of zeilen) {
    const label = findCategory(side, z.category)?.label;
    if (label !== undefined && !marken.includes(label)) marken.push(label);

    const titel = putzen(z.title);
    const text = putzen(z.description ?? "");
    const doppeltDieMarke = label !== undefined && titel === label;
    const eintrag = {
      id: z.id,
      titel: doppeltDieMarke || wiederholtDenAnfang(z.title, z.description ?? "") ? "" : titel,
      text,
    };
    if (eintrag.titel !== "" || eintrag.text !== "") eintraege.push(eintrag);
  }

  return { marken, eintraege };
}
