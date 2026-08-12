import { captureException } from "@sentry/react";

import { type Json } from "./database.types";
import { type PostMediaEingabe } from "./post-media";
import { supabase } from "./supabase";

/**
 * Community-Feed (AGE-250) — Datenschicht. Spec: docs/community-events-spec.md §1.
 *
 * Der Client macht NUR, was die RLS (§7 der RLS-Policies) erlaubt:
 *  - `fetchFeed` liest `posts` (Sichtbarkeit erzwingt `posts_select_by_visibility`:
 *    anon nur 'public', 'members' ab Rang 4 `exchange`). Autoren werden über die
 *    View `profiles_public` angereichert.
 *  - Like-/Kommentarzähler kommen aus der read-only RPC `post_engagement_counts`,
 *    weil `post_likes` bewusst owner-only lesbar ist (20260612090845) — ein echter
 *    Zähler ist sonst clientseitig nicht berechenbar. Die RPC liefert nur Zahlen.
 *  - `likedByMe` aus den eigenen `post_likes`-Zeilen (alles, was die owner-only
 *    SELECT-Policy zurückgibt).
 *  - Schreiben: `toggleLike`/`addComment` über die `*_own`-Policies; ein Beitrag
 *    entsteht über die RPC `create_post_with_media`, damit er nie ohne seine
 *    Bilder im Feed steht (AGE-528). `posts_write_own` bleibt daneben bestehen.
 *
 * Reine Helfer (Hashtag-/Body-Parsing, Video-Erkennung) sind in feed.test.ts getestet.
 */

/** Spiegelt `posts_visibility_check` (20260715150000_six_level_model.sql:265). */
export type PostVisibility = "public" | "members";

export interface FeedAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  tier: string | null;
}

/** Ein Bild des Beitrags. Die Maße stehen hier, damit die Karte ihr Layout
 *  bestimmen kann, ohne die Datei zu laden (AGE-528). Der Pfad zeigt in den
 *  PRIVATEN Bucket — sichtbar wird er erst über `signPostMedia`. */
export interface FeedMedia {
  storagePath: string;
  sort: number;
  width: number;
  height: number;
}

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  body: string;
  hashtags: string[];
  visibility: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  media: FeedMedia[];
}

export interface FeedComment {
  id: string;
  postId: string;
  author: FeedAuthor;
  body: string;
  createdAt: string;
}

export interface PostSegment {
  type: "text" | "hashtag" | "mention" | "url";
  /** Hashtag/Mention ohne Präfix (Hashtag klein normalisiert); sonst der rohe Text. */
  value: string;
  /** Das exakt erkannte Stück (inkl. #/@), für die Anzeige. */
  raw: string;
}

// ── reine Helfer (getestet) ─────────────────────────────────────────────────

// Hashtag/Erwähnung nur am Wortanfang (Start oder nach Whitespace), damit
// "C#programming" oder eine E-Mail keine Fehltreffer erzeugen. URLs überall.
const TOKEN_RE = /(?<=^|\s)[#@][\p{L}\p{N}_]+|https?:\/\/[^\s]+/gu;
// Satzzeichen am URL-Ende gehören zum Satz, nicht zum Link. Klammern/eckige
// Klammern bewusst NICHT abtrennen — sie kommen in echten URLs vor (z. B.
// Wikipedia `/wiki/Foo_(bar)`); sie hier zu strippen würde solche Links zerreißen.
const TRAILING_PUNCT = /[.,;:!?»"']+$/;

function normalizeTag(tag: string): string {
  return tag.toLowerCase();
}

/** Zerlegt den Beitragstext in geordnete Segmente (Text/Hashtag/Erwähnung/URL). */
export function tokenizePostBody(body: string): PostSegment[] {
  const segments: PostSegment[] = [];
  const re = new RegExp(TOKEN_RE);
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    let matched = m[0];
    const start = m.index;

    // URL: nachgestellte Satzzeichen abtrennen (wandern zurück in den Text).
    let trailing = "";
    if (matched.startsWith("http")) {
      const t = TRAILING_PUNCT.exec(matched);
      if (t) {
        trailing = t[0];
        matched = matched.slice(0, -trailing.length);
      }
    }

    if (start > last) {
      const text = body.slice(last, start);
      segments.push({ type: "text", value: text, raw: text });
    }
    if (matched.startsWith("#")) {
      segments.push({ type: "hashtag", value: normalizeTag(matched.slice(1)), raw: matched });
    } else if (matched.startsWith("@")) {
      segments.push({ type: "mention", value: matched.slice(1), raw: matched });
    } else {
      segments.push({ type: "url", value: matched, raw: matched });
    }
    last = start + matched.length;
    if (trailing) {
      segments.push({ type: "text", value: trailing, raw: trailing });
      last += trailing.length;
    }
  }
  if (last < body.length) {
    const text = body.slice(last);
    segments.push({ type: "text", value: text, raw: text });
  }
  return segments;
}

/** Hashtags eines Beitrags: klein normalisiert, dedupliziert, Reihenfolge erhalten. */
export function parseHashtags(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of tokenizePostBody(body)) {
    if (seg.type === "hashtag" && !seen.has(seg.value)) {
      seen.add(seg.value);
      out.push(seg.value);
    }
  }
  return out;
}

