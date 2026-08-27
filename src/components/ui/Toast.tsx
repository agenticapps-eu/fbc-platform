import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ToastContext, type ToastOptions } from "./toast-context";

interface ToastItem extends ToastOptions {
  id: number;
}

const variantStyles: Record<NonNullable<ToastOptions["variant"]>, string> = {
  default: "border-l-accent",
  success: "border-l-success",
  error: "border-l-danger",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...options, id }]);
      window.setTimeout(() => dismiss(id), options.duration ?? 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Der Ausgleich für die angedockten Chatfenster (AGE-639). Gemessen:
          Toasts stehen bei `right-6` und sind bis 24 rem breit, die Fensterreihe
          beginnt bei 5,5 rem vom rechten Rand — sie überlappen, und zwar genau
          in der Ecke, in der die SENDEZEILE des rechtesten Fensters sitzt. Der
          Toast, der als erster dort landen würde, ist ausgerechnet „Nachricht
          nicht gesendet".

          Die Variable setzt die Hülle an `document.documentElement`, an genau
          einer Stelle. Der Vorgabewert `0rem` gilt überall, wo es keine Fenster
          gibt — auf `/login`, unter `xl`, auf den Chatrouten. */}
      <div
        style={{ bottom: "calc(1.5rem + var(--fbc-fenster-h, 0rem))" }}
        className="pointer-events-none fixed right-6 z-50 flex w-full max-w-sm flex-col gap-3"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border border-line border-l-4 bg-canvas px-4 py-3 shadow-soft",
              variantStyles[t.variant ?? "default"],
            )}
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-muted transition-colors hover:text-ink"
              aria-label="Schließen"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
