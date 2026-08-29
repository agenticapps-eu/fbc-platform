import { cn } from "../../lib/cn";

/** eff.bee.zee-Marke: vierstrahliger Kompassstern mit Nebenstrahlen (AGE-492).
 *
 *  Ersetzt die Krone (CrownMark). `fill="currentColor"` ist der ganze Punkt:
 *  EIN Asset trägt beide Themes, weil es die Farbe seiner Umgebung erbt. Die
 *  Krone brauchte dafür ein zweites Asset — und das für dunkle Flächen fehlte
 *  dauerhaft, was Logo.tsx als offenen Punkt mitschleppte.
 *
 *  Neue Fassung vom 29.08. (AGE-642): der Ring ist ersatzlos entfallen, dafür
 *  stehen vier schlanke Nebenstrahlen auf den Diagonalen. Damit sind Komponente
 *  und Favicon jetzt formgleich — die frühere Sonderbehandlung („Ring bei 16 px
 *  auf 3.5 verstärkt") betraf genau die Form, die es nicht mehr gibt.
 *
 *  Pfad aus der verbindlichen Vorlage (docs/design-system.html), vermessen in
 *  docs/marke-neu/entwurf-messung.md. Er liegt im Repo an drei Stellen — hier,
 *  im Favicon (public/brand/compass-favicon.svg) und in der Vorlage; alle drei
 *  müssen zusammen geändert werden. */
export function CompassMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-auto", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M24 2 L27.15 20.85 L46 24 L27.15 27.15 L24 46 L20.85 27.15 L2 24 L20.85 20.85 Z M27.89 20.11 L29.64 19.9 L34.58 13.42 L28.1 18.36 Z M27.89 27.89 L28.1 29.64 L34.58 34.58 L29.64 28.1 Z M20.11 27.89 L18.36 28.1 L13.42 34.58 L19.9 29.64 Z M20.11 20.11 L19.9 18.36 L13.42 13.42 L18.36 19.9 Z"
        fill="currentColor"
      />
    </svg>
  );
}