function youtube(id: string) {
  return { provider: "youtube" as const, embedUrl: `https://www.youtube.com/embed/${id}` };
}

/**
 * Wandelt eine YouTube-/Vimeo-URL in eine sichere Embed-URL. Lässt NUR diese beiden
 * Anbieter und valide Video-IDs zu — alles andere (fremde Hosts, javascript:, kein
 * Link) ergibt `null`, damit nie ein beliebiges iframe eingebettet wird (AGE-252-Regel).
 */
export function parseVideoUrl(
  raw: string,
): { provider: "youtube" | "vimeo"; embedUrl: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      if (id && /^[\w-]+$/.test(id)) return youtube(id);
      return null;
    }
    const embed = url.pathname.match(/^\/embed\/([\w-]+)$/);
    return embed ? youtube(embed[1]) : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id && /^[\w-]+$/.test(id) ? youtube(id) : null;
  }
  if (host === "vimeo.com") {
    const m = url.pathname.match(/^\/(\d+)$/);
    return m ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}` } : null;
  }
  if (host === "player.vimeo.com") {
    const m = url.pathname.match(/^\/video\/(\d+)$/);
    return m ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}` } : null;
  }
  return null;
}

/**
 * Erste einbettbare Video-URL im Beitrag (für die Embed-Vorschau der Karte). Gibt
 * neben der Embed-URL auch die rohe Quell-URL zurück, damit die Karte sie im Text
 * ausblenden kann (kein doppelter Link + Embed).
 */
export function extractFirstVideo(
  body: string,
): { url: string; provider: "youtube" | "vimeo"; embedUrl: string } | null {
  for (const seg of tokenizePostBody(body)) {
    if (seg.type === "url") {
      const video = parseVideoUrl(seg.value);
      if (video) return { url: seg.raw, ...video };
    }
  }
  return null;
}

// ── Erwähnungen auflösen ──────────────────────────────────────────────────

export type MentionResolver = (handle: string) => string | null;

