/**
 * Bild-URLs für Profil- und Hintergrundbilder herstellen (AGE-580).
 *
 * `profiles.avatar_url` und `profiles.cover_url` trugen bis zu dieser Change
 * absolute URLs **mit der Supabase-Projektkennung darin** — 56 bzw. 53 Zeilen,
 * keine einzige relativ. Unter einer neuen Kennung zeigen sie alle ins Leere,
 * obwohl die Objekte mitgezogen wären. Das sieht kein Grant-Test und keine
 * Zeilenzählung; es fällt erst im Browser auf, als leeres Profilbild.
 *
 * Künftig steht der Pfad in der Spalte und die URL entsteht hier. Beide Buckets
 * sind öffentlich (`20260613081627`, `20260811090200`), deshalb braucht das
 * weder Signatur noch Netzwerkrunde — anders als bei `event-covers` und
 * `post-media`, die über `createSignedUrls` laufen. Diese Funktion ist rein.
 *
 * ── Warum absolute Werte durchgereicht werden ──────────────────────────────
 *
 * Das ist keine Vorsorge für einen Fall, der nicht eintreten kann, sondern für
 * drei, die heute eintreten:
 *
 *   1. Bestandszeilen, solange die Migration nicht gelaufen ist — und Zeilen,
 *      die eine ältere ausgelieferte Fassung danach zurückschreibt.
 *   2. Fremd gehostete Bilder. Der Demo-Seed schreibt `i.pravatar.cc`; das ist
 *      gar kein Supabase-Storage und bleibt ausdrücklich erlaubt.
 *   3. **Die Bildvorschau im Profil-Editor.** `ProfilPage` rendert
 *      `preview ?? values.avatar_url` und `coverPreview ?? values.cover_url`
 *      durch dieselbe Anzeigestelle. Die Vorschau ist eine `blob:`-URL aus
 *      `URL.createObjectURL`. Wer ihr den Bucket-Host voranstellt, zerlegt die
 *      Vorschau beim Hochladen — und **jsdom sieht das nie**, weil es kein Bild
 *      lädt. Der Fall gehört deshalb in den Test UND in die Sichtprobe.
 *
 * ── Warum am Schema erkannt und nicht an einer Liste ───────────────────────
 *
 * Ein früherer Entwurf zählte `https`, `blob` und `data` auf. Er übersah
 * `http:`, unter dem der **lokale Stack** läuft (`supabase/config.toml`, Port
 * 54321) — eine Whitelist hätte genau die lokalen Entwicklungswerte
 * beschädigt. Verworfen zugunsten der Frage, ob überhaupt ein URI-Schema da
 * ist. Ein Bucket-Pfad (`{uid}/{zeitstempel}.webp`) trägt keines.
 */
import { supabase } from "./supabase";

/** RFC-3986-Schema am Wertanfang: `http:`, `https:`, `blob:`, `data:`, … */
const HAT_SCHEMA = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Macht aus dem Spaltenwert die URL zum Anzeigen.
 *
 * @param bucket Der Bucket der Spalte — `avatar_url` liegt in `avatars`,
 *   `cover_url` in `covers`. Eine Verwechslung zeigte auf ein Objekt, das es
 *   nicht gibt, ohne dass eine Zählung etwas merkte.
 * @param wert Pfad innerhalb des Buckets, eine bereits absolute URL, oder null.
 */
export function bildUrl(bucket: "avatars" | "covers", wert: string | null): string | null {
  if (!wert) return null;
  if (HAT_SCHEMA.test(wert)) return wert;
  return supabase.storage.from(bucket).getPublicUrl(wert).data.publicUrl;
}
