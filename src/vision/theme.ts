import type { CSSProperties } from "react";

/**
 * eff.bee.zee-Vision-Dummy (AGE-361, Phase C) — eigenständige Marke, KEIN FBC.
 * Rein clientseitige Vorschau: eigene Palette als CSS-Variablen auf dem Shell-Root,
 * damit die Primitives sie über `var(--ebz-*)` lesen (kein FBC-Token-Bleed).
 * Referenz: docs/design-mocks/linkedin.jpeg.
 */
export const EBZ_VARS: CSSProperties = {
  ["--ebz-navy" as string]: "#0e1a3a",
  ["--ebz-navy-2" as string]: "#10214a",
  ["--ebz-blue" as string]: "#2f6bff",
  ["--ebz-blue-2" as string]: "#3b82f6",
  ["--ebz-blue-soft" as string]: "#eaf1ff",
  ["--ebz-bg" as string]: "#f5f7fb",
  ["--ebz-card" as string]: "#ffffff",
  ["--ebz-ink" as string]: "#0f1b33",
  ["--ebz-muted" as string]: "#5b6b8c",
  ["--ebz-line" as string]: "#e4e9f2",
  ["--ebz-gold" as string]: "#e8b53a",
  ["--ebz-green" as string]: "#1fa971",
  ["--ebz-green-soft" as string]: "#e7f6ef",
};
