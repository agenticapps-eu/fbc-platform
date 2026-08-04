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
      {/* Der Ring sitzt enger als die Zacken: der Stern bricht an allen vier
          Spitzen aus dem Kreis aus (AGE-499, Donalds Referenz). Vorher lag er
          vollständig innen, wodurch die Marke wie ein gefüllter Kreis mit Muster
          las statt wie ein Kompass. */}
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M24 2 L27.4 20.6 L46 24 L27.4 27.4 L24 46 L20.6 27.4 L2 24 L20.6 20.6 Z"
        fill="currentColor"
      />
    </svg>
  );
}
