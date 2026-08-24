import type { ReactElement } from "react";

/** Der Icon-Satz (AGE-582).
 *
 *  **Eine** Stelle, an der ein wiederverwendbarer Glyph gezeichnet wird — und
 *  die einzige Datei im Baum, die dafür ein `<svg>` öffnen darf. Erzwungen wird
 *  das von `icons.test.ts`, nicht von diesem Kommentar: vor dem Change lagen
 *  SVGs in 14 Dateien, `CrownIcon` stand byte-gleich zweimal und der Kalender
 *  dreimal. Eine Bitte im Kommentar hatte das nicht verhindert.
 *
 *  Ein Stil, ausnahmslos: 24er-Viewbox, `currentColor`, Strichstärke 1.6, runde
 *  Enden. Die Vorlagen trugen 1.6, 1.75, 1.8 und 2.0 — die Vereinheitlichung ist
 *  eine sichtbare, gewollte Änderung an Chevron, Fanfare und Lupe.
 *
 *  Bewusst ohne Icon-Bibliothek: es sind 27 Pfade in einem Stil. Eine
 *  Abhängigkeit brächte ein paar hundert ungenutzte Symbole und einen zweiten
 *  Stil ins Haus — dieselbe Begründung wie in `NavIcon.tsx` seit AGE-499.
 *
 *  `currentColor` überall: dieselbe Datei trägt damit dunkelblaue Symbole auf
 *  hellem und helle auf dunkelblauem Chrome, ohne Theme-Verzweigung.
 */
const GLYPHS = {
  // ── Menü (aus NavIcon.tsx, AGE-499) ──────────────────────────────────────
  home: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1h3.5v-5h4v5H17a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15 9-1.8 4.2L9 15l1.8-4.2z" />
    </>
  ),
  /** Trägt auch die Kategorie `mentor`: deren Vorlage zeichnete denselben
   *  Talar-Hut mit anderen Zahlen. */
  academy: (
    <>
      <path d="M12 4.5 21 9l-9 4.5L3 9z" />
      <path d="M6.5 11v4.8c0 .5.3 1 .8 1.2 1.3.7 3 1 4.7 1s3.4-.3 4.7-1c.5-.2.8-.7.8-1.2V11" />
    </>
  ),
  /** Trägt auch den Kalender der Aktivität — die zweite Vorlage unterschied
   *  sich nur in den Rundungen und rendert dort mit 14 px. */
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  /** Trägt auch die Kategorie `users`. */
  members: (
    <>
      <circle cx="9.5" cy="9" r="3.2" />
      <path d="M3.5 19.5c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8" />
      <path d="M16.5 7.2a3 3 0 0 1 0 5.6M18.5 19.5c0-1.9-.7-3.3-2-4.2" />
    </>
  ),
  /** Menüeintrag „Aktivität" **und** die Kommentarzahl am Beitrag: beide
   *  Vorlagen zeichneten dieselbe Sprechblase. */
  comment: (
    <>
      <path d="M20.5 12c0 4.1-3.8 7.5-8.5 7.5-1.2 0-2.4-.2-3.4-.6L3.5 20.5l1.7-4.4C4.1 14.9 3.5 13.5 3.5 12c0-4.1 3.8-7.5 8.5-7.5s8.5 3.4 8.5 7.5Z" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
    </>
  ),
  contacts: (
    <>
      <circle cx="8.8" cy="9" r="3.2" />
      <path d="M3 19.5c0-3 2.6-4.8 5.8-4.8s5.8 1.8 5.8 4.8" />
      <path d="M17.5 8.5v5M20 11h-5" />
    </>
  ),
  membership: <path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3.5 5 6.4v5c0 4.1 2.9 7.9 7 9.1 4.1-1.2 7-5 7-9.1v-5z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </>
  ),

  // ── Bedienung (aus AppShell, HeaderSearch, FeedbackButton, CommunityFeed) ──
  chevronLeft: <path d="m14 6-6 6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  bell: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  /** Fanfare, nicht Lautsprecher — Feedback ist ein Zuruf an uns, kein Gespräch
   *  unter Mitgliedern (AGE-440). Die Halteschlaufe trägt genau diese Lesart. */
  feedback: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h2.5L11 17.5V6.5L6.5 10H4a1 1 0 0 0-1 1Z" />
      <path d="M15 9.2a4 4 0 0 1 0 5.6" />
      <path d="M17.8 6.8a8 8 0 0 1 0 10.4" />
      <path d="M7.5 17.5 8.6 20a1.2 1.2 0 0 0 2.3-.4v-1.4" />
    </>
  ),
  /** Nachrichten als Gegenstandsbereich — die Sprechblase `comment` gehört
   *  schon der Aktivität, und zwei Bereiche mit demselben Glyph wären genau die
   *  Verwechslung, gegen die der Kanon existiert. */
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.6 7.2 8.4 5.9 8.4-5.9" />
    </>
  ),
  /** Highlights. Bewusst NICHT der Stern aus `membership` und nicht die Krone:
   *  beide bezeichnen eine Mitgliedsstufe, nicht einen Bereich. */
  sparkle: (
    <>
      <path d="M12 3.2 13.8 9.2 19.8 11 13.8 12.8 12 18.8 10.2 12.8 4.2 11 10.2 9.2z" />
      <path d="M18.5 3.5 19.2 5.8 21.5 6.5 19.2 7.2 18.5 9.5 17.8 7.2 15.5 6.5 17.8 5.8z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5.5 5.5 5.5c1.8 0 3 .9 3.8 2 .8-1.1 2-2 3.8-2 3 0 4.5 3 3 6C19 15.65 12 20 12 20Z" />
  ),
  /** Rückfall für einen Menüpfad, der noch kein Symbol hat — eingeklappt bleibt
   *  der Eintrag so trotzdem sichtbar und anklickbar (AGE-499). */
  dot: <circle cx="12" cy="12" r="3.4" />,
  /** Nur massiv (siehe `NUR_MASSIV`): eine Krone ist eine Fläche. Stand vor dem
   *  Change byte-gleich in `building-blocks.tsx` und `ProfileHero.tsx`. */
  crown: <path d="M3 7l4 4 5-7 5 7 4-4-1.5 11h-15L3 7zm1.8 13h14.4v1.5H4.8V20z" />,

  // ── Such-/Biete-Kategorien (aus matching/CategoryIcon.tsx, AGE-244) ────────
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  network: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <circle cx="10" cy="18" r="2.2" />
      <path d="M8 7l8 1M8.5 8l1.2 8M16 10l-5 6.2" />
    </>
  ),
  bulb: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.3 1 2.5h6c0-1.2.2-1.8 1-2.5A6 6 0 0 0 12 3z" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.2" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-3.5h4V21" />
    </>
  ),
  shares: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12V4M12 12l6.5 3.8" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A2 2 0 0 1 10 3.5h4a2 2 0 0 1 2 2V7M3 12.5h18" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 3c2.5 2 4 5 4 8 0 1.7-.6 3.2-1.4 4.4L12 18l-2.6-2.6C8.6 14.2 8 12.7 8 11c0-3 1.5-6 4-8z" />
      <circle cx="12" cy="10" r="1.2" />
      <path d="M9.4 16 7 18.4M14.6 16 17 18.4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type GlyphName = keyof typeof GLYPHS;

