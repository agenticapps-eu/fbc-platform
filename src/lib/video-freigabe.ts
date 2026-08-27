import { useSyncExternalStore } from "react";

/**
 * Die Freigabe fuer eingebettete Videos — je Anbieter, dauerhaft, widerruflich
 * (AGE-621).
 *
 * **Warum es das gibt.** Das Einwilligungstor aus AGE-611 merkte sich nichts:
 * ein Klick pro Video, und nach jedem Neuladen wieder von vorn. Auf der
 * Startseite waren das zwei Klicks, jedes Mal. Das ist die strengste denkbare
 * Variante und in der Bedienung muehsamer als alles, was Besucher von anderen
 * Seiten kennen.
 *
 * **Was hier NICHT steht.** Keine Kennung, kein Zeitstempel, kein Zaehler — nur
 * welche Anbieter freigegeben sind. Ein Wert auf dem Endgeraet ist eine
 * Technologie im Sinne des §25 TTDSG; er traegt deshalb genau die Entscheidung
 * und nichts, woran sich ein Besuch wiedererkennen liesse. Die Cookie-
 * Richtlinie benennt ihn.
 *
 * **Warum je Anbieter und nicht global.** Wer YouTube erlaubt, hat ueber Vimeo
 * nichts gesagt. Eine Einwilligung muss spezifisch sein, und zwei Anbieter sind
 * zwei Entscheidungen.
 */
export type Anbieter = "youtube" | "vimeo";

const SCHLUESSEL = "fbc.video-freigabe";

/** Die uebrigen Flaechen DERSELBEN Seite muessen nachziehen, sonst waere die
 *  Zusage „einmalig" auf einer Seite mit zwei Videos unwahr. */
const horcher = new Set<() => void>();

function melden() {
  for (const h of horcher) h();
}

/**
 * Jeder Speicherzugriff ist gefangen. Er wirft in abgeschotteten Kontexten
 * (Speicher abgeschaltet, volles Kontingent) — und `istFreigegeben` laeuft beim
 * RENDERN. Ein ungefangener Fehler risse dort die ganze Seite auf, statt nur
 * das Merken zu verlieren.
 */
function lesen(): string[] {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    return roh ? roh.split(",") : [];
  } catch {
    return [];
  }
}

function schreiben(anbieter: string[]) {
  try {
    if (anbieter.length === 0) localStorage.removeItem(SCHLUESSEL);
    else localStorage.setItem(SCHLUESSEL, anbieter.join(","));
  } catch {
    // Das Merken faellt aus, das Tor nicht: wer geklickt hat, sieht sein Video.
    // Nur der naechste Aufruf faengt wieder von vorn an. Deshalb wird unten
    // trotzdem gemeldet.
  }
}

export function istFreigegeben(anbieter: Anbieter): boolean {
  return lesen().includes(anbieter);
}

export function freigeben(anbieter: Anbieter) {
  const jetzt = lesen();
  if (!jetzt.includes(anbieter)) schreiben([...jetzt, anbieter]);
  melden();
}

export function widerrufen(anbieter: Anbieter) {
  schreiben(lesen().filter((a) => a !== anbieter));
  melden();
}

export function abonnieren(horchen: () => void): () => void {
  horcher.add(horchen);
  return () => horcher.delete(horchen);
}

/**
 * `useSyncExternalStore` verlangt einen Schnappschuss, der sich nur bei echter
 * Aenderung unterscheidet. Deshalb ein Boolean je Anbieter und keine Liste: ein
 * frisch gebautes Array waere bei jedem Rendern ein neuer Wert und triebe React
 * in eine Schleife.
 */
export function useFreigabe(anbieter: Anbieter | null): boolean {
  return useSyncExternalStore(
    abonnieren,
    // `null` steht fuer eine URL, die gar kein einbettbares Video ist. Der Hook
    // nimmt sie entgegen, statt den Aufrufer zu einem erfundenen Anbieter zu
    // zwingen — Hooks duerfen nicht hinter einer Bedingung stehen, und die
    // Absage entscheidet sich erst nach dem Zerlegen der URL.
    () => anbieter !== null && istFreigegeben(anbieter),
    // Auf dem Server gibt es kein Endgeraet, also auch keine Freigabe. Ohne
    // diesen dritten Wert wirft der Hook beim Vorab-Rendern.
    () => false,
  );
}
