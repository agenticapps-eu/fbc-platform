import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { TierBadge } from "../ui/TierBadge";
import { VideoEmbed } from "../ui/VideoEmbed";
import { useToast } from "../ui/toast-context";
import { useAuth } from "../../providers/auth-context";
import {
  addComment,
  buildMentionResolver,
  commentsQueryKey,
  createPost,
  extractFirstVideo,
  feedListKey,
  feedQueryKey,
  fetchComments,
  fetchFeed,
  parseVideoUrl,
  toggleLike,
  tokenizePostBody,
  VISIBILITY_OPTIONS,
  type FeedPost,
  type MentionResolver,
  type PostSegment,
  type PostVisibility,
} from "../../lib/feed";

/**
 * Community-Feed (AGE-250). Composer + chronologische Beitragsliste im Schwarz-&-Gold-
 * Look. Sichtbarkeit entscheidet AUSSCHLIESSLICH die RLS (siehe lib/feed.ts) — anon
 * sieht nur `public`, eingeloggte zusätzlich `members`/rang-gegated. Der Composer ist
 * nur für eingeloggte Mitglieder sichtbar.
 */
export default function CommunityFeed() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [hashtag, setHashtag] = useState<string | null>(null);

  const feed = useQuery({
    queryKey: feedQueryKey(uid, hashtag),
    queryFn: () => fetchFeed({ uid, hashtag }),
  });

  // Erwähnungen (@name) werden gegen die im Feed bekannten Autoren aufgelöst — ein
  // Treffer wird zum Profil-Link, sonst bleibt es dezenter Gold-Text (kein Fake-Link).
  const mentionResolver = useMemo(
    () => buildMentionResolver((feed.data ?? []).map((p) => p.author)),
    [feed.data],
  );

  return (
    <section className="space-y-6">
      {user && <PostComposer authorId={user.id} />}

      {hashtag && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Gefiltert nach</span>
          <span className="inline-flex items-center rounded-full bg-gold-soft px-2.5 py-0.5 font-medium text-gold-strong">
            #{hashtag}
          </span>
          <button
            type="button"
            onClick={() => setHashtag(null)}
            className="text-gold-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Filter entfernen
          </button>
        </div>
      )}

      <FeedList
        query={feed}
        currentUserId={user?.id ?? null}
        activeHashtag={hashtag}
        onHashtag={setHashtag}
        mentionResolver={mentionResolver}
      />
    </section>
  );
}

// ── Composer ────────────────────────────────────────────────────────────────

function PostComposer({ authorId }: { authorId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("members");

  const videoValid = videoUrl.trim() === "" || parseVideoUrl(videoUrl) !== null;

  const create = useMutation({
    mutationFn: () => {
      // Video-URL (falls valide) wird an den Body gehängt — kein neues Schema; die
      // Karte erkennt und bettet sie ein.
      const trimmedVideo = videoUrl.trim();
      const fullBody = trimmedVideo ? `${body.trim()}\n${trimmedVideo}` : body.trim();
      return createPost({ authorId, body: fullBody, visibility });
    },
    onSuccess: () => {
      setBody("");
      setVideoUrl("");
      setVisibility("members");
      toast({ variant: "success", title: "Beitrag veröffentlicht" });
      // Präfix-Invalidierung: alle Feed-Ansichten dieses Betrachters (jeder
      // Hashtag-Filter), damit ein mehrfach getaggter Beitrag nirgends veraltet.
      queryClient.invalidateQueries({ queryKey: feedListKey(authorId) });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Beitrag fehlgeschlagen",
        description: errorMessage(error),
      });
    },
  });

  const canSubmit = body.trim() !== "" && videoValid && !create.isPending;

  return (
    <Card className="space-y-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Etwas mit der Community teilen … #Hashtag, @Erwähnung"
        aria-label="Neuer Beitrag"
      />

      <div>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Optional: YouTube-/Vimeo-Link"
          aria-label="Video-Link (optional)"
          aria-invalid={!videoValid || undefined}
          className={`h-10 w-full rounded-md border bg-canvas px-3 text-sm text-ink transition-colors placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-soft ${
            videoValid
              ? "border-line focus-visible:border-gold focus-visible:ring-gold"
              : "border-danger focus-visible:ring-danger"
          }`}
        />
        {!videoValid && (
          <p className="mt-1 text-xs text-danger">
            Nur YouTube- oder Vimeo-Links werden eingebettet.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="whitespace-nowrap">Sichtbar für</span>
          <Select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as PostVisibility)}
            className="h-9 w-auto"
            aria-label="Sichtbarkeit"
          >
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <Button size="sm" disabled={!canSubmit} onClick={() => create.mutate()}>
          {create.isPending ? "Wird veröffentlicht…" : "Beitrag teilen"}
        </Button>
      </div>
    </Card>
  );
}

