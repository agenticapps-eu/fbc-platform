/**
 * Was aus dem Ergebnis von `issue_activation_token` folgt (AGE-505, Befund 8.1
 * aus Review 5.4).
 *
 * Eigenes Modul, obwohl es wenig Code trägt — aus demselben Grund wie
 * `emails.ts`: `index.ts` ruft `Deno.serve` auf der obersten Ebene auf und ist
 * deshalb nicht als Einheit testbar. Die Entscheidung, die hier fällt, ist
 * sicherheitsrelevant und muss geprüft sein, nicht nur gelesen.
 *
 * ── Der Befund ────────────────────────────────────────────────────────────
 * Bis hierher übersetzte `index.ts` JEDEN Fehler des RPC in HTTP 502, während
 * jeder andere Ausgang 202 lieferte. Zwei GLEICHZEITIGE Anfragen für dieselbe
 * bekannte Adresse passieren aber beide die Zähl- und Pending-Abfragen; der
 * partielle Unique-Index `activation_tokens_offen_je_profil` lässt nur einen
 * Insert zu, und der Verlierer bekommt eine Unique-Violation. Für eine
 * UNBEKANNTE Adresse endet dieselbe Doppelanfrage zweimal mit 202.
 *
 * Damit unterscheidet ein einziges Anfragenpaar Mitglied von Nicht-Mitglied —
 * genau das, was die Immer-202-Konstruktion verhindern soll.
 *
 * Der Index ist dabei nicht der Fehler, sondern die Absicht (siehe seinen
 * Kommentar in 20260806080000). Der Fehler war, dass sein Verstoß nach außen
 * drang. Fachlich ist der Verlierer des Wettlaufs in genau der Lage, die
 * `pending` beschreibt: ein gültiger Link ist unterwegs, an dieselbe Adresse,
 * ausgelöst vom Gewinner. Er antwortet deshalb 202 und versendet nichts.
 *
 * ── Was NICHT verdeckt wird ───────────────────────────────────────────────
 * Jeder andere Fehlercode bleibt 502. Ein echter Datenbankausfall soll weiter
 * als Fehler sichtbar sein — „hat nicht geklappt" darf nicht dieselbe Antwort
 * erzeugen wie „gibt es nicht".
 */

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

export type Ausgang =
  /** Mail rendern und versenden. */
  | "versenden"
  /** 202 ohne Versand — der Normalfall aller nicht-ausgebenden Ausgänge. */
  | "still_angenommen"
  /** 502. Nur für Fehler, die kein Wettlauf sind. */
  | "serverfehler";

export function ausgangNachRpc(
  fehlerCode: string | undefined,
  status: string | undefined,
): Ausgang {
  if (fehlerCode !== undefined) {
    return fehlerCode === UNIQUE_VIOLATION ? "still_angenommen" : "serverfehler";
  }
  return status === "issued" || status === "issued_reset" ? "versenden" : "still_angenommen";
}
