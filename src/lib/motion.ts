/** Motion-Preset für Übergänge (AGE-237, seit AGE-492 nur noch eine Stufe).
 *
 *  Bis AGE-492 trug jede Design-Variante ein `motion`-Flag (subtle | medium |
 *  dramatic). Bei zwei Themes, die sich nur in Farbwerten unterscheiden, hat
 *  eine gestaffelte Bewegungsintensität keinen Zweck mehr — es bleibt ein
 *  Preset. Komponenten lesen es weiterhin über `getMotionPreset()` und leiten
 *  daraus Dauer, Easing, Stagger und Slide-Distanz ab. Bei
 *  `prefers-reduced-motion` kollabiert es auf „keine Bewegung". */

export interface MotionPreset {
  /** Sekunden — Grunddauer für Übergänge. */
  duration: number;
  /** cubic-bezier als framer-motion-Easing-Array. */
  ease: [number, number, number, number];
  /** Sekunden — Versatz zwischen gestaffelten Listenkindern. */
  stagger: number;
  /** Pixel — Slide-/Reveal-Distanz (y). */
  slide: number;
}

// Ruhiges, elegantes Ease-out (kein „zappeliges" Spring).
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const NO_EASE: [number, number, number, number] = [0, 0, 1, 1];

const DEFAULT_PRESET: MotionPreset = {
  duration: 0.42,
  ease: EASE_OUT,
  stagger: 0.06,
  slide: 14,
};

const REDUCED: MotionPreset = { duration: 0, ease: NO_EASE, stagger: 0, slide: 0 };

export function getMotionPreset(reducedMotion: boolean): MotionPreset {
  return reducedMotion ? REDUCED : DEFAULT_PRESET;
}
