import { createContext, useContext } from "react";
import { DEFAULT_VARIANT, DESIGN_VARIANTS } from "../config/designVariants";
import type { DesignVariant, DesignVariantId } from "../config/designVariants";
import { getMotionPreset, type MotionPreset } from "../lib/motion";

export interface DesignVariantContextValue {
  /** Aktives Theme (hell | navy). */
  variant: DesignVariantId;
  /** Metadaten des aktiven Themes (Label, Beschreibung). */
  meta: DesignVariant;
  /** Schaltet live um und persistiert (localStorage, eingeloggt zusätzlich Server). */
  setVariant: (id: DesignVariantId) => void;
  /** prefers-reduced-motion aktiv. */
  reducedMotion: boolean;
  /** Motion-Preset, bereits reduced-motion-bereinigt. */
  preset: MotionPreset;
}

export const DesignVariantContext = createContext<DesignVariantContextValue | undefined>(undefined);

export function useDesignVariant(): DesignVariantContextValue {
  const ctx = useContext(DesignVariantContext);
  if (!ctx) {
    throw new Error(
      "useDesignVariant muss innerhalb von <DesignVariantProvider> verwendet werden.",
    );
  }
  return ctx;
}

/** Defaultwert für Leaf-Komponenten ohne Provider. reducedMotion wird einmalig
 *  aus der Media-Query abgeleitet, damit auch provider-lose Komponenten
 *  (isolierte Tests, Styleguide-Snippets) reduced-motion respektieren. */
const defaultReduced =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

const DEFAULT_VALUE: DesignVariantContextValue = {
  variant: DEFAULT_VARIANT,
  meta: DESIGN_VARIANTS[DEFAULT_VARIANT],
  setVariant: () => {},
  reducedMotion: defaultReduced,
  preset: getMotionPreset(defaultReduced),
};

/** Nicht-werfende Lesevariante: liefert ohne Provider sinnvolle Defaults.
 *  Für Theming-/Motion-Leafkomponenten, die auch isoliert rendern (Tests,
 *  Styleguide-Snippets). */
export function useDesignVariantValue(): DesignVariantContextValue {
  return useContext(DesignVariantContext) ?? DEFAULT_VALUE;
}
