import { supabase } from "./supabase";

/** Benachrichtigungs- & Sichtbarkeits-Präferenzen eines Mitglieds (1:1 zum Profil).
 *
 *  `visible_in_directory` liegt bewusst NICHT in `member_settings`, sondern ist
 *  `profiles.is_public` — die Spalte, auf die `profiles_public` filtert und die
 *  damit als einzige durchgesetzt wird. Bis AGE-313 stand hier eine Kopie, die ein
 *  zweiter, nicht-atomarer Write synchron halten musste; schlug er fehl, zeigte die
 *  Einstellungsseite „ausgeblendet“, während das Verzeichnis weiter listete. */
export interface MemberSettings {
  notify_email_requests: boolean;
  notify_email_events: boolean;
  notify_email_digest: boolean;
  visible_in_directory: boolean;
  contactable_by_prime: boolean;
}

/** Die Felder, die wirklich in member_settings liegen. */
type StoredSettings = Omit<MemberSettings, "visible_in_directory">;

const STORED_COLUMNS =
  "notify_email_requests, notify_email_events, notify_email_digest, contactable_by_prime";

/** Defaults entsprechen den DB-Defaults der Migrationen — bestehendes Verhalten bleibt unverändert. */
export const DEFAULT_MEMBER_SETTINGS: MemberSettings = {
  notify_email_requests: true,
  notify_email_events: true,
  notify_email_digest: false,
  visible_in_directory: true,
  contactable_by_prime: true,
};

export const memberSettingsQueryKey = (uid: string) => ["member-settings", uid] as const;

/** Lädt die Einstellungen; ohne vorhandene member_settings-Zeile gelten deren Defaults.
 *  Die Sichtbarkeit kommt aus profiles.is_public, nicht aus einer Kopie. */
export async function fetchMemberSettings(uid: string): Promise<MemberSettings> {
  const [stored, profile] = await Promise.all([
    supabase.from("member_settings").select(STORED_COLUMNS).eq("profile_id", uid).maybeSingle(),
    supabase.from("profiles").select("is_public").eq("id", uid).maybeSingle(),
  ]);
  if (stored.error) throw stored.error;
  if (profile.error) throw profile.error;

  const s = (stored.data as StoredSettings | null) ?? {
    notify_email_requests: DEFAULT_MEMBER_SETTINGS.notify_email_requests,
    notify_email_events: DEFAULT_MEMBER_SETTINGS.notify_email_events,
    notify_email_digest: DEFAULT_MEMBER_SETTINGS.notify_email_digest,
    contactable_by_prime: DEFAULT_MEMBER_SETTINGS.contactable_by_prime,
  };
  return {
    ...s,
    visible_in_directory: profile.data?.is_public ?? DEFAULT_MEMBER_SETTINGS.visible_in_directory,
  };
}

/** Speichert die Einstellungen. RLS erzwingt own-profile auf beiden Tabellen.
 *
 *  Zwei Writes, weil die Sichtbarkeit am Profil hängt und die Benachrichtigungen an
 *  member_settings — aber es sind zwei UNABHÄNGIGE Einstellungen, keine zwei Kopien
 *  derselben. Schlägt einer fehl, wirft die Funktion und der Aufrufer zeigt den
 *  Fehler; es entsteht kein Zustand, in dem die UI etwas anderes behauptet als das
 *  Verzeichnis tut. Genau das war der Bug in AGE-313. */
export async function saveMemberSettings(uid: string, values: MemberSettings): Promise<void> {
  const { visible_in_directory, ...stored } = values;

  const { error: settingsError } = await supabase
    .from("member_settings")
    .upsert({ profile_id: uid, ...stored }, { onConflict: "profile_id" });
  if (settingsError) throw settingsError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_public: visible_in_directory })
    .eq("id", uid);
  if (profileError) throw profileError;
}
