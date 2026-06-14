import { supabase } from "./supabase";

/**
 * Lässt die regelbasierte Match-Engine (AGE-245) die Matches des eingeloggten
 * Nutzers neu berechnen. Ruft die SECURITY-DEFINER-RPC `recompute_my_matches`,
 * die serverseitig `generate_matches_for(auth.uid())` ausführt und die Zahl der
 * ge-upserteten Matches zurückgibt.
 *
 * Wird nach relevanten Änderungen ausgelöst (Onboarding-Abschluss, Speichern von
 * offers/needs/Profil) sowie über den „Matches neu berechnen"-Button im
 * Matching-Hub (AGE-246). Wirft bei Fehlern — die Aufrufer entscheiden, ob sie
 * den Fehler best-effort schlucken (Speicherpfade) oder anzeigen (Button).
 */
export async function recomputeMyMatches(): Promise<number> {
  const { data, error } = await supabase.rpc("recompute_my_matches");
  if (error) throw error;
  return data ?? 0;
}
