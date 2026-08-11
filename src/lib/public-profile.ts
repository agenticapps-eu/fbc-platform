import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * Öffentliche Profilseite (AGE-239) — Datenschicht. Spec: docs/profile-spec.md §2/§3.
 *
 * Sichtbarkeit wird AUSSCHLIESSLICH von der RLS entschieden, nicht im Frontend:
 *  - `public` kommt aus der View `profiles_public` (nur öffentliche Spalten) und ist
 *    für jeden eingeloggten Betrachter (Discover+) sichtbar.
 *  - `extended` wird aus der Basistabelle `profiles` und den Detailtabellen gelesen.
 *    Die RLS gibt diese Zeilen nur am eigenen Profil ODER für Prime+ zurück. Für
 *    einen Discover-Betrachter eines fremden Profils liefern die Queries 0 Zeilen —
 *    `extended` ist dann `null`. Wir „faken" nichts: das Vorhandensein der Basiszeile
 *    IST das von der RLS entschiedene Signal.
 */

type ThemeScore = Pick<
  Database["public"]["Tables"]["profile_theme_scores"]["Row"],
  "theme" | "score"
>;
type Interest = Pick<Database["public"]["Tables"]["profile_interests"]["Row"], "theme" | "label">;
type Offer = Pick<
  Database["public"]["Tables"]["offers"]["Row"],
  "id" | "category" | "theme" | "title" | "description"
>;
type Need = Pick<
  Database["public"]["Tables"]["needs"]["Row"],
  "id" | "category" | "theme" | "title" | "description"
>;

export interface PublicProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  /** Hintergrundbild (AGE-498). Liegt in der Sicht, nicht nur auf der Basiszeile —
   *  sonst sähe es außer dem Eigentümer niemand. */
  cover_url: string | null;
  region: string | null;
  company: string | null;
  short_bio: string | null;
  tier: string | null;
  roles: string[];
}

export interface ProfileActivity {
  id: string;
  body: string;
  created_at: string;
}

export interface ExtendedProfile {
  headline: string | null;
  /** Für den Abschnitt „Beruf" (AGE-498). */
  branche: string | null;
  /** Für die Eckdaten (AGE-498). Steht NICHT in profiles_public — nur in der
   *  Vollzeile, also ab `discover`. */
  member_since: string | null;
  potential_score: number;
  competencies: string[];
  videos: string[];
  themeScores: ThemeScore[];
  interests: Interest[];
  offers: Offer[];
  needs: Need[];
  /** Eigene Beiträge des Mitglieds („Aktivitäten" im Mockup). Die RLS des
   *  Feeds entscheidet, welche sichtbar sind — wir filtern nichts nach. */
  posts: ProfileActivity[];
}

export interface PublicProfileData {
  /** Öffentliche Felder (profiles_public). null = Profil existiert nicht / nicht öffentlich. */
  publicProfile: PublicProfile | null;
  /** Erweiterte Felder — von der RLS freigegeben (Prime+/eigenes Profil). Sonst null. */
  extended: ExtendedProfile | null;
}

export const publicProfileQueryKey = (id: string) => ["public-profile", id] as const;

/**
 * Lädt die öffentliche Projektion und — parallel — die erweiterten Daten. Die
 * erweiterten Queries laufen immer, aber die RLS entscheidet, ob Zeilen zurückkommen.
 * Liegt die Basiszeile aus `profiles` vor, war der Vollzugriff erlaubt (Prime+/eigen)
 * und `extended` wird zusammengebaut; sonst bleibt es `null`.
 */
export async function fetchPublicProfile(id: string): Promise<PublicProfileData> {
  const [publicRes, baseRes, themeRes, interestsRes, offersRes, needsRes, postsRes] =
    await Promise.all([
    supabase
      .from("profiles_public")
      .select("id, name, avatar_url, cover_url, region, company, short_bio, tier, roles")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("headline, branche, member_since, potential_score, competencies, videos")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profile_theme_scores").select("theme, score").eq("profile_id", id),
    supabase.from("profile_interests").select("theme, label").eq("profile_id", id).order("label"),
    supabase
      .from("offers")
      .select("id, category, theme, title, description")
      .eq("profile_id", id)
      .order("created_at"),
    supabase
      .from("needs")
      .select("id, category, theme, title, description")
      .eq("profile_id", id)
      .order("created_at"),
    supabase
      .from("posts")
      .select("id, body, created_at")
      .eq("author_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (publicRes.error) throw publicRes.error;
  if (baseRes.error) throw baseRes.error;

  const pub = publicRes.data;
  const publicProfile: PublicProfile | null =
    pub && pub.id
      ? {
          id: pub.id,
          name: pub.name ?? "Mitglied",
          avatar_url: pub.avatar_url,
          cover_url: pub.cover_url,
          region: pub.region,
          company: pub.company,
          short_bio: pub.short_bio,
          tier: pub.tier,
          roles: pub.roles ?? [],
        }
      : null;

  // Die RLS gab die Basiszeile frei → Vollzugriff (Prime+/eigenes Profil).
  const base = baseRes.data;
  const extended: ExtendedProfile | null = base
    ? {
        headline: base.headline,
        branche: base.branche,
        member_since: base.member_since,
        potential_score: base.potential_score,
        competencies: base.competencies ?? [],
        videos: base.videos,
        themeScores: themeRes.data ?? [],
        interests: interestsRes.data ?? [],
        offers: offersRes.data ?? [],
        needs: needsRes.data ?? [],
        posts: postsRes.data ?? [],
      }
    : null;

  return { publicProfile, extended };
}
