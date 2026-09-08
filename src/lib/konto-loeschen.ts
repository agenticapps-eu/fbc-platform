import { supabase } from "./supabase";

/**
 * Löscht das Konto des angemeldeten Mitglieds (AGE-708).
 *
 * Ruft die Edge Function `konto-loeschen`, die der EINZIGE Eingang ist: die
 * Anonymisierungs-Funktion in der Datenbank hat `EXECUTE` nur für
 * `service_role`, damit niemand über die Datenbank-API einen Halbzustand
 * erzeugen kann — Profil geleert, Dateien noch da, `auth.users` noch da.
 *
 * **Es wird keine Kennung mitgeschickt.** Wessen Konto gelöscht wird, steht im
 * `sub` des Tokens, und das verifiziert das Gateway (`verify_jwt = true`).
 * Eine mitgeschickte fremde Kennung würde serverseitig abgelehnt, nicht
 * ignoriert — hier gar keine zu senden ist die schlichtere Hälfte derselben
 * Zusage.
 *
 * Wirft, wenn die Löschung nicht vollständig durchlief. Der Server antwortet
 * in diesem Fall mit `207` und nennt die offenen Schritte; der zurückbleibende
 * Zustand hat immer zu WENIG gelöscht, nie zu viel, und ein erneuter Aufruf
 * holt den Rest nach. Für das Mitglied heisst das: es bleibt angemeldet und
 * sieht einen Fehler, statt eine Löschung zu glauben, die nicht stattfand.
 */
export async function kontoLoeschen(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("konto-loeschen", { body: {} });
  if (error) throw error;
  if (!(data as { geloescht?: boolean } | null)?.geloescht) {
    throw new Error("Die Löschung wurde nicht vollständig abgeschlossen.");
  }
}
