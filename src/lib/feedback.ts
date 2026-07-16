import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * Plattformweites QM-Feedback (AGE-300) — Spec §3.5 in
 * docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md.
 *
 * Schreibt über die `feedback_own`-Policy (20260612082726): ein Mitglied schreibt
 * nur unter der eigenen profile_id. Gelesen wird über die Admin-RPC
 * `admin_list_feedback` (AGE-358) — sie liefert nur einem `admin` Zeilen, samt
 * Autor-Name; die `feedback_admin_read`-Policy bleibt die Grenze für direkte Reads.
 *
 * `ref_type`/`ref_id` bleiben beim Schreiben bewusst ungesetzt. Sie kennzeichnen
 * AKTIONSGEBUNDENES Feedback (Event/Match/Kurs, AGE-234), und nur solches zählt auf
 * den Potenzial-Score (recompute_potential_score, s. 20260716070000_platform_feedback.sql).
 * Eine Meinung über die Plattform ist kein Signal über das Mitglied.
 */
export interface PlatformFeedbackInput {
  profileId: string;
  /** 1–5. Pflicht — ohne Sterne ist die Zeile aussagelos (Spec-Design §3). */
  rating: number;
  likes: string;
  misses: string;
  idea: string;
  /** Pfad, auf dem das Feedback entstand (z. B. `/meine-chancen`). */
  route: string;
}

export async function submitPlatformFeedback(input: PlatformFeedbackInput): Promise<void> {
  const { error } = await supabase.from("feedback").insert({
    profile_id: input.profileId,
    rating: input.rating,
    likes: input.likes,
    misses: input.misses,
    idea: input.idea,
    route: input.route,
  });
  if (error) throw error;
}

/** Eine Zeile der Admin-Sicht (AGE-358) — Feedback samt aufgelöstem Autor-Namen. */
export type AdminFeedbackRow =
  Database["public"]["Functions"]["admin_list_feedback"]["Returns"][number];

/**
 * Admin-Sicht auf alles QM-Feedback (AGE-358). Ruft die SECURITY-DEFINER-RPC
 * `admin_list_feedback`, die nur einem `admin` Zeilen liefert (für alle anderen
 * leer) — die Rolle wird server-seitig in der Funktion geprüft, nicht hier.
 */
export async function fetchAdminFeedback(): Promise<AdminFeedbackRow[]> {
  const { data, error } = await supabase.rpc("admin_list_feedback");
  if (error) throw error;
  return data ?? [];
}
