import { z } from "zod";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * Profil-Editor (AGE-238) — Datenschicht: zod-Schema, Default-Mapping,
 * Vollständigkeits-Berechnung sowie Laden/Speichern gegen Supabase.
 * Spec: docs/profile-spec.md §6.
 */

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// ── Stammwerte (Themen / Ziel-Kategorien) ────────────────────────────────────
export const THEMES = [
  { value: "sein", label: "Sein" },
  { value: "tun", label: "Tun" },
  { value: "haben", label: "Haben" },
  { value: "wirken", label: "Wirken" },
] as const;

export const GOAL_CATEGORIES = [
  { value: "persoenlich", label: "Persönlich" },
  { value: "unternehmerisch", label: "Unternehmerisch" },
  { value: "finanziell", label: "Finanziell" },
  { value: "wirkung", label: "Wirkung" },
] as const;

const themeEnum = z.enum(["sein", "tun", "haben", "wirken"]);
const goalCategoryEnum = z.enum(["persoenlich", "unternehmerisch", "finanziell", "wirkung"]);

// ── Formular-Schema ──────────────────────────────────────────────────────────
export const profileFormSchema = z.object({
  // Pflichtfelder (§6) — Avatar ist „empfohlen“ (zählt zur Vollständigkeit),
  // blockiert das Speichern aber nicht, damit reine Textänderungen möglich sind.
  name: z.string().trim().min(1, "Name ist erforderlich."),
  region: z.string().trim().min(1, "Region ist erforderlich."),
  company: z.string().trim().min(1, "Unternehmen ist erforderlich."),
  short_bio: z.string().trim().min(1, "Kurzbeschreibung ist erforderlich."),
  avatar_url: z.string().nullable(),
  branche: z.string().trim(),
  headline: z.string().trim(),
  roles: z.array(z.string().trim().min(1)),
  competencies: z.array(z.string().trim().min(1)),
  website: z.union([
    z.literal(""),
    z.string().trim().url("Bitte eine gültige URL eingeben (inkl. https://)."),
  ]),
  dev_focus: z.union([z.literal(""), themeEnum]),
  socials: z.object({
    linkedin: z.string().trim(),
    instagram: z.string().trim(),
    xing: z.string().trim(),
  }),
  interests: z.array(
    z.object({
      theme: z.union([z.literal(""), themeEnum]),
      label: z.string().trim().min(1, "Bezeichnung fehlt."),
    }),
  ),
  goals: z.array(
    z.object({
      category: goalCategoryEnum,
      title: z.string().trim().min(1, "Titel fehlt."),
      progress: z.number().int().min(0).max(100),
    }),
  ),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

// ── Vollständigkeit ──────────────────────────────────────────────────────────
// Spiegelt EXAKT den DB-Trigger set_profile_completion (12 Profil-Felder,
// Ganzzahl-Division). ≥ 80 % = „vollständig“ (10/12 → 83 %).
export const PROFILE_COMPLETION_FIELDS = 12;
export const PROFILE_COMPLETE_THRESHOLD = 80;

export function computeProfileCompletion(v: ProfileFormValues): number {
  const text = (s: string | null | undefined) => (s && s.trim() !== "" ? 1 : 0);
  const arr = (a: string[]) => (a.length > 0 ? 1 : 0);
  const socialsFilled = Object.values(v.socials).some((s) => s.trim() !== "") ? 1 : 0;

  const filled =
    text(v.name) +
    text(v.avatar_url) +
    text(v.region) +
    text(v.company) +
    text(v.short_bio) +
    text(v.branche) +
    text(v.headline) +
    arr(v.roles) +
    arr(v.competencies) +
    text(v.website) +
    text(v.dev_focus) +
    socialsFilled;

  return Math.floor((filled * 100) / PROFILE_COMPLETION_FIELDS);
}

export function isProfileComplete(completion: number): boolean {
  return completion >= PROFILE_COMPLETE_THRESHOLD;
}

// ── Laden ────────────────────────────────────────────────────────────────────
export const profileEditorQueryKey = (uid: string) => ["profile-editor", uid] as const;

function socialString(socials: ProfileRow["socials"], key: string): string {
  if (socials && typeof socials === "object" && !Array.isArray(socials)) {
    const value = (socials as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

/** Lädt Profilzeile + Interessen + Ziele und baut die Formular-Defaults. */
export async function fetchProfileEditorData(uid: string): Promise<ProfileFormValues> {
  const [profileRes, interestsRes, goalsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).single(),
    supabase.from("profile_interests").select("theme, label").eq("profile_id", uid).order("label"),
    supabase
      .from("goals")
      .select("category, title, progress")
      .eq("profile_id", uid)
      .order("category"),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (interestsRes.error) throw interestsRes.error;
  if (goalsRes.error) throw goalsRes.error;

  const p = profileRes.data;
  return {
    name: p.name ?? "",
    region: p.region ?? "",
    company: p.company ?? "",
    short_bio: p.short_bio ?? "",
    avatar_url: p.avatar_url,
    branche: p.branche ?? "",
    headline: p.headline ?? "",
    roles: p.roles ?? [],
    competencies: p.competencies ?? [],
    website: p.website ?? "",
    dev_focus: (p.dev_focus as ProfileFormValues["dev_focus"]) ?? "",
    socials: {
      linkedin: socialString(p.socials, "linkedin"),
      instagram: socialString(p.socials, "instagram"),
      xing: socialString(p.socials, "xing"),
    },
    interests: (interestsRes.data ?? []).map((i) => ({
      theme: (i.theme as ProfileFormValues["interests"][number]["theme"]) ?? "",
      label: i.label,
    })),
    goals: (goalsRes.data ?? []).map((g) => ({
      category: g.category as ProfileFormValues["goals"][number]["category"],
      title: g.title,
      progress: g.progress ?? 0,
    })),
  };
}

// ── Speichern ────────────────────────────────────────────────────────────────
const emptyToNull = (s: string) => (s.trim() === "" ? null : s.trim());

function buildSocials(socials: ProfileFormValues["socials"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(socials)) {
    if (value.trim() !== "") out[key] = value.trim();
  }
  return out;
}

/**
 * Speichert das Profil: optionaler Avatar-Upload, Profilzeile aktualisieren,
 * Interessen und Ziele ersetzen. profile_completion setzt der DB-Trigger —
 * die zurückgegebene Zeile trägt den maßgeblichen Wert.
 */
export async function saveProfile(
  uid: string,
  values: ProfileFormValues,
  avatarBlob: Blob | null,
): Promise<{ avatarUrl: string | null; completion: number }> {
  let avatarUrl = values.avatar_url;

  if (avatarBlob) {
    const path = `${uid}/${Date.now()}.webp`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, avatarBlob, { upsert: true, contentType: "image/webp" });
    if (uploadError) throw uploadError;
    avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({
      name: values.name.trim(),
      region: values.region.trim(),
      company: values.company.trim(),
      short_bio: values.short_bio.trim(),
      branche: emptyToNull(values.branche),
      headline: emptyToNull(values.headline),
      roles: values.roles,
      competencies: values.competencies,
      website: emptyToNull(values.website),
      dev_focus: values.dev_focus === "" ? null : values.dev_focus,
      socials: buildSocials(values.socials),
      avatar_url: avatarUrl,
    })
    .eq("id", uid)
    .select("profile_completion, avatar_url")
    .single();
  if (updateError) throw updateError;

  // Kind-Tabellen ersetzen (einfaches „replace collection“-Muster).
  const { error: delInterests } = await supabase
    .from("profile_interests")
    .delete()
    .eq("profile_id", uid);
  if (delInterests) throw delInterests;
  if (values.interests.length > 0) {
    const { error } = await supabase.from("profile_interests").insert(
      values.interests.map((i) => ({
        profile_id: uid,
        theme: i.theme === "" ? null : i.theme,
        label: i.label.trim(),
      })),
    );
    if (error) throw error;
  }

  const { error: delGoals } = await supabase.from("goals").delete().eq("profile_id", uid);
  if (delGoals) throw delGoals;
  if (values.goals.length > 0) {
    const { error } = await supabase.from("goals").insert(
      values.goals.map((g) => ({
        profile_id: uid,
        category: g.category,
        title: g.title.trim(),
        progress: g.progress,
      })),
    );
    if (error) throw error;
  }

  // Impact Score & Erfolgsradar nach dem Speichern neu berechnen (AGE-242).
  // Best-effort: das Profil ist bereits persistiert; schlägt die Neuberechnung
  // fehl, holt sie das Dashboard beim nächsten Laden nach — daher kein throw,
  // aber auch nicht still: der Fehler wird sichtbar geloggt.
  const { error: recomputeError } = await supabase.rpc("recompute_potential_score", {
    p_profile_id: uid,
  });
  if (recomputeError) {
    console.error("recompute_potential_score after save failed:", recomputeError.message);
  }

  return { avatarUrl: updated.avatar_url, completion: updated.profile_completion };
}