/** Gefüllte Fassung für den aktiven Menüeintrag (AGE-499): das aktive Symbol ist
 *  massiv, die übrigen sind Linien. Das trägt die Auswahl auch dann, wenn die
 *  Leiste eingeklappt ist und kein Label danebensteht.
 *
 *  Die Aussparungen (Fenster im Haus, Nadel im Kompass, Blatt im Kalender)
 *  entstehen über `fill-rule="evenodd"` als Loch im selben Pfad — nicht als
 *  zweite Form in Hintergrundfarbe. Das ist der Unterschied zwischen einem
 *  Symbol, das auf jeder Fläche funktioniert, und einem, das auf hellem Chrome
 *  richtig und auf dunklem falsch aussieht. */
const MASSIV: Partial<Record<GlyphName, ReactElement>> = {
  home: <path d="M12 3.2 21.5 10.5v9.3a1 1 0 0 1-1 1h-5v-5.6h-7V20.8h-5a1 1 0 0 1-1-1v-9.3z" />,
  compass: (
    <path
      fillRule="evenodd"
      d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.9 5.1-2.4 5.6-5.6 2.4 2.4-5.6z"
    />
  ),
  academy: (
    <>
      <path d="M12 3.6 22.4 8.8 12 14 1.6 8.8z" />
      <path d="M6 11.3v4.9c0 .6.3 1.1.9 1.4 1.4.8 3.2 1.2 5.1 1.2s3.7-.4 5.1-1.2c.6-.3.9-.8.9-1.4v-4.9l-6 3z" />
    </>
  ),
  calendar: (
    <path
      fillRule="evenodd"
      d="M8 2.2a.9.9 0 0 1 .9.9v1.5h6.2V3.1a.9.9 0 0 1 1.8 0v1.5h1.6a2.5 2.5 0 0 1 2.5 2.5v11.4a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 18.5V7.1a2.5 2.5 0 0 1 2.5-2.5h1.6V3.1a.9.9 0 0 1 .9-.9ZM4.8 10.6v7.9c0 .4.3.7.7.7h13a.7.7 0 0 0 .7-.7v-7.9z"
    />
  ),
  members: (
    <>
      <circle cx="9.3" cy="8.8" r="3.6" />
      <path d="M3 19.8c0-3.3 2.9-5.3 6.3-5.3s6.3 2 6.3 5.3a.7.7 0 0 1-.7.7H3.7a.7.7 0 0 1-.7-.7Z" />
      <path d="M16.4 6.6a3.2 3.2 0 0 1 0 6.4 4.6 4.6 0 0 0-1-.7 4.4 4.4 0 0 0 0-5 4.6 4.6 0 0 0 1-.7Z" />
      <path d="M17.2 14.8c2.2.5 3.8 2.2 3.8 4.7v.3a.7.7 0 0 1-.7.7h-3.4c.1-2-.6-3.8-1.9-5.1a9 9 0 0 1 2.2-.6Z" />
    </>
  ),
  comment: (
    <path d="M12 3.7c5.2 0 9.5 3.7 9.5 8.3s-4.3 8.3-9.5 8.3c-1.2 0-2.3-.2-3.4-.5l-5.2 1.4a.7.7 0 0 1-.9-.9l1.5-4A7.7 7.7 0 0 1 2.5 12c0-4.6 4.3-8.3 9.5-8.3Z" />
  ),
  profile: (
    <>
      <circle cx="12" cy="8.2" r="4" />
      <path d="M4.3 20.4c0-3.8 3.5-6 7.7-6s7.7 2.2 7.7 6a.7.7 0 0 1-.7.7H5a.7.7 0 0 1-.7-.7Z" />
    </>
  ),
  contacts: (
    <>
      <circle cx="8.8" cy="8.8" r="3.6" />
      <path d="M2.6 19.9c0-3.3 2.8-5.4 6.2-5.4s6.2 2.1 6.2 5.4a.6.6 0 0 1-.6.6H3.2a.6.6 0 0 1-.6-.6Z" />
      <path d="M17.5 7.6a.9.9 0 0 1 .9.9v1.7h1.7a.9.9 0 0 1 0 1.8h-1.7v1.7a.9.9 0 0 1-1.8 0V12h-1.7a.9.9 0 0 1 0-1.8h1.7V8.5a.9.9 0 0 1 .9-.9Z" />
    </>
  ),
  membership: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.4l6.1-.9z" />,
  settings: (
    <path
      fillRule="evenodd"
      d="M12 2a2 2 0 0 1 2 2v.2c0 .6.4 1.2 1 1.4.6.3 1.3.2 1.7-.3l.2-.1a2 2 0 1 1 2.8 2.8l-.1.2c-.5.4-.6 1.1-.3 1.7.2.6.8 1 1.4 1H21a2 2 0 1 1 0 4h-.2c-.6 0-1.2.4-1.4 1-.3.6-.2 1.3.3 1.7l.1.2a2 2 0 1 1-2.8 2.8l-.2-.1c-.4-.5-1.1-.6-1.7-.3-.6.2-1 .8-1 1.4V21a2 2 0 1 1-4 0v-.2c0-.6-.4-1.2-1-1.4-.6-.3-1.3-.2-1.7.3l-.2.1a2 2 0 1 1-2.8-2.8l.1-.2c.5-.4.6-1.1.3-1.7-.2-.6-.8-1-1.4-1H3a2 2 0 1 1 0-4h.2c.6 0 1.2-.4 1.4-1 .3-.6.2-1.3-.3-1.7l-.1-.2a2 2 0 1 1 2.8-2.8l.2.1c.4.5 1.1.6 1.7.3.6-.2 1-.8 1-1.4V4a2 2 0 0 1 2-2Zm0 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"
    />
  ),
  admin: (
    <path
      fillRule="evenodd"
      d="M12 2.6 4.6 5.7v5.9c0 4.6 3.2 8.8 7.4 10.1 4.2-1.3 7.4-5.5 7.4-10.1V5.7zm3.4 7-4.3 4.5-2.5-2.5 1.2-1.3 1.3 1.3 3-3.2z"
    />
  ),
  /** Die Reaktion am Beitrag: dieselbe Kontur, gefüllt. */
  heart: (
    <path d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5.5 5.5 5.5c1.8 0 3 .9 3.8 2 .8-1.1 2-2 3.8-2 3 0 4.5 3 3 6C19 15.65 12 20 12 20Z" />
  ),
};

/** Glyphen ohne Linienfassung — sie sind als Fläche gedacht und würden als
 *  Kontur falsch lesen. */
const NUR_MASSIV = new Set<GlyphName>(["crown"]);

export function Icon({
  name,
  variant = "line",
  className,
}: {
  name: GlyphName;
  /** `solid` füllt, wo es eine gefüllte Fassung gibt; sonst bleibt die Kontur. */
  variant?: "line" | "solid";
  className?: string;
}) {
  const massiv = NUR_MASSIV.has(name) || (variant === "solid" && name in MASSIV);
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-5 w-5 shrink-0"}
      fill={massiv ? "currentColor" : "none"}
      stroke={massiv ? "none" : "currentColor"}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {massiv ? (MASSIV[name] ?? GLYPHS[name]) : GLYPHS[name]}
    </svg>
  );
}
