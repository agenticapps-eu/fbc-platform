import { useEffect, useState } from "react";
import {
  DESIGN_VARIANTS,
  SWITCHER_VARIANT_IDS,
  type DesignVariantId,
} from "../config/designVariants";
import { cn } from "../lib/cn";
import { useDesignVariant } from "../providers/design-variant-context";

/* ⚠️ TEMPORÄRES REVIEW-TOOL (AGE-237).
 * Schwebender Live-Umschalter, damit Detlev die Varianten auf dem Deploy direkt
 * vergleichen kann. Angeboten wird nur noch, was in SWITCHER_VARIANT_IDS steht
 * (AGE-439: A, Sommerfest, eff.bee.zee). Sobald der Look endgültig feststeht:
 * VITE_DESIGN_SWITCHER=off setzen und diese Komponente + die nicht gewählten
 * Variant-Blöcke in src/index.css entfernen. */

const SWITCHER_ENABLED = (import.meta.env.VITE_DESIGN_SWITCHER ?? "on") !== "off";

/** Kurzcode fürs runde Badge: einbuchstabige IDs (a–i) unverändert, längere
 *  (z. B. „sommerfest") auf zwei Zeichen gekürzt, damit der Kreis nicht überläuft. */
function variantBadge(id: string): string {
  return id.length <= 2 ? id : id.slice(0, 2);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function DesignSwitcher() {
  const { variant, setVariant, cycleVariant } = useDesignVariant();
  const [open, setOpen] = useState(false);

  // Shift+D schaltet durch (Tastatur-Shortcut fürs Review).
  useEffect(() => {
    if (!SWITCHER_ENABLED) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d") && !isTypingTarget(e.target)) {
        e.preventDefault();
        cycleVariant();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleVariant]);

  if (!SWITCHER_ENABLED) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] print:hidden">
      {open ? (
        <div
          role="dialog"
          aria-label="Design-Variante wählen"
          className="w-72 rounded-2xl border border-gold/30 bg-canvas/95 p-2 text-ink shadow-soft backdrop-blur"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Design · Review
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Switcher schließen"
              className="rounded-md px-1.5 text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {SWITCHER_VARIANT_IDS.map((id: DesignVariantId) => {
              const v = DESIGN_VARIANTS[id];
              const active = id === variant;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setVariant(id)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                      active ? "bg-gold-soft/60" : "hover:bg-ink/[0.05]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
                        active ? "bg-gold text-night" : "bg-ink/[0.07] text-ink",
                      )}
                    >
                      {variantBadge(id)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        {v.label}
                        {v.recommended && (
                          <span className="text-gold-strong" title="Empfehlung">
                            ★
                          </span>
                        )}
                        {v.experimental && (
                          <span className="rounded-full border border-gold/40 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-gold-strong">
                            Experimentell
                          </span>
                        )}
                      </span>
                      <span className="block text-xs leading-snug text-muted">{v.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2.5 py-1.5 text-[11px] text-muted/80">
            Shift+D schaltet durch · <code>?variant=</code> ist teilbar
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Design-Variante: ${DESIGN_VARIANTS[variant].label}. Switcher öffnen`}
          className="fbc-sheen inline-flex items-center gap-2 rounded-full border border-gold/40 bg-canvas/90 px-4 py-2 text-sm font-semibold text-ink shadow-soft backdrop-blur transition-colors hover:border-gold"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[11px] font-bold uppercase text-night">
            {variantBadge(variant)}
          </span>
          Design: {variant.toUpperCase()}
          <span aria-hidden>▸</span>
        </button>
      )}
    </div>
  );
}
