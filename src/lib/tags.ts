import { supabase } from "./supabase";

/**
 * Kuratierte Tags (AGE-528) — die redaktionelle Liste aus `public.tags`.
 *
 * Es gibt bewusst KEINE Verknüpfungstabelle zwischen `posts` und `tags`
 * (`design.md`, „Warum keine Verknüpfungstabelle"): `posts.hashtags text[]`
 * hält beide Sorten, und die Verbindung ist die Zeichenkette selbst. Ein Chip
 * gilt als kuratiert, wenn sein Wert als `key` vorkommt — sonst als freier Tag.
 *
 * Der Preis ist benannt: ein deaktivierter oder umbenannter Tag wirkt NICHT
 * rückwirkend. Bestandsbeiträge tragen weiter ihre Zeichenkette und zeigen sie
 * danach als freien Tag.
 */

export interface Tag {
  key: string;
  label: string;
  sort: number;
}

/** Die Liste hängt an keinem Betrachter — `tags` ist für alle gleich lesbar. */
export const tagsQueryKey = ["tags", "aktiv"] as const;

/** Aktive kuratierte Tags in ihrer redaktionellen Reihenfolge. */
export async function fetchAktiveTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("key, label, sort")
    .eq("active", true)
    .order("sort");
  if (error) throw error;
  return data ?? [];
}

/** Kommt dieser Wert in der kuratierten Liste vor? */
export function istKuratiert(key: string, tags: Tag[]): boolean {
  return tags.some((t) => t.key === key);
}
