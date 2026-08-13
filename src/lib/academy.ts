import { supabase } from "./supabase";
import { FEED_SEITE, fetchAuthors, type FeedCursor, type FeedPost } from "./feed";

/**
 * Academy-lite (AGE-533, C9) — das eine Stück, das der Feed nicht schon kann.
 *
 * Die beiden anderen Ansichten laufen über `fetchFeed`:
 *   „Alle"          → fetchFeed({ nurVideos: true })
 *   „selbst geteilt" → fetchFeed({ nurVideos: true, autorId: uid })
 *
 * Hier steht nur das Regal der eigenen „gefällt mir"-Liste, weil es die einzige
 * Ansicht ist, die NICHT über `posts` einsteigt: sie geht über die eigenen
 * `post_likes` und sortiert nach dem Zeitpunkt des Likes.
 *
 * ── Warum das Regal so heißt, wie es heißt ────────────────────────────────
 * Es ist die eigene „gefällt mir"-Liste, kein Merkzettel. Ein Like ist hier
 * NICHT privat: `post_engagement_counts` gibt den Zähler an jeden aus, der den
 * Beitrag sehen darf. Wer etwas markiert, erhöht also eine sichtbare Zahl;
 * verborgen bleibt nur, WER es war (owner-only SELECT auf `post_likes`). Eine
 * Beschriftung „Gemerkt" verspräche Privatheit, die es nicht gibt.
 *
 * ── Ein gemerktes Video kann verschwinden ─────────────────────────────────
 * Sinkt die Stufe des Betrachters unter Rang 4, oder wechselt der Autor seinen
 * Beitrag auf `members`, liefert die RLS die Beitragszeile nicht mehr — die
 * Like-Zeile bleibt liegen und zeigt ins Leere. Solche Einträge entfallen
 * lautlos: ein Like ist eine Markierung, kein Zugriffsrecht.
 */

export interface AcademySeite {
  posts: FeedPost[];
  /** `null` heißt: es gibt nichts mehr nachzuladen. */
  nextCursor: FeedCursor | null;
}

export const gelikteVideosKey = (uid: string | null) => ["academy", "geliked", uid] as const;

/** Die Spalten des eingebetteten Beitrags — dieselben wie im Feed. */
const POST_SPALTEN = "id, author_id, body, hashtags, visibility, created_at, video_url";

interface LikeZeile {
  post_id: string;
  created_at: string;
  posts: {
    id: string;
    author_id: string;
    body: string;
    hashtags: string[] | null;
    visibility: string;
    created_at: string;
    video_url: string | null;
  } | null;
}

export interface FetchGelikteArgs {
  /** Eigene Profil-ID; null = ausgeloggt. */
  uid: string | null;
  /** Weiterlesen ab hier — Cursor über (Like-Zeitpunkt, post_id). */
  cursor?: FeedCursor | null;
}

/**
 * Die eigenen mit „gefällt mir" markierten Videos, zuletzt markierte zuerst.
 *
 * Ohne Session wird gar nicht erst gefragt (wie in `fetchFeed`, AGE-530):
 * `post_likes` trägt für `anon` kein Leserecht, die Abfrage käme als `42501`
 * zurück. Das ist KEINE Sicherheitsgrenze — die bleibt das fehlende Recht.
 */
export async function fetchGelikteVideos({
  uid,
  cursor,
}: FetchGelikteArgs): Promise<AcademySeite> {
  if (!uid) return { posts: [], nextCursor: null };

  let query = supabase
    .from("post_likes")
    // `!inner`: eine Like-Zeile ohne lesbaren Beitrag fällt schon in der
    // Datenbank heraus. Nachträglich im Client zu filtern ergäbe kürzere
    // Seiten als angefordert — und „Mehr laden" liefe irgendwann durch den
    // ganzen Bestand, um eine Seite zu füllen.
    .select(`post_id, created_at, posts!inner(${POST_SPALTEN})`)
    .order("created_at", { ascending: false })
    .order("post_id", { ascending: false })
    // Der Filter sitzt am EINGEBETTETEN Beitrag, nicht an der Like-Zeile.
    .not("posts.video_url", "is", null)
    // Die Spähzeile, wie im Feed: sie beantwortet „gibt es mehr?".
    .limit(FEED_SEITE + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},` +
        `and(created_at.eq.${cursor.createdAt},post_id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  // Der Typgenerator kennt die Form einer eingebetteten Auswahl
  // (`posts!inner(…)`) nicht — er liefert für `posts` je nach Version ein
  // Array oder ein Objekt. `LikeZeile` schreibt die Form auf, die PostgREST bei
  // einer n:1-Beziehung tatsächlich zurückgibt. Das ist die Typbrücke, nicht
  // eine Behauptung über die Daten; die Form prüft der Rumpf unten.
  const geholt = (data ?? []) as unknown as LikeZeile[];
  const gibtMehr = geholt.length > FEED_SEITE;
  const rows = gibtMehr ? geholt.slice(0, FEED_SEITE) : geholt;
  if (rows.length === 0) return { posts: [], nextCursor: null };

  // Ein `!inner`-Join sollte keine Zeile ohne Beitrag liefern. Die Prüfung
  // steht trotzdem hier, weil der Typ ihn als nullable führt und ein
  // durchgereichtes `null` die Karte zerlegen würde — nicht als Fehlerbehandlung
  // für einen unmöglichen Fall, sondern als Typ-Grenze.
  // Autoren wie im Feed über `profiles_public` anreichern. Ohne das trüge jede
  // Karte in DIESEM Regal „Mitglied", während das Regal daneben echte Namen
  // zeigt — derselbe Reiter, zwei Auskünfte über dieselben Leute.
  const sichtbar = rows.map((z) => z.posts).filter((p): p is NonNullable<typeof p> => p !== null);
  const autoren = await fetchAuthors(uid, [...new Set(sichtbar.map((p) => p.author_id))]);

  const posts: FeedPost[] = [];
  for (const zeile of rows) {
    const p = zeile.posts;
    if (!p) continue;
    posts.push({
      id: p.id,
      author: autoren.get(p.author_id) ?? {
        id: p.author_id,
        name: "Mitglied",
        avatarUrl: null,
        tier: null,
      },
      body: p.body,
      hashtags: p.hashtags ?? [],
      visibility: p.visibility,
      createdAt: p.created_at,
      likeCount: 0,
      commentCount: 0,
      // Es ist die eigene Like-Liste — jede Zeile hier ist geliked.
      likedByMe: true,
      media: [],
      videoUrl: p.video_url,
    });
  }

  const letzte = rows[rows.length - 1];
  return {
    posts,
    // Der Cursor läuft über den LIKE-Zeitpunkt, nicht über den des Beitrags:
    // danach ist auch sortiert.
    nextCursor: gibtMehr ? { createdAt: letzte.created_at, id: letzte.post_id } : null,
  };
}
