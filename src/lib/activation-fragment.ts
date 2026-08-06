/**
 * Das Aktivierungs-Token aus dem Fragment nehmen (AGE-495 / C3).
 *
 * Eigenes Modul, obwohl es kaum Code trägt: es wird von `instrument.ts`
 * importiert, und das muss der allererste Import bleiben. `activation.ts` zieht
 * den Supabase-Client nach — den vor `Sentry.init()` zu laden, würde genau die
 * Zeitspanne verlängern, die dieses Modul kurz halten soll. Hier hängt nichts
 * dran.
 *
 * **Warum die Entnahme VOR `Sentry.init()` laufen muss.** Sentry erfasst
 * `location.href` samt Fragment und puffert bei `replaysOnErrorSampleRate: 1.0`
 * jede Sitzung mit. Solange das Token in der Adresszeile stand, hätte ein
 * beliebiger Fehler im Puffer-Fenster es an Sentry gesendet — und wer
 * Sentry-Zugriff hat, setzt damit binnen 72 h ein fremdes Passwort. Aufgeräumt
 * wurde bis zum Audit vom 2026-08-06 erst, wenn die Einlöseseite rendert; das
 * ist Hunderte Millisekunden zu spät.
 */

let entnommen: string | null = null;

/**
 * Nimmt ein Aktivierungs-Token aus der Adresszeile und hält es zurück.
 *
 * Ruft `instrument.ts` für die Wirkung auf, nicht für den Wert. Findet die
 * Funktion nichts, lässt sie ein bereits Entnommenes unangetastet.
 *
 * Rührt nur ein Fragment mit `token` an. Der Anmeldedienst legt seine Rückkehr
 * als `#access_token=…&token_type=bearer` ab; die muss stehen bleiben, sonst
 * bricht der Anmeldefluss.
 */
export function entnimmAktivierungsFragment(): void {
  if (typeof window === "undefined") return;

  const fragment = window.location.hash.replace(/^#/, "");
  const token = fragment ? new URLSearchParams(fragment).get("token") : null;
  if (!token) return;

  entnommen = token;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Gibt das entnommene Token **einmal** heraus.
 *
 * Der Aufruf von `entnimmAktivierungsFragment()` deckt den Fall ab, dass
 * `instrument.ts` nicht gelaufen ist — in Tests etwa. Danach ist der Speicher
 * leer: ein zweiter Aufruf liefert `null` und nicht ein altes Token.
 */
export function holeAktivierungsToken(): string | null {
  entnimmAktivierungsFragment();
  const token = entnommen;
  entnommen = null;
  return token;
}
