import { supabase } from "./supabase";
import { sanitizeVideos, type ProfileFormValues } from "./profile";
import type { Json } from "./database.types";

/**
 * Der Admin-Weg auf ein fremdes Profil (AGE-498, C6).
 *
 * ALLES hier geht über RPCs, nichts über einen direkten Tabellenzugriff — und
 * zwar aus zwei verschiedenen Gründen, die man leicht verwechselt:
 *
 *  * SCHREIBEN scheiterte am spaltenweisen UPDATE-Grant auf `profiles`, der VOR
 *    der Policy greift. Eine Admin-Policy allein bliebe wirkungslos.
 *  * LESEN scheiterte am Aktivierungs-Gate: `profiles_select_self_or_discover`
 *    und `profiles_public` verlangen beide, dass das ZIELPROFIL bestätigt ist.
 *    Ein importiertes, noch unbestätigtes Mitglied — genau das ausgesperrte —
 *    ist damit für niemanden sichtbar, auch nicht für einen Admin.
 *
 * Was hier NICHT liegt: Interessen, Ziele und Kompass-Kategorien. Deren Policies
 * stehen auf `profile_id = auth.uid()`, ein Admin prallt dort ab; der Editor
 * blendet diese Abschnitte im Fremd-Modus aus. Ebenso die Bild-Uploads: beide
 * Bucket-Policies prüfen die `auth.uid()` des AUFRUFERS.
 */

export interface AdminContact {
  email: string;
  phone: string;
}

export interface AdminLegacy {
  paid_until: string;
  legacy_tier: string;
  legacy_price: string;
  legacy_source_id: string;
}

export interface AdminProfileData {
  form: ProfileFormValues;
  contact: AdminContact;
  legacy: AdminLegacy;
  loginEmail: string;
  activated: boolean;
}

export interface AdminSearchHit {
  id: string;
  name: string | null;
  tier: string | null;
  login_email: string;
  bestaetigt: boolean;
}

export const adminProfileQueryKey = (id: string) => ["admin-profile", id] as const;

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Leere Eingabe heißt „nicht gesetzt", nicht „leerer Text". */
const leerZuNull = (s: string): string | null => (s.trim() === "" ? null : s.trim());

