import type { GlyphName } from "../components/ui/icons";

/** Der Bereichs-Kanon (AGE-582).
 *
 *  **Eine** Modulkonstante bildet `Gegenstandsbereich → { icon, farbe }`. Eine
 *  Fläche bezieht sie von hier und trifft sie nicht je Karte neu; eine
 *  Verzweigung über Bereiche in mehreren Dateien soll gar nicht erst entstehen.
 *
 *  Der Kanon trägt ausschließlich **Gegenstandsbereiche**. Bedien-Symbole —
 *  Chevron, Menü, Glocke, Lupe — stehen ausdrücklich nicht darin: sie bezeichnen
 *  keinen Bereich, und eine Bereichsfarbe für sie wäre erfunden. Sie liegen im
 *  Icon-Satz und werden von dort direkt bezogen.
 *
 *  Die Farbe steht als Utility-Klasse, nicht als Farbwert — der Wert liegt als
 *  Token in `index.css` und ist dort einmal definiert, nicht je Theme.
 *
 *  **Diese Farben identifizieren, sie signalisieren nicht.** Kein Link, kein
 *  Knopf, kein Fokusring, kein aktiver Zustand trägt sie; das bleibt die blaue
 *  Akzentfamilie allein. Genau diese Abgrenzung ist der Grund, aus dem die
 *  bestehende Anforderung („Blue SHALL be the only accent family") geändert
 *  werden durfte statt umgangen zu werden. Erzwungen wird sie von
 *  `bereiche.test.ts`, nicht von diesem Absatz.
 */
export const BEREICHE = {
  events: { icon: "calendar", farbe: "text-bereich-events" },
  mitglieder: { icon: "members", farbe: "text-bereich-mitglieder" },
  nachrichten: { icon: "mail", farbe: "text-bereich-nachrichten" },
  aktivitaet: { icon: "comment", farbe: "text-bereich-aktivitaet" },
  kontakte: { icon: "contacts", farbe: "text-bereich-kontakte" },
  kompass: { icon: "compass", farbe: "text-bereich-kompass" },
  highlights: { icon: "sparkle", farbe: "text-bereich-highlights" },
} satisfies Record<string, { icon: GlyphName; farbe: string }>;

export type Bereich = keyof typeof BEREICHE;
