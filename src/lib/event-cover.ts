import { captureException } from "@sentry/react";

import { supabase } from "./supabase";
import { SIGNATUR_GUELTIGKEIT_SEK, SIGNATUR_STALE_MS } from "./post-media";

/**
 * Titelbilder von Events (AGE-531) — hochladen und signieren.
 *
 * Der Bucket `event-covers` ist PRIVAT, aus demselben Grund wie `post-media`:
 * das Titelbild eines `members`-Events darf ohne Session nicht abrufbar sein,
 * und ein öffentlicher Bucket mit schwer erratbaren Pfaden ist Verschleierung,
 * keine Zugriffskontrolle. Ein `<img>` setzt keinen Authorization-Header, also
 * führt der einzige Weg aus dem Bucket auf die Seite über eine signierte URL.
 *
 * Die Sichtbarkeitsregel steht in genau einer SELECT-Policy auf
 * `storage.objects` und nirgends hier — dieser Code entscheidet nichts über
 * Sichtbarkeit, er fragt nur.
 *
 * Gültigkeit und Cache-Fenster werden aus `post-media` ÜBERNOMMEN, nicht neu
 * gewählt: die Zahl ist zugleich die Nachlaufzeit eines
 * Sichtbarkeitswechsels, und zwei verschiedene Werte im selben Produkt wären
 * zwei verschiedene Antworten auf dieselbe Frage.
 */

export const EVENT_COVER_BUCKET = "event-covers";
export { SIGNATUR_GUELTIGKEIT_SEK, SIGNATUR_STALE_MS };

/**
 * Query-Key am PRINCIPAL, nicht nur an den Pfaden: welche Cover sich signieren
 * lassen, hängt am Aufrufer (`event_cover_lesbar` wertet `auth.uid()` aus).
 * Ohne die uid im Schlüssel bekäme ein zweiter Betrachter die Antwort des
 * ersten — dieselbe Falle, die `eventsListKey` schon vermeidet.
 */
export const coverSignaturKey = (uid: string | null, pfade: string[]) =>
  ["event-covers", "sign", uid, [...pfade].sort().join("|")] as const;

/**
 * Signiert einen STAPEL Pfade in EINEM Aufruf. Eine Übersicht mit zwölf
 * Kacheln macht damit eine Anfrage, nicht zwölf.
 *
 * Ein Pfad, für den keine Signatur herauskommt, fehlt schlicht im Ergebnis —
 * die Kachel fällt dann auf den Platzhalter zurück. Das ist der Normalfall und
 * kein Fehler: ein Objekt, dessen Event der Betrachter nicht sehen darf, ist
 * genau deshalb nicht signierbar. Nur ein Fehlschlag des ganzen Aufrufs wirft.
 */
export async function signEventCovers(pfade: string[]): Promise<Record<string, string>> {
  if (pfade.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(EVENT_COVER_BUCKET)
    .createSignedUrls(pfade, SIGNATUR_GUELTIGKEIT_SEK);
  if (error) {
    captureException(error, { tags: { area: "event-cover.sign" } });
    throw error;
  }
  const urls: Record<string, string> = {};
  for (const eintrag of data ?? []) {
    if (eintrag.path && eintrag.signedUrl) urls[eintrag.path] = eintrag.signedUrl;
  }
  return urls;
}

/**
 * Lädt ein zugeschnittenes WebP in das eigene `{uid}/`-Präfix und gibt den PFAD
 * zurück, nicht eine URL. Der Pfad landet in `events.cover_path`, und sein
 * erstes Segment MUSS die eigene uid sein — das erzwingen die INSERT-Policy des
 * Buckets und zusätzlich `events_write_host` beim Schreiben der Spalte.
 */
export async function uploadEventCover(uid: string, datei: Blob): Promise<string> {
  const pfad = `${uid}/${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from(EVENT_COVER_BUCKET)
    // `upsert: false` ist hier keine Vorsichtsmaßnahme, sondern die einzige
    // Möglichkeit — gemessen am 2026-08-12 gegen den lokalen Stack:
    //
    //   upsert: true  → „new row violates row-level security policy"
    //   upsert: false → ok
    //
    // `upsert` wird zu `insert … on conflict do update`, und ON CONFLICT
    // verlangt Leserecht auf die betroffene Zeile. Lesen entscheidet in diesem
    // Bucket `event_cover_lesbar()`, und die verneint für ein Objekt, auf das
    // noch KEIN Event zeigt — was beim Hochladen immer der Fall ist, weil die
    // `events.cover_path`-Zeile erst danach entsteht. Ein Henne-Ei-Problem, das
    // sich nicht auflösen lässt und auch nicht muss: der Pfad trägt einen
    // Zeitstempel, kollidiert also ohnehin nie.
    .upload(pfad, datei, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  return pfad;
}
