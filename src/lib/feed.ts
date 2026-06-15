import { supabase } from "./supabase";

/**
 * Community-Feed (AGE-250) — Datenschicht. Spec: docs/community-events-spec.md §1.
 *
 * Der Client macht NUR, was die RLS (§7 der RLS-Policies) erlaubt:
 *  - `fetchFeed` liest `posts` (Sichtbarkeit erzwingt `posts_select_by_visibility`:
 *    anon nur 'public', eingeloggte zusätzlich 'members' und je nach Rang 'prime'/
 *    'legacy'). Autoren werden über die View `profiles_public` angereichert.
 *  - Like-/Kommentarzähler kommen aus der read-only RPC `post_engagement_counts`,
 *    weil `post_likes` bewusst owner-only lesbar ist (20260612090845) — ein echter
 *    Zähler ist sonst clientseitig nicht berechenbar. Die RPC liefert nur Zahlen.
 *  - `likedByMe` aus den eigenen `post_likes`-Zeilen (alles, was die owner-only
 *    SELECT-Policy zurückgibt).
 *  - Schreiben (`createPost`/`toggleLike`/`addComment`) über die `*_own`-Policies.
 *
 * Reine Helfer (Hashtag-/Body-Parsing, Video-Erkennung) sind in feed.test.ts getestet.
 */

export type PostVisibility = "public" | "members" | "prime" | "legacy";

export interface FeedAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  tier: string | null;
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
// Satzzeichen am URL-Ende gehören zum Satz, nicht zum Link.
const TRAILING_PUNCT = /[.,;:!?»"')\]]+$/;

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

// ── Query-Keys & Optionen ───────────────────────────────────────────────────

export const feedQueryKey = (hashtag: string | null) => ["feed", "list", hashtag] as const;
export const commentsQueryKey = (postId: string) => ["feed", "comments", postId] as const;

/** Sichtbarkeitsstufen für den Composer (Default `members`). */
export const VISIBILITY_OPTIONS: { value: PostVisibility; label: string }[] = [
  { value: "members", label: "Mitglieder" },
  { value: "public", label: "Öffentlich" },
  { value: "prime", label: "Prime & Legacy" },
  { value: "legacy", label: "Nur Legacy" },
];

// ── Lesen ────────────────────────────────────────────────────────────────────

function authorOf(byId: Map<string, FeedAuthor>, id: string): FeedAuthor {
  return byId.get(id) ?? { id, name: "Mitglied", avatarUrl: null, tier: null };
}

/**
 * Autoren aus `profiles_public` (nur öffentliche Spalten, für authenticated lesbar).
 * Best-effort: hat der Aufrufer (anon) keinen Lesezugriff oder ist ein Autor nicht
 * öffentlich, bleibt es beim Fallback „Mitglied" — der Feed bricht dadurch nie ab.
 */
async function fetchAuthors(ids: string[]): Promise<Map<string, FeedAuthor>> {
  const byId = new Map<string, FeedAuthor>();
  if (ids.length === 0) return byId;
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

export interface FetchFeedArgs {
  /** Eigene Profil-ID (für `likedByMe`); null = ausgeloggt. */
  uid: string | null;
  /** Optionaler Hashtag-Filter (normalisiert, ohne #). */
  hashtag?: string | null;
}

/** Lädt den chronologischen Feed (neueste zuerst). Sichtbarkeit erzwingt die RLS. */
export async function fetchFeed({ uid, hashtag }: FetchFeedArgs): Promise<FeedPost[]> {
  let query = supabase
    .from("posts")
    .select("id, author_id, body, hashtags, visibility, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (hashtag) query = query.contains("hashtags", [hashtag]);

  const { data: posts, error } = await query;
  if (error) throw error;
  const rows = posts ?? [];
  if (rows.length === 0) return [];

  const postIds = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.author_id))];

  const [authors, countsRes] = await Promise.all([
    fetchAuthors(authorIds),
    supabase.rpc("post_engagement_counts", { p_post_ids: postIds }),
  ]);

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

  return rows.map((r) => ({
    id: r.id,
    author: authorOf(authors, r.author_id),
    body: r.body,
    hashtags: r.hashtags ?? [],
    visibility: r.visibility,
    createdAt: r.created_at,
    likeCount: counts.get(r.id)?.like_count ?? 0,
    commentCount: counts.get(r.id)?.comment_count ?? 0,
    likedByMe: myLikes.has(r.id),
  }));
}

/** Kommentare eines Beitrags, chronologisch (RLS: nur wenn der Post sichtbar ist). */
export async function fetchComments(postId: string): Promise<FeedComment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const authors = await fetchAuthors([...new Set(rows.map((r) => r.author_id))]);
  return rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    author: authorOf(authors, r.author_id),
    body: r.body,
    createdAt: r.created_at,
  }));
}

// ── Schreiben ─────────────────────────────────────────────────────────────────

/** Legt einen Beitrag an. Hashtags werden aus dem Body geparst und gespeichert. */
export async function createPost(input: {
  authorId: string;
  body: string;
  visibility: PostVisibility;
}): Promise<void> {
  const { error } = await supabase.from("posts").insert({
    author_id: input.authorId,
    body: input.body,
    visibility: input.visibility,
    hashtags: parseHashtags(input.body),
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
    const { error } = await supabase
      .from("post_likes")
      .insert({ post_id: input.postId, profile_id: input.profileId });
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
