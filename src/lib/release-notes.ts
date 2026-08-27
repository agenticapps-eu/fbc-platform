import type { Database } from "./database.types";
import { supabase } from "./supabase";
import type { ReleaseEintrag } from "../types/release";

/**
 * Die Datenschicht der Release-Notes (AGE-631).
 *
 * Zwei Quellen treffen hier aufeinander, und das ist der ganze Trick:
 *
 *  - **Was es an Änderungen gibt** kommt aus `release-entries.generated.ts` —
 *    zur Bauzeit aus `openspec/changes/archive/` erzeugt und mit dem Bündel
 *    ausgeliefert. Ein Eintrag, der dort steht, ist per Konstruktion deployed.
 *  - **Was davon schon angekündigt wurde** steht in `release_notes`.
 *
 * Die Zustellung selbst gehört keiner dieser Seiten: sie läuft über
 * `send_release_note()`, weil ein Fan-out auf alle Mitglieder nichts ist, was
 * ein Client tun darf — und weil der Riegel gegen die Doppelzustellung in der
 * Datenbank sitzen muss, nicht im Knopf.
 */

export type ReleaseNote = Database["public"]["Tables"]["release_notes"]["Row"];

/** Wieviele zugestellte Notes eine Seite trägt. */
export const RELEASE_NOTES_SEITE = 20;

export const releaseNotesQueryKey = (was: "draft" | "sent") => ["release-notes", was] as const;

const SPALTEN =
  "id, title, body, entry_slugs, status, created_by, created_at, sent_at, recipient_count";

/**
 * Was noch nicht angekündigt wurde.
 *
 * Abgezogen werden **nur die Slugs ZUGESTELLTER** Notes. Ein Entwurf darf
 * nichts verstecken: sonst verschwände ein Change aus der Liste, sobald ihn
 * jemand in einen Entwurf gezogen und den Entwurf liegen gelassen hat — für
 * immer unangekündigt, und niemandem fiele es auf, weil eine kürzere Liste
 * aussieht wie eine vollständige.
 */
export function nochNichtAngekuendigt(
  eintraege: ReleaseEintrag[],
  notes: Pick<ReleaseNote, "status" | "entry_slugs">[],
): ReleaseEintrag[] {
  const angekuendigt = new Set(
    notes.filter((n) => n.status === "sent").flatMap((n) => n.entry_slugs),
  );
  return eintraege.filter((e) => !angekuendigt.has(e.slug));
}

/** Die Entwürfe. Nur ein Admin sieht sie — das hält `release_notes_read_sent`. */
export async function fetchEntwuerfe(): Promise<ReleaseNote[]> {
  const { data, error } = await supabase
    .from("release_notes")
    .select(SPALTEN)
    .eq("status", "draft");
  if (error) throw error;
  return (data ?? []) as ReleaseNote[];
}

/**
 * Die zugestellten Notes, neueste zuerst. `nullsFirst: false`, weil `desc` in
 * Postgres `nulls first` ist — eine Note ohne `sent_at` gibt es hier zwar nicht
 * (der Zustand `sent` setzt ihn), aber die Ordnung soll nicht davon abhängen,
 * dass das so bleibt.
 */
export async function fetchZugestellte({
  limit = RELEASE_NOTES_SEITE,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<ReleaseNote[]> {
  const { data, error } = await supabase
    .from("release_notes")
    .select(SPALTEN)
    .eq("status", "sent")
    .order("sent_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as ReleaseNote[];
}

/** Legt einen Entwurf an oder überschreibt ihn. `status` bleibt `draft` — mehr
 *  lässt die Policy ohnehin nicht zu, und die Fläche soll nicht behaupten, sie
 *  könnte mehr. */
export async function speichereEntwurf(entwurf: {
  id?: string;
  title: string;
  body: string;
  entrySlugs: string[];
  createdBy: string | null;
}): Promise<ReleaseNote> {
  const { data, error } = await supabase
    .from("release_notes")
    .upsert({
      ...(entwurf.id ? { id: entwurf.id } : {}),
      title: entwurf.title,
      body: entwurf.body,
      entry_slugs: entwurf.entrySlugs,
      status: "draft",
      created_by: entwurf.createdBy,
    })
    .select(SPALTEN)
    .single();
  if (error) throw error;
  return data as ReleaseNote;
}

/**
 * Stellt zu. Gibt die Zahl der wirklich beschriebenen Mitglieder zurück.
 *
 * Wirft, wenn der Aufrufer kein Admin ist **oder die Note schon zugestellt
 * wurde** — der zweite Fall ist kein Fehler des Aufrufers, sondern der Riegel,
 * und die Fläche darf ihn nicht verschlucken.
 */
export async function stelleZu(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("send_release_note", { p_id: id });
  if (error) throw error;
  return data ?? 0;
}
