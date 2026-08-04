import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DESIGN_VARIANTS,
  resolveInitialVariant,
  VARIANT_STORAGE_KEY,
  type DesignVariantId,
} from "../config/designVariants";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { getMotionPreset } from "../lib/motion";
import { DesignVariantContext } from "./design-variant-context";

function readStored(): string | null {
  try {
    return localStorage.getItem(VARIANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persist(variant: DesignVariantId) {
  try {
    localStorage.setItem(VARIANT_STORAGE_KEY, variant);
  } catch {
    // Private-Mode o. Ä. — Persistenz ist best-effort, der Live-Switch bleibt.
  }
}

export function DesignVariantProvider({ children }: { children: ReactNode }) {
  const [variant, setVariantState] = useState<DesignVariantId>(() =>
    resolveInitialVariant({ stored: readStored() }),
  );
  const reducedMotion = usePrefersReducedMotion();

  // Single source of truth → DOM: <html data-variant> treibt alle CSS-Overrides.
  // Das Inline-Skript in index.html hat denselben Wert bereits VOR dem ersten
  // Paint gesetzt (gleiche Regel, gleicher Storage-Key); dieser Effect hält ihn
  // nur synchron. Weichen beide Regeln voneinander ab, korrigiert dieser Effect
  // sichtbar — genau das Flackern, das das Skript verhindern soll.
  useEffect(() => {
    document.documentElement.dataset.variant = variant;
    persist(variant);
  }, [variant]);

  const setVariant = useCallback((id: DesignVariantId) => setVariantState(id), []);

  const meta = DESIGN_VARIANTS[variant];
  const preset = useMemo(() => getMotionPreset(reducedMotion), [reducedMotion]);

  const value = useMemo(
    () => ({ variant, meta, setVariant, reducedMotion, preset }),
    [variant, meta, setVariant, reducedMotion, preset],
  );

  return <DesignVariantContext.Provider value={value}>{children}</DesignVariantContext.Provider>;
}
