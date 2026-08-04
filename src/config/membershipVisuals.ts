import type { CSSProperties } from "react";

/** Rang-Monogramm als Serifen-Römerzahl (1–6 → I…VI) für das Siegel im Band. */
const NUMERALS = ["", "I", "II", "III", "IV", "V", "VI"] as const;
export function monogram(rank: number): string {
  return NUMERALS[rank] ?? String(rank);
}

/** Der Akzent-Ton, `pct`% über die Canvas gemischt — token-getrieben, erbt je Theme. */
function accentMix(pct: number): string {
  return `color-mix(in oklab, var(--color-accent) ${pct}%, var(--color-canvas))`;
}

/**
 * Akzent-Band-Hintergrund pro Stufe: kein flacher Ton mehr, sondern Tiefe.
 * Ein vertikaler Verlauf (oben heller → unten satter) trägt die Rang-Progression
 * (Rang 1 blass → 6 satt); ein zarter Spekular-Schimmer fängt die Oberkante; eine
 * Akzent-Haarlinie graviert die Naht zum Karten-Körper. Alles token-getrieben, damit
 * jedes Theme seinen eigenen Akzent erbt — keine Pro-Theme-Klassen.
 */
export function accentBandStyle(rank: number): CSSProperties {
  const pct = Math.min(60, Math.max(8, 6 + rank * 8));
  const top = Math.max(4, pct - 8);
  return {
    background: [
      "radial-gradient(120% 80% at 50% -30%, rgba(255, 255, 255, 0.22), transparent 60%)",
      `linear-gradient(180deg, ${accentMix(top)}, ${accentMix(pct)})`,
    ].join(", "),
    borderBottom: "1px solid color-mix(in oklab, var(--color-accent) 45%, transparent)",
  };
}
