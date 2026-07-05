import { supabase } from "./supabase";

/** Benachrichtigungs- & Sichtbarkeits-Präferenzen eines Mitglieds (1:1 zum Profil). */
export interface MemberSettings {
  notify_email_requests: boolean;
  notify_email_events: boolean;
  notify_email_digest: boolean;
  visible_in_directory: boolean;
  contactable_by_prime: boolean;
}

/** Defaults entsprechen den DB-Defaults der Migration — bestehendes Verhalten bleibt unverändert. */
export const DEFAULT_MEMBER_SETTINGS: MemberSettings = {
  notify_email_requests: true,
  notify_email_events: true,
  notify_email_digest: false,
  visible_in_directory: true,
  contactable_by_prime: true,
};

export const memberSettingsQueryKey = (uid: string) => ["member-settings", uid] as const;

/** Lädt die Einstellungen; ohne vorhandene Zeile gelten die Defaults. */
export async function fetchMemberSettings(uid: string): Promise<MemberSettings> {
  const { data, error } = await supabase
    .from("member_settings")
    .select(
      "notify_email_requests, notify_email_events, notify_email_digest, visible_in_directory, contactable_by_prime",
    )
    .eq("profile_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_MEMBER_SETTINGS;
}

/** Speichert die Einstellungen (Upsert auf profile_id). RLS erzwingt own-profile. */
export async function saveMemberSettings(uid: string, values: MemberSettings): Promise<void> {
  const { error } = await supabase
    .from("member_settings")
    .upsert({ profile_id: uid, ...values }, { onConflict: "profile_id" });
  if (error) throw error;
}

/** Spiegelt die Verzeichnis-Sichtbarkeit auf profiles.is_public (die durchgesetzte
 *  Quelle der Wahrheit für Verzeichnis/RLS). RLS erzwingt own-profile. */
export async function setProfileVisibility(uid: string, visible: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_public: visible }).eq("id", uid);
  if (error) throw error;
}
