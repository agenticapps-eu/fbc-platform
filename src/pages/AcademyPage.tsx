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

/** Die Reiter der Academy. Die Reihenfolge ist Donalds Entscheidung (01.09.). */
type Reiter = "alle" | "meine" | "redaktion";

export default function AcademyPage() {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  /* Der Reiterzustand liegt HIER und nicht in `Tabs` (AGE-677). Die
     Filterspalte umspannt Reiterzeile und Inhalt gemeinsam — sie steht also
     ausserhalb der Reiter und muss trotzdem wissen, welcher offen ist. Vorher
     stand sie IM Inhalt von „Alle": sie begann damit erst unterhalb der
     Reiterzeile und fehlte auf „Meine Academy" ganz. */
  const [reiter, setReiter] = useState<Reiter>("alle");

  /* Auch der Filterzustand liegt hier, aus demselben Grund: die Felder stehen
     in der Spalte, die Liste steht im Reiterinhalt. */
  const [eingabe, setEingabe] = useState("");
  const [suche, setSuche] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [ordnung, setOrdnung] = useState<FeedOrdnung>("neueste");

  // Entprellt wie im Verzeichnis: sonst eine Serverrunde je Tastendruck.
  useEffect(() => {
    const id = setTimeout(() => setSuche(eingabe), 300);
    return () => clearTimeout(id);
  }, [eingabe]);

  /* Die Facetten kommen aus der UNGEFILTERTEN Grundabfrage. Aus der gefilterten
     Liste abgeleitet verschwänden nach dem ersten Haken alle anderen Marken,
     und man käme aus dem Filter nicht mehr heraus. */
  const facetten = useQuery({
    queryKey: academyFacettenKey(uid, null),
    queryFn: () => fetchFeed({ uid, nurVideos: true }),
    enabled: reiter === "alle",
    staleTime: Infinity,
  });
  const hashtagsImBestand = useMemo(
    () => [...new Set((facetten.data?.posts ?? []).flatMap((p) => p.hashtags ?? []))].sort(),
    [facetten.data],
  );

  return (
    <div className="flex flex-col gap-8">
      <FormatHero meta={FORMAT_HERO["/academy"]} />

      <FilterSpalte
        id="academy-filter"
        filter={
          reiter === "alle" ? (
            <AcademyFilter
              eingabe={eingabe}
              onEingabe={setEingabe}
              ordnung={ordnung}
              onOrdnung={setOrdnung}
              hashtags={hashtagsImBestand}
              gewaehlt={tags}
              onTag={(t) =>
                setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]))
              }
            />
          ) : (
            /* Die Spalte BLEIBT stehen und wird nur leer. Verschwände sie,
               spränge die Inhaltsbreite beim Reiterwechsel um 16rem. Felder
               anzubieten, die hier nichts täten, wäre die andere Hälfte des
               Fehlers: die Redaktion ist eine Konstante im Code, und „Meine
               Academy" lädt sein zweites Regal über `fetchGelikteVideos`, das
               weder Suche noch Ordnung kennt. */
            <Card className="space-y-2">
              <h2 className="font-display text-sm font-semibold text-ink">Filter</h2>
              <p className="text-sm text-muted">
                {reiter === "redaktion"
                  ? "Die Lektionen der Redaktion sind eine feste Auswahl — hier gibt es nichts zu filtern."
                  : "Suche und Sortierung wirken auf „Alle“."}
              </p>
            </Card>
          )
        }
      >
        <Tabs
          value={reiter}
          onValueChange={(v) => setReiter(v as Reiter)}
          tabs={[
            {
              value: "alle",
              label: "Alle",
              content: <GeteilteVideos uid={uid} suche={suche} tags={tags} ordnung={ordnung} />,
            },
            {
              value: "meine",
              label: "Meine Academy",
              content: <MeineAcademy uid={uid} />,
            },
            {
              value: "redaktion",
              label: "Redaktion",
              content: <Redaktion />,
            },
          ]}
        />
      </FilterSpalte>
    </div>
  );
}

// ── Reiter „Redaktion“ ──────────────────────────────────────────────────────

/**
 * Die drei kuratierten Lektionen, als Streifen statt als Stapel (AGE-677).
 *
 * Video links, Text rechts. Gestapelt nahm der `aspect-video`-Rahmen die volle
 * Kachelbreite und schob den Titel aus dem Bild — mit dem Einwilligungstor umso
 * mehr, weil die ungeklickte Fläche dieselbe Höhe als Grau einnimmt. Gemeldet
 * von Donald am 01.09. mit Screenshot.
 *
 * Die Schwelle ist eine BEHÄLTER-Abfrage. Ein Fenster-Präfix wäre hier gleich
 * doppelt falsch: die Kachel steht in einem Raster, das die Filterspalte
 * verengt, und `kartenraster.test.ts` zählt diese Datei zu den Kartenflächen.
 */
