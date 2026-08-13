import type { ReactElement } from "react";

/** Sidebar-Icons (AGE-499).
 *
 *  Ein Icon je Menüeintrag, gekeyt auf den Pfad — die Referenzen zeigen die
 *  Navigation mit Symbolen, und eingeklappt ist das Icon der einzige Anker, den
 *  ein Eintrag noch hat.
 *
 *  Bewusst inline und ohne Icon-Bibliothek: es sind zwölf Symbole in einem
 *  einheitlichen Linienstil (1.6 px, runde Enden, 24er-Viewbox). Eine
 *  Abhängigkeit für zwölf Pfade zu ziehen, brächte ein paar hundert ungenutzte
 *  Icons und einen zweiten Stil ins Haus.
 *
 *  Alle Pfade zeichnen mit `currentColor` — dieselbe Datei trägt damit dunkelblaue
 *  Icons auf hellem und helle auf dunkelblauem Chrome, ohne Theme-Verzweigung.
 */

const ICONS: Record<string, ReactElement> = {
  "/": (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1h3.5v-5h4v5H17a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  "/kompass": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15 9-1.8 4.2L9 15l1.8-4.2z" />
    </>
  ),
  "/academy": (
    <>
      <path d="M12 4.5 21 9l-9 4.5L3 9z" />
      <path d="M6.5 11v4.8c0 .5.3 1 .8 1.2 1.3.7 3 1 4.7 1s3.4-.3 4.7-1c.5-.2.8-.7.8-1.2V11" />
    </>
  ),
  "/events": (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  "/mitglieder": (
    <>
      <circle cx="9.5" cy="9" r="3.2" />
      <path d="M3.5 19.5c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8" />
      <path d="M16.5 7.2a3 3 0 0 1 0 5.6M18.5 19.5c0-1.9-.7-3.3-2-4.2" />
    </>
  ),
  "/aktivitaet": (
    <>
      <path d="M20.5 12c0 4.1-3.8 7.5-8.5 7.5-1.2 0-2.4-.2-3.4-.6L3.5 20.5l1.7-4.4C4.1 14.9 3.5 13.5 3.5 12c0-4.1 3.8-7.5 8.5-7.5s8.5 3.4 8.5 7.5Z" />
    </>
  ),
  "/profil": (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
    </>
  ),
  "/kontakte": (
    <>
      <circle cx="8.8" cy="9" r="3.2" />
      <path d="M3 19.5c0-3 2.6-4.8 5.8-4.8s5.8 1.8 5.8 4.8" />
      <path d="M17.5 8.5v5M20 11h-5" />
    </>
  ),
  "/mitgliedschaft": (
    <>
      <path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z" />
    </>
  ),
  "/einstellungen": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  "/admin": (
    <>
      <path d="M12 3.5 5 6.4v5c0 4.1 2.9 7.9 7 9.1 4.1-1.2 7-5 7-9.1v-5z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </>
  ),
};

/** Gefüllte Fassung für den aktiven Eintrag (AGE-499, Referenz): das aktive
 *  Symbol ist massiv, die übrigen sind Linien. Das trägt die Auswahl auch dann,
 *  wenn die Leiste eingeklappt ist und kein Label danebensteht.
 *
 *  Die Aussparungen (Fenster im Haus, Nadel im Kompass, Blatt im Kalender)
 *  entstehen über `fill-rule="evenodd"` als Loch im selben Pfad — nicht als
 *  zweite Form in Hintergrundfarbe. Das ist der Unterschied zwischen einem
 *  Symbol, das auf jeder Fläche funktioniert, und einem, das auf hellem Chrome
 *  richtig und auf dunklem falsch aussieht. */
const FILLED: Record<string, ReactElement> = {
  "/": <path d="M12 3.2 21.5 10.5v9.3a1 1 0 0 1-1 1h-5v-5.6h-7V20.8h-5a1 1 0 0 1-1-1v-9.3z" />,
  "/kompass": (
    <path
      fillRule="evenodd"
      d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.9 5.1-2.4 5.6-5.6 2.4 2.4-5.6z"
    />
  ),
  "/academy": (
    <>
      <path d="M12 3.6 22.4 8.8 12 14 1.6 8.8z" />
      <path d="M6 11.3v4.9c0 .6.3 1.1.9 1.4 1.4.8 3.2 1.2 5.1 1.2s3.7-.4 5.1-1.2c.6-.3.9-.8.9-1.4v-4.9l-6 3z" />
    </>
  ),
  "/events": (
    <path
      fillRule="evenodd"
      d="M8 2.2a.9.9 0 0 1 .9.9v1.5h6.2V3.1a.9.9 0 0 1 1.8 0v1.5h1.6a2.5 2.5 0 0 1 2.5 2.5v11.4a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 18.5V7.1a2.5 2.5 0 0 1 2.5-2.5h1.6V3.1a.9.9 0 0 1 .9-.9ZM4.8 10.6v7.9c0 .4.3.7.7.7h13a.7.7 0 0 0 .7-.7v-7.9z"
    />
  ),
  "/mitglieder": (
    <>
      <circle cx="9.3" cy="8.8" r="3.6" />
      <path d="M3 19.8c0-3.3 2.9-5.3 6.3-5.3s6.3 2 6.3 5.3a.7.7 0 0 1-.7.7H3.7a.7.7 0 0 1-.7-.7Z" />
      <path d="M16.4 6.6a3.2 3.2 0 0 1 0 6.4 4.6 4.6 0 0 0-1-.7 4.4 4.4 0 0 0 0-5 4.6 4.6 0 0 0 1-.7Z" />
      <path d="M17.2 14.8c2.2.5 3.8 2.2 3.8 4.7v.3a.7.7 0 0 1-.7.7h-3.4c.1-2-.6-3.8-1.9-5.1a9 9 0 0 1 2.2-.6Z" />
    </>
  ),
  "/aktivitaet": (
    <path d="M12 3.7c5.2 0 9.5 3.7 9.5 8.3s-4.3 8.3-9.5 8.3c-1.2 0-2.3-.2-3.4-.5l-5.2 1.4a.7.7 0 0 1-.9-.9l1.5-4A7.7 7.7 0 0 1 2.5 12c0-4.6 4.3-8.3 9.5-8.3Z" />
  ),
  "/profil": (
    <>
      <circle cx="12" cy="8.2" r="4" />
      <path d="M4.3 20.4c0-3.8 3.5-6 7.7-6s7.7 2.2 7.7 6a.7.7 0 0 1-.7.7H5a.7.7 0 0 1-.7-.7Z" />
    </>
  ),
  "/kontakte": (
    <>
      <circle cx="8.8" cy="8.8" r="3.6" />
      <path d="M2.6 19.9c0-3.3 2.8-5.4 6.2-5.4s6.2 2.1 6.2 5.4a.6.6 0 0 1-.6.6H3.2a.6.6 0 0 1-.6-.6Z" />
      <path d="M17.5 7.6a.9.9 0 0 1 .9.9v1.7h1.7a.9.9 0 0 1 0 1.8h-1.7v1.7a.9.9 0 0 1-1.8 0V12h-1.7a.9.9 0 0 1 0-1.8h1.7V8.5a.9.9 0 0 1 .9-.9Z" />
    </>
  ),
  "/mitgliedschaft": (
    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.4l6.1-.9z" />
  ),
  "/einstellungen": (
    <path
      fillRule="evenodd"
      d="M12 2a2 2 0 0 1 2 2v.2c0 .6.4 1.2 1 1.4.6.3 1.3.2 1.7-.3l.2-.1a2 2 0 1 1 2.8 2.8l-.1.2c-.5.4-.6 1.1-.3 1.7.2.6.8 1 1.4 1H21a2 2 0 1 1 0 4h-.2c-.6 0-1.2.4-1.4 1-.3.6-.2 1.3.3 1.7l.1.2a2 2 0 1 1-2.8 2.8l-.2-.1c-.4-.5-1.1-.6-1.7-.3-.6.2-1 .8-1 1.4V21a2 2 0 1 1-4 0v-.2c0-.6-.4-1.2-1-1.4-.6-.3-1.3-.2-1.7.3l-.2.1a2 2 0 1 1-2.8-2.8l.1-.2c.5-.4.6-1.1.3-1.7-.2-.6-.8-1-1.4-1H3a2 2 0 1 1 0-4h.2c.6 0 1.2-.4 1.4-1 .3-.6.2-1.3-.3-1.7l-.1-.2a2 2 0 1 1 2.8-2.8l.2.1c.4.5 1.1.6 1.7.3.6-.2 1-.8 1-1.4V4a2 2 0 0 1 2-2Zm0 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"
    />
  ),
  "/admin": (
    <path
      fillRule="evenodd"
      d="M12 2.6 4.6 5.7v5.9c0 4.6 3.2 8.8 7.4 10.1 4.2-1.3 7.4-5.5 7.4-10.1V5.7zm3.4 7-4.3 4.5-2.5-2.5 1.2-1.3 1.3 1.3 3-3.2z"
    />
  ),
};

/** Fällt auf einen Punkt zurück, wenn ein neuer Pfad noch kein Symbol hat —
 *  eingeklappt bleibt der Eintrag so trotzdem anklickbar und sichtbar. */
const FALLBACK = <circle cx="12" cy="12" r="3.4" />;

export function NavIcon({
  path,
  active = false,
  className,
}: {
  path: string;
  /** Aktiver Eintrag → gefülltes Symbol statt Linien. */
  active?: boolean;
  className?: string;
}) {
  const filled = active ? FILLED[path] : undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-5 w-5 shrink-0"}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {filled ?? ICONS[path] ?? FALLBACK}
    </svg>
  );
}
