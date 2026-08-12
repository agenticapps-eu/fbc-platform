import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Stagger, StaggerItem } from "../ui/Motion";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { TierBadge } from "../ui/TierBadge";
import { VideoEmbed } from "../ui/VideoEmbed";
import { useOverlay } from "../ui/useOverlay";
import { useToast } from "../ui/toast-context";
import { useAuth } from "../../providers/auth-context";
import { displayAuthor } from "../../lib/displayAuthor";
import { shrinkToWebp } from "../../lib/image";
import {
  bildLayout,
  signaturQueryKey,
  signPostMedia,
  SIGNATUR_STALE_MS,
  uploadPostMedia,
} from "../../lib/post-media";
import { fetchAktiveTags, istKuratiert, tagsQueryKey, type Tag } from "../../lib/tags";
import {
  addComment,
  buildMentionResolver,
  commentsQueryKey,
  createPostWithMedia,
  extractFirstVideo,
  feedListKey,
  feedSeitenKey,
  fetchComments,
  fetchFeed,
  parseVideoUrl,
  toggleLike,
  tokenizePostBody,
  VISIBILITY_OPTIONS,
  type FeedCursor,
  type FeedMedia,
  type FeedPost,
  type MentionResolver,
  type PostSegment,
  type PostVisibility,
} from "../../lib/feed";

/**
 * Community-Feed (AGE-250). Composer + chronologische Beitragsliste im
 * Look. Sichtbarkeit entscheidet AUSSCHLIESSLICH die RLS (siehe lib/feed.ts) — anon
 * sieht nur `public`, eingeloggte zusätzlich `members`/rang-gegated. Der Composer ist
 * nur für eingeloggte Mitglieder sichtbar.
 */
