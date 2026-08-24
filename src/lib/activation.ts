/**
 * Aktivierung — Client-Seite (AGE-495 / C3).
 *
 * Die Sicherheitsgrenze ist die RLS, nicht dieses Modul. Was hier steht, ist
 * Bequemlichkeit: der Aktivierungsbildschirm und die Einlöseseite. Wer das
 * verteilte Passwort hat, kann sich mit einem eigenen Supabase-Client anmelden
 * und an dieser Datei vorbei fragen — und bekommt nichts.
 */
import { holeAktivierungsToken } from "./activation-fragment";
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
  /**
   * Zu viele FEHLVERSUCHE von derselben Adresse (Task 5.6). Ein gültiges Token
   * erreicht diesen Status nie — die Drossel sitzt hinter dem Beanspruchen.
   */
  | "throttled"
  | "error";

/**
 * Ausgang einer Anforderung des eigenen Bestätigungslinks (AGE-526).
 *
 * Die ersten sechs kommen aus `request_own_activation_token` und erreichen den
 * Aufrufer mit **200**; `send_failed` ist der 502 aus `resend-activation`, wenn
 * Resend den Versand ablehnt, `error` alles Übrige.
 *
 * Der Unterschied zwischen einer abgewiesenen Anforderung und einem
 * Fehlversand ist keine Feinheit: Das eine heißt „warte kurz", das andere
 * „versuch es nochmal". Wer beides zusammenwirft, schickt ein Mitglied ins
 * Warten auf eine Mail, die nie kommt.
 */
export type ResendStatus =
  | "issued"
  | "rate_limited"
  | "rate_limited_day"
  | "rate_limited_global"
  | "already_activated"
  | "unknown"
  | "send_failed"
  | "error";

export interface ActivationState {
  activated: boolean;
  /**
   * Dem Konto wurde der Zugang entzogen — deaktiviert oder gelöscht (AGE-581).
   *
   * Steht NEBEN `activated` und nicht darin: ein gesperrtes, zuvor bestätigtes
   * Konto trägt beides als `true`. `activated` heißt weiter „hat je bestätigt",
   * sonst hinge an einem Feld zweierlei und die Oberfläche könnte „muss noch
   * bestätigen" nicht von „darf nicht mehr" unterscheiden.
   */
  blocked: boolean;
  displayName: string | null;
}

/**
 * Der Aktivierungszustand des eingeloggten Kontos.
 *
 * Über die RPC `my_activation_state()`, NICHT über die Profilzeile: die ist
 * nach dem Gate auch für den Eigentümer gesperrt. Die RPC gibt genau zwei
 * Booleans und einen Anzeigenamen zurück — die kleinste Fläche, die den
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
    blocked: !!row?.blocked,
    displayName: row?.display_name ?? null,
  };
}

/**
 * Fordert den eigenen Bestätigungslink an — der Weg des Aktivierungsbildschirms.
 *
 * Nimmt bewusst **keine Adresse** entgegen: das Subjekt ist die Sitzung. Die
 * dahinterliegende RPC `request_own_activation_token` liest `auth.uid()`, ein
 * Aufrufer kann also nur sich selbst einen Link auslösen.
 *
 * Das ist der Unterschied zu {@link requestActivationLink}, und er ist der
 * Grund, warum es beide gibt: über den adressbasierten Weg konnte ein Fremder,
 * der bloß die Login-Adresse kannte, den ausstehenden Link eines Mitglieds
 * entwerten und es damit aussperren (Audit vom 2026-08-06).
 */
export async function resendActivationLink(): Promise<ResendStatus> {
  const { data, error } = await supabase.functions.invoke("resend-activation", { body: {} });
  // Bei jedem FACHLICHEN Ausgang antwortet die Function 200 und legt den Status
  // in den Rumpf; nur ein Fehlschlag kommt als `error`. Beides trägt einen
  // Status — der Aufrufer muss „warte kurz" von „versuch es nochmal"
  // unterscheiden können, sonst wartet ein Mitglied auf eine Mail, die niemand
  // mehr schickt (AGE-526).
  if (error) {
    const body = await leseFehlerRumpf(error);
    return (body as ResendStatus) ?? "error";
  }
  return ((data as { status?: ResendStatus })?.status ?? "error") as ResendStatus;
}

/**
 * Fordert einen Bestätigungslink über die **Adresse** an.
 *
 * Braucht KEINE Session — das ist der Weg für ein Mitglied, dessen verteiltes
 * Passwort ein Dritter geändert hat, und nur noch für den. Wer angemeldet ist,
 * nimmt {@link resendActivationLink}.
 *
 * Die Function antwortet immer gleich, unabhängig davon, ob es die Adresse
 * gibt; dieses Modul kann daraus also nichts ableiten und tut es auch nicht.
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
    return (body as RedeemStatus) ?? "error";
  }
  return ((data as { status?: RedeemStatus })?.status ?? "error") as RedeemStatus;
}

/** Holt den Status aus dem Rumpf einer FunctionsHttpError-Antwort. Roh, weil
 *  beide Aufrufer eine eigene Statusmenge haben — die Zuordnung macht der
 *  Aufrufer, nicht dieser Leser. */
async function leseFehlerRumpf(error: unknown): Promise<string | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (!context?.json) return null;
  try {
    const body = (await context.json()) as { status?: string };
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
 *
 * Die Entnahme selbst passiert nicht mehr hier, sondern in `instrument.ts`,
 * noch vor `Sentry.init()`: bis dorthin ist es für den Replay-Puffer zu spät.
 * Diese Funktion holt nur noch ab, was dort entnommen wurde.
 */
export function leseTokenAusFragment(): string | null {
  return holeAktivierungsToken();
}
