import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { rechtsseiten } from "../content/legal/meta";

/**
 * Die vier Pflichtlinks als eine Zeile (AGE-497).
 *
 * Drei Aufrufer: der Footer des Rahmens, die Anmeldeseite und der
 * Aktivierungsbildschirm. Die letzten beiden brauchen sie eigenstaendig, weil
 * ein unbestaetigtes Konto den Rahmen — und damit den Footer — nie sieht.
 *
 * `className` wird angehaengt, nicht gemischt: `cn()` ist in diesem Projekt ein
 * blosser Join ohne tailwind-merge, die CSS-Reihenfolge entscheidet. Deshalb
 * stehen hier nur Layout-Klassen und keine, die ein Aufrufer ueberschreiben
 * wollen wuerde.
 */
export default function RechtsLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Rechtliches"
      className={cn("flex flex-wrap gap-x-5 gap-y-2 text-sm", className)}
    >
      {rechtsseiten.map((dok) => (
        <Link key={dok.slug} to={`/${dok.slug}`} className="text-muted hover:text-ink">
          {dok.titel}
        </Link>
      ))}
    </nav>
  );
}