/** Name/Handle → reine Kleinbuchstaben+Ziffern (für @-Matching, umlautfest). */
function mentionSlug(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Baut einen Resolver, der eine Erwähnung (@handle) auf eine Profil-ID der
 * übergebenen Autoren abbildet — über den Slug des vollen Namens UND des
 * Vornamens. Best-effort (Spec: „optional auflösen"): leerer Slug wird ignoriert,
 * bei Vornamens-Kollisionen gewinnt der erste Autor; kein Treffer → null.
 */
export function buildMentionResolver(authors: FeedAuthor[]): MentionResolver {
  const byHandle = new Map<string, string>();
  for (const author of authors) {
    if (!author.name) continue;
    const full = mentionSlug(author.name);
    if (full && !byHandle.has(full)) byHandle.set(full, author.id);
    const first = mentionSlug(author.name.trim().split(/\s+/)[0] ?? "");
    if (first && !byHandle.has(first)) byHandle.set(first, author.id);
  }
  return (handle) => {
    const key = mentionSlug(handle);
    return key ? (byHandle.get(key) ?? null) : null;
  };
}

// ── Query-Keys & Optionen ───────────────────────────────────────────────────

/**
 * Query-Keys sind nach `uid` getrennt: Sichtbarkeit hängt am Principal (tier-
 * gegated über RLS), also darf der Cache eines Mitglieds NICHT an ein anderes
 * (z. B. nach Logout/Account-Wechsel) ausgespielt werden. Der `uid`-Präfix
 * trennt die Cache-Einträge je Betrachter sauber.
 */
export const feedListKey = (uid: string | null) => ["feed", "list", uid] as const;
export const feedQueryKey = (uid: string | null, hashtag: string | null) =>
  ["feed", "list", uid, hashtag] as const;

/**
 * Der seitenweise Feed braucht einen EIGENEN Schlüssel (AGE-528).
 *
 * `feedQueryKey` liegt bei Startseite und Mitglieder-Übersicht auf einem
 * `useQuery` und trägt dort `{posts, nextCursor}`. Der Feed selbst ist eine
 * `useInfiniteQuery` und trägt `{pages, pageParams}`. Unter demselben Schlüssel
 * ist ein Eintrag für den anderen unlesbar: `data.pages` wäre `undefined`,
 * `isLoading` aber false — der Feed malte den leeren Zustand über einen vollen
 * Feed, und die Startseite verlöre umgekehrt ihre Beiträge.
 *
 * Das Anhängsel steht am ENDE, damit `feedListKey` weiter als Präfix greift:
 * eine Invalidierung nach dem Veröffentlichen erreicht beide Formen.
 */
export const feedSeitenKey = (uid: string | null, hashtag: string | null) =>
  ["feed", "list", uid, hashtag, "seiten"] as const;
export const commentsQueryKey = (uid: string | null, postId: string) =>
  ["feed", "comments", uid, postId] as const;

/**
 * Sichtbarkeitsstufen für den Composer (Default `members`).
 *
 * Gestufte Beitrags-Sichtbarkeit gibt es im MVP nicht (AGE-311): die Stufung sitzt in
 * der RLS — `members` ist ab Rang 4 (`exchange`) lesbar —, nicht im Wert. Wer hier eine
 * Option ergänzt, ändert zuerst `posts_visibility_check`, sonst scheitert das Speichern.
 */
export const VISIBILITY_OPTIONS: { value: PostVisibility; label: string }[] = [
  { value: "members", label: "Mitglieder" },
  { value: "public", label: "Öffentlich" },
];

// ── Lesen ────────────────────────────────────────────────────────────────────

function authorOf(byId: Map<string, FeedAuthor>, id: string): FeedAuthor {
  return byId.get(id) ?? { id, name: "Mitglied", avatarUrl: null, tier: null };
}

/**
 * Autoren aus `profiles_public` (nur öffentliche Spalten, für authenticated lesbar).
 * Best-effort: ist ein Autor nicht öffentlich, bleibt es beim Fallback „Mitglied" —
 * der Feed bricht dadurch nie ab.
 *
 * OHNE Session wird gar nicht erst gefragt (AGE-530): `profiles_public` trägt für
 * `anon` bewusst kein Leserecht (AGE-239), die Abfrage käme also als `42501`
 * zurück. Das ist KEINE Sicherheitsgrenze — die bleibt das fehlende Recht, und die
 * Maskierung der Anzeige bleibt `displayAuthor`. Hier wird nur nichts gefragt, was
 * gesichert abgewiesen wird.
 */
async function fetchAuthors(uid: string | null, ids: string[]): Promise<Map<string, FeedAuthor>> {
  const byId = new Map<string, FeedAuthor>();
  if (!uid || ids.length === 0) return byId;
  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, name, avatar_url, tier")
    .in("id", ids);
  if (error) return byId;
  for (const p of data ?? []) {
    if (!p.id) continue; // profiles_public ist eine View → id ist nullable im Typ.
    byId.set(p.id, {
      id: p.id,
      name: p.name ?? "Mitglied",
      avatarUrl: p.avatar_url,
      tier: p.tier,
    });
  }
  return byId;
}

/** Seitengröße des Feeds. Eine feste Obergrenze ohne Nachladen wäre mit Bildern
 *  eine stille Kappung — ältere Beiträge wären unauffindbar (AGE-528). */
export const FEED_SEITE = 20;

/**
 * Der Cursor läuft über **(created_at, id)**, nicht über `created_at` allein.
 * Bei gleichen Zeitstempeln — beim Import der ~70 Konten der wahrscheinliche
 * Fall — überspränge eine reine Zeitgrenze den zweiten Beitrag still: er stünde
 * weder auf der einen noch auf der nächsten Seite.
 */
export interface FeedCursor {
  createdAt: string;
  id: string;
}

export interface FeedSeite {
  posts: FeedPost[];
  /** `null` heißt: es gibt nichts mehr nachzuladen. */
  nextCursor: FeedCursor | null;
}

export interface FetchFeedArgs {
  /** Eigene Profil-ID (für `likedByMe`); null = ausgeloggt. */
  uid: string | null;
  /** Optionaler Hashtag-Filter (normalisiert, ohne #). */
  hashtag?: string | null;
  /** Weiterlesen ab hier; fehlt er, beginnt die erste Seite. */
  cursor?: FeedCursor | null;
}

/** Lädt eine Feed-Seite (neueste zuerst). Sichtbarkeit erzwingt die RLS. */
export async function fetchFeed({ uid, hashtag, cursor }: FetchFeedArgs): Promise<FeedSeite> {
  let query = supabase
    .from("posts")
    .select("id, author_id, body, hashtags, visibility, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    // EINE Zeile mehr als die Seite trägt: die Spähzeile. Ohne sie ist „volle
    // Seite" das einzige Indiz dafür, dass es weitergeht — und bei genau 20
    // sichtbaren Beiträgen verspricht das eine nächste Seite, die garantiert
    // leer ist. Der Knopf holte sie, bevor er verschwände.
    .limit(FEED_SEITE + 1);
  if (hashtag) query = query.contains("hashtags", [hashtag]);
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},` +
        `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data: posts, error } = await query;
  if (error) throw error;
  const geholt = posts ?? [];
  // Die Spähzeile wird abgeschnitten: sie ist die Antwort auf „gibt es mehr?",
  // kein Teil der Seite.
  const gibtMehr = geholt.length > FEED_SEITE;
  const rows = gibtMehr ? geholt.slice(0, FEED_SEITE) : geholt;
  if (rows.length === 0) return { posts: [], nextCursor: null };

  const postIds = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.author_id))];

  const [authors, countsRes, mediaRes] = await Promise.all([
    fetchAuthors(uid, authorIds),
    supabase.rpc("post_engagement_counts", { p_post_ids: postIds }),
    supabase
      .from("post_media")
      .select("post_id, storage_path, sort, width, height")
      .in("post_id", postIds),
  ]);

  // Wie bei den Zählern: ein Fehler hier nimmt dem Feed die Bilder, nicht die
  // Beiträge — aber nicht still. Ein fehlender Grant soll sichtbar werden.
  if (mediaRes.error) captureException(mediaRes.error, { tags: { area: "feed.media" } });
  const media = new Map<string, FeedMedia[]>();
  for (const m of mediaRes.data ?? []) {
    const liste = media.get(m.post_id) ?? [];
    liste.push({ storagePath: m.storage_path, sort: m.sort, width: m.width, height: m.height });
    media.set(m.post_id, liste);
  }
  for (const liste of media.values()) liste.sort((a, b) => a.sort - b.sort);

  // Zähler-RPC ist nicht kritisch: schlägt sie fehl, zeigt der Feed 0/0 (statt zu
  // brechen) — aber NICHT still: an Sentry melden, damit ein kaputter Grant /
  // fehlende Migration sichtbar wird.
  if (countsRes.error) captureException(countsRes.error, { tags: { area: "feed.counts" } });
  const counts = new Map((countsRes.data ?? []).map((c) => [c.post_id, c]));

  let myLikes = new Set<string>();
  if (uid) {
    // owner-only SELECT (likes_write_own) → liefert nur meine eigenen Like-Zeilen.
    const { data, error: likesError } = await supabase
      .from("post_likes")
      .select("post_id")
      .in("post_id", postIds);
    if (likesError) throw likesError;
    myLikes = new Set((data ?? []).map((l) => l.post_id));
  }

  const letzte = rows[rows.length - 1];
  return {
    posts: rows.map((r) => ({
      id: r.id,
      author: authorOf(authors, r.author_id),
      body: r.body,
      hashtags: r.hashtags ?? [],
      visibility: r.visibility,
      createdAt: r.created_at,
      likeCount: counts.get(r.id)?.like_count ?? 0,
      commentCount: counts.get(r.id)?.comment_count ?? 0,
      likedByMe: myLikes.has(r.id),
      media: media.get(r.id) ?? [],
    })),
    // Nur wenn die Spähzeile kam, gibt es wirklich mehr. Sonst brächte der
    // Cursor eine leere Anfrage — und eine Schaltfläche, die nichts tut.
    nextCursor: gibtMehr ? { createdAt: letzte.created_at, id: letzte.id } : null,
  };
}

