/**
 * Aktivierung — Client-Seite (AGE-495 / C3).
 *
 * Die Sicherheitsgrenze ist die RLS, nicht dieses Modul. Was hier steht, ist
 * Bequemlichkeit: der Aktivierungsbildschirm und die Einlöseseite. Wer das
 * verteilte Passwort hat, kann sich mit einem eigenen Supabase-Client anmelden
 * und an dieser Datei vorbei fragen — und bekommt nichts.
 */
import { supabase } from "./supabase";

/** Antwortstatus von `redeem-activation`. Je ein eigener Bildschirm (AGE-495 §6). */
export type RedeemStatus =
  | "activated"
  | "expired"
  | "used"
  | "superseded"
  | "not_found"
  | "weak_password"
  | "retry_needed"
  | "error";

export interface ActivationState {
  activated: boolean;
  displayName: string | null;
}

/**
 * Der Aktivierungszustand des eingeloggten Kontos.
 *
 * Über die RPC `my_activation_state()`, NICHT über die Profilzeile: die ist
 * nach dem Gate auch für den Eigentümer gesperrt. Die RPC gibt genau ein
 * Boolean und einen Anzeigenamen zurück — die kleinste Fläche, die den
 * Bildschirm trägt.
 *
 * Wirft bei einem Fehler, statt `false` zu liefern: Der Aufrufer muss „noch
 * unbekannt" von „nicht aktiviert" unterscheiden können, sonst zeigt ein
 * Netzwerkfehler einem aktivierten Mitglied die Wand.
 */
export async function fetchActivationState(): Promise<ActivationState> {
  const { data, error } = await supabase.rpc("my_activation_state");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    activated: !!row?.activated,
    displayName: row?.display_name ?? null,
  };
}

/**
 * Fordert einen Bestätigungslink an.
 *
 * Braucht KEINE Session — das ist der Weg für ein Mitglied, dessen verteiltes
 * Passwort ein Dritter geändert hat. Die Function antwortet immer gleich,
 * unabhängig davon, ob es die Adresse gibt; dieses Modul kann daraus also
 * nichts ableiten und tut es auch nicht.
 */
export async function requestActivationLink(email: string): Promise<void> {
  const { error } = await supabase.functions.invoke("send-activation", {
    body: { email },
  });
  if (error) throw error;
}

/** Löst das Token gegen ein neues Passwort ein. */
export async function redeemActivation(token: string, password: string): Promise<RedeemStatus> {
  const { data, error } = await supabase.functions.invoke("redeem-activation", {
    body: { token, password },
  });
  // Die Function antwortet bei jedem fachlichen Fehlschlag mit 4xx/410 und
  // einem Status im Rumpf. supabase-js meldet das als `error`; der Rumpf ist
  // die Wahrheit, nicht der HTTP-Code.
  if (error) {
    const body = await leseFehlerRumpf(error);
    return body ?? "error";
  }
  return ((data as { status?: RedeemStatus })?.status ?? "error") as RedeemStatus;
}

/** Holt den Status aus dem Rumpf einer FunctionsHttpError-Antwort. */
async function leseFehlerRumpf(error: unknown): Promise<RedeemStatus | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (!context?.json) return null;
  try {
    const body = (await context.json()) as { status?: RedeemStatus };
    return body?.status ?? null;
  } catch {
    return null;
  }
}

/**
 * Liest das Token aus dem **Fragment** und räumt die Adresszeile auf.
 *
 * Das Token steht im Fragment und nicht im Query-String, weil ein Query-String
 * in der Browser-Historie, in Server- und CDN-Logs und potenziell im `Referer`
 * landet. Nach dem Auslesen wird es auch aus der Adresszeile entfernt — ein
 * Screenshot oder ein über die Schulter geworfener Blick soll es nicht tragen.
 */
export function leseTokenAusFragment(): string | null {
  if (typeof window === "undefined") return null;
  const fragment = window.location.hash.replace(/^#/, "");
  if (!fragment) return null;
  const token = new URLSearchParams(fragment).get("token");
  if (!token) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}