function Redaktion() {
  return (
    <div className="@container">
      <ul className="space-y-4">
        {ACADEMY_LESSONS.map((lesson) => (
          <li key={lesson.url}>
            <Card className="@[30rem]:flex-row @[30rem]:items-start flex flex-col gap-4">
              {/* Feste Spaltenbreite im Streifen, damit die drei Videos eine
                  gemeinsame Kante zeigen; gestapelt nimmt es die volle Breite. */}
              <div className="@[30rem]:w-64 @[30rem]:shrink-0 w-full">
                <VideoEmbed url={lesson.url} title={lesson.title} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">{lesson.title}</CardTitle>
                <CardDescription>{lesson.description}</CardDescription>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Die Felder der Spalte ───────────────────────────────────────────────────

function AcademyFilter({
  eingabe,
  onEingabe,
  ordnung,
  onOrdnung,
  hashtags,
  gewaehlt,
  onTag,
}: {
  eingabe: string;
  onEingabe: (v: string) => void;
  ordnung: FeedOrdnung;
  onOrdnung: (v: FeedOrdnung) => void;
  hashtags: string[];
  gewaehlt: string[];
  onTag: (t: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <label htmlFor="academy-suche" className="font-display text-sm font-semibold text-ink">
          Suche
        </label>
        {/* Kein `aria-label`: das Feld trägt schon ein sichtbares
            `<label for>`, und ein `aria-label` ERSETZT dessen Text als
            zugänglichen Namen, statt ihn zu ergänzen. Wer per Sprache
            „Suche" sagt, träfe das Feld dann nicht mehr (WCAG 2.5.3).
            Auf `/mitglieder` ist das `aria-label` richtig — dort gibt es
            kein sichtbares Label. Beim Übernehmen kam hier eines dazu. */}
        <Input
          id="academy-suche"
          type="search"
          value={eingabe}
          onChange={(e) => onEingabe(e.target.value)}
          placeholder="Wonach suchst du?"
        />
      </Card>

      <Card className="space-y-3">
        <label htmlFor="academy-ordnung" className="font-display text-sm font-semibold text-ink">
          Sortierung
        </label>
        {/* Die Ordnungen sind die der Feed-Schicht, nicht eigene. Sie führt
            seit AGE-667 in allen drei `veroeffentlicht_ab` und trägt in
            „Beliebteste" zusätzlich `like_count` im Cursor; eine zweite
            Ordnung hier hiesse, diesen Vertrag ein zweites Mal zu bauen. */}
        <Select
          id="academy-ordnung"
          value={ordnung}
          onChange={(e) => onOrdnung(e.target.value as FeedOrdnung)}
        >
          <option value="neueste">Neueste zuerst</option>
          <option value="beliebteste">Beliebteste zuerst</option>
        </Select>
      </Card>

      {/* Abgeleitet, denn Hashtags sind Freitext. Ohne Werte rendert die
          Karte nicht — auf der Produktion ist das heute der Fall. */}
      {hashtags.length > 0 && (
        <Card className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-ink">Hashtags</h2>
          <ul className="space-y-1.5">
            {hashtags.map((t) => (
              <li key={t}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={gewaehlt.includes(t)}
                    onChange={() => onTag(t)}
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
  suche = "",
  tags = [],
  ordnung = "neueste",
}: {
  uid: string | null;
  autorId?: string | null;
  leer?: { title: string; description: string };
  /**
   * Suche, Marken und Ordnung kommen seit AGE-677 von der SEITE, nicht mehr aus
   * eigenem Zustand: die Felder stehen in der Filterspalte, und die umspannt
   * Reiterzeile und Inhalt gemeinsam. Ohne Angabe verhält sich die Liste wie
   * ungefiltert — so laden die beiden Regale in „Meine Academy" weiter.
   */
  suche?: string;
  tags?: string[];
  ordnung?: FeedOrdnung;
}) {
  const liste = useInfiniteQuery({
    queryKey: academyKey(uid, autorId, suche, tags, ordnung),
    queryFn: ({ pageParam }) =>
      fetchFeed({ uid, nurVideos: true, autorId, cursor: pageParam, suche, tags, ordnung }),
    initialPageParam: null as FeedCursor | null,
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
      leer={
        leer ?? {
          title: "Noch keine geteilten Videos",
          description:
            "Sobald jemand in der Aktivität ein Video teilt, steht es hier — ohne weiteres Zutun.",
        }
      }
    />
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