export default function CommunityFeed() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [hashtag, setHashtag] = useState<string | null>(null);

  // Seitenweise (AGE-528): eine feste Obergrenze ohne Nachladen wäre mit Bildern
  // eine stille Kappung — ältere Beiträge blieben unauffindbar. Der Cursor läuft
  // über (created_at, id), siehe lib/feed.ts.
  const feed = useInfiniteQuery({
    queryKey: feedSeitenKey(uid, hashtag),
    queryFn: ({ pageParam }) => fetchFeed({ uid, hashtag, cursor: pageParam }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (letzteSeite) => letzteSeite.nextCursor,
  });
  const posts = useMemo(
    () => (feed.data?.pages ?? []).flatMap((seite) => seite.posts),
    [feed.data],
  );

  // Erwähnungen (@name) werden gegen die im Feed bekannten Autoren aufgelöst — ein
  // Treffer wird zum Profil-Link, sonst bleibt es dezenter Akzent-Text (kein Fake-Link).
  const mentionResolver = useMemo(() => buildMentionResolver(posts.map((p) => p.author)), [posts]);

  // Signaturen JE SEITE, nicht je Bild und nicht für alles zusammen: der Token
  // steckt in der URL, und ein Schlüssel über alle geladenen Seiten würde beim
  // Nachladen auch die alten Bilder neu signieren — der Browser lüde sie dann
  // erneut. Je Seite bleibt die Zeichenkette stabil, solange die Seite es ist.
  const signaturen = useQueries({
    queries: (feed.data?.pages ?? []).map((seite) => {
      const pfade = seite.posts.flatMap((p) => p.media.map((m) => m.storagePath));
      return {
        queryKey: signaturQueryKey(pfade),
        queryFn: () => signPostMedia(pfade),
        enabled: pfade.length > 0,
        staleTime: SIGNATUR_STALE_MS,
      };
    }),
  });
  const bildUrls: Record<string, string> = Object.assign(
    {},
    ...signaturen.map((q) => q.data ?? {}),
  );

  // Zwischen `staleTime` (50 min) und Ablauf (60 min) liegt ein Fenster, in dem
  // ein offen gelassener Tab eine abgelaufene URL hält und das Bild 403 liefert.
  // Dann wird nachsigniert.
  //
  // Der Wächter merkt sich die fehlgeschlagene URL, NICHT den Pfad: ein wirklich
  // kaputtes Bild liefert dieselbe URL wieder und dreht sich nicht im Kreis —
  // aber eine zweite abgelaufene Signatur desselben Pfades ist eine andere
  // Zeichenkette und bekommt ihren Versuch. Genau der Fall, den der Kommentar
  // hier beschreibt (ein Tab über zwei Ablauffenster), war mit einem Wächter je
  // Pfad nach dem ersten Mal dauerhaft kaputt.
  const queryClient = useQueryClient();
  const nachsigniert = useRef(new Set<string>());
  function onBildFehler(url: string) {
    if (nachsigniert.current.has(url)) return;
    nachsigniert.current.add(url);
    void queryClient.invalidateQueries({ queryKey: ["post-media", "signiert"] });
  }

  const tags = useQuery({ queryKey: tagsQueryKey, queryFn: fetchAktiveTags });

  return (
    <section className="space-y-6">
      {user && <PostComposer authorId={user.id} />}

      {/* Die Leiste steht im Markup VOR dem Feed: auf dem Telefon liegt sie
          damit über ihm, auf großen Schirmen schiebt sie das Raster in die
          rechte Spalte (Mockup). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <aside className="lg:col-start-2 lg:row-start-1">
          <TagFilter tags={tags.data ?? []} aktiv={hashtag} onWaehlen={setHashtag} />
        </aside>

        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          {hashtag && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Gefiltert nach</span>
              <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent-strong">
                #{hashtag}
              </span>
              <button
                type="button"
                onClick={() => setHashtag(null)}
                className="text-accent-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Filter entfernen
              </button>
            </div>
          )}

          <FeedList
            posts={posts}
            isLoading={feed.isLoading}
            isError={feed.isError}
            hasNextPage={feed.hasNextPage}
            isFetchingNextPage={feed.isFetchingNextPage}
            onNextPage={() => void feed.fetchNextPage()}
            currentUserId={user?.id ?? null}
            activeHashtag={hashtag}
            onHashtag={setHashtag}
            mentionResolver={mentionResolver}
            bildUrls={bildUrls}
            onBildFehler={onBildFehler}
            kuratierteTags={tags.data ?? []}
          />
        </div>
      </div>
    </section>
  );
}

// ── Tag-Filterleiste ────────────────────────────────────────────────────────

/**
 * Die kuratierten Tags als Filter (AGE-528). Bewusst EINE Auswahl zur Zeit:
 * der Feed filtert über `.contains("hashtags", [tag])`, und mehrere Tags wären
 * eine andere Abfrage — nicht eine andere Leiste. Ein zweiter Klick auf
 * denselben Tag hebt den Filter auf.
 *
 * „Beliebte Tags" mit Zählern und „Aktivste Mitglieder" aus dem Mockup gehören
 * NICHT hierher (Non-goals): die rechte Spalte trägt in dieser Fassung nur den
 * Filter.
 */
function TagFilter({
  tags,
  aktiv,
  onWaehlen,
}: {
  tags: Tag[];
  aktiv: string | null;
  onWaehlen: (tag: string | null) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-sm font-semibold text-ink">Tags</h2>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const gewaehlt = aktiv === tag.key;
          return (
            <button
              key={tag.key}
              type="button"
              aria-pressed={gewaehlt}
              onClick={() => onWaehlen(gewaehlt ? null : tag.key)}
              className={`rounded-full px-2.5 py-0.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                gewaehlt
                  ? "bg-accent text-chrome"
                  : "bg-accent-soft/60 text-accent-strong hover:bg-accent-soft"
              }`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Composer ────────────────────────────────────────────────────────────────

/** Höchstens sechs Bilder pro Beitrag — dieselbe Grenze hält der Trigger auf
 *  `post_media`. Hier steht sie, damit der Nutzer sie sieht, nicht damit sie
 *  gilt: durchgesetzt wird sie in der Datenbank. */
const MAX_BILDER = 6;

/** Ein gewähltes Bild, bereits verkleinert und nach WebP gewandelt. */
interface GewaehltesBild {
  blob: Blob;
  width: number;
  height: number;
  vorschau: string;
}

function PostComposer({ authorId }: { authorId: string }) {
  const { activationName } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [offen, setOffen] = useState(false);
  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("members");
  const [bilder, setBilder] = useState<GewaehltesBild[]>([]);
  const [bildFehler, setBildFehler] = useState<string | null>(null);
  const [gewaehlteTags, setGewaehlteTags] = useState<string[]>([]);
  /** Laufende Bildverarbeitungen. Solange > 0, ist „Posten" gesperrt: sonst
   *  veröffentlicht ein Klick den Beitrag OHNE die Bilder, die gerade noch
   *  verkleinert werden — und die fertigen Ergebnisse fallen ins Leere. */
  const [verarbeitet, setVerarbeitet] = useState(0);

  // Die kuratierte Liste hängt an keinem Betrachter; freie Tags entstehen
  // weiterhin durch `#Wort` im Text — beide Quellen vereinigt die RPC.
  const tags = useQuery({ queryKey: tagsQueryKey, queryFn: fetchAktiveTags });

  const videoValid = videoUrl.trim() === "" || parseVideoUrl(videoUrl) !== null;

  /**
   * Verkleinern passiert beim AUSWÄHLEN, nicht beim Veröffentlichen: ein
   * unlesbares Bild soll sofort und benennbar auffallen, statt den Nutzer
   * später in einen nichtssagenden Serverfehler am 1-MiB-Limit laufen zu lassen.
   */
  async function waehleBilder(dateien: File[]) {
    const frei = MAX_BILDER - bilder.length;
    setBildFehler(
      dateien.length > frei
        ? `Höchstens sechs Bilder pro Beitrag — ${dateien.length - frei} wurden nicht übernommen.`
        : null,
    );
    setVerarbeitet((n) => n + 1);
    try {
      for (const datei of dateien.slice(0, Math.max(0, frei))) {
        try {
          const { blob, width, height } = await shrinkToWebp(datei);
          // Die Grenze steht IM Zustandswechsel, nicht davor: `frei` oben ist
          // ein Schnappschuss, und zwei rasch aufeinanderfolgende Auswahlen
          // lesen beide denselben. Hier kann nichts vorbeikommen.
          setBilder((bisher) =>
            bisher.length >= MAX_BILDER
              ? bisher
              : [...bisher, { blob, width, height, vorschau: URL.createObjectURL(blob) }],
          );
        } catch (fehler) {
          setBildFehler(errorMessage(fehler));
        }
      }
    } finally {
      setVerarbeitet((n) => n - 1);
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      // Video-URL (falls valide) wird an den Body gehängt — kein neues Schema; die
      // Karte erkennt und bettet sie ein.
      const trimmedVideo = videoUrl.trim();
      const fullBody = trimmedVideo ? `${body.trim()}\n${trimmedVideo}` : body.trim();
      // Die id entsteht HIER, vor dem Upload: die Bildpfade tragen sie, und der
      // Beitrag entsteht erst danach — in einem Schritt mit seinen Bildzeilen.
      const postId = crypto.randomUUID();
      const media = await uploadPostMedia({ uid: authorId, postId, bilder });
      await createPostWithMedia({
        postId,
        body: fullBody,
        visibility,
        tags: gewaehlteTags,
        media,
      });
    },
    onSuccess: () => {
      setBody("");
      setVideoUrl("");
      setVisibility("members");
      for (const bild of bilder) URL.revokeObjectURL(bild.vorschau);
      setBilder([]);
      setBildFehler(null);
      setGewaehlteTags([]);
      setOffen(false);
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

  const canSubmit =
    (body.trim() !== "" || bilder.length > 0) &&
    videoValid &&
    verarbeitet === 0 &&
    !create.isPending;

  // Die ruhige Zeile aus dem Mockup: der Composer nimmt geschlossen so wenig
  // Raum ein wie ein Beitrag Aufmerksamkeit verdient.
  if (!offen) {
    return (
      <Card>
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Avatar name={activationName ?? ""} masked={!activationName} />
          <span className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm text-muted">
            Was möchtest du mit der Community teilen?
          </span>
        </button>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Etwas mit der Community teilen … #Hashtag, @Erwähnung"
        aria-label="Neuer Beitrag"
      />

      {bilder.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {bilder.map((bild, i) => (
            <li key={bild.vorschau} className="relative">
              <img
                src={bild.vorschau}
                alt=""
                className="aspect-4/3 w-full rounded-md object-cover"
              />
              <button
                type="button"
                aria-label={`Bild ${i + 1} entfernen`}
                onClick={() => {
                  URL.revokeObjectURL(bild.vorschau);
                  setBilder((bisher) => bisher.filter((_, j) => j !== i));
                  setBildFehler(null);
                }}
                className="absolute top-1 right-1 rounded-full bg-scrim px-2 py-0.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {(tags.data ?? []).length > 0 && (
        <div role="group" aria-label="Tags für diesen Beitrag" className="flex flex-wrap gap-2">
          {(tags.data ?? []).map((tag) => {
            const aktiv = gewaehlteTags.includes(tag.key);
            return (
              <button
                key={tag.key}
                type="button"
                aria-pressed={aktiv}
                onClick={() =>
                  setGewaehlteTags((bisher) =>
                    aktiv ? bisher.filter((k) => k !== tag.key) : [...bisher, tag.key],
                  )
                }
                className={`rounded-full px-2.5 py-0.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  aktiv
                    ? "bg-accent-soft font-medium text-accent-strong"
                    : "border border-line text-muted hover:text-ink"
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      )}

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
              ? "border-line focus-visible:border-accent focus-visible:ring-accent"
              : "border-danger focus-visible:ring-danger"
          }`}
        />
        {!videoValid && (
          <p className="mt-1 text-xs text-danger">
            Nur YouTube- oder Vimeo-Links werden eingebettet.
          </p>
        )}
      </div>

      {bildFehler && <p className="text-xs text-danger">{bildFehler}</p>}

      {/* Handelndes gehört zusammen und nach rechts: Dateiauswahl und „Posten"
          teilen die Aktionszeile mit der Sichtbarkeit links (Donald,
          2026-08-12) — die Anordnung von LinkedIn, Slack und Gmail. Vorher lag
          die Auswahl allein auf einer eigenen Zeile über den Kacheln; deren
          Wegfall macht den Composer auf dem Telefon um eine Zeile kürzer. */}
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
        {/* `ml-auto` und nicht nur `justify-between`: bricht die Zeile auf dem
            Telefon um, landet ein einzelnes Element sonst am ZEILENANFANG —
            die Gruppe stünde dort links. Gemessen auf 375 px. */}
        <div className="ml-auto flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center text-sm text-muted">
            {/* Beschriftung bleibt „Bild", bis auch Dateien gehen (AGE-532).
                Ein Knopf, der „Datei anhängen" verspricht und nur Bilder
                annimmt, ist schlechter als der genaue Name. */}
            <span className="rounded-md border border-line px-3 py-1.5">Bild</span>
            <input
              type="file"
              accept="image/*"
              multiple
              aria-label="Bilder auswählen"
              className="sr-only"
              onChange={(e) => {
                const dateien = [...(e.target.files ?? [])];
                e.target.value = "";
                void waehleBilder(dateien);
              }}
            />
          </label>
          <Button size="sm" disabled={!canSubmit} onClick={() => create.mutate()}>
            {create.isPending ? "Wird veröffentlicht…" : "Posten"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Liste ─────────────────────────────────────────────────────────────────────

function FeedList({
  posts,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  onNextPage,
  currentUserId,
  activeHashtag,
  onHashtag,
  mentionResolver,
  bildUrls,
  onBildFehler,
  kuratierteTags,
}: {
  posts: FeedPost[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onNextPage: () => void;
  currentUserId: string | null;
  activeHashtag: string | null;
  onHashtag: (tag: string | null) => void;
  mentionResolver: MentionResolver;
  bildUrls: Record<string, string>;
  onBildFehler: (pfad: string) => void;
  kuratierteTags: Tag[];
}) {
  if (isLoading) {
    return <p className="text-sm text-muted">Feed wird geladen…</p>;
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">Der Feed konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }
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
    <div className="space-y-5">
      <Stagger className="space-y-5">
        {posts.map((post) => (
          <StaggerItem key={post.id}>
            <PostCard
              post={post}
              currentUserId={currentUserId}
              activeHashtag={activeHashtag}
              onHashtag={onHashtag}
              mentionResolver={mentionResolver}
              bildUrls={bildUrls}
              onBildFehler={onBildFehler}
              kuratierteTags={kuratierteTags}
            />
          </StaggerItem>
        ))}
      </Stagger>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onNextPage} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Wird geladen…" : "Ältere Beiträge"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Beitrags-Karte ──────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  activeHashtag,
  onHashtag,
  mentionResolver,
  bildUrls,
  onBildFehler,
  kuratierteTags,
}: {
  post: FeedPost;
  currentUserId: string | null;
  activeHashtag: string | null;
  onHashtag: (tag: string | null) => void;
  mentionResolver: MentionResolver;
  bildUrls: Record<string, string>;
  onBildFehler: (pfad: string) => void;
  kuratierteTags: Tag[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);

  const segments = useMemo(() => tokenizePostBody(post.body), [post.body]);
  const video = useMemo(() => extractFirstVideo(post.body), [post.body]);
  const author = displayAuthor(post.author, currentUserId !== null);

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
        {author.masked ? (
          <Avatar
            name={author.name}
            src={author.avatarUrl}
            masked={author.masked}
            size="md"
            className="ring-1 ring-accent/40"
          />
        ) : (
          <Link to={`/p/${post.author.id}`} className="shrink-0">
            <Avatar
              name={author.name}
              src={author.avatarUrl}
              size="md"
              className="ring-1 ring-accent/40"
            />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {author.masked ? (
              <span className="font-display text-base font-semibold text-ink">{author.name}</span>
            ) : (
              <>
                <Link
                  to={`/p/${post.author.id}`}
                  className="font-display text-base font-semibold text-ink hover:text-accent-strong"
                >
                  {author.name}
                </Link>
                {post.author.tier && <TierBadge tier={post.author.tier} />}
              </>
            )}
          </div>
          <p className="text-xs text-muted">
            {timeAgo(post.createdAt)}
            {" · "}
            {post.visibility === "members" ? "Nur für Mitglieder" : "Öffentlich"}
          </p>
        </div>
      </header>

      <PostBody segments={segments} skipRaw={video?.url} mentionResolver={mentionResolver} />

      <PostMedien media={post.media} urls={bildUrls} onFehler={onBildFehler} autor={author.name} />

      {video && <VideoEmbed url={video.url} title={`Video von ${author.name}`} />}

      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.hashtags.map((tag) => {
            // Kuratiert heißt: dieser Wert steht in `tags`. Ein umbenannter oder
            // deaktivierter Tag wirkt NICHT rückwirkend — der Beitrag behält
            // seine Zeichenkette und der Chip wandert nach „frei".
            const kuratiert = istKuratiert(tag, kuratierteTags);
            return (
              <button
                key={tag}
                type="button"
                data-kuratiert={kuratiert}
                onClick={() => onHashtag(tag)}
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  activeHashtag === tag
                    ? "bg-accent text-chrome"
                    : kuratiert
                      ? "bg-accent-soft/60 text-accent-strong hover:bg-accent-soft"
                      : "border border-line text-muted hover:text-ink"
                }`}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}

      <footer className="flex items-center gap-4 border-t border-line pt-3 text-sm">
        <button
          type="button"
          disabled={!currentUserId || like.isPending}
          onClick={() => like.mutate()}
          aria-pressed={post.likedByMe}
          className={`inline-flex items-center gap-1.5 rounded-md px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${
            post.likedByMe ? "text-accent-strong" : "text-muted hover:text-ink"
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
          className="inline-flex items-center gap-1.5 rounded-md px-1 text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
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

// ── Bilder einer Karte ──────────────────────────────────────────────────────

/**
 * Die Bilder liegen in einem PRIVATEN Bucket; sichtbar sind sie nur über eine
 * signierte URL. Fehlt die Signatur für einen Pfad, entfällt seine Kachel —
 * der Storage lehnt einzelne Pfade ab, und der Beitrag darf deshalb nicht
 * verschwinden (gemessen in EVIDENCE.md, Fall F).
 */
function PostMedien({
  media,
  urls,
  onFehler,
  autor,
}: {
  media: FeedMedia[];
  urls: Record<string, string>;
  onFehler: (pfad: string) => void;
  autor: string;
}) {
  const [offen, setOffen] = useState<number | null>(null);

  // Gezählt wird, was auch gezeigt werden KANN. Vorher rechnete `bildLayout`
  // über alle Bildzeilen, während abgelehnte Pfade beim Zeichnen entfielen —
  // bei einem abgelehnten vierten Bild verschwand das „+n" ersatzlos, und der
  // Rest war weder sichtbar noch angekündigt.
  const nutzbar = media.filter((bild) => urls[bild.storagePath]);
  const layout = bildLayout(nutzbar.length);
  if (nutzbar.length === 0) return null;

  const raster =
    layout.art === "einzeln"
      ? "grid-cols-1"
      : layout.art === "paar"
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <>
      <ul className={`grid gap-2 ${raster}`}>
        {nutzbar.slice(0, layout.sichtbar).map((bild, i) => {
          const url = urls[bild.storagePath];
          const letzte = i === layout.sichtbar - 1 && layout.rest > 0;
          return (
            <li key={bild.storagePath} className="relative">
              <button
                type="button"
                onClick={() => setOffen(i)}
                aria-label={`Bild ${i + 1} vergrößern`}
                className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <img
                  src={url}
                  // Die Maße stehen in `post_media`, damit der Platz schon steht,
                  // bevor das Bild da ist — sonst springt die Karte beim Laden.
                  width={bild.width}
                  height={bild.height}
                  // Ein einzelnes Bild behält sein echtes Seitenverhältnis; erst im
                  // Raster wird beschnitten, weil dort die Kacheln zueinander
                  // passen müssen. Ohne diese Zeile wären `width`/`height` nur
                  // Dekoration: `aspect-4/3` setzt die Box ohnehin.
                  style={
                    layout.art === "einzeln"
                      ? { aspectRatio: `${bild.width} / ${bild.height}` }
                      : undefined
                  }
                  loading="lazy"
                  alt={`Bild ${i + 1} zum Beitrag von ${autor}`}
                  onError={() => onFehler(url)}
                  className={`w-full rounded-md object-cover ${
                    layout.art === "einzeln" ? "" : "aspect-4/3"
                  }`}
                />
              </button>
              {letzte && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-scrim text-lg font-semibold text-white"
                >
                  +{layout.rest}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {offen !== null && (
        <Lightbox
          media={nutzbar}
          urls={urls}
          autor={autor}
          index={offen}
          onIndex={setOffen}
          onSchliessen={() => setOffen(null)}
        />
      )}
    </>
  );
}

/**
 * Die Bilder in voller Größe (AGE-528).
 *
 * Sie ist kein Schmuck, sondern die Antwort auf einen Befund aus dem
 * Diff-Review: Schema, Trigger und Composer erlauben sechs Bilder, das Raster
 * zeigt vier, und die vierte liegt unter dem „+n". Ohne diesen Weg
 * veröffentlicht jemand Bilder, die kein Leser je erreicht.
 *
 * Bewusst KEIN Zoom, kein Wischen, keine Miniaturenleiste: vor, zurück, zu.
 */
function Lightbox({
  media,
  urls,
  autor,
  index,
  onIndex,
  onSchliessen,
}: {
  media: FeedMedia[];
  urls: Record<string, string>;
  autor: string;
  index: number;
  onIndex: (i: number) => void;
  onSchliessen: () => void;
}) {
  const schliessen = useRef<HTMLButtonElement>(null);
  // Die Lightbox ist nur montiert, solange sie offen ist — daher fest `true`
  // (AGE-529). Sperrt die Seite dahinter und hält den Fokus im Overlay; den
  // ERSTEN Fokus setzt weiterhin der Effekt unten, aus dem Grund, der dort steht.
  const overlay = useOverlay(true);

  const weiter = (schritt: number) =>
    onIndex((index + schritt + media.length) % media.length);

  // Ohne Abhängigkeitsliste, weil `weiter` den aktuellen `index` schließt — der
  // Zuhörer wird je Render neu gesetzt und wieder abgeräumt.
  useEffect(() => {
    // Die Tastatur ist hier kein Zusatz: wer mit ihr bedient, kommt sonst aus
    // dem Overlay nicht mehr heraus.
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
      if (e.key === "ArrowRight") weiter(1);
      if (e.key === "ArrowLeft") weiter(-1);
    }
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  });

  // Der Fokus wandert NUR beim Öffnen. Stünde das im Effekt darüber, risse
  // jeder Bildwechsel den Fokus zurück auf „Schließen" — wer mit der Tastatur
  // weiterblättert, verlöre nach dem ersten Klick seinen Knopf.
  useEffect(() => {
    schliessen.current?.focus();
  }, []);

  const bild = media[index];
  // Der Portal ist keine Kosmetik: `.fbc-card:hover` setzt `transform`
  // (AGE-492), und ein transformierter Vorfahr wird zum Bezugsrahmen für
  // `position: fixed`. In der Karte gezeichnet schrumpfte dieses Overlay bei
  // jedem echten Mausklick auf die Kartenfläche (gemessen 847×615 statt
  // 1280×900). jsdom hat kein Layout, deshalb hat das kein Test gesehen,
  // sondern die Sichtprobe zu 9.6.
  return createPortal(
    <div
      ref={overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Bild ${index + 1} von ${media.length}`}
      onClick={onSchliessen}
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-sm"
    >
      <img
        src={urls[bild.storagePath]}
        width={bild.width}
        height={bild.height}
        alt={`Bild ${index + 1} zum Beitrag von ${autor}`}
        // Der Klick aufs Bild soll NICHT schließen — sonst trifft man beim
        // Weiterblättern ständig daneben.
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain"
      />

      <button
        ref={schliessen}
        type="button"
        onClick={onSchliessen}
        aria-label="Schließen"
        className="absolute top-4 right-4 rounded-full bg-canvas/90 px-3 py-1 text-lg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ×
      </button>

      {media.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              weiter(-1);
            }}
            aria-label="Vorheriges Bild"
            className="absolute left-4 rounded-full bg-canvas/90 px-3 py-1 text-lg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              weiter(1);
            }}
            aria-label="Nächstes Bild"
            className="absolute right-4 rounded-full bg-canvas/90 px-3 py-1 text-lg text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ›
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

// ── Body-Rendering (Text/Hashtag/Erwähnung/URL) ───────────────────────────────

function PostBody({
  segments,
  skipRaw,
  mentionResolver,
}: {
  segments: PostSegment[];
  skipRaw: string | undefined;
  mentionResolver: MentionResolver;
}) {
  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
      {segments.map((seg, i) => {
        if (seg.type === "url" && seg.raw === skipRaw) return null; // als Embed gezeigt
        // Hashtags im Fließtext bleiben Text (AGE-528). Sie waren bis hierher
        // ein zweiter Button neben dem Chip unter dem Beitrag — derselbe Tag
        // stand also zweimal klickbar da. Der Chip ist die Bedienstelle; der
        // Satz liest sich, er wird nicht bedient. `seg.raw` und nicht
        // `seg.value`, damit die getippte Schreibweise samt `#` stehen bleibt.
        if (seg.type === "hashtag") {
          return <span key={i}>{seg.raw}</span>;
        }
        if (seg.type === "mention") {
          const id = mentionResolver(seg.value);
          return id ? (
            <Link
              key={i}
              to={`/p/${id}`}
              className="font-medium text-accent-strong hover:underline"
            >
              {seg.raw}
            </Link>
          ) : (
            <span key={i} className="font-medium text-accent-strong">
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
              className="text-accent-strong underline underline-offset-2"
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
    queryFn: () => fetchComments(currentUserId, postId),
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
      {comments.data?.map((c) => {
        const author = displayAuthor(c.author, currentUserId !== null);
        return (
          <div key={c.id} className="flex items-start gap-2.5">
            {author.masked ? (
              <Avatar name={author.name} src={author.avatarUrl} masked={author.masked} size="sm" />
            ) : (
              <Link to={`/p/${c.author.id}`} className="shrink-0">
                <Avatar name={author.name} src={author.avatarUrl} size="sm" />
              </Link>
            )}
            <div className="min-w-0 flex-1 rounded-[var(--radius-card)] bg-soft px-3 py-2">
              <div className="flex items-baseline gap-2">
                {author.masked ? (
                  <span className="text-sm font-semibold text-ink">{author.name}</span>
                ) : (
                  <Link
                    to={`/p/${c.author.id}`}
                    className="text-sm font-semibold text-ink hover:text-accent-strong"
                  >
                    {author.name}
                  </Link>
                )}
                <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap text-ink">{c.body}</p>
            </div>
          </div>
        );
      })}

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
