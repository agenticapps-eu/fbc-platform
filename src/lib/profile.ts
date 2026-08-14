import { z } from "zod";
import { parseVideoUrl } from "./feed";
import { recomputeMyMatches } from "./matches";
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
  // Hintergrundbild (AGE-498). Wie der Avatar „empfohlen", nie Pflicht — und
  // bewusst NICHT in computeProfileCompletion: die zwölf gewichteten Felder
  // sind Vertrag mit dem DB-Trigger, ein dreizehntes verschöbe rückwirkend den
  // Vollständigkeitsgrad jedes bestehenden Profils.
  cover_url: z.string().nullable(),
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
  // Profil-Videos (AGE-252): rohe YouTube-/Vimeo-URLs. Pro-Zeilen-Validierung
  // passiert im Editor; beim Speichern werden leere/ungültige Einträge verworfen,
  // damit nie eine nicht-einbettbare URL persistiert wird.
  videos: z.array(z.string()),
  // Die Kontaktzeile (AGE-537). Sie liegt in `profile_contacts`, NICHT in
  // `profiles`: dort wäre sie für jedes eingeloggte Mitglied lesbar, hier gibt
  // `contacts_select_self_or_released` sie erst nach einer angenommenen
  // Kontaktanfrage frei. Kein Feld ist Pflicht.
  //
  // `country` bekommt bewusst KEINE Vorbelegung — ein vorbelegtes „DE" machte
  // aus einer bewussten Leerung beim nächsten Laden wieder Deutschland. Die
  // Vorgabe setzt der Import (C10), der ein Feld füllt, das WordPress nicht
  // erhebt; im Formular steht sie als Platzhalter.
  contact: z.object({
    // Die KONTAKT-Adresse, nicht die Login-Adresse (auth.users). An sie
    // schickt notify-contact-request — ein Tippfehler hier ist keine
    // Anzeigefrage, sondern eine Benachrichtigung, die niemanden erreicht.
    email: z.union([
      z.literal(""),
      z.string().trim().email("Bitte eine gültige E-Mail-Adresse eingeben."),
    ]),
    phone: z.string().trim(),
    street: z.string().trim(),
    postal_code: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim(),
    country: z.string().trim(),
  }),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/**
 * Leerwerte für `useForm({ defaultValues })`. Sie sind kein Komfort: die
 * Chip-Eingaben lesen `value.map`, und vor dem ersten `reset(data)` gäbe es
 * ohne sie `undefined` — die Komponente wirft, und zwar erst zur Laufzeit auf
 * einer Seite, die gerade lädt. Beide Editoren (eigenes Profil und
 * Admin-Bearbeitung, AGE-498) benutzen dieselben.
 */
export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  name: "",
  region: "",
  company: "",
  short_bio: "",
  avatar_url: null,
  cover_url: null,
  branche: "",
  headline: "",
  roles: [],
  competencies: [],
  website: "",
  dev_focus: "",
  socials: { linkedin: "", instagram: "", xing: "" },
  interests: [],
  goals: [],
  videos: [],
  contact: {
    email: "",
    phone: "",
    street: "",
    postal_code: "",
    city: "",
    state: "",
    country: "",
  },
};

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
  const [profileRes, interestsRes, goalsRes, contactRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).single(),
    supabase.from("profile_interests").select("theme, label").eq("profile_id", uid).order("label"),
    supabase
      .from("goals")
      .select("category, title, progress")
      .eq("profile_id", uid)
      .order("category"),
    // `maybeSingle`: die meisten Profile haben (noch) gar keine Kontaktzeile —
    // sie entsteht bei der Registrierung nicht, sondern erst beim ersten
    // Speichern hier oder durch admin_update_profile.
    supabase
      .from("profile_contacts")
      .select("email, phone, street, postal_code, city, state, country")
      .eq("profile_id", uid)
      .maybeSingle(),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (interestsRes.error) throw interestsRes.error;
  if (goalsRes.error) throw goalsRes.error;
  if (contactRes.error) throw contactRes.error;

  const p = profileRes.data;
  const c = contactRes.data;
  return {
    name: p.name ?? "",
    region: p.region ?? "",
    company: p.company ?? "",
    short_bio: p.short_bio ?? "",
    avatar_url: p.avatar_url,
    cover_url: p.cover_url,
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
    videos: p.videos,
    contact: {
      email: c?.email ?? "",
      phone: c?.phone ?? "",
      street: c?.street ?? "",
      postal_code: c?.postal_code ?? "",
      city: c?.city ?? "",
      state: c?.state ?? "",
      country: c?.country ?? "",
    },
  };
}