/** Kommentare eines Beitrags, chronologisch (RLS: nur wenn der Post sichtbar ist).
 *
 *  Ohne Session wird gar nicht gefragt (AGE-530): `comments` trägt sein select nur
 *  für `authenticated`. Aufklappen kann ein ausgeloggter Besucher den Thread zwar
 *  nicht — der Knopf ist `disabled` —, aber er kann sich abmelden, WÄHREND er offen
 *  ist. Dann bleibt der Thread montiert, der Query-Key wechselt auf `uid = null`,
 *  und ohne diese Zeile liefe genau dort die nächste verbotene Abfrage. */
export async function fetchComments(uid: string | null, postId: string): Promise<FeedComment[]> {
  if (!uid) return [];
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const authors = await fetchAuthors(uid, [...new Set(rows.map((r) => r.author_id))]);
  return rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    author: authorOf(authors, r.author_id),
    body: r.body,
    createdAt: r.created_at,
  }));
}

// ── Schreiben ─────────────────────────────────────────────────────────────────

/**
 * Legt Beitrag UND Bildzeilen in einer Transaktion an (AGE-528).
 *
 * Der naheliegende Ablauf — Beitrag anlegen, Bilder hochladen, Zeilen anlegen —
 * hat einen sichtbaren Fehlerzustand: bricht er nach dem ersten Schritt ab,
 * steht der Beitrag sofort im Feed, und zwar **ohne seine Bilder**. Ein
 * Erlebnisbericht ohne Fotos ist kein halber Beitrag, sondern ein falscher.
 * Deshalb wird die `id` im Client erzeugt, die Bilder wandern zuerst in den
 * Bucket, und diese eine RPC klammert die beiden Inserts.
 *
 * Die Tags gehen GETRENNT hinein: getippte (aus dem Text) und geklickte. Die
 * Vereinigung steht in der RPC — sie hier zusätzlich zu bauen wäre dieselbe
 * Regel an zwei Stellen.
 */
