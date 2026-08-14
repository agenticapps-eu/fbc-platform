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
export async function fetchOnboardingProfile(uid: string): Promise<OnboardingProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("headline, avatar_url, region")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return {
    headline: data?.headline ?? "",
    avatar_url: data?.avatar_url ?? null,
    region: data?.region ?? "",
  };
}

/** Feldbezogenes Schreiben: eine Spalte, eigene Zeile. Die RLS erzwingt
 *  `id = auth.uid()`; das `eq` hier ist die Absicht, nicht die Grenze. */
async function updateEigeneSpalte(
  uid: string,
  patch: Partial<Pick<OnboardingProfile, "headline" | "region" | "avatar_url">>,
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
  if (error) throw error;
}

export const saveOnboardingHeadline = (uid: string, headline: string) =>
  updateEigeneSpalte(uid, { headline });

/** `region` ist der FBC Standort und ein FREITEXTfeld (`ProfileFieldsets.tsx:46`).
 *  Eine verbindliche Liste der Standorte gibt es nicht — hier wird ergänzt, nicht
 *  validiert, deshalb auch ohne die `min(1)`-Pflicht aus `profile.ts:38`. */
export const saveOnboardingRegion = (uid: string, region: string) =>
  updateEigeneSpalte(uid, { region });

export const saveOnboardingAvatarUrl = (uid: string, avatar_url: string) =>
  updateEigeneSpalte(uid, { avatar_url });

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
