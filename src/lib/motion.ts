/** Motion-Presets je Intensitätsstufe (AGE-237 Live-Switcher).
 *
 *  Jede Design-Variante trägt ein `motion`-Flag (subtle | medium | dramatic).
 *  Komponenten lesen über `getMotionPreset()` ein einheitliches Preset und
 *  leiten daraus Dauer, Easing, Stagger, Slide-Distanz und Glow ab. Bei
 *  `prefers-reduced-motion` kollabiert jedes Preset auf „keine Bewegung". */

import type { MotionIntensity } from "../config/designVariants";

export interface MotionPreset {
  /** Sekunden — Grunddauer für Übergänge. */
  duration: number;
  /** cubic-bezier als framer-motion-Easing-Array. */
  ease: [number, number, number, number];
  /** Sekunden — Versatz zwischen gestaffelten Listenkindern. */
  stagger: number;
  /** Pixel — Slide-/Reveal-Distanz (y). */
  slide: number;
  /** Gold-Schimmer/Glow-Effekte aktiv (nur „dramatic"). */
  glow: boolean;
}

// Ruhiges, elegantes Ease-out (kein „zappeliges" Spring).
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const NO_EASE: [number, number, number, number] = [0, 0, 1, 1];

const PRESETS: Record<MotionIntensity, MotionPreset> = {
  subtle: { duration: 0.28, ease: EASE_OUT, stagger: 0.03, slide: 6, glow: false },
  medium: { duration: 0.42, ease: EASE_OUT, stagger: 0.06, slide: 14, glow: false },
  dramatic: { duration: 0.55, ease: EASE_OUT, stagger: 0.08, slide: 22, glow: true },
};

const REDUCED: MotionPreset = { duration: 0, ease: NO_EASE, stagger: 0, slide: 0, glow: false };

export function getMotionPreset(intensity: MotionIntensity, reducedMotion: boolean): MotionPreset {
  return reducedMotion ? REDUCED : PRESETS[intensity];
}