function socialString(socials: unknown, key: string): string {
  if (socials && typeof socials === "object" && !Array.isArray(socials)) {
    const value = (socials as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

/** Liest Profil-, Kontakt- und Altdaten über `admin_get_profile`. */
export async function fetchAdminProfile(id: string): Promise<AdminProfileData> {
  const { data, error } = await supabase.rpc("admin_get_profile", { target: id });
  if (error) throw error;

  const paket = (data ?? {}) as Record<string, unknown>;
  const p = (paket.profile ?? {}) as Record<string, unknown>;
  const c = (paket.contact ?? {}) as Record<string, unknown>;
  const l = (paket.legacy ?? {}) as Record<string, unknown>;

  return {
    form: {
      name: text(p.name),
      region: text(p.region),
      company: text(p.company),
      short_bio: text(p.short_bio),
      avatar_url: typeof p.avatar_url === "string" ? p.avatar_url : null,
      cover_url: typeof p.cover_url === "string" ? p.cover_url : null,
      branche: text(p.branche),
      headline: text(p.headline),
      roles: strArray(p.roles),
      competencies: strArray(p.competencies),
      website: text(p.website),
      dev_focus: text(p.dev_focus) as ProfileFormValues["dev_focus"],
      socials: {
        linkedin: socialString(p.socials, "linkedin"),
        instagram: socialString(p.socials, "instagram"),
        xing: socialString(p.socials, "xing"),
      },
      // Die Kind-Tabellen sind im Fremd-Modus nicht bearbeitbar; leer statt
      // halb gefüllt, damit ein Speichern sie nicht versehentlich leert.
      interests: [],
      goals: [],
      videos: strArray(p.videos),
    },
    contact: { email: text(c.email), phone: text(c.phone) },
    legacy: {
      paid_until: text(l.paid_until),
      legacy_tier: text(l.legacy_tier),
      legacy_price: l.legacy_price == null ? "" : String(l.legacy_price),
      legacy_source_id: text(l.legacy_source_id),
    },
    loginEmail: text(paket.login_email),
    activated: p.activated_at != null,
  };
}

/**
 * Schreibt über `admin_update_profile`.
 *
 * Die Umwandlung leerer Felder nach `null` ist nicht Kosmetik: die Funktion
 * castet `paid_until` nach `date` und `legacy_price` nach `numeric`. Ein `""`
 * ließe den Cast scheitern, und der Admin sähe einen Fehler für ein Feld, das
 * er nie angefasst hat.
 */
export async function saveAdminProfile(
  id: string,
  form: ProfileFormValues,
  contact: AdminContact,
  legacy: AdminLegacy,
): Promise<void> {
  // `Number("zwölfhundert")` ist NaN, und `JSON.stringify` macht daraus `null`.
  // Ein Tippfehler im Betragsfeld hätte den gezahlten Preis also STILL gelöscht,
  // statt zu scheitern — gefunden im Review auf dem Diff. Hier abfangen und
  // nicht erst in der Datenbank: die Funktion sähe ein sauberes `null` und
  // hätte keinen Grund abzubrechen.
  const preisText = leerZuNull(legacy.legacy_price);
  const preis = preisText === null ? null : Number(preisText.replace(",", "."));
  if (preis !== null && !Number.isFinite(preis)) {
    throw new Error(`„${legacy.legacy_price}" ist kein lesbarer Betrag.`);
  }

  const patch: Record<string, unknown> = {
    name: form.name.trim(),
    region: leerZuNull(form.region),
    company: leerZuNull(form.company),
    short_bio: leerZuNull(form.short_bio),
    branche: leerZuNull(form.branche),
    headline: leerZuNull(form.headline),
    website: leerZuNull(form.website),
    dev_focus: form.dev_focus === "" ? null : form.dev_focus,
    cover_url: form.cover_url,
    avatar_url: form.avatar_url,
    roles: form.roles,
    competencies: form.competencies,
    // Der Editor zeigt die Videos — ohne diese Zeile meldete das Speichern
    // Erfolg und verwarf die Änderung (Review auf dem Diff).
    videos: sanitizeVideos(form.videos),
    socials: Object.fromEntries(
      Object.entries(form.socials).filter(([, v]) => v.trim() !== ""),
    ),
    email: leerZuNull(contact.email),
    phone: leerZuNull(contact.phone),
    paid_until: leerZuNull(legacy.paid_until),
    legacy_tier: leerZuNull(legacy.legacy_tier),
    legacy_price: preis,
    legacy_source_id: leerZuNull(legacy.legacy_source_id),
  };

  // `patch` ist ein jsonb-Argument; der generierte Typ ist `Json`, und ein
  // Record<string, unknown> passt darauf nicht ohne Zusicherung. Die Werte sind
  // eine Zeile darüber alle JSON-fähig konstruiert.
  const { error } = await supabase.rpc("admin_update_profile", {
    target: id,
    patch: patch as Json,
  });
  if (error) throw error;
}

/** Sucht ein einzelnes Mitglied. Keine Liste — siehe `admin_find_profile`. */
export async function findProfiles(needle: string): Promise<AdminSearchHit[]> {
  const { data, error } = await supabase.rpc("admin_find_profile", { needle });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as unknown as AdminSearchHit[];
}

export type ChangeEmailResult =
  | { status: "ok" }
  | { status: "sessions_not_revoked" }
  /** Adresse geändert, aber ohne Eintrag in admin_audit — muss sichtbar sein. */
  | { status: "not_audited" };

/**
 * Ändert die LOGIN-Adresse. Über die Edge Function, nicht über die Datenbank:
 * `auth.users` gehört GoTrue, und dieselbe Adresse steht ein zweites Mal in
 * `auth.identities`.
 *
 * `sessions_not_revoked` ist KEIN Fehler: die Adresse ist dann geändert, nur die
 * Sitzungen leben weiter. Als Fehler gemeldet, wiederholte der Admin eine
 * Änderung, die längst gilt.
 */
export async function changeLoginEmail(target: string, email: string): Promise<ChangeEmailResult> {
  const { data, error } = await supabase.functions.invoke("admin-change-email", {
    body: { target, email },
  });
  if (error) throw error;
  return (data ?? { status: "ok" }) as ChangeEmailResult;
}
