import { cn } from "../../lib/cn";
import { useDesignVariantValue } from "../../providers/design-variant-context";

/** Struktureller Hintergrund hinter dem App-Content (AGE-237, experimentelle
 *  Varianten). Flag-gesteuert über `meta.backdrop` der aktiven Variante:
 *   - 'none'   → rendert nichts (a–e),
 *   - 'aurora' → langsam driftende, leuchtende Aurora-Mesh (Variante F),
 *   - 'paper'  → dezente Papier-/Leinen-Textur (Variante G).
 *  Liegt als fixe -z-10-Ebene hinter allem; die Drift-Animation ist in index.css
 *  unter prefers-reduced-motion abgeschaltet. */
export function VariantBackdrop() {
  const { meta } = useDesignVariantValue();
  const backdrop = meta.backdrop ?? "none";
  if (backdrop === "none") return null;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fbc-backdrop pointer-events-none fixed inset-0 -z-10",
        backdrop === "aurora" && "fbc-backdrop--aurora",
        backdrop === "paper" && "fbc-backdrop--paper",
      )}
    />
  );
}
