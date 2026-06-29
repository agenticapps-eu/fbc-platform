import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_VARIANT,
  DESIGN_VARIANT_IDS,
  DESIGN_VARIANTS,
  resolveInitialVariant,
  VARIANT_QUERY_PARAM,
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

/** Spiegelt die Auswahl in die URL (?variant=) per replaceState, ohne den
 *  History-Stack zu verändern — Deep-Links bleiben teilbar, Back/Forward heil. */
function syncUrl(variant: DesignVariantId) {
  const url = new URL(window.location.href);
  if (url.searchParams.get(VARIANT_QUERY_PARAM) === variant) return;
  url.searchParams.set(VARIANT_QUERY_PARAM, variant);
  window.history.replaceState(window.history.state, "", url);
}

export function DesignVariantProvider({ children }: { children: ReactNode }) {
  const [variant, setVariantState] = useState<DesignVariantId>(() =>
    resolveInitialVariant({ search: window.location.search, stored: readStored() }),
  );
  const reducedMotion = usePrefersReducedMotion();

  // Single source of truth → DOM: <html data-variant> treibt alle CSS-Overrides.
  // Zusätzlich spiegeln die strukturellen Flags der aktiven Variante in
  // data-card-style / data-backdrop — daran hängen die wiederverwendbaren
  // Card-/Backdrop-Stile (statt Komponenten-Forks).
  useEffect(() => {
    const root = document.documentElement;
    const meta = DESIGN_VARIANTS[variant];
    root.dataset.variant = variant;
    root.dataset.cardStyle = meta.cardStyle ?? "solid";
    root.dataset.backdrop = meta.backdrop ?? "none";
    persist(variant);
    syncUrl(variant);
  }, [variant]);

  const setVariant = useCallback((id: DesignVariantId) => setVariantState(id), []);

  const cycleVariant = useCallback(() => {
    setVariantState((current) => {
      const i = DESIGN_VARIANT_IDS.indexOf(current);
      return DESIGN_VARIANT_IDS[(i + 1) % DESIGN_VARIANT_IDS.length] ?? DEFAULT_VARIANT;
    });
  }, []);

  const meta = DESIGN_VARIANTS[variant];
  const preset = useMemo(
    () => getMotionPreset(meta.motion, reducedMotion),
    [meta.motion, reducedMotion],
  );

  const value = useMemo(
    () => ({ variant, meta, setVariant, cycleVariant, reducedMotion, preset }),
    [variant, meta, setVariant, cycleVariant, reducedMotion, preset],
  );

  return <DesignVariantContext.Provider value={value}>{children}</DesignVariantContext.Provider>;
}
