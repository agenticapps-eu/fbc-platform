import { Preferences } from "@capacitor/preferences";

/**
 * Wo die Anmeldesitzung liegt (AGE-642).
 *
 * Im Web ändert sich nichts: `supabase.ts` reicht `localStorage` unverändert
 * durch, indem es gar keinen Speicher übergibt. Nativ ist genau das der Fehler,
 * den man nicht nachstellen kann — eine WebView darf ihren Web-Speicher unter
 * Druck leeren, und dann ist ein Mitglied abgemeldet, ohne Anlass, nur manchmal
 * und nur bei manchen.
 *
 * **Der Speicher hier hält den Ausweis im Klartext**, und das ist eine
 * Entscheidung, keine Nebenwirkung: `@capacitor/preferences` schreibt nach
 * UserDefaults (iOS) bzw. SharedPreferences (Android), unverschlüsselt und im
 * Gerätebackup. Der Zugewinn eines Keychain-Plugins läge allein beim Backup —
 * wer ein entsperrtes Gerät hat, hat die laufende Sitzung ohnehin über die
 * WebView. Ein Dritt-Plugin im Anmeldeweg ist dafür der höhere Preis
 * (Donald, 27.08.; Begründung im Entwurf des Changes `capacitor-huelle`, §1).
 */

/**
 * Der Sitzungsschlüssel, festgenagelt.
 *
 * Bis heute bildet `supabase-js` ihn selbst genauso — nachgelesen in
 * `@supabase/supabase-js@2.112.1`, `dist/index.mjs:626`:
 *
 * ```js
 * const defaultStorageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
 * ```
 *
 * Das ist eine Konvention der Bibliothek, keine zugesagte Schnittstelle. Ein
 * Minor-Upgrade, das das Format ändert, meldete sonst **alle** Web-Mitglieder
 * ab — lautlos, weil niemand einen Fehler sähe, nur eine Anmeldemaske. Indem
 * wir den Schlüssel selbst setzen, wird aus dieser Konvention eine Zusage, die
 * uns gehört.
 */
export function sitzungsSchluessel(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/**
 * Der Speicher für die nativen Schalen. Asynchron, was `supabase-js`
 * ausdrücklich zulässt: `SupportedStorage` wickelt seine drei Methoden in
 * `MaybePromisify` (`@supabase/auth-js@2.112.1`, `lib/types.d.ts:1556`).
 */
export const nativerSitzungsspeicher = {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  },
  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  },
};
