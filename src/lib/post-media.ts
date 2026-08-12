import { captureException } from "@sentry/react";

import { supabase } from "./supabase";

/**
 * Bilder eines Beitrags (AGE-528) — hochladen und signieren.
 *
 * Der Bucket `post-media` ist PRIVAT. Ein `<img>` kann keinen
 * Authorization-Header setzen, also führt der einzige Weg aus dem Bucket in die
 * Karte über eine signierte URL (`design.md`, „Die Entscheidung"). Die
 * Sichtbarkeitsregel steht dabei in genau einer SELECT-Policy auf
 * `storage.objects` und nirgends hier — dieser Code entscheidet nichts über
 * Sichtbarkeit, er fragt nur.
 *
 * Hochgeladen wird BEIM VERÖFFENTLICHEN, nicht beim Auswählen: bricht es vor
 * der RPC ab, liegen Objekte im Bucket, die zu keiner `post_media`-Zeile
 * gehören und damit für niemanden signierbar sind — Speicherschuld, kein Leck.
 */

export const POST_MEDIA_BUCKET = "post-media";

/**
 * 1 h Gültigkeit, 50 min `staleTime`. Beide Zahlen hängen aneinander: der Token
 * steckt in der URL, also lädt der Browser bei jeder Neusignatur jedes Bild neu.
 * Die Gültigkeit ist zugleich die Nachlaufzeit eines Sichtbarkeitswechsels —
 * wer sie ändert, ändert die (`design.md`, „Signatur").
 */
export const SIGNATUR_GUELTIGKEIT_SEK = 3600;
export const SIGNATUR_STALE_MS = 50 * 60 * 1000;

/**
 * Wie viele Kacheln zeigt die Karte, und wie viele bleiben übrig?
 *
 * Rein, damit die Wahl prüfbar ist, ohne etwas zu rendern: ein Bild steht
 * allein, zwei stehen nebeneinander, ab drei wird es ein Raster mit höchstens
 * vier Kacheln — die vierte trägt dann „+n". Die Maße jedes Bildes stehen in
 * `post_media`, damit beim Laden nichts springt.
 */
export type BildLayout = {
  art: "einzeln" | "paar" | "raster";
  sichtbar: number;
  rest: number;
};

export function bildLayout(anzahl: number): BildLayout {
  if (anzahl <= 1) return { art: "einzeln", sichtbar: anzahl, rest: 0 };
  if (anzahl === 2) return { art: "paar", sichtbar: 2, rest: 0 };
  const sichtbar = Math.min(anzahl, 4);
  return { art: "raster", sichtbar, rest: anzahl - sichtbar };
}

/** Genau die Form, die `create_post_with_media(p_media jsonb)` erwartet. */
export interface PostMediaEingabe {
  storage_path: string;
  sort: number;
  width: number;
  height: number;
}

/** Signierte URLs hängen am Pfad, nicht am Beitrag — je Pfad ein Cache-Eintrag. */
export const signaturQueryKey = (pfade: string[]) =>
  ["post-media", "signiert", [...pfade].sort()] as const;

/**
 * Lädt die Bilder eines Beitrags hoch und gibt die Zeilen für die RPC zurück.
 * Der erste Pfadabschnitt MUSS die eigene Kennung sein — daran hängt die
 * INSERT-Policy des Buckets, nicht eine Namenskonvention.
 */
export async function uploadPostMedia(input: {
  uid: string;
  postId: string;
  bilder: { blob: Blob; width: number; height: number }[];
}): Promise<PostMediaEingabe[]> {
  const zeilen: PostMediaEingabe[] = [];
  for (const [i, bild] of input.bilder.entries()) {
    const path = `${input.uid}/${input.postId}/${i}-${Date.now()}.webp`;
    const { error } = await supabase.storage
      .from(POST_MEDIA_BUCKET)
      .upload(path, bild.blob, { contentType: "image/webp" });
    if (error) throw error;
    zeilen.push({ storage_path: path, sort: i, width: bild.width, height: bild.height });
  }
  return zeilen;
}

/**
 * Signierte URLs für alle Bilder einer Feed-Seite — EIN Aufruf, nicht einer je
 * Bild (`createSignedUrls` ist eine Batch-API).
 *
 * Zwei Fehlerfälle, die absichtlich verschieden behandelt werden:
 *
 *  - **Ein einzelner Pfad wird abgelehnt.** Der Storage antwortet „Object not
 *    found", auch wenn er „nicht erlaubt" meint — er unterscheidet die beiden
 *    nach außen nicht (keine Aufzählbarkeit, gemessen in `EVIDENCE.md`). Für
 *    ein Bild, das den Betrachter nichts angeht, ist das der Normalfall: es
 *    fehlt seine Kachel, der Beitrag bleibt. **Nicht an Sentry** — das wäre
 *    Rauschen.
 *  - **Der ganze Aufruf scheitert.** Dann ist etwas kaputt (Grant, Bucket,
 *    Netz). Der Feed zeigt die Beiträge ohne Bilder statt gar nicht, meldet es
 *    aber — dasselbe Muster wie die Zähler-RPC in `feed.ts`.
 */
export async function signPostMedia(pfade: string[]): Promise<Record<string, string>> {
  if (pfade.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUrls(pfade, SIGNATUR_GUELTIGKEIT_SEK);
  if (error) {
    captureException(error, { tags: { area: "post-media.sign" } });
    return {};
  }
  const urls: Record<string, string> = {};
  for (const eintrag of data ?? []) {
    if (eintrag.path && eintrag.signedUrl) urls[eintrag.path] = eintrag.signedUrl;
  }
  return urls;
}
