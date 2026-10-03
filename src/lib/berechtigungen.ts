import { BERECHTIGUNGEN, type Berechtigung } from "../config/berechtigungen";
import { supabase } from "./supabase";

/**
 * Die Feature-Rechte des Aufrufers, in einem Zug aus der Datenbank (AGE-1000).
 *
 * `meine_rechte()` liefert nur die Schlüssel, die der Aufrufer HAT — keine
 * Mindestränge und keine fremden Schlüssel. Ein Konto ohne Sitzung oder ohne
 * Aktivierung bekommt das leere Array, nicht `null`.
 *
 * Unbekannte Schlüssel werden **verworfen**, nicht durchgereicht: ein Recht,
 * das die Datenbank kennt und dieser Build nicht, kann in der Oberfläche
 * nichts freischalten, und es als `Berechtigung` zu behandeln wäre eine Lüge
 * über den Typ. Der umgekehrte Fall — Build kennt ein Recht, DB nicht — fällt
 * ohnehin auf die richtige Seite: es fehlt in der Antwort und gilt als nicht
 * vorhanden.
 */
export const meineRechteQueryKey = ["meine-rechte"] as const;

export async function ladeMeineRechte(): Promise<Berechtigung[]> {
  const { data, error } = await supabase.rpc("meine_rechte");
  if (error) throw error;
  const bekannt = new Set<string>(BERECHTIGUNGEN);
  return (data ?? []).filter((k): k is Berechtigung => bekannt.has(k));
}
