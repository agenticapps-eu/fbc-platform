import { useId } from "react";
import { cn } from "../../lib/cn";

/** Goldene FBC-Krone als sauberes, theme-fähiges Vektor-SVG (transparenter
 *  Hintergrund). Bewusst nachgebaut, weil das offizielle Lockup-PNG einen
 *  Creme-Verlauf-Hintergrund + grüne Wortmarke hat und auf dunklen Flächen
 *  (Variante B, dark-glow-Heroes) nicht einbettbar ist. Wird vom <Logo /> für
 *  „mark" und für die dunkle Darstellung genutzt; TODO: durch Detlevs offizielles
 *  SVG ersetzen, sobald verfügbar. */
export function CrownMark({ className, title }: { className?: string; title?: string }) {
  const gid = useId();
  return (
    <svg
      viewBox="0 0 48 40"
      className={cn("h-8 w-auto", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e3c071" />
          <stop offset="1" stopColor="#b8893b" />
        </linearGradient>
      </defs>
      <path d="M4 31 L8 12 L16 23 L24 8 L32 23 L40 12 L44 31 Z" fill={`url(#${gid})`} />
      <rect x="4" y="30" width="40" height="7" rx="2.4" fill={`url(#${gid})`} />
      <circle cx="8" cy="11" r="2.3" fill="#efe3c8" />
      <circle cx="24" cy="7" r="2.6" fill="#efe3c8" />
      <circle cx="40" cy="11" r="2.3" fill="#efe3c8" />
    </svg>
  );
}