/** Behält nur nicht-leere, einbettbare YouTube-/Vimeo-URLs (AGE-252). */
export function sanitizeVideos(videos: string[]): string[] {
  return videos.map((v) => v.trim()).filter((v) => v !== "" && parseVideoUrl(v) !== null);
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
 * Lädt ein zugeschnittenes Bild in seinen Bucket und gibt die öffentliche URL
 * zurück; ohne Blob bleibt der bisherige Wert stehen.
 *
 * Kein `upsert`: der Pfad trägt einen Zeitstempel, kollidiert also nie — und der
 * Upsert-Weg der Storage-API (INSERT … ON CONFLICT DO UPDATE) scheitert an der
 * bewusst fehlenden SELECT-Policy auf storage.objects (AGE-438).
 *
 * Der erste Pfadabschnitt MUSS die eigene uid sein: daran hängt die
 * Bucket-Policy, in beiden Buckets. Ein Admin kann darüber deshalb kein fremdes
 * Bild hochladen — die Bild-Steuerung ist im Fremd-Modus ausgeblendet.
 *
 * Ein ersetztes Bild wird nicht gelöscht: das alte Objekt bleibt über seine URL
 * abrufbar. Das ist beim Avatar seit AGE-238 so und hier bewusst gleich
 * gehalten — benannt, statt als Löschung versprochen.
 *
 * Exportiert seit AGE-538: die Willkommensstrecke lädt ihr Profilbild über
 * denselben Weg. Sie ist der EINZIGE Teil von `profile.ts`, den sie
 * wiederverwendet — geschrieben wird dort feldbezogen.
 */
export async function uploadBild(
  bucket: "avatars" | "covers",
  uid: string,
  blob: Blob | null,
  bisher: string | null,
): Promise<string | null> {
  if (!blob) return bisher;
  const path = `${uid}/${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: "image/webp" });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Speichert das Profil: optionale Bild-Uploads, Profilzeile aktualisieren,
 * Interessen und Ziele ersetzen. profile_completion setzt der DB-Trigger —
 * die zurückgegebene Zeile trägt den maßgeblichen Wert.
 */
export async function saveProfile(
  uid: string,
  values: ProfileFormValues,
  avatarBlob: Blob | null,
  coverBlob: Blob | null = null,
): Promise<{ avatarUrl: string | null; coverUrl: string | null; completion: number }> {
  const avatarUrl = await uploadBild("avatars", uid, avatarBlob, values.avatar_url);
  const coverUrl = await uploadBild("covers", uid, coverBlob, values.cover_url);

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
      videos: sanitizeVideos(values.videos),
      avatar_url: avatarUrl,
      cover_url: coverUrl,
    })
    .eq("id", uid)
    .select("profile_completion, avatar_url, cover_url")
    .single();
  if (updateError) throw updateError;

  // Die Kontaktzeile (AGE-537). Upsert, weil ein Mitglied meist noch keine hat:
  // die Zeile entsteht bei der Registrierung nicht. Bedingungslos, damit ein
  // Leeren auch wirklich leert — „alle Felder leer" wäre sonst von „nichts
  // eingetragen" nicht zu unterscheiden. Für ein Profil ohne Kontaktdaten
  // entsteht dabei eine Zeile aus lauter NULL; sie behauptet nichts, und die
  // Anzeige lässt leere Werte ohnehin weg.
  const { error: contactError } = await supabase.from("profile_contacts").upsert({
    profile_id: uid,
    email: emptyToNull(values.contact.email),
    phone: emptyToNull(values.contact.phone),
    street: emptyToNull(values.contact.street),
    postal_code: emptyToNull(values.contact.postal_code),
    city: emptyToNull(values.contact.city),
    state: emptyToNull(values.contact.state),
    country: emptyToNull(values.contact.country),
  });
  if (contactError) throw contactError;

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

  // Matches nach dem Profil-Speichern neu berechnen (AGE-245) — Region/Branche/
  // Interessen/Kompetenzen/Tier speisen den Score. Best-effort wie oben.
  try {
    await recomputeMyMatches();
  } catch (e) {
    console.error("recompute_my_matches after save failed:", e instanceof Error ? e.message : e);
  }

  return {
    avatarUrl: updated.avatar_url,
    coverUrl: updated.cover_url,
    completion: updated.profile_completion,
  };
}
