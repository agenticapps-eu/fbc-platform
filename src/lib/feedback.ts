import { captureException } from "@sentry/react";

import { supabase } from "./supabase";
import type { Database } from "./database.types";
import { SIGNATUR_GUELTIGKEIT_SEK, SIGNATUR_STALE_MS } from "./post-media";

/**
 * Plattformweites QM-Feedback (AGE-300) — Spec §3.5 in
 * docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md.
 *
 * Schreibt über die `feedback_own`-Policy (20260612082726): ein Mitglied schreibt
 * nur unter der eigenen profile_id. Gelesen wird über die Admin-RPC
 * `admin_list_feedback` (AGE-358) — sie liefert nur einem `admin` Zeilen, samt
 * Autor-Name; die `feedback_admin_read`-Policy bleibt die Grenze für direkte Reads.
 *
 * `ref_type`/`ref_id` bleiben beim Schreiben bewusst ungesetzt. Sie kennzeichnen
 * AKTIONSGEBUNDENES Feedback (Event/Match/Kurs, AGE-234), und nur solches zählt auf
 * den Potenzial-Score (recompute_potential_score, s. 20260716070000_platform_feedback.sql).
 * Eine Meinung über die Plattform ist kein Signal über das Mitglied.
 */
export interface PlatformFeedbackInput {
  profileId: string;
  /** 1–5. Pflicht — ohne Sterne ist die Zeile aussagelos (Spec-Design §3). */
  rating: number;
  likes: string;
  misses: string;
  idea: string;
  /** Pfad, auf dem das Feedback entstand (z. B. `/meine-chancen`). */
  route: string;
  /**
   * Schlüssel aus `feedback_themes` (AGE-628). Weglassen heisst „Generell":
   * die Spalte trägt in der Datenbank einen dauerhaften Vorgabewert, und genau
   * daran hängt, dass eine ältere Oberfläche zwischen Migration und Deploy
   * weiter absenden kann.
   */
  theme?: string;
  /**
   * Pfad im Bucket `feedback-screenshots`, optional. Kommt aus
   * {@link uploadFeedbackScreenshot} und **muss** im eigenen `{uid}/`-Präfix
   * liegen — das erzwingt zusätzlich ein CHECK an der Spalte.
   */
  screenshotPath?: string | null;
}

export async function submitPlatformFeedback(input: PlatformFeedbackInput): Promise<void> {
  const { error } = await supabase.from("feedback").insert({
    profile_id: input.profileId,
    rating: input.rating,
    likes: input.likes,
    misses: input.misses,
    idea: input.idea,
    route: input.route,
    // Beides nur mitschicken, wenn es etwas zu sagen gibt: ein `theme:
    // undefined` im Objekt würde von PostgREST als Spalte mit `null`
    // übertragen und liefe gegen das `not null` — der Vorgabewert greift nur,
    // wenn die Spalte GAR NICHT genannt wird.
    ...(input.theme ? { theme: input.theme } : {}),
    ...(input.screenshotPath ? { screenshot_path: input.screenshotPath } : {}),
  });
  if (error) throw error;
}

/** Der Bucket, in dem die Screenshots liegen. Privat (AGE-628). */
export const FEEDBACK_SCREENSHOT_BUCKET = "feedback-screenshots";

/** Was der Bucket serverseitig annimmt — das Formular prüft dasselbe. */
export const FEEDBACK_SCREENSHOT_TYPEN = ["image/png", "image/jpeg", "image/webp"] as const;
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

const ENDUNG_JE_TYP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Lädt einen Screenshot in das eigene `{uid}/`-Präfix und gibt den PFAD zurück,
 * nicht eine URL.
 *
 * `upsert: false`, und das ist keine Vorsichtsmaßnahme: `upsert` wird zu
 * `insert … on conflict do update`, und ON CONFLICT verlangt Leserecht auf die
 * betroffene Zeile. In einem privaten Bucket scheitert das mit „new row
 * violates row-level security policy" — dieselbe Messung wie bei
 * `uploadEventCover` (2026-08-12). Der Pfad trägt einen Zeitstempel und
 * kollidiert ohnehin nie.
 *
 * Die Grenzen (Typ, Größe) stehen am BUCKET. Was hier passiert, ist Komfort:
 * ein früher, verständlicher Fehler statt einer Storage-Antwort.
 */
export async function uploadFeedbackScreenshot(uid: string, datei: File): Promise<string> {
  const endung = ENDUNG_JE_TYP[datei.type];
  if (!endung) throw new Error(`Nicht unterstütztes Bildformat: ${datei.type}`);
  if (datei.size > FEEDBACK_SCREENSHOT_MAX_BYTES) {
    throw new Error("Das Bild ist grösser als 5 MB.");
  }
  const pfad = `${uid}/${Date.now()}.${endung}`;
  const { error } = await supabase.storage
    .from(FEEDBACK_SCREENSHOT_BUCKET)
    .upload(pfad, datei, { contentType: datei.type, upsert: false });
  if (error) throw error;
  return pfad;
}

