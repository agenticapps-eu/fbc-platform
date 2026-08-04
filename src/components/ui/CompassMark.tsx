import { cn } from "../../lib/cn";

/** eff.bee.zee-Marke: vierstrahliger Kompassstern im dünnen Ring (AGE-492).
 *
 *  Ersetzt die Krone (CrownMark). `fill="currentColor"` ist der ganze Punkt:
 *  EIN Asset trägt beide Themes, weil es die Farbe seiner Umgebung erbt. Die
 *  Krone brauchte dafür ein zweites Asset — und das für dunkle Flächen fehlte
 *  dauerhaft, was Logo.tsx als offenen Punkt mitschleppte.
 *
 *  Pfad aus der verbindlichen Vorlage (docs/design-system.html). Ab 16 px wird
 *  der Ring dort auf 2 px verstärkt; das betrifft das Favicon
 *  (public/brand/compass-favicon.svg), nicht diese Komponente. */
export function CompassMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-auto", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M24 7 L27 21 L41 24 L27 27 L24 41 L21 27 L7 24 L21 21 Z" fill="currentColor" />
    </svg>
  );
}
