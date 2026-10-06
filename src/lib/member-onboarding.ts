import { supabase } from "./supabase";

/**
 * Datenschicht der Willkommensstrecke (AGE-538, C11).
 *
 * **Warum es diese Datei gibt und nicht `saveProfile` benutzt wird.**
 * `saveProfile` (`profile.ts:303`) sieht nach dem richtigen Weg aus und ist hier
 * eine Falle: ein Aufruf schreibt ALLE Profilspalten, upsertet `profile_contacts`
 * bedingungslos und LÖSCHT UND ERSETZT die Kindtabellen für Interessen und Ziele.
 * Aus einem Schritt heraus aufgerufen, der nur `headline` kennt, räumte er die
 * Kontaktzeile und sämtliche Interessen weg — bei einem gerade importierten
 * Mitglied genau den Datenbestand, für den der Import gebaut wurde.
 *
 * Jeder Schreibweg hier fasst deshalb GENAU EINE Spalte an, auf der eigenen
 * Zeile. Aus `profile.ts` wird ausschließlich `uploadBild` wiederverwendet.
 *
 * Die Kategorien laufen NICHT über diese Datei, sondern über
 * `saveCategorySelection` — den Abgleich je Kategorie, den auch der Profil-Editor
 * benutzt. Ein zweiter Schreibpfad dorthin wäre eine vierte Oberfläche auf
 * `offers`/`needs` und die Falle aus dem Kopf von `profile-categories.ts`.
 */

export interface OnboardingProfile {
  headline: string;
  avatar_url: string | null;
  region: string;
}

export const onboardingProfileQueryKey = (uid: string) => ["onboarding-profile", uid] as const;

/** Die drei Felder der Strecke. Bewusst nicht `fetchProfileEditorData`: das lädt
 *  Interessen, Ziele, Videos und die Kontaktzeile mit, von denen hier keins
 *  gebraucht wird. */
export async function fetchOnboardingProfile(): Promise<OnboardingProfile> {
  // `mein_profil()` statt der Spaltenauswahl (AGE-1001). Die Funktion ist an
  // die Sitzung gebunden und nimmt keine Kennung entgegen — der Parameter
  // `uid` ist hier deshalb entfallen. Der Schluessel der Abfrage traegt ihn
  // weiterhin, denn der Zwischenspeicher gehoert dem Konto.
  const { data, error } = await supabase.rpc("mein_profil").maybeSingle();
  if (error) throw error;
  return {
    headline: data?.headline ?? "",
    avatar_url: data?.avatar_url ?? null,
    region: data?.region ?? "",
  };
}

/* Feldbezogenes Schreiben: eine Spalte, eigene Zeile. Seit AGE-1001 je eine
 * eigene SECURITY-DEFINER-Funktion statt eines gemeinsamen UPDATE mit einem
 * `patch`-Objekt — das Schreibrecht auf `profiles` ist mit dem Leserecht
 * gefallen, denn ein `update … where id = $1` braucht `select` auf die
 * Spalten der WHERE-Klausel.
 *
 * Drei Funktionen statt einer mit drei Vorgabewerten: der Funktionsname IST
 * die Positivliste. Bei „null heisst unverändert" liesse sich ein Feld nie
 * leeren, bei „null heisst leeren" leerte ein vergessener Parameter still.
 *
 * Die Kennung ist aus allen dreien entfallen: die Funktionen treffen die
 * Zeile der Sitzung, einen Weg zu einer fremden gibt es nicht mehr.
 */
export async function saveOnboardingHeadline(headline: string): Promise<void> {
  const { error } = await supabase.rpc("onboarding_kopfzeile_setzen", { p_headline: headline });
  if (error) throw error;
}

/** `region` ist der FBC Standort und ein FREITEXTfeld (`ProfileFieldsets.tsx:46`).
 *  Eine verbindliche Liste der Standorte gibt es nicht — hier wird ergänzt, nicht
 *  validiert, deshalb auch ohne die `min(1)`-Pflicht aus `profile.ts:38`. */
export async function saveOnboardingRegion(region: string): Promise<void> {
  const { error } = await supabase.rpc("onboarding_region_setzen", { p_region: region });
  if (error) throw error;
}

export async function saveOnboardingAvatarUrl(avatar_url: string): Promise<void> {
  const { error } = await supabase.rpc("onboarding_bild_setzen", { p_avatar_url: avatar_url });
  if (error) throw error;
}

export interface OnboardingFreetext {
  offers: string[];
  needs: string[];
}

export const onboardingFreetextQueryKey = (uid: string) => ["onboarding-freetext", uid] as const;

/** Der vorhandene Freitext des Mitglieds je Seite.
 *
 *  Eigener Lesepfad, weil `fetchCategorySelection` ausdrücklich KEINE
 *  Beschreibungen lädt — es liest nur `id, category, source`. Zeilen OHNE
 *  Kategorie sind eingeschlossen: gerade der aus WordPress übernommene Fließtext
 *  trägt keine, und er ist der Grund, warum dieser Pfad existiert. */
export async function fetchOnboardingFreetext(uid: string): Promise<OnboardingFreetext> {
  const lies = async (table: "offers" | "needs") => {
    const { data, error } = await supabase
      .from(table)
      .select("description")
      .eq("profile_id", uid);
    if (error) throw error;
    return (data ?? [])
      .map((r) => r.description?.trim() ?? "")
      .filter((d): d is string => d !== "");
  };
  const [offers, needs] = await Promise.all([lies("offers"), lies("needs")]);
  return { offers, needs };
}
