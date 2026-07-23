import { supabase } from "./supabase";

/** Plattformweite Einstellungen (Singleton-Tabelle platform_settings, AGE-455). */
export interface PlatformSettings {
  /** Wenn true: jedes eingeloggte Mitglied darf jedem eine Kontaktanfrage senden. */
  openContact: boolean;
}

/** Sicherer Default: geschlossen. Ein Lesefehler soll die UI NICHT öffnen — die RLS
 *  ist ohnehin die echte Grenze. */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = { openContact: false };

export const platformSettingsQueryKey = ["platform-settings"] as const;

/** Reine Abbildung Zeile → Settings, damit sie ohne DB testbar ist. */
export function platformSettingsFromRow(row: { open_contact: boolean } | null): PlatformSettings {
  return { openContact: row?.open_contact ?? DEFAULT_PLATFORM_SETTINGS.openContact };
}

/** Lädt den plattformweiten Flag. Alle Eingeloggten dürfen lesen (RLS). */
export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("open_contact")
    .maybeSingle();
  if (error) throw error;
  return platformSettingsFromRow(data);
}

/** Schaltet den Flag. RLS erzwingt is_admin(); der Client hat nur update(open_contact). */
export async function updateOpenContact(next: boolean): Promise<void> {
  const { error } = await supabase
    .from("platform_settings")
    .update({ open_contact: next })
    .eq("id", true);
  if (error) throw error;
}
