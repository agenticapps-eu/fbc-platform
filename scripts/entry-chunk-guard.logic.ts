/**
 * Welche Seiten im Eintrittsbündel liegen dürfen (AGE-642).
 *
 * Die Spec verlangt für den Erststart eine **strukturelle** Zusage, nicht nur
 * eine Zahl: „keine Seitenkomponente außer denen, die der erste Bildschirm
 * braucht". Eine Zahl driftet mit dem nächsten Feature und sagt beim
 * Überschreiten nicht, wer schuld ist. Diese Prüfung sagt es.
 *
 * Die Liste ist eine **Erlaubnisliste**, keine Verbotsliste. Eine Verbotsliste
 * müsste jede neue Seite kennen, um sie fernzuhalten — und eine neue Seite
 * kennt sie nie. So herum ist der Zustand „unbekannte Seite im Erststart"
 * automatisch ein Fehler.
 */
export const ERLAUBT_IM_EINTRITT = [
  // Die öffentliche Startseite. `HomeRedirect` (in `components/`) gibt sie in
  // jedem Zweig zurück; sie ist damit für ausgeloggte wie eingeloggte
  // Besucher der erste Bildschirm.
  "src/pages/HomePage.tsx",
  // Der zweite mögliche erste Bildschirm. Ein Ladezustand vor der Anmeldemaske
  // wäre ein leerer Start.
  "src/pages/LoginPage.tsx",
  // Der dritte. Liegt trotz seines Ortes nicht an einer Route: `ActivationGate`
  // umschliesst die gesamte Hülle (`App.tsx`) und rendert ihn, sobald ein
  // eingeloggtes Konto noch unbestätigt ist — egal welche Route (AGE-495). Für
  // diese Gruppe ist er der erste und einzige Bildschirm, und die Wand
  // nachzuladen hiesse, einen Ladezustand vor eine Wand zu setzen.
  // Der Wächter hat ihn selbst gefunden; er stand vorher in keiner Liste.
  "src/pages/ActivationScreen.tsx",
];

/**
 * Gibt die Seiten zurück, die im Eintrittsbündel liegen und dort nicht
 * hingehören. Leere Liste heißt: die Zusage hält.
 *
 * `quellen` sind die `sources` der Source-Map des Eintrittsbündels — also die
 * Module, aus denen es tatsächlich entstanden ist, nicht die, die jemand
 * importiert zu haben glaubt.
 */
export function verbotereSeitenImEintritt(
  quellen: string[],
  erlaubt: string[] = ERLAUBT_IM_EINTRITT,
): string[] {
  const gefunden = new Set<string>();

  for (const quelle of quellen) {
    // Nur echte Seiten. Der Pfad kann absolut sein oder relativ, mit
    // vorangestelltem `../` aus der Sicht des Bündels — deshalb wird auf das
    // Vorkommen geprüft, nicht auf den Anfang.
    const treffer = quelle.match(/src\/pages\/[^/]+\.tsx$/);
    if (!treffer) continue;

    const kurz = treffer[0];
    if (erlaubt.some((e) => e.endsWith(kurz) || kurz.endsWith(e))) continue;

    gefunden.add(kurz);
  }

  return [...gefunden].sort();
}
