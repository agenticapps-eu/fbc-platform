import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterSpalte } from "../components/ui/FilterSpalte";
import { FormatHero } from "../components/ui/FormatHero";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Tabs } from "../components/ui/Tabs";
import { VideoEmbed } from "../components/ui/VideoEmbed";
import { FORMAT_HERO } from "../config/formatHero";
import { displayAuthor } from "../lib/displayAuthor";
import { fetchGelikteVideos, gelikteVideosKey, type AcademyCursor } from "../lib/academy";
import { fetchFeed, type FeedCursor, type FeedOrdnung, type FeedPost } from "../lib/feed";
import { useAuth } from "../providers/auth-context";

/**
 * Academy (AGE-252, erweitert in AGE-533 / C9).
 *
 * ── Die Academy hat kein eigenes Datenmodell ──────────────────────────────
 * Sie ist eine gefilterte Sicht auf `posts`: Beiträge mit `video_url`. Ein in
 * der Aktivität geteiltes Video erscheint dadurch OHNE Zutun hier — kein
 * Abgleich, kein Übertragen, kein zweiter Eintrag. Kurse, Lektionen,
 * Fortschritt und Einschreibung sind ausdrücklich NICHT Teil davon (AGE-262).
 *
 * ── Die drei kuratierten Videos bleiben eine Konstante ────────────────────
 * Sie stehen als redaktioneller Block oben, damit die Seite am Starttag nicht
 * leer ist, und wandern bewusst NICHT in die Datenbank: drei von der Redaktion
 * gewählte Videos sind kein Inhaltsmodell. In `posts` geschrieben hätten sie
 * einen Autor, eine Sichtbarkeit, Likes und Kommentare, die niemand bestellt hat.
 *
 * ── Sichtbarkeit entscheidet die RLS ──────────────────────────────────────
 * Diese Seite stellt dieselbe Abfrage wie der Feed, nur mit einem Filter mehr.
 * Sie führt KEIN zweites Sichtbarkeitsprädikat.
 */
interface Lesson {
  title: string;
  description: string;
  url: string;
}

const ACADEMY_LESSONS: Lesson[] = [
  {
    title: "Mit dem „Warum“ beginnen",
    description: "Wie herausragende Führung Vertrauen und Wirkung aufbaut.",
    url: "https://www.youtube.com/watch?v=qp0HIF3SfI4",
  },
  {
    title: "Warum Start-ups erfolgreich sind",
    description: "Der wichtigste Faktor hinter erfolgreichen Gründungen.",
    url: "https://www.youtube.com/watch?v=bNpx7gpSqbY",
  },
  {
    title: "Fokus & Beständigkeit",
    description: "Eine ruhige Einstimmung auf das Leitprinzip „Qualität vor Reichweite“.",
    url: "https://vimeo.com/76979871",
  },
];

