/**
 * Was die Android-Zurueck-Taste tun soll (AGE-642 C2).
 *
 * Die Entscheidung steht hier und nicht im Handler, weil `backButton` ein
 * natives Capacitor-Ereignis ist, das in jsdom nie feuert. Ein Test, der auf
 * die Ereignisquelle wartet, waere gruen, weil nichts passiert — dieselbe
 * Falle wie bei `env(safe-area-inset-*)` und bei der Wischgeste.
 *
 * Die REIHENFOLGE ist der Punkt, den man uebersieht. Mehrere Flaechen fuehren
 * ihren Offen-Zustand ueber den Verlaufsschluessel und schliessen sich bei
 * JEDER Navigation selbst, auch bei POP. Ein Handler, der bei offenem Overlay
 * unbedingt zuruecknavigiert, saehe deshalb richtig aus — das Overlay ginge zu
 * — und traege dabei die Seite darunter mit fort.
 */

export type ZurueckEntscheidung =
  /** Nur das oberste Overlay schliessen, die Seite bleibt stehen. */
  | "overlay-schliessen"
  /** Eine Seite im Verlauf zurueck. */
  | "seite-zurueck"
  /** Die App in den Hintergrund schicken. Ausdruecklich nicht beenden. */
  | "hintergrund";

export function entscheideZurueck({
  overlayOffen,
  hatVerlauf,
}: {
  /** Ob mindestens ein modales Overlay offen ist. */
  overlayOffen: boolean;
  /** Ob es innerhalb der App eine Seite gibt, zu der zurueckgegangen werden kann. */
  hatVerlauf: boolean;
}): ZurueckEntscheidung {
  if (overlayOffen) return "overlay-schliessen";
  if (hatVerlauf) return "seite-zurueck";
  // Kein "beenden": die Anforderung verbietet es ausdruecklich. Android legt
  // die App aus dem Hintergrund unveraendert wieder hin; ein Beenden verloere
  // jeden halb ausgefuellten Entwurf.
  return "hintergrund";
}

/**
 * Ob es innerhalb dieser App-Sitzung einen Eintrag HINTER dem aktuellen gibt.
 *
 * Gelesen aus `window.history.state.idx`, den react-router selbst fuehrt und
 * an dem er selbst seine Position bestimmt. Gemessen in 7.18.2: der erste
 * Eintrag bekommt `0`, `push` erhoeht, **`replace` nicht**.
 *
 * Genau darum steht hier nicht `location.key !== "default"`, die Regel aus
 * `LegalZurueck.tsx`: `RequireAuth` und `HomeRedirect` ersetzen beim Kaltstart
 * den ersten Eintrag. Der Schluessel waere dann nicht mehr `"default"`, ein
 * Eintrag dahinter gaebe es trotzdem nicht — und Zurueck liefe ins Leere,
 * statt die App zu minimieren. Sichtbar erst am Geraet, beim allerersten
 * Druck nach einer Anmeldung.
 *
 * @param historyState `window.history.state`, roh und ungeprueft
 */
export function hatVerlauf(historyState: unknown): boolean {
  const idx = (historyState as { idx?: unknown } | null | undefined)?.idx;
  return typeof idx === "number" && idx > 0;
}
