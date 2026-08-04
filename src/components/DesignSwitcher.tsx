import { useCallback, useEffect, useState } from "react";
import {
  DESIGN_VARIANTS,
  DESIGN_VARIANT_IDS,
  type DesignVariantId,
} from "../config/designVariants";
import { cn } from "../lib/cn";
import { useDesignVariant } from "../providers/design-variant-context";

/* ⚠️ NICHT GEMOUNTET (AGE-492).
 * War das Review-Tool aus AGE-237, mit dem Detlev zwölf Varianten auf dem Deploy
 * vergleichen konnte. Seit AGE-492 gibt es nur noch zwei Themes, und ihre Wahl
 * ist eine Nutzer-Einstellung (EinstellungenPage) statt eines Review-Werkzeugs —
 * darum ist der Montagepunkt in App.tsx entfallen. Die Komponente bleibt auf
 * Wunsch im Baum; sie rendert nirgends und ist ein Löschkandidat für C2. */

const SWITCHER_ENABLED = (import.meta.env.VITE_DESIGN_SWITCHER ?? "on") !== "off";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function DesignSwitcher() {
  const { variant, setVariant } = useDesignVariant();
  const [open, setOpen] = useState(false);

  const cycleVariant = useCallback(() => {
    const i = DESIGN_VARIANT_IDS.indexOf(variant);
    setVariant(DESIGN_VARIANT_IDS[(i + 1) % DESIGN_VARIANT_IDS.length] ?? "hell");
  }, [variant, setVariant]);

  // Shift+D schaltet zwischen hell und navy um.
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
          aria-label="Theme wählen"
          className="w-72 rounded-2xl border border-accent/30 bg-canvas/95 p-2 text-ink shadow-soft backdrop-blur"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Theme</span>
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
            {DESIGN_VARIANT_IDS.map((id: DesignVariantId) => {
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
                      active ? "bg-accent-soft/60" : "hover:bg-ink/[0.05]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{v.label}</span>
                      <span className="block text-xs leading-snug text-muted">{v.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2.5 py-1.5 text-[11px] text-muted/80">Shift+D schaltet um</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Theme: ${DESIGN_VARIANTS[variant].label}. Switcher öffnen`}
          className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-canvas/90 px-4 py-2 text-sm font-semibold text-ink shadow-soft backdrop-blur transition-colors hover:border-accent"
        >
          Theme: {DESIGN_VARIANTS[variant].label}
          <span aria-hidden>▸</span>
        </button>
      )}
    </div>
  );
}