/**
 * Der Schlüssel trägt den PFAD, nicht die Zeile: dieselbe Signatur gilt für
 * jeden, der das Objekt sehen darf, und die Frage „darf ich" beantwortet
 * ohnehin die SELECT-Policy des Buckets.
 */
export const feedbackScreenshotKey = (pfad: string) =>
  ["feedback-screenshot", "sign", pfad] as const;

/**
 * Weitergereicht, nicht neu gewählt — wie `SIGNATUR_GUELTIGKEIT_SEK` unten.
 * Die beiden Zahlen hängen aneinander (`post-media.ts`): der Token steckt IN
 * der URL, also lädt der Browser bei jeder Neusignatur das Bild neu. Ohne
 * `staleTime` gilt die Vorgabe 0 plus `refetchOnWindowFocus` — jeder Wechsel
 * zurück auf die Admin-Fläche signierte dann jeden sichtbaren Screenshot neu
 * und lüde ihn erneut herunter.
 */
export { SIGNATUR_STALE_MS };

/**
 * Signiert EINEN Screenshot — erst beim Anzeigen, nicht beim Laden der Liste.
 *
 * Die Gültigkeit wird aus `post-media` ÜBERNOMMEN und nicht neu gewählt: sie
 * ist zugleich die Nachlaufzeit eines Sichtbarkeitswechsels, und zwei
 * verschiedene Werte im selben Produkt wären zwei verschiedene Antworten auf
 * dieselbe Frage.
 */
export async function signFeedbackScreenshot(pfad: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(FEEDBACK_SCREENSHOT_BUCKET)
    .createSignedUrl(pfad, SIGNATUR_GUELTIGKEIT_SEK);
  if (error) {
    captureException(error, { tags: { area: "feedback.sign" } });
    throw error;
  }
  return data.signedUrl;
}

/**
 * Nimmt den Screenshot von einer Feedback-Zeile — ZEILE UND OBJEKT, in dieser
 * Reihenfolge.
 *
 * Die RPC bekommt die Feedback-Kennung und **keinen Pfad**: ein Pfad vom
 * Aufrufer wäre ein _confused deputy_ über den ganzen Bucket. Sie leert den
 * Verweis und gibt den Pfad zurück; das Objekt entfernt danach dieser Aufruf
 * über die Storage-API, wofür der Admin die DELETE-Policy des Buckets trägt.
 *
 * Erst die Zeile, dann das Objekt — dieselbe Begründung wie in
 * `removePostMedia`: andersherum bliebe bei einem Abbruch dazwischen ein
 * Verweis auf ein Bild stehen, das es nicht mehr gibt. So herum ist der
 * schlimmste Ausgang ein verwaistes Objekt, das niemand sieht.
 */
export async function deleteFeedbackScreenshot(feedbackId: string): Promise<void> {
  const { data: pfad, error } = await supabase.rpc("admin_feedback_bild_loeschen", {
    p_feedback_id: feedbackId,
  });
  if (error) throw error;
  // `null` heisst „die Zeile trug kein Bild" und ist kein Fehler.
  if (!pfad) return;
  await supabase.storage.from(FEEDBACK_SCREENSHOT_BUCKET).remove([pfad]);
}

/**
 * Öffnet das Gespräch zwischen dem aufrufenden Admin und `zielProfilId` und
 * gibt dessen Kennung zurück — das **bestehende** oder ein neues.
 *
 * Der ganze Weg liegt im Server: Normalisierung des Paares, `on conflict`, die
 * Markierung. Ein von Hand über `message_threads` angelegtes Gespräch trüge
 * keine Marke und wäre eine Einbahnstrasse — der Admin schriebe darin, das
 * Gegenüber nicht.
 */
export async function oeffneAdminGespraech(zielProfilId: string): Promise<string> {
  const { data, error } = await supabase.rpc("admin_gespraech_oeffnen", {
    p_ziel: zielProfilId,
  });
  if (error) throw error;
  return data;
}

/** Ein Thema aus `feedback_themes` — Schlüssel, Beschriftung, Reihenfolge. */
export type FeedbackThema = Database["public"]["Tables"]["feedback_themes"]["Row"];

export const feedbackThemenQueryKey = ["feedback-themes"] as const;

/**
 * Die Themenliste kommt aus der DATENBANK und nicht aus einer Konstante hier.
 * Sonst stünde sie zweimal — einmal als Fremdschlüsselziel, einmal als
 * TypeScript-Liste — und nichts verglichen die beiden Abschriften.
 */
