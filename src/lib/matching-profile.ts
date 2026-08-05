import { z } from "zod";
import {
  NEED_CATEGORIES,
  OFFER_CATEGORIES,
  VOLUME_BANDS,
  type VolumeBand,
} from "../config/matching";
import { recomputeMyMatches } from "./matches";
import { supabase } from "./supabase";

/**
 * Such-/Bieteprofil-Editor (AGE-244) — Datenschicht: zod-Schema, Laden und
 * Speichern der eigenen offers/needs gegen das bestehende Schema (kein neues).
 * Kategorien/Themen/Volumen kommen zentral aus config/matching.ts.
 *
 * Gespeichert wird nach dem „Replace-Collection"-Muster (wie compass.ts &
 * profile.ts): die eigenen Zeilen werden ersetzt — idempotent und einfach. RLS
 * (offers_write_own / needs_write_own) erzwingt profile_id = auth.uid().
 */

const themeEnum = z.enum(["sein", "tun", "haben", "wirken"]);

const offerKeySet = new Set(OFFER_CATEGORIES.map((c) => c.key));
const needKeySet = new Set(NEED_CATEGORIES.map((c) => c.key));
const bandSet = new Set<string>(VOLUME_BANDS.map((b) => b.value));

const baseItem = {
  theme: z.union([z.literal(""), themeEnum]),
  title: z.string().trim().min(1, "Titel ist erforderlich."),
  description: z.string().trim(),
  tags: z.array(z.string().trim().min(1)),
  // AGE-494: Die Herkunft muss den Replace-Durchlauf ÜBERLEBEN. Ohne sie fiele
  // jede chip-erzeugte Zeile beim Speichern hier auf den Default 'editor' zurück,
  // und das spätere Abwählen des Chips verlangte plötzlich eine Rückfrage für
  // etwas, das nie von Hand geschrieben wurde.
  // Kein `.default()`: das machte zod-Ein- und Ausgabetyp verschieden und bräche
  // die Typisierung des react-hook-form-Resolvers. Der Wert wird ohnehin an jeder
  // Stelle gesetzt (Laden aus der DB, EMPTY_OFFER/EMPTY_NEED).
  source: z.union([z.literal("editor"), z.literal("chip")]),
};

const offerSchema = z.object({
  category: z.string().refine((v) => offerKeySet.has(v), "Bitte eine Kategorie wählen."),
  ...baseItem,
});

const needSchema = z.object({
  category: z.string().refine((v) => needKeySet.has(v), "Bitte eine Kategorie wählen."),
  ...baseItem,
  // AGE-494: Ein FEHLENDES Volumenband heißt „noch nicht angegeben", nicht
  // „ungültig". Chips und der geführte Kompass legen Zeilen ohne Band an — ein
  // Pflichtfeld hier machte jede solche Zeile im reichen Editor unspeicherbar und
  // ließe eine Oberfläche die Ausgabe der anderen blockieren. Ein gesetzter Wert
  // muss weiterhin aus der bekannten Liste kommen.
  tx_volume_band: z
    .string()
    .refine((v) => v === "" || bandSet.has(v), "Bitte ein gültiges Volumen wählen."),
});

export const matchingProfileSchema = z.object({
  offers: z.array(offerSchema),
  needs: z.array(needSchema),
});

export type OfferValues = z.infer<typeof offerSchema>;
export type NeedValues = z.infer<typeof needSchema>;
export type MatchingProfileValues = z.infer<typeof matchingProfileSchema>;

// ── Defaults für neue Einträge ────────────────────────────────────────────────
export const EMPTY_OFFER: OfferValues = {
  category: "",
  theme: "",
  title: "",
  description: "",
  tags: [],
  source: "editor",
};

export const EMPTY_NEED: NeedValues = {
  category: "",
  theme: "",
  title: "",
  description: "",
  tags: [],
  tx_volume_band: "10k_100k",
  source: "editor",
};

// ── Laden ────────────────────────────────────────────────────────────────────
export const matchingProfileQueryKey = (uid: string) => ["matching-profile", uid] as const;

export async function fetchMatchingProfile(uid: string): Promise<MatchingProfileValues> {
  const [offersRes, needsRes] = await Promise.all([
    supabase
      .from("offers")
      .select("category, theme, title, description, tags, source")
      .eq("profile_id", uid)
      .order("created_at"),
    supabase
      .from("needs")
      .select("category, theme, title, description, tags, tx_volume_band, source")
      .eq("profile_id", uid)
      .order("created_at"),
  ]);
  if (offersRes.error) throw offersRes.error;
  if (needsRes.error) throw needsRes.error;

  return {
    offers: (offersRes.data ?? []).map((o) => ({
      category: o.category ?? "",
      theme: (o.theme as OfferValues["theme"]) ?? "",
      title: o.title,
      description: o.description ?? "",
      tags: o.tags ?? [],
      source: (o.source as OfferValues["source"]) ?? "editor",
    })),
    needs: (needsRes.data ?? []).map((n) => ({
      category: n.category ?? "",
      theme: (n.theme as NeedValues["theme"]) ?? "",
      title: n.title,
      description: n.description ?? "",
      tags: n.tags ?? [],
      tx_volume_band: (n.tx_volume_band as VolumeBand) ?? "",
      source: (n.source as NeedValues["source"]) ?? "editor",
    })),
  };
}

// ── Speichern ────────────────────────────────────────────────────────────────
const emptyToNull = (s: string) => (s.trim() === "" ? null : s.trim());
const tagsOrNull = (tags: string[]) => (tags.length > 0 ? tags : null);

/**
 * Ersetzt die eigenen offers/needs durch die übergebenen Werte. Die Lösch-/
 * Einfüge-Schritte sind separate Calls (keine eine Transaktion): schlägt ein
 * Insert nach dem Delete fehl, bleibt die Sammlung leer, bis erneut gespeichert
 * wird. Für Phase 1 ausreichend (vgl. compass.ts).
 */
export async function saveMatchingProfile(
  uid: string,
  values: MatchingProfileValues,
): Promise<void> {
  for (const table of ["offers", "needs"] as const) {
    const { error } = await supabase.from(table).delete().eq("profile_id", uid);
    if (error) throw error;
  }

  if (values.offers.length > 0) {
    const { error } = await supabase.from("offers").insert(
      values.offers.map((o) => ({
        profile_id: uid,
        category: o.category,
        theme: o.theme === "" ? null : o.theme,
        title: o.title.trim(),
        description: emptyToNull(o.description),
        tags: tagsOrNull(o.tags),
        source: o.source,
      })),
    );
    if (error) throw error;
  }

  if (values.needs.length > 0) {
    const { error } = await supabase.from("needs").insert(
      values.needs.map((n) => ({
        profile_id: uid,
        category: n.category,
        theme: n.theme === "" ? null : n.theme,
        title: n.title.trim(),
        description: emptyToNull(n.description),
        tags: tagsOrNull(n.tags),
        tx_volume_band: n.tx_volume_band === "" ? null : n.tx_volume_band,
        source: n.source,
      })),
    );
    if (error) throw error;
  }

  // Matches nach dem Speichern neu berechnen (AGE-245). Best-effort: offers/needs
  // sind bereits persistiert; ein Fehler holt die Neuberechnung beim nächsten
  // Trigger (Button im Matching-Hub) nach — daher kein throw, aber sichtbares Log.
  try {
    await recomputeMyMatches();
  } catch (e) {
    console.error(
      "recompute_my_matches after saving offers/needs failed:",
      e instanceof Error ? e.message : e,
    );
  }
}