export default function AcademyPage() {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  return (
    <div className="flex flex-col gap-8">
      <FormatHero meta={FORMAT_HERO["/academy"]} />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
          Aus der Redaktion
        </h2>
        {/* Behälter statt Fenster (AGE-629): mit der Filterspalte daneben
            verengt sich diese Fläche, das Fenster nicht. 35rem und nicht
            41rem wie bei den Karten der anderen Flächen — eine Lektion trägt
            einen Videorahmen und wird darunter unbrauchbar; gemessen liefert
            die Academy heute bei 1024 px zwei Kacheln zu 332 px. Der Deckel
            bleibt bei ZWEI, damit ein breiter Schirm die Fläche nicht dichter
            macht, als sie heute ist. */}
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @[35rem]:grid-cols-2">
            {ACADEMY_LESSONS.map((lesson) => (
              <Card key={lesson.url} className="flex flex-col gap-3">
                <VideoEmbed url={lesson.url} title={lesson.title} />
                <div>
                  <CardTitle className="text-base">{lesson.title}</CardTitle>
                  <CardDescription>{lesson.description}</CardDescription>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Der Reiterzustand ist eine reine Bedienentscheidung und kommt nicht aus
          einer Abfrage — `useState` in <Tabs> ist hier also richtig. Die Falle
          aus AGE-492 (ein Wert, der erst NACH dem Mount eintrifft, wird von
          `useState(wert)` nie angenommen) trifft nur datengespeiste Zustände. */}
      <Tabs
        tabs={[
          {
            value: "alle",
            label: "Alle",
            content: <GeteilteVideos uid={uid} mitFilter />,
          },
          {
            value: "meine",
            label: "Meine Academy",
            content: <MeineAcademy uid={uid} />,
          },
        ]}
      />
    </div>
  );
}

// ── Reiter „Alle“ ───────────────────────────────────────────────────────────

/**
 * Der Schlüssel trägt JEDEN Filter mit (AGE-629). Täte er es nicht, lieferte
 * react-query beim Umschalten der Ordnung oder beim Tippen weiterhin das
 * zwischengespeicherte Ergebnis der vorigen Frage — und zwar lautlos, weil
 * nichts fehlschlägt.
 */
const academyKey = (
  uid: string | null,
  autorId: string | null,
  suche: string,
  tags: string[],
  ordnung: FeedOrdnung,
) => ["academy", "videos", uid, autorId, suche, [...tags].sort().join(","), ordnung] as const;

/**
 * Die Grundabfrage für die Hashtag-Facette — OHNE Suche und OHNE Tagfilter.
 *
 * Sie ist nicht dieselbe wie die Liste, und das ist der Punkt: leitete man die
 * Facette aus der gefilterten Liste ab, verschwänden nach dem ersten Haken alle
 * anderen Marken aus der Auswahl, und man käme aus dem Filter nicht mehr
 * heraus. Dieselbe Rolle wie `fetchDirectoryBaseline` im Verzeichnis.
 */
const academyFacettenKey = (uid: string | null, autorId: string | null) =>
  ["academy", "facetten", uid, autorId] as const;

/**
 * Alle sichtbaren Beiträge mit Video, neueste zuerst — oder, mit `autorId`, nur
 * die eigenen.
 *
 * Seitenweise über denselben Keyset-Cursor wie der Feed. Eine feste Obergrenze
 * wäre eine stille Kappung: PostgREST begrenzt Resultsets ohnehin, und ein
 * Reiter, der „alle sichtbaren Videos" verspricht und dabei abschneidet, sagt
 * die Unwahrheit, ohne dass etwas darauf hinweist.
 */
function GeteilteVideos({
  uid,
  autorId = null,
  leer,
  mitFilter = false,
}: {
  uid: string | null;
  autorId?: string | null;
  leer?: { title: string; description: string };
  /**
   * Nur das Regal „Alle" trägt die Filterspalte. „Meine Academy" lädt über
   * `fetchGelikteVideos`, das weder Suche noch Ordnung kennt — eine Spalte, die
   * dort nichts täte, wäre eine Zusage an der Oberfläche ohne Deckung.
   */
  mitFilter?: boolean;
}) {
  const [eingabe, setEingabe] = useState("");
  const [suche, setSuche] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [ordnung, setOrdnung] = useState<FeedOrdnung>("neueste");

  // Entprellt wie im Verzeichnis: sonst eine Serverrunde je Tastendruck.
  useEffect(() => {
    const id = setTimeout(() => setSuche(eingabe), 300);
    return () => clearTimeout(id);
  }, [eingabe]);

  const liste = useInfiniteQuery({
    queryKey: academyKey(uid, autorId, suche, tags, ordnung),
    queryFn: ({ pageParam }) =>
      fetchFeed({ uid, nurVideos: true, autorId, cursor: pageParam, suche, tags, ordnung }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (letzte) => letzte.nextCursor,
  });

  const facetten = useQuery({
    queryKey: academyFacettenKey(uid, autorId),
    queryFn: () => fetchFeed({ uid, nurVideos: true, autorId }),
    enabled: mitFilter,
    staleTime: Infinity,
  });
  const hashtagsImBestand = useMemo(
    () => [...new Set((facetten.data?.posts ?? []).flatMap((p) => p.hashtags ?? []))].sort(),
    [facetten.data],
  );

  const posts = (liste.data?.pages ?? []).flatMap((seite) => seite.posts);

  const raster = (
    <VideoRaster
      posts={posts}
      isLoading={liste.isLoading}
      isError={liste.isError}
      hasNextPage={liste.hasNextPage}
      isFetchingNextPage={liste.isFetchingNextPage}
      onNextPage={() => void liste.fetchNextPage()}
      isLoggedIn={uid !== null}
      leer={
        leer ?? {
          title: "Noch keine geteilten Videos",
          description:
            "Sobald jemand in der Aktivität ein Video teilt, steht es hier — ohne weiteres Zutun.",
        }
      }
    />
  );

  if (!mitFilter) return raster;

  return (
    <FilterSpalte
      id="academy-filter"
      filter={
        <div className="space-y-4">
          <Card className="space-y-3">
            <label htmlFor="academy-suche" className="font-display text-sm font-semibold text-ink">
              Suche
            </label>
            <Input
              id="academy-suche"
              type="search"
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              placeholder="Wonach suchst du?"
              aria-label="Volltextsuche in der Academy"
            />
          </Card>

          <Card className="space-y-3">
            <label
              htmlFor="academy-ordnung"
              className="font-display text-sm font-semibold text-ink"
            >
              Sortierung
            </label>
            {/* Die Ordnungen sind die der Feed-Schicht, nicht eigene. Sie führt
                seit AGE-667 in allen drei `veroeffentlicht_ab` und trägt in
                „Beliebteste" zusätzlich `like_count` im Cursor; eine zweite
                Ordnung hier hiesse, diesen Vertrag ein zweites Mal zu bauen. */}
            <Select
              id="academy-ordnung"
              value={ordnung}
              onChange={(e) => setOrdnung(e.target.value as FeedOrdnung)}
              aria-label="Sortierung der Academy"
            >
              <option value="neueste">Neueste zuerst</option>
              <option value="beliebteste">Beliebteste zuerst</option>
            </Select>
          </Card>

          {/* Abgeleitet, denn Hashtags sind Freitext. Ohne Werte rendert die
              Karte nicht — auf der Produktion ist das heute der Fall. */}
          {hashtagsImBestand.length > 0 && (
            <Card className="space-y-3">
              <h2 className="font-display text-sm font-semibold text-ink">Hashtags</h2>
              <ul className="space-y-1.5">
                {hashtagsImBestand.map((t) => (
                  <li key={t}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={tags.includes(t)}
                        onChange={() =>
                          setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]))
                        }
                        className="size-4 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      />
                      <span className="min-w-0 flex-1 truncate">{t}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      }
    >
      {raster}
    </FilterSpalte>
  );
}

// ── Reiter „Meine Academy“ ──────────────────────────────────────────────────

/**
 * Zwei Regale, die verschiedene Fragen beantworten: was habe ich geteilt, und
 * was habe ich markiert. Ein eigenes, selbst geliktes Video steht deshalb in
 * beiden — ein Ausschluss wäre eine Regel, die man sich merken müsste.
 */
function MeineAcademy({ uid }: { uid: string | null }) {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
          Von mir geteilt
        </h3>
        <GeteilteVideos
          uid={uid}
          autorId={uid}
          leer={{
            title: "Du hast noch kein Video geteilt",
            description:
              "Teile ein YouTube- oder Vimeo-Video in der Aktivität — es erscheint dann automatisch hier und in der Academy.",
          }}
        />
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Gefällt mir</h3>
        {/* Die Beschriftung sagt, was es ist. „Gemerkt" oder „Gespeichert"
            verspräche Privatheit, die es nicht gibt: `post_engagement_counts`
            gibt den Like-Zähler an jeden aus, der den Beitrag sehen darf —
            verborgen bleibt nur, WER geliked hat. */}
        <p className="text-sm text-muted">
          Die Videos, die du mit „gefällt mir“ markiert hast. Zuletzt markierte zuerst.
        </p>
        <GelikteVideos uid={uid} />
      </section>
    </div>
  );
}

function GelikteVideos({ uid }: { uid: string | null }) {
  const liste = useInfiniteQuery({
    queryKey: gelikteVideosKey(uid),
    queryFn: ({ pageParam }) => fetchGelikteVideos({ uid, cursor: pageParam }),
    initialPageParam: null as AcademyCursor | null,
    getNextPageParam: (letzte) => letzte.nextCursor,
  });

  const posts = (liste.data?.pages ?? []).flatMap((seite) => seite.posts);

  return (
    <VideoRaster
      posts={posts}
      isLoading={liste.isLoading}
      isError={liste.isError}
      hasNextPage={liste.hasNextPage}
      isFetchingNextPage={liste.isFetchingNextPage}
      onNextPage={() => void liste.fetchNextPage()}
      isLoggedIn={uid !== null}
      leer={{
        title: "Noch nichts markiert",
        description: "Was dir in der Aktivität oder unter „Alle“ gefällt, sammelt sich hier.",
      }}
    />
  );
}

// ── Darstellung ─────────────────────────────────────────────────────────────

function VideoRaster({
  posts,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  onNextPage,
  isLoggedIn,
  leer,
}: {
  posts: FeedPost[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onNextPage: () => void;
  isLoggedIn: boolean;
  leer: { title: string; description: string };
}) {
  if (isLoading) return <p className="text-sm text-muted">Videos werden geladen…</p>;
  if (isError) {
    return (
      <p className="text-sm text-danger">
        Die Videos konnten nicht geladen werden. Bitte neu laden.
      </p>
    );
  }
  if (posts.length === 0) {
    return (
      <EmptyState
        title={leer.title}
        description={leer.description}
        action={
          <Link to="/aktivitaet">
            <Button variant="primary" size="sm">
              Zur Aktivität
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Dieselbe Schwelle wie beim Redaktionsregal — es sind dieselben
          Kacheln mit demselben Videorahmen. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-6 @[35rem]:grid-cols-2">
          {posts.map((post) => (
            <VideoKarte key={post.id} post={post} isLoggedIn={isLoggedIn} />
          ))}
        </div>
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onNextPage} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Wird geladen…" : "Ältere Videos"}
          </Button>
        </div>
      )}
    </div>
  );
}

function VideoKarte({ post, isLoggedIn }: { post: FeedPost; isLoggedIn: boolean }) {
  const author = displayAuthor(post.author, isLoggedIn);
  // Aus der Spalte, nicht aus einem erneuten Parsen des Bodys — dieselbe
  // Quelle, über die diese Seite filtert (AGE-533).
  const video = post.videoUrl;
  const text = video ? post.body.replace(video, "").trim() : post.body;

  return (
    <Card className="flex flex-col gap-3">
      {video && <VideoEmbed url={video} title={`Video von ${author.name}`} />}
      {text && <p className="line-clamp-3 text-sm text-ink/90">{text}</p>}
      <div className="flex items-center gap-2">
        <Avatar name={author.name} src={author.avatarUrl} masked={author.masked} size="sm" />
        {author.masked ? (
          <span className="text-sm text-muted">{author.name}</span>
        ) : (
          <Link to={`/p/${post.author.id}`} className="text-sm text-muted hover:text-accent-strong">
            {author.name}
          </Link>
        )}
      </div>
    </Card>
  );
}
