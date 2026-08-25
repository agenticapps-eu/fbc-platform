import { supabase } from "./supabase";

/**
 * Die zwei Aggregate der Feed-Sidebar (AGE-582) — Datenschicht.
 *
 * Beide RPCs laufen `security invoker` und kopieren das Sichtbarkeits-
 * prädikat NICHT (`20260824170000_feed_sidebar_aggregate.sql`). Die Zahlen
 * stimmen also, weil `posts_select_by_visibility` wirkt — nicht, weil eine
 * Abschrift sie nachspricht. Für den Client folgt daraus zweierlei:
 *
 *  - **Die Zahlen hängen am Betrachter.** Zwei Mitglieder verschiedener Stufe
 *    sehen für denselben Tag verschiedene Zahlen. Die Schlüssel tragen deshalb
 *    die Kennung, genau wie `feedListKey`.
 *  - **`feed_top_authors` ist NICHT an `anon` vergeben**, und das ist Absicht:
 *    `profiles_public` hält dort kein Recht (siehe die Migration). Ohne Sitzung
 *    darf die Funktion deshalb gar nicht erst gerufen werden — die Fläche
 *    entscheidet das über `enabled`, nicht diese Datei über einen Rückfall.
 *    `feed_tag_counts` dagegen ist an `anon` vergeben und zählt dort
 *    nachweislich nur öffentliche Beiträge.
 *
 * Kein Fehler wird zu einer leeren Liste geglättet. Eine Sidebar, die aus einem
 * verweigerten Aufruf „keine Tags" macht, behauptet etwas über den Bestand.
 */

export interface TagZaehler {
  key: string;
  label: string;
  anzahl: number;
}

export interface TopAutor {
  id: string;
  name: string;
  avatarUrl: string | null;
  anzahl: number;
}

export const tagZaehlerKey = (uid: string | null) => ["feed", "tag-zaehler", uid] as const;
export const topAutorenKey = (uid: string | null) => ["feed", "top-autoren", uid] as const;

/** Die aktiven kuratierten Tags mit der Zahl der für den Betrachter sichtbaren
 *  Beiträge. Ein Tag ohne sichtbaren Beitrag erscheint gar nicht — auch nicht
 *  mit der Zahl null, denn schon sein Erscheinen verriete, dass es ihn gibt. */
export async function fetchTagZaehler(): Promise<TagZaehler[]> {
  const { data, error } = await supabase.rpc("feed_tag_counts");
  if (error) throw error;
  return (data ?? []).map((zeile) => ({
    key: zeile.tag_key,
    label: zeile.tag_label,
    anzahl: zeile.post_count,
  }));
}

/** Die fünf aktivsten Mitglieder nach Zahl der sichtbaren Beiträge. Die Grenze
 *  steht hier als Argument, obwohl die Funktion sie auch selbst vorgibt: die
 *  Fläche zeigt fünf Zeilen, und eine stille Vorgabe in der Datenbank wäre die
 *  zweite Stelle, an der diese Zahl steht. */
export async function fetchTopAutoren(): Promise<TopAutor[]> {
  const { data, error } = await supabase.rpc("feed_top_authors", { p_limit: 5 });
  if (error) throw error;
  return (data ?? []).map((zeile) => ({
    id: zeile.profile_id,
    name: zeile.name,
    avatarUrl: zeile.avatar_url,
    anzahl: zeile.post_count,
  }));
}