export async function createPostWithMedia(input: {
  postId: string;
  body: string;
  visibility: PostVisibility;
  tags: string[];
  media: PostMediaEingabe[];
}): Promise<void> {
  const { error } = await supabase.rpc("create_post_with_media", {
    p_post_id: input.postId,
    p_body: input.body,
    p_visibility: input.visibility,
    p_hashtags: parseHashtags(input.body),
    p_tags: input.tags,
    // `p_media` ist in Postgres `jsonb`, und der Typgenerator schreibt dafür
    // `Json` — eine Struktur mit festen Feldern passt da nicht ohne Weiteres
    // hinein. Die Form prüft die RPC beim Auspacken (`m->>'storage_path'` …),
    // hier ist nur die Typbrücke.
    p_media: input.media as unknown as Json,
  });
  if (error) throw error;
}

/** Like setzen/entfernen (Toggle). RLS: nur das eigene Profil, nur auf sichtbare Posts. */
export async function toggleLike(input: {
  postId: string;
  profileId: string;
  liked: boolean;
}): Promise<void> {
  if (input.liked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", input.postId)
      .eq("profile_id", input.profileId);
    if (error) throw error;
  } else {
    // Idempotent: ein Doppelklick (oder Klick vor dem Refetch) darf nicht am
    // (post_id, profile_id)-PK in einen 23505-Fehler laufen → ON CONFLICT DO NOTHING.
    const { error } = await supabase
      .from("post_likes")
      .upsert(
        { post_id: input.postId, profile_id: input.profileId },
        { onConflict: "post_id,profile_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }
}

/** Kommentar anlegen. RLS: nur als eigenes Profil und nur auf sichtbare Posts. */
export async function addComment(input: {
  postId: string;
  authorId: string;
  body: string;
}): Promise<void> {
  const { error } = await supabase
    .from("comments")
    .insert({ post_id: input.postId, author_id: input.authorId, body: input.body });
  if (error) throw error;
}
