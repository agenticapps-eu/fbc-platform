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

/* ── Theme (AGE-492) ─────────────────────────────────────────────────────────
 *
 *  Bewusst ein EIGENER, schmaler Pfad statt eines weiteren Feldes in
 *  MemberSettings: `saveMemberSettings` schreibt alle Präferenzen in einem
 *  Upsert: Legte ein Notification-Toggle los, während der Theme-Wert im Cache
 *  veraltet ist, überschriebe es das Theme stillschweigend mit dem alten Wert.
 *  Getrennte Schlüssel, getrennte Writes — dieselbe Lehre wie bei
 *  `visible_in_directory` oben (AGE-313). */

export type MemberTheme = "hell" | "navy";

export const memberThemeQueryKey = (uid: string) => ["member-theme", uid] as const;

/** Liest das serverseitig gespeicherte Theme. `null` heißt „noch keine Zeile" —
 *  dann bleibt der lokale Wert gültig, statt ihn auf den Default zu zwingen. */
export async function fetchMemberTheme(uid: string): Promise<MemberTheme | null> {
  const { data, error } = await supabase
    .from("member_settings")
    .select("theme")
    .eq("profile_id", uid)
    .maybeSingle();
  if (error) throw error;
  const theme = (data as { theme?: string } | null)?.theme;
  return theme === "hell" || theme === "navy" ? theme : null;
}

/** Schreibt das Theme. Upsert, weil ein Mitglied ohne je geänderte Einstellung
 *  noch gar keine member_settings-Zeile hat. RLS erzwingt own-profile. */
export async function saveMemberTheme(uid: string, theme: MemberTheme): Promise<void> {
  const { error } = await supabase
    .from("member_settings")
    .upsert({ profile_id: uid, theme }, { onConflict: "profile_id" });
  if (error) throw error;
}

/* ── Onboarding-Merker (AGE-538) ─────────────────────────────────────────────
 *
 *  Wieder ein EIGENER schmaler Pfad, aus demselben Grund wie beim Theme:
 *  `saveMemberSettings` schreibt alle Präferenzen in einem Upsert und
 *  überschriebe den Merker mit einem veralteten Cache-Wert, sobald jemand
 *  während der Strecke eine Einstellung umlegt. */

export const memberOnboardingQueryKey = (uid: string) => ["member-onboarding", uid] as const;

/** Liest den Merker. `null` heißt „die Strecke ist offen" — und zwar sowohl für
 *  eine Zeile ohne Wert als auch für ein Konto ohne Einstellungszeile. Beide
 *  bedeuten dasselbe, deshalb unterscheidet der Rückgabewert sie nicht.
 *
 *  Wirft bei einem Lesefehler, statt `null` zurückzugeben: der Aufrufer muss
 *  „nicht gesetzt" von „nicht gelesen" unterscheiden können, sonst wirft ein
 *  Netzfehler jedes Mitglied erneut in die Strecke. */
export async function fetchOnboardedAt(uid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("member_settings")
    .select("onboarded_at")
    .eq("profile_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data?.onboarded_at ?? null;
}

/** Setzt den Merker auf jetzt und gibt den geschriebenen Zeitpunkt zurück.
 *
 *  Upsert, weil die Einstellungszeile bei der Registrierung nicht entsteht — ein
 *  `update` änderte dort null Zeilen und meldete dabei keinen Fehler. RLS
 *  erzwingt own-profile.
 *
 *  Der Rückgabewert ist kein Beiwerk: der Aufrufer setzt damit den gelesenen
 *  Zustand, BEVOR er zur Startseite navigiert. Sonst liest die Weiche dort noch
 *  den alten `null` und schickt das Mitglied in die Strecke zurück, die es
 *  gerade beendet hat. */
export async function markOnboarded(uid: string): Promise<string> {
  const onboarded_at = new Date().toISOString();
  const { error } = await supabase
    .from("member_settings")
    .upsert({ profile_id: uid, onboarded_at }, { onConflict: "profile_id" });
  if (error) throw error;
  return onboarded_at;
}

/* ── Vertagen („Später") ─────────────────────────────────────────────────────
 *
 *  „Später" setzt den Merker ausdrücklich NICHT — die Strecke soll ja
 *  wiederkommen. Damit entsteht aber ein Kreis: „Später" führt zur Startseite,
 *  und die Startseite IST die Weiche, die zurück in die Strecke schickt.
 *
 *  Aufgelöst mit dem kleinstmöglichen Zustand: einem Modulwert, der genau diese
 *  Anwendungssitzung überdauert. Ein Neuladen der Seite und ein Abmelden setzen
 *  ihn zurück, ein Navigieren innerhalb der App nicht. Damit ist „vertagt"
 *  wörtlich das, was es heißt — und nichts davon liegt dauerhaft im Browser, wo
 *  es den Gerätewechsel überstünde und den Merker heimlich ersetzte. */
let vertagtFuer: string | null = null;

export function vertageOnboarding(uid: string): void {
  vertagtFuer = uid;
}

export function istOnboardingVertagt(uid: string): boolean {
  return vertagtFuer === uid;
}

/** Beim Abmelden zurücksetzen: sonst bliebe die Strecke nach „Später" auch für
 *  die nächste Anmeldung im selben Tab unterdrückt. */
export function vertagungZuruecksetzen(): void {
  vertagtFuer = null;
}

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
