import type { CSSProperties } from "react";

/** Anzeige-Ziffer des Rang-Monogramms (1–6). */
export function monogram(rank: number): string {
  return String(rank);
}

/**
 * Akzent-Band-Hintergrund pro Stufe: EIN Gold-Token, mit `color-mix` in sechs
 * Stufen über die Canvas gemischt (Rang 1 blass → 6 satt). Token-getrieben, damit
 * jede Design-Variante ihr eigenes Gold erbt — keine Pro-Varianten-Klassen.
 */
export function accentBandStyle(rank: number): CSSProperties {
  const pct = Math.min(60, Math.max(8, 6 + rank * 8));
  return { background: `color-mix(in oklab, var(--color-gold) ${pct}%, var(--color-canvas))` };
}
