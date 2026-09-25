import { Icon, type GlyphName } from "./icons";

/** Sidebar-Icons (AGE-499).
 *
 *  Ein Icon je Menüeintrag, gekeyt auf den Pfad — die Referenzen zeigen die
 *  Navigation mit Symbolen, und eingeklappt ist das Icon der einzige Anker, den
 *  ein Eintrag noch hat.
 *
 *  Seit AGE-582 liegen die Pfade im gemeinsamen Icon-Satz (`ui/icons.tsx`), und
 *  diese Datei ist nur noch die Zuordnung Route → Glyph. Der Grund ist gemessen:
 *  der Kalender stand vorher dreimal im Baum, jeder Stilwechsel erreichte also
 *  höchstens ein Drittel der Symbole.
 */
const NACH_ROUTE: Record<string, GlyphName> = {
  "/": "home",
  "/kompass": "compass",
  "/academy": "academy",
  "/events": "calendar",
  "/mitglieder": "members",
  "/aktivitaet": "comment",
  "/profil": "profile",
  "/kontakte": "contacts",
  "/mitgliedschaft": "membership",
  "/einstellungen": "settings",
  "/admin": "admin",
  // AGE-929: Seit der Support-Abschnitt ein gewöhnlicher Abschnitt ist, holt
  // sich „Tutorials" sein Symbol hier statt es selbst zu zeichnen. Ohne diese
  // Zeile griffe der Rückfall unten, und der Eintrag trüge einen Punkt — still,
  // nichts schlüge fehl, das Symbol sagte nur nichts mehr.
  //
  // NICHT `academy`: dieses Symbol trägt zwei Zeilen höher den Menüeintrag
  // „Academy". Zwei Einträge derselben Leiste mit demselben Symbol heben sich
  // gegenseitig auf — es unterscheidet dann nicht mehr, es dekoriert nur noch
  // (dieselbe Begründung stand an `FeedbackIcon`, AGE-904).
  "/hilfe/tutorials": "bulb",
};

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
  // Fällt auf einen Punkt zurück, wenn ein neuer Pfad noch kein Symbol hat —
  // eingeklappt bleibt der Eintrag so trotzdem anklickbar und sichtbar.
  const name = NACH_ROUTE[path] ?? "dot";
  return <Icon name={name} variant={active ? "solid" : "line"} className={className} />;
}