export async function fetchFeedbackThemen(): Promise<FeedbackThema[]> {
  const { data, error } = await supabase
    .from("feedback_themes")
    .select("key, label, sort")
    .order("sort", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Eine Zeile der Admin-Sicht (AGE-358) — Feedback samt aufgelöstem Autor-Namen. */
export type AdminFeedbackRow =
  Database["public"]["Functions"]["admin_list_feedback"]["Returns"][number];

export interface AdminFeedbackSeite {
  feedbacks: AdminFeedbackRow[];
  hatWeitere: boolean;
}

/**
 * Wie viele Feedback-Zeilen eine Seite zeigt — dieselbe Zahl wie die
 * Mitgliederliste, damit sich die zwei Verwaltungsflächen gleich anfühlen.
 */
export const FEEDBACK_SEITENGROESSE = 25;

/**
 * Der Filterzustand der Admin-Sicht (AGE-628). Zwei Facetten; innerhalb einer
 * wirken mehrere Marken als ODER, zwischen den beiden gilt UND.
 */
export interface FeedbackFilter {
  themen: string[];
  bewertungen: number[];
}

export const LEERER_FEEDBACK_FILTER: FeedbackFilter = { themen: [], bewertungen: [] };

/**
 * Der Schlüssel trägt die SEITE **und den Filter**.
 *
 * Ohne die Seite hielte React Query alle Seiten für dieselbe Abfrage und zeigte
 * auf Seite 2 den zwischengespeicherten Inhalt von Seite 1 (AGE-587, 4.2).
 * Ohne den Filter passiert dasselbe eine Ebene höher: ein Filterwechsel auf
 * derselben Seite lieferte veraltete Treffer.
 *
 * Die Marken werden SORTIERT eingesetzt. Der Schlüssel beschreibt eine
 * Auswahl, keine Reihenfolge — sonst wären „Fehler, Idee" und „Idee, Fehler"
 * zwei Abfragen mit garantiert gleichem Ergebnis.
 */
export const adminFeedbackQueryKey = (
  seite: number,
  filter: FeedbackFilter = LEERER_FEEDBACK_FILTER,
) =>
  [
    "admin-feedback",
    seite,
    [...filter.themen].sort().join("|"),
    [...filter.bewertungen].sort((a, b) => a - b).join("|"),
  ] as const;

/**
 * Eine Seite der Admin-Sicht auf alles QM-Feedback (AGE-358, Blätterung AGE-587).
 * Ruft die SECURITY-DEFINER-RPC `admin_list_feedback`, die nur einem `admin`
 * Zeilen liefert (für alle anderen leer) — die Rolle wird server-seitig in der
 * Funktion geprüft, nicht hier.
 *
 * Es wird EINE Zeile mehr angefordert als angezeigt, genau wie bei
 * `fetchAdminMembers`: die RPC liefert keine Gesamtzahl, und eine zweite,
 * zählende Abfrage wäre ein zweiter Weg an dieselben Daten — mit der
 * Möglichkeit, dass beide sich widersprechen.
 *
 * Wirft bei einem Fehler, statt eine leere Liste zu liefern. Eine leere Liste
 * heisst hier „kein Feedback" — und genauso sieht auch ein Nicht-Admin die
 * Fläche. Eine dritte, stumme Ursache für dieselbe Ansicht braucht es nicht.
 *
 * Die Filter gehen als `null` hinüber, wenn nichts gewählt ist — **niemals als
 * leeres Array**. `spalte = any('{}')` ist in PostgreSQL `false`, nicht `true`:
 * ein `[]` bedeutete „trifft nichts", und der Normalfall (kein Filter) lieferte
 * eine leere Liste. Die Umrechnung steht hier und nicht in der Oberfläche,
 * damit es nur eine Stelle gibt, an der sie falsch sein kann.
 *
 * @param seite Nullbasiert.
 */
export async function fetchAdminFeedback(
  seite: number,
  filter: FeedbackFilter = LEERER_FEEDBACK_FILTER,
): Promise<AdminFeedbackSeite> {
  const { data, error } = await supabase.rpc("admin_list_feedback", {
    p_limit: FEEDBACK_SEITENGROESSE + 1,
    p_offset: seite * FEEDBACK_SEITENGROESSE,
    p_themes: filter.themen.length > 0 ? filter.themen : null,
    p_ratings: filter.bewertungen.length > 0 ? filter.bewertungen : null,
  });
  if (error) throw error;

  const zeilen = data ?? [];
  return {
    feedbacks: zeilen.slice(0, FEEDBACK_SEITENGROESSE),
    hatWeitere: zeilen.length > FEEDBACK_SEITENGROESSE,
  };
}
