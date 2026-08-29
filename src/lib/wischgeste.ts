/**
 * Wann eine Berührung ein Wischen von der rechten Kante ist (AGE-642).
 *
 * Nur die RECHTE Kante, und das ist kein Zufall: links liegt auf iOS die
 * System-Zurück-Geste. Eine eigene Geste dort konkurriert mit ihr, und wer
 * verliert, entscheidet das Betriebssystem — nicht wir.
 *
 * Die Entscheidung steht hier und nicht im Effekt, weil Berührungsereignisse in
 * jsdom nicht entstehen. Ein Test, der auf sie wartet, wäre grün, weil nichts
 * passiert — dieselbe Falle wie bei `env(safe-area-inset-*)` und beim
 * `backButton`.
 */

/** Wie nah am Rand die Berührung beginnen muss. */
export const KANTE_PX = 24;
/** Wie weit nach links gezogen werden muss, bevor es als Absicht gilt. */
export const SCHWELLE_PX = 48;

export function wischtVonRechts({
  startX,
  breite,
  dx,
  dy,
}: {
  /** X der ersten Berührung. */
  startX: number;
  /** Fensterbreite. */
  breite: number;
  /** Verschiebung seither, negativ heisst nach links. */
  dx: number;
  /** Verschiebung seither, senkrecht. */
  dy: number;
}): boolean {
  // Am Rand begonnen?
  if (startX < breite - KANTE_PX) return false;
  // Weit genug nach links?
  if (dx > -SCHWELLE_PX) return false;
  // Und waagerecht GEMEINT: sonst reisst jede Scrollbewegung, die am rechten
  // Rand beginnt, die Leiste auf. Der Vergleich ist der ganze Unterschied
  // zwischen einer Geste und einem Fehlalarm.
  return Math.abs(dx) > Math.abs(dy);
}
