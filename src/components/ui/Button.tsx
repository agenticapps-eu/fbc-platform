import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-soft disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Primary — Akzent-Fläche, Text in accent-ink (kein Glanz-Effekt mehr, AGE-492).
  primary: "bg-accent text-accent-ink hover:bg-accent-strong focus-visible:ring-accent",
  // Secondary — near-black Fläche, heller Text. Dezenter Rand, damit der Button sich
  // in Variante B (dunkle Canvas ≈ bg-chrome) noch von der Fläche abhebt.
  secondary:
    "border border-chrome-border bg-chrome text-on-chrome hover:bg-chrome-elevated focus-visible:ring-chrome",
  // Ghost — Akzent-Outline.
  ghost:
    "border border-accent text-accent-strong hover:bg-accent-soft/40 focus-visible:ring-accent",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
};

/** Dieselben Klassen für ein Element, das ein LINK sein muss statt ein Knopf.
 *
 *  Nötig geworden mit AGE-616: seit die Registrierung eine Adresse hat, sollen
 *  die Einladungen dorthin auch eine tragen — mittlere Maustaste, neuer Tab,
 *  Ziel in der Statusleiste, und ein Screenreader sagt „Link" statt „Schaltfläche"
 *  für etwas, das navigiert. Ein `<button onClick={navigate}>` kann davon nichts. */
export function buttonKlassen(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});