// ── Liste ─────────────────────────────────────────────────────────────────────

function FeedList({
  query,
  currentUserId,
  activeHashtag,
  onHashtag,
  mentionResolver,
}: {
  query: ReturnType<typeof useQuery<FeedPost[]>>;
  currentUserId: string | null;
  activeHashtag: string | null;
  onHashtag: (tag: string | null) => void;
  mentionResolver: MentionResolver;
}) {
  if (query.isLoading) {
    return <p className="text-sm text-muted">Feed wird geladen…</p>;
  }
  if (query.isError) {
    return (
      <p className="text-sm text-danger">Der Feed konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }
  const posts = query.data ?? [];
  if (posts.length === 0) {
    return (
      <EmptyState
        title={activeHashtag ? "Keine Beiträge mit diesem Hashtag" : "Noch keine Beiträge"}
        description={
          activeHashtag
            ? "Für diesen Hashtag gibt es noch nichts zu sehen."
            : "Teile den ersten Beitrag — ruhig und mit Substanz. Qualität vor Reichweite."
        }
        action={
          activeHashtag ? (
            <Button variant="secondary" size="sm" onClick={() => onHashtag(null)}>
              Filter entfernen
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="space-y-5">
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard
            post={post}
            currentUserId={currentUserId}
            activeHashtag={activeHashtag}
            onHashtag={onHashtag}
            mentionResolver={mentionResolver}
          />
        </li>
      ))}
    </ul>
  );
}

// ── Beitrags-Karte ──────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  activeHashtag,
  onHashtag,
  mentionResolver,
}: {
  post: FeedPost;
  currentUserId: string | null;
  activeHashtag: string | null;
  onHashtag: (tag: string | null) => void;
  mentionResolver: MentionResolver;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);

  const segments = useMemo(() => tokenizePostBody(post.body), [post.body]);
  const video = useMemo(() => extractFirstVideo(post.body), [post.body]);

  const like = useMutation({
    mutationFn: () =>
      toggleLike({ postId: post.id, profileId: currentUserId as string, liked: post.likedByMe }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedListKey(currentUserId) });
    },
    onError: (error) => {
      toast({ variant: "error", title: "Aktion fehlgeschlagen", description: errorMessage(error) });
    },
  });

  return (
    <Card className="space-y-4">
      <header className="flex items-start gap-3">
        <Link to={`/p/${post.author.id}`} className="shrink-0">
          <Avatar
            name={post.author.name}
            src={post.author.avatarUrl}
            size="md"
            className="ring-1 ring-gold/40"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/p/${post.author.id}`}
              className="font-display text-base font-semibold text-ink hover:text-gold-strong"
            >
              {post.author.name}
            </Link>
            {post.author.tier && <TierBadge tier={post.author.tier} />}
          </div>
          <p className="text-xs text-muted">{timeAgo(post.createdAt)}</p>
        </div>
      </header>

      <PostBody
        segments={segments}
        skipRaw={video?.url}
        activeHashtag={activeHashtag}
        onHashtag={onHashtag}
        mentionResolver={mentionResolver}
      />

      {video && <VideoEmbed url={video.url} title={`Video von ${post.author.name}`} />}

      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.hashtags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onHashtag(tag)}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                activeHashtag === tag
                  ? "bg-gold text-night"
                  : "bg-gold-soft/60 text-gold-strong hover:bg-gold-soft"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <footer className="flex items-center gap-4 border-t border-line pt-3 text-sm">
        <button
          type="button"
          disabled={!currentUserId || like.isPending}
          onClick={() => like.mutate()}
          aria-pressed={post.likedByMe}
          className={`inline-flex items-center gap-1.5 rounded-md px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-60 ${
            post.likedByMe ? "text-gold-strong" : "text-muted hover:text-ink"
          }`}
        >
          <HeartIcon filled={post.likedByMe} />
          <span>{post.likeCount}</span>
          <span className="sr-only">Gefällt mir</span>
        </button>
        <button
          type="button"
          disabled={!currentUserId}
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className="inline-flex items-center gap-1.5 rounded-md px-1 text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CommentIcon />
          <span>{post.commentCount}</span>
          <span className="sr-only">Kommentare</span>
        </button>
      </footer>

      {showComments && <CommentThread postId={post.id} currentUserId={currentUserId} />}
    </Card>
  );
}

// ── Body-Rendering (Text/Hashtag/Erwähnung/URL) ───────────────────────────────

function PostBody({
  segments,
  skipRaw,
  activeHashtag,
  onHashtag,
  mentionResolver,
}: {
  segments: PostSegment[];
  skipRaw: string | undefined;
  activeHashtag: string | null;
  onHashtag: (tag: string | null) => void;
  mentionResolver: MentionResolver;
}) {
  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
      {segments.map((seg, i) => {
        if (seg.type === "url" && seg.raw === skipRaw) return null; // als Embed gezeigt
        if (seg.type === "hashtag") {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onHashtag(activeHashtag === seg.value ? null : seg.value)}
              className="font-medium text-gold-strong hover:underline"
            >
              {seg.raw}
            </button>
          );
        }
        if (seg.type === "mention") {
          const id = mentionResolver(seg.value);
          return id ? (
            <Link key={i} to={`/p/${id}`} className="font-medium text-gold-strong hover:underline">
              {seg.raw}
            </Link>
          ) : (
            <span key={i} className="font-medium text-gold-strong">
              {seg.raw}
            </span>
          );
        }
        if (seg.type === "url") {
          return (
            <a
              key={i}
              href={seg.value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-strong underline underline-offset-2"
            >
              {seg.raw}
            </a>
          );
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </p>
  );
}

// ── Kommentare ────────────────────────────────────────────────────────────────

function CommentThread({
  postId,
  currentUserId,
}: {
  postId: string;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [body, setBody] = useState("");

  const comments = useQuery({
    queryKey: commentsQueryKey(currentUserId, postId),
    queryFn: () => fetchComments(postId),
  });

  const add = useMutation({
    mutationFn: () => addComment({ postId, authorId: currentUserId as string, body: body.trim() }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(currentUserId, postId) });
      queryClient.invalidateQueries({ queryKey: feedListKey(currentUserId) });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Kommentar fehlgeschlagen",
        description: errorMessage(error),
      });
    },
  });

  return (
    <div className="space-y-3 border-t border-line pt-4">
      {comments.isLoading && <p className="text-sm text-muted">Kommentare werden geladen…</p>}
      {comments.isError && (
        <p className="text-sm text-danger">Kommentare konnten nicht geladen werden.</p>
      )}
      {comments.data?.map((c) => (
        <div key={c.id} className="flex items-start gap-2.5">
          <Link to={`/p/${c.author.id}`} className="shrink-0">
            <Avatar name={c.author.name} src={c.author.avatarUrl} size="sm" />
          </Link>
          <div className="min-w-0 flex-1 rounded-[var(--radius-card)] bg-soft px-3 py-2">
            <div className="flex items-baseline gap-2">
              <Link
                to={`/p/${c.author.id}`}
                className="text-sm font-semibold text-ink hover:text-gold-strong"
              >
                {c.author.name}
              </Link>
              <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap text-ink">{c.body}</p>
          </div>
        </div>
      ))}

      {comments.data?.length === 0 && (
        <p className="text-sm text-muted">Noch keine Kommentare. Sei der/die Erste.</p>
      )}

      {currentUserId && (
        <div className="flex items-end gap-2 pt-1">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            placeholder="Kommentieren…"
            aria-label="Neuer Kommentar"
            className="min-h-9"
          />
          <Button
            size="sm"
            disabled={body.trim() === "" || add.isPending}
            onClick={() => add.mutate()}
          >
            Senden
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Helfer ──────────────────────────────────────────────────────────────────

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

const rtf = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
const absFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Relative Zeit („vor 3 Minuten"), ab 7 Tagen absolutes Datum. */
function timeAgo(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diffSec / 86400), "day");
  return absFmt.format(new Date(iso));
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      aria-hidden="true"
    >
      <path
        d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5.5 5.5 5.5c1.8 0 3 .9 3.8 2 .8-1.1 2-2 3.8-2 3 0 4.5 3 3 6C19 15.65 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
