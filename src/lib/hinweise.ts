import { supabase } from "./supabase";

/**
 * Die Datenschicht der Benachrichtigungs-Glocke (AGE-620).
 *
 * **Warum es das ueberhaupt braucht.** Die Glocke in der Kopfzeile war seit Juni
 * ein toter Knopf — `AppShell.tsx`, kein `onClick`, kein Zaehler — waehrend drei
 * Typen laengst in die Tabelle schrieben (`contact_request`, `_accepted`,
 * `_declined`). Diese Hinweise hat nie jemand zu sehen bekommen.
 *
 * **Keine Migration.** `notifications` traegt `read_at`, die Grants
 * (`select, insert, update, delete` fuer `authenticated`) stehen, und
 * `notifications_own` begrenzt auf aktivierte Mitglieder und die eigene Zeile.
 * Es fehlte ausschliesslich das Frontend.
 *
 * **Die Policy erlaubt mehr, als diese Datei tut.** `notifications_own` ist
 * `for all` — ein Mitglied duerfte sich eigene Zeilen anlegen und loeschen. Die
 * Glocke tut das nicht: sie liest, und sie setzt `read_at`. Mehr steht hier
 * nicht, damit die Fläche schmaler ist als ihr Recht.
 */

export interface Hinweis {
  id: string;
  type: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

/** Eine Grenze gehoert in die ERSTE Fassung jeder listenden Flaeche, nicht in
 *  die zweite. In der Startwoche aktivieren sich rund 70 Mitglieder nacheinander
 *  — ohne Grenze zoege die Glocke sie alle auf einmal. */
const GRENZE = 50;

export function hinweiseQueryKey(uid: string) {
  // An der Kennung, nicht global: sonst zeigte nach einem Kontowechsel der
  // Zaehler des Vorgaengers weiter.
  return ["hinweise", uid] as const;
}

export async function fetchHinweise(): Promise<Hinweis[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, payload, created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(GRENZE);
  // Weiterwerfen, nicht verschlucken: ein stiller Fehler saehe aus wie „nichts
  // ungelesen", und das faellt niemandem auf.
  if (error) throw error;
  return (data ?? []) as Hinweis[];
}

/**
 * `'now'` ist ein Sonderwert von Postgres und ergibt die Zeit der SERVER-
 * Transaktion. Bewusst NICHT `new Date().toISOString()`: das schickte die Uhr
 * des Besuchers mit, und genau daran ist in AGE-583 ein Lesestand vor die
 * Nachricht gerutscht, die er als gelesen erklaerte.
 *
 * Ein Trigger, der den Wert serverseitig ueberschreibt, waere die haerteste
 * Fassung — er kostete aber eine Migration, und die braucht die Glocke sonst
 * nicht. `'now'` loest der Server, nicht der Client; das genuegt hier, weil an
 * `read_at` kein Vergleich gegen eine zweite Uhr haengt.
 */
const SERVERZEIT = "now";

export async function markiereHinweisGelesen(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: SERVERZEIT })
    .eq("id", id);
  if (error) throw error;
}

export async function markiereAlleGelesen(): Promise<void> {
  // EIN Aufruf, nicht einer je Zeile. Die RLS begrenzt ihn ohnehin auf die
  // eigenen Zeilen — ein `eq("profile_id", …)` waere eine zweite, schwaechere
  // Kopie derselben Bedingung.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: SERVERZEIT })
    .is("read_at", null);
  if (error) throw error;
}
