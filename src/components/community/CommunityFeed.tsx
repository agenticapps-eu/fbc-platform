import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

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
import { coverSignaturKey, signEventCovers } from "../../lib/event-cover";
import { formatEventDate } from "../../lib/events";
import { fetchAktiveTags, istKuratiert, tagsQueryKey, type Tag } from "../../lib/tags";
import {
  fetchTagZaehler,
  fetchTopAutoren,
  tagZaehlerKey,
  topAutorenKey,
  type TagZaehler,
  type TopAutor,
} from "../../lib/feed-sidebar";
import { Icon } from "../ui/icons";
import {
  addComment,
  addPostMedia,
  buildMentionResolver,
  commentsQueryKey,
  createPostWithMedia,
  feedListKey,
  feedSeitenKey,
  fetchPostById,
  postDeeplinkQueryKey,
  type FeedAuswahl,
  type FeedOrdnung,
  type FeedReiter,
  type FeedTyp,
  toggleSave,
  deletePost,
  fetchComments,
  fetchFeed,
  parseVideoUrl,
  removePostMedia,
  toggleLike,
  updatePost,
  ohneSchlussHashtags,
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
 * Community-Feed (AGE-250). Composer, Beitragsliste und die Filterspalte.
 *
 * Sichtbarkeit entscheidet AUSSCHLIESSLICH die RLS (siehe lib/feed.ts) — anon
 * sieht nur `public`, eingeloggte zusätzlich `members`/rang-gegated. Der Composer
 * ist nur für eingeloggte Mitglieder sichtbar.
 *
 * Die Liste ist seit AGE-582 nicht mehr zwingend chronologisch: Reiter, Ordnung,
 * Tagmenge und Beitragstyp bilden EINE Auswahl, die Abfrage und Cache-Schlüssel
 * gemeinsam bestimmen. Zwei der drei Reiter verlangen eine Kennung; ohne Sitzung
 * gibt es nur „Alle Beiträge", keinen Speichern-Knopf und keine Mitgliedernamen
 * (siehe `aktiverReiter` und die Sidebar).
 */
export default function CommunityFeed() {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  // Die Auswahl, die Abfrage UND Schlüssel bestimmt (AGE-582). Vier Achsen,
  // eine Quelle: die Anfrage und der Cache-Schlüssel lesen dieselben Werte,
  // damit nicht zwei Stellen gepflegt werden müssen.
  const [reiter, setReiter] = useState<FeedReiter>("alle");
  const [ordnung, setOrdnung] = useState<FeedOrdnung>("neueste");
  const [gewaehlteTags, setGewaehlteTags] = useState<string[]>([]);
  const [typ, setTyp] = useState<FeedTyp | null>(null);

  /**
   * Ohne Sitzung gibt es NUR „Alle Beiträge" (6.8).
   *
   * Abgeleitet und nicht als Zustand nachgeführt: „Beiträge von mir" und
   * „Gespeichert" verlangen eine Kennung, und `fetchFeed` wirft ohne sie (5.2).
   * Die Reiter erscheinen ausgeloggt gar nicht — aber eine Sitzung kann auch
   * ENDEN, während die Seite offen steht. Dann ist der gewählte Reiter mit
   * einem Schlag unerfüllbar, und die Ableitung fängt genau diesen Übergang.
   * Ein `useEffect`, der den Zustand zurückstellt, täte dasselbe eine Runde
   * später — und dazwischen liefe die Anfrage.
   */
  const aktiverReiter: FeedReiter = uid ? reiter : "alle";

  const auswahl: FeedAuswahl = useMemo(
    () => ({ reiter: aktiverReiter, ordnung, tags: gewaehlteTags, typ }),
    [aktiverReiter, ordnung, gewaehlteTags, typ],
  );

  // Seitenweise (AGE-528): eine feste Obergrenze ohne Nachladen wäre mit Bildern
  // eine stille Kappung — ältere Beiträge blieben unauffindbar. Der Cursor läuft
  // je Ordnung über einen eigenen Keyset-Pfad, siehe lib/feed.ts.
  //
  // Der Schlüssel trägt die ganze Auswahl (5.7). Deshalb braucht ein Wechsel von
  // Reiter, Ordnung, Tagmenge oder Typ KEIN Zurücksetzen von Hand: die neue
  // Auswahl ist eine andere Abfrage und beginnt bei ihrer ersten Seite. Ein
  // mitgeschleppter Cursor der alten Ordnung wäre in der neuen bedeutungslos.
  const feed = useInfiniteQuery({
    queryKey: feedSeitenKey(uid, auswahl),
    queryFn: ({ pageParam }) => fetchFeed({ uid, ...auswahl, cursor: pageParam }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (letzteSeite) => letzteSeite.nextCursor,
  });
  const geladenePosts = useMemo(
    () => (feed.data?.pages ?? []).flatMap((seite) => seite.posts),
    [feed.data],
  );

  /**
   * Der Deeplink `?post=<id>` (AGE-587) — aus den Aktivitäten-Karten beider
   * Profilflächen.
   *
   * Der Beitrag wird GEHOLT, nicht gesucht. Der erste Entwurf wollte bis zu
   * fünf Feed-Seiten durchlaufen; ein sichtbarer Beitrag auf Seite 6 wäre damit
   * unerreichbar gewesen, und zwar durch korrekten Code. Eine Anfrage über die
   * Kennung erreicht jeden sichtbaren Beitrag, unabhängig vom Alter.
   *
   * Der Parameter steht AUSDRÜCKLICH NICHT in `feedSeitenKey`. Er ändert
   * nicht, was der Feed lädt — stünde er darin, wäre jeder Deeplink eine andere
   * Abfrage und verwürfe den geladenen Feed samt aller nachgeladenen Seiten.
   */
  const [feedParameter] = useSearchParams();
  const verlinkteId = feedParameter.get("post");
  const verlinkter = useQuery({
    queryKey: postDeeplinkQueryKey(uid, verlinkteId ?? ""),
    queryFn: () => fetchPostById(uid, verlinkteId!),
    enabled: verlinkteId !== null,
  });

  /**
   * Der geholte Beitrag steht dem Feed VORAN und wird darunter herausgefiltert.
   * Ohne den Filter stünde er zweimal da und sähe wie ein Dublettenfehler aus.
   */
  const posts = useMemo(() => {
    const oben = verlinkter.data;
    if (!oben) return geladenePosts;
    return [oben, ...geladenePosts.filter((p) => p.id !== oben.id)];
  }, [geladenePosts, verlinkter.data]);

  /**
   * Nicht abrufbar — und das ist EINE Auskunft, nicht zwei.
   *
   * Ein vorhandener, aber unsichtbarer Beitrag liefert aus derselben Anfrage
   * dieselben null Zeilen wie ein erfundener. Es gibt hier deshalb kein `if`,
   * das die Fälle trennt: es gäbe nichts, woran es sie unterscheiden könnte,
   * und der Versuch wäre ein Existenz-Orakel.
   */
  const verlinkterFehlt = verlinkteId !== null && verlinkter.isSuccess && !verlinkter.data;

  // Erwähnungen (@name) werden gegen die im Feed bekannten Autoren aufgelöst — ein
  // Treffer wird zum Profil-Link, sonst bleibt es dezenter Akzent-Text (kein Fake-Link).
  const mentionResolver = useMemo(() => buildMentionResolver(posts.map((p) => p.author)), [posts]);

  // Signaturen JE SEITE, nicht je Bild und nicht für alles zusammen: der Token
  // steckt in der URL, und ein Schlüssel über alle geladenen Seiten würde beim
  // Nachladen auch die alten Bilder neu signieren — der Browser lüde sie dann
  // erneut. Je Seite bleibt die Zeichenkette stabil, solange die Seite es ist.
  //
  // Der VERLINKTE Beitrag bekommt eine eigene Abfrage in derselben Liste. Er
  // liegt in aller Regel ausserhalb der geladenen Seiten — das ist der Zweck
  // des Deeplinks —, und ohne diesen Eintrag bliebe genau sein Bild ohne
  // signierte URL. `PostMedien` verwürfe es dann stillschweigend, und die
  // Karte zeigte nur den Text (Diff-Review codex). Die Sichtprobe hat es nicht
  // gezeigt: ihre Fixtures trugen nur Text.
  const signaturSeiten = [
    ...(feed.data?.pages ?? []).map((seite) => seite.posts),
    ...(verlinkter.data ? [[verlinkter.data]] : []),
  ];
  const signaturen = useQueries({
    queries: signaturSeiten.map((seitenPosts) => {
      const pfade = seitenPosts.flatMap((p) => p.media.map((m) => m.storagePath));
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

  // Titelbilder der Event-Karten — JE SEITE signiert, aus demselben Grund wie
  // die Beitragsbilder darüber: ein Schlüssel über alle geladenen Seiten würde
  // beim Nachladen auch die alten Cover neu signieren, und der Browser lüde sie
  // erneut. Ein Pfad ohne Signatur ist der NORMALFALL (fremdes members-Event),
  // kein Fehler — die Karte erscheint dann ohne Bild.
  const coverSignaturen = useQueries({
    queries: signaturSeiten.map((seitenPosts) => {
      const pfade = seitenPosts
        .map((p) => p.event?.coverPath)
        .filter((pfad): pfad is string => !!pfad);
      return {
        queryKey: coverSignaturKey(uid, pfade),
        queryFn: () => signEventCovers(pfade),
        enabled: pfade.length > 0,
        staleTime: SIGNATUR_STALE_MS,
      };
    }),
  });
  const coverUrls: Record<string, string> = Object.assign(
    {},
    ...coverSignaturen.map((q) => q.data ?? {}),
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

  /**
   * Die zwei Aggregate der Spalte (6.6). Beide laufen `security invoker` — die
   * Zahlen hängen also am Betrachter, und die Schlüssel tragen ihn deshalb.
   *
   * `feed_top_authors` ist an `anon` NICHT vergeben (`profiles_public` hält
   * dort kein Recht). Ohne Sitzung wird die Abfrage deshalb gar nicht erst
   * gestellt — `enabled`, nicht ein Rückfall auf eine leere Liste: ein Fehler,
   * den eine Fläche als Null zeigt, ist die schlechteste aller Zahlen (6.8).
   * `feed_tag_counts` dagegen IST an `anon` vergeben und zählt dort
   * nachweislich nur öffentliche Beiträge.
   */
  const tagZaehler = useQuery({ queryKey: tagZaehlerKey(uid), queryFn: fetchTagZaehler });
  const topAutoren = useQuery({
    queryKey: topAutorenKey(uid),
    queryFn: fetchTopAutoren,
    enabled: uid !== null,
  });

  /** Ein Tag wird an- oder abgehakt. Mehrere wirken als ODER (`.overlaps()`),
   *  und genau das versprechen Auswahlkästchen auch. */
  function tagUmschalten(tag: string) {
    setGewaehlteTags((bisher) =>
      bisher.includes(tag) ? bisher.filter((t) => t !== tag) : [...bisher, tag],
    );
  }

  /** „Filter entfernen" — an ZWEI Stellen angeboten: im Filter-Banner und im
   *  Leerzustand der Liste. Beide leeren dieselben Achsen, und der Reiter und die
   *  Ordnung bleiben stehen, weil sie keine Filter sind. Steht das hier, kann
   *  eine dritte Achse nicht an einer der beiden Stellen vergessen werden
   *  (Befund gemini, LOW). */
  function filterLeeren() {
    setGewaehlteTags([]);
    setTyp(null);
  }

  return (
    <section>
      {/* Drei Rasterkinder, und die Reihenfolge im Markup ist die Reihenfolge auf
          dem Telefon (6.9): Composer, zusammengeklappte Filter, Feed. Auf breiten
          Schirmen setzt nur die Spalte sich ausdrücklich nach rechts oben; die
          beiden anderen sind auf Spalte 1 festgenagelt und finden ihre Zeile
          selbst. Damit beginnen Spalte und Composer oben bündig (6.1), ohne dass
          eine leere Zeile entsteht, wenn der Composer fehlt (ausgeloggt). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        {user && (
          <div className="lg:col-start-1">
            <PostComposer authorId={user.id} />
          </div>
        )}

        {/* Die Spannweite hängt daran, ob der Composer eine eigene Zeile
            belegt. Fest auf zwei gesetzt entstünde ausgeloggt eine LEERE zweite
            Zeile unter dem Feed — samt ihrem Abstand. */}
        <aside
          className={`lg:col-start-2 lg:row-start-1 ${user ? "lg:row-span-2" : "lg:row-span-1"}`}
        >
          <FeedSidebar
            zaehler={tagZaehler.data ?? []}
            zaehlerFehler={tagZaehler.isError}
            gewaehlteTags={gewaehlteTags}
            onTagUmschalten={tagUmschalten}
            autoren={topAutoren.data ?? []}
            autorenFehler={topAutoren.isError}
            zeigeAutoren={uid !== null}
            typ={typ}
            onTyp={setTyp}
          />
        </aside>

        <div className="space-y-6 lg:col-start-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ReiterLeiste aktiv={aktiverReiter} onWaehlen={setReiter} eingeloggt={uid !== null} />
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="whitespace-nowrap">Sortierung</span>
              <Select
                value={ordnung}
                onChange={(e) => setOrdnung(e.target.value as FeedOrdnung)}
                className="h-9 w-auto"
                aria-label="Sortierung"
              >
                {ORDNUNGEN.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {/* Die Zeile bleibt, obwohl die Haken in der Spalte stehen (AGE-528):
              auf dem Telefon ist die Spalte ZUSAMMENGEKLAPPT, und ohne diese
              Zeile sähe ein Mitglied dort nicht, dass überhaupt gefiltert
              wird — es sähe nur einen kurzen Feed. */}
          {(gewaehlteTags.length > 0 || typ !== null) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Gefiltert nach</span>
              {gewaehlteTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent-strong"
                >
                  #{tag}
                </span>
              ))}
              {typ && (
                <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent-strong">
                  {TYPEN.find((t) => t.value === typ)?.label}
                </span>
              )}
              <button
                type="button"
                onClick={filterLeeren}
                className="text-accent-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Filter entfernen
              </button>
            </div>
          )}

          {verlinkterFehlt && (
            <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
              Dieser Beitrag ist nicht verfügbar.
            </p>
          )}

          <FeedList
            posts={posts}
            isLoading={feed.isLoading}
            isError={feed.isError}
            hasNextPage={feed.hasNextPage}
            isFetchingNextPage={feed.isFetchingNextPage}
            onNextPage={() => void feed.fetchNextPage()}
            currentUserId={user?.id ?? null}
            gewaehlteTags={gewaehlteTags}
            onTagUmschalten={tagUmschalten}
            onFilterLeeren={filterLeeren}
            gefiltert={gewaehlteTags.length > 0 || typ !== null}
            mentionResolver={mentionResolver}
            bildUrls={bildUrls}
            onBildFehler={onBildFehler}
            kuratierteTags={tags.data ?? []}
            coverUrls={coverUrls}
          />
        </div>
      </div>
    </section>
  );
}

// ── Reiter, Ordnung, Sidebar ────────────────────────────────────────────────

/** Die drei Ordnungen (6.5). Ihre Werte sind die von `FeedOrdnung`; die
 *  Beschriftungen stehen hier und nicht in `lib/feed.ts`, weil die Datenschicht
 *  keine Sprache trägt. */
const ORDNUNGEN: { value: FeedOrdnung; label: string }[] = [
  { value: "neueste", label: "Neueste zuerst" },
  { value: "aelteste", label: "Älteste zuerst" },
  { value: "beliebteste", label: "Beliebteste" },
];

/** Die fünf wählbaren Beitragstypen (6.6). `null` heißt „alle". */
const TYPEN: { value: FeedTyp | ""; label: string }[] = [
  { value: "", label: "Alle Typen" },
  { value: "bild", label: "Bild" },
  { value: "video", label: "Video" },
  { value: "event", label: "Event" },
  { value: "text", label: "Text" },
];

const REITER: { value: FeedReiter; label: string }[] = [
  { value: "alle", label: "Alle Beiträge" },
  { value: "meine", label: "Beiträge von mir" },
  { value: "gespeichert", label: "Gespeichert" },
];

/**
 * Die Reiterleiste (6.4).
 *
 * Bewusst Knöpfe mit `aria-pressed` statt `role="tab"`: echte Reiter verlangen
 * Pfeiltasten-Navigation und einen wandernden `tabindex`, und eine halbe
 * Umsetzung davon ist für eine Vorleseausgabe schlechter als gar keine. Die
 * Datei führt dieselbe Form schon an den Tag-Chips.
 *
 * Ausgeloggt bleibt EIN Eintrag stehen (6.8) — die beiden anderen erscheinen
 * nicht, statt abgeblendet dazustehen: sie sind ohne Kennung nicht „gerade
 * nicht möglich", sondern gibt es nicht.
 */
function ReiterLeiste({
  aktiv,
  onWaehlen,
  eingeloggt,
}: {
  aktiv: FeedReiter;
  onWaehlen: (reiter: FeedReiter) => void;
  eingeloggt: boolean;
}) {
  const sichtbar = eingeloggt ? REITER : REITER.filter((r) => r.value === "alle");
  return (
    <div role="group" aria-label="Reiter" className="flex flex-wrap gap-1.5">
      {sichtbar.map((r) => {
        const gewaehlt = aktiv === r.value;
        return (
          <button
            key={r.value}
            type="button"
            aria-pressed={gewaehlt}
            onClick={() => onWaehlen(r.value)}
            className={`rounded-full px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              gewaehlt ? "bg-accent text-chrome" : "border border-line text-muted hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Die rechte Spalte (6.6, 6.7, 6.9).
 *
 * Sie trägt drei Dinge — Tags mit Zählern, die aktivsten Mitglieder und den
 * Beitragstyp — und verschwindet NICHT mehr, wenn es keinen kuratierten Tag mit
 * sichtbarem Beitrag gibt: die anderen beiden hängen davon nicht ab (6.7). Vorher
 * gab `TagFilter` in dem Fall `null` zurück und nahm die ganze Spalte mit.
 *
 * Auf dem Telefon ist sie ZUSAMMENGEKLAPPT und steht zwischen Composer und Feed
 * (6.9). Sie darf dort weder ungeklappt zwischen beide treten — sie wäre eine
 * Wand vor dem Inhalt — noch ersatzlos unter zwanzig Karten wandern, wo sie
 * niemand findet.
 *
 * EINE Fassung im DOM, nicht zwei: `hidden lg:block` schaltet die Fläche, statt
 * eine Telefon- und eine Schirmfassung nebeneinanderzustellen. Zwei Fassungen
 * lägen in jsdom beide im Baum, und jede Abfrage nach einem Kästchen fände es
 * doppelt.
 */
function FeedSidebar({
  zaehler,
  zaehlerFehler,
  gewaehlteTags,
  onTagUmschalten,
  autoren,
  autorenFehler,
  zeigeAutoren,
  typ,
  onTyp,
}: {
  zaehler: TagZaehler[];
  /** Ein gescheiterter Aufruf sieht sonst GENAU SO AUS wie „es gibt nichts" —
   *  beide Male keine Kästchen. Die Spalte behauptete damit etwas über den
   *  Bestand, was sie nicht weiß. Dieselbe Regel wie „keine Null aus einem
   *  Fehler", nur eine Ebene tiefer. */
  zaehlerFehler: boolean;
  gewaehlteTags: string[];
  onTagUmschalten: (tag: string) => void;
  autoren: TopAutor[];
  autorenFehler: boolean;
  zeigeAutoren: boolean;
  typ: FeedTyp | null;
  onTyp: (typ: FeedTyp | null) => void;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        aria-controls="feed-filter"
        className="mb-3 inline-flex w-full items-center justify-between rounded-md border border-line px-3 py-2 text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
      >
        Filter
        <Icon name="chevronDown" className={`h-4 w-4 ${offen ? "rotate-180" : ""}`} />
      </button>

      <div id="feed-filter" className={`space-y-4 ${offen ? "" : "hidden"} lg:block`}>
        {zaehlerFehler && (
          <Card>
            <p className="text-sm text-muted">Tags konnten nicht geladen werden.</p>
          </Card>
        )}

        {zaehler.length > 0 && (
          <Card className="space-y-3">
            <h2 className="font-display text-sm font-semibold text-ink">Beliebte Tags</h2>
            {/* Auswahlkästchen und keine Chips: sie versprechen Mehrfachauswahl,
                und genau die gibt es hier — mehrere Marken wirken als ODER. */}
            <ul className="space-y-1.5">
              {zaehler.map((t) => (
                <li key={t.key}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={gewaehlteTags.includes(t.key)}
                      onChange={() => onTagUmschalten(t.key)}
                      className="size-4 rounded border-line text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <span className="min-w-0 flex-1 truncate">{t.label}</span>
                    <span className="text-xs text-muted tabular-nums">{t.anzahl}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Nur mit Sitzung (6.8): `feed_top_authors` ist an `anon` nicht
            vergeben, und ein Mitgliedsname gehört ohnehin nicht ins
            Schaufenster. Angefordert wird die Liste dort gar nicht erst — das
            entscheidet `enabled` an der Abfrage, nicht diese Bedingung. */}
        {zeigeAutoren && autorenFehler && (
          <Card>
            <p className="text-sm text-muted">Aktivste Mitglieder konnten nicht geladen werden.</p>
          </Card>
        )}

        {zeigeAutoren && autoren.length > 0 && (
          <Card className="space-y-3">
            <h2 className="font-display text-sm font-semibold text-ink">Aktivste Mitglieder</h2>
            <ul aria-label="Aktivste Mitglieder" className="space-y-2">
              {autoren.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/p/${a.id}`}
                    className="flex items-center gap-2 text-sm text-ink hover:text-accent-strong"
                  >
                    <Avatar name={a.name} src={a.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="text-xs text-muted tabular-nums">{a.anzahl}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-ink">Beitragstyp</h2>
          <Select
            value={typ ?? ""}
            onChange={(e) => onTyp((e.target.value || null) as FeedTyp | null)}
            aria-label="Beitragstyp"
          >
            {TYPEN.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Card>
      </div>
    </>
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
  /** Ob das Videofeld sichtbar ist (6.3). Der Wert selbst steht in `videoUrl`
   *  und bleibt beim Zuklappen erhalten — deshalb hält das Feld sich offen,
   *  sobald etwas darin steht. */
  const [videoOffen, setVideoOffen] = useState(false);
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
      setVideoOffen(false);
      setVisibility("members");
      for (const bild of bilder) URL.revokeObjectURL(bild.vorschau);
      setBilder([]);
      setBildFehler(null);
      setGewaehlteTags([]);
      setOffen(false);
      toast({ variant: "success", title: "Beitrag veröffentlicht" });
      // Präfix-Invalidierung: alle Feed-Ansichten dieses Betrachters (jeder
      // Hashtag-Filter), damit ein mehrfach getaggter Beitrag nirgends veraltet.
      //
      // Und die zwei Sidebar-Zähler dazu (Befund codex, MEDIUM): ein neuer
      // Beitrag ändert BEIDE — er trägt Tags, und er zählt für seinen Autor.
      // Ihre Schlüssel liegen aber nicht unter `feed/list`, das Präfix erreicht
      // sie also nicht. Ohne die zwei Zeilen stünde der Beitrag in der Liste,
      // während die Zahl daneben noch die von vorhin ist — zwei Flächen
      // nebeneinander, die sich widersprechen.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: feedListKey(authorId) }),
        queryClient.invalidateQueries({ queryKey: tagZaehlerKey(authorId) }),
        queryClient.invalidateQueries({ queryKey: topAutorenKey(authorId) }),
      ]);
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

      {/* Das Feld erscheint auf Wunsch (6.3) — aber es VERSCHWINDET nicht mehr,
          sobald etwas darin steht. Der Composer hängt den Link beim
          Veröffentlichen an den Body; ein Fehlklick, der ihn unsichtbar macht,
          ergäbe einen Beitrag mit einem Video, von dem sein Verfasser nichts
          weiß. */}
      {(videoOffen || videoUrl.trim() !== "") && (
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
      )}

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
          {/* Die Medientyp-Zeile (6.3): sie benennt, was dieser Composer
              annimmt — Bild und Video, sonst nichts. KEIN „Event"-Knopf (Events
              entstehen in `/events` und erscheinen hier als eigene Karte) und
              KEIN „Umfrage"-Knopf (die gibt es nicht). Ein Knopf, dessen
              einziger Ausgang eine Enttäuschung ist, ist schlechter als kein
              Knopf.

              Ein `span` und kein `div`: die Zeile liegt INNERHALB der
              Aktionsgruppe, damit Donalds Anordnung vom 12.08. bestehen bleibt
              — Handelndes zusammen und nach rechts. */}
          <span role="group" aria-label="Medien" className="inline-flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center text-sm text-muted">
              {/* Beschriftung bleibt „Bild", bis auch Dateien gehen (AGE-532).
                  Ein Knopf, der „Datei anhängen" verspricht und nur Bilder
                  annimmt, ist schlechter als der genaue Name. */}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 transition-colors hover:text-ink">
                <Icon name="image" className="h-4 w-4" />
                Bild
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
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
            <button
              type="button"
              onClick={() => setVideoOffen((v) => !v)}
              aria-expanded={videoOffen || videoUrl.trim() !== ""}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon name="video" className="h-4 w-4" />
              Video
            </button>
          </span>
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
  gewaehlteTags,
  onTagUmschalten,
  onFilterLeeren,
  gefiltert,
  mentionResolver,
  bildUrls,
  onBildFehler,
  kuratierteTags,
  coverUrls,
}: {
  posts: FeedPost[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onNextPage: () => void;
  currentUserId: string | null;
  gewaehlteTags: string[];
  onTagUmschalten: (tag: string) => void;
  onFilterLeeren: () => void;
  /** Ob überhaupt gefiltert wird — Marken ODER Beitragstyp. Der leere Zustand
   *  muss weiter unterscheiden, ob es NICHTS gibt oder nur nichts Passendes. */
  gefiltert: boolean;
  mentionResolver: MentionResolver;
  bildUrls: Record<string, string>;
  onBildFehler: (pfad: string) => void;
  kuratierteTags: Tag[];
  coverUrls: Record<string, string>;
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
        title={gefiltert ? "Keine Beiträge zu diesem Filter" : "Noch keine Beiträge"}
        description={
          gefiltert
            ? "Zu dieser Auswahl gibt es noch nichts zu sehen."
            : "Teile den ersten Beitrag — ruhig und mit Substanz. Qualität vor Reichweite."
        }
        action={
          gefiltert ? (
            <Button variant="secondary" size="sm" onClick={onFilterLeeren}>
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
        {/* Zwei Kartentypen, EINE Liste: die Event-Karte steht chronologisch
            zwischen den Beiträgen, nicht als getrennte Liste daneben. */}
        {posts.map((post) => (
          <StaggerItem key={post.id}>
            {post.kind === "event" ? (
              <EventCard post={post} currentUserId={currentUserId} coverUrls={coverUrls} />
            ) : (
              <PostCard
                post={post}
                currentUserId={currentUserId}
                gewaehlteTags={gewaehlteTags}
                onTagUmschalten={onTagUmschalten}
                mentionResolver={mentionResolver}
                bildUrls={bildUrls}
                onBildFehler={onBildFehler}
                kuratierteTags={kuratierteTags}
              />
            )}
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
  gewaehlteTags,
  onTagUmschalten,
  mentionResolver,
  bildUrls,
  onBildFehler,
  kuratierteTags,
}: {
  post: FeedPost;
  currentUserId: string | null;
  gewaehlteTags: string[];
  onTagUmschalten: (tag: string) => void;
  mentionResolver: MentionResolver;
  bildUrls: Record<string, string>;
  onBildFehler: (pfad: string) => void;
  kuratierteTags: Tag[];
}) {
  // Ohne den abschliessenden Hashtag-Block: der steht als Chip unter dem
  // Beitrag, und beides zusammen zeigte dasselbe Wort zweimal (AGE-566).
  // Hashtags im Satzinneren bleiben — siehe `ohneSchlussHashtags`.
  const segments = useMemo(() => ohneSchlussHashtags(tokenizePostBody(post.body)), [post.body]);
  // Seit AGE-533 aus der Spalte, nicht aus einem erneuten Parsen des Bodys:
  // die Academy filtert über `posts.video_url`, und zwei Quellen fürs Rendern
  // könnten auseinanderlaufen. Die Spalte trägt denselben rohen Token, den der
  // Body enthält — `skipRaw` unterdrückt ihn deshalb weiterhin im Fließtext.
  const video = post.videoUrl;
  const author = displayAuthor(post.author, currentUserId !== null);

  // Bearbeiten darf nur der Verfasser, und nur an einem MITGLIEDSBEITRAG:
  // Event-Beiträge sind systemverwaltet, `posts_write_own` verlangt
  // `kind = 'member'`, und ein Knopf, dessen einziger Ausgang eine
  // RLS-Ablehnung ist, wäre eine Einladung zum Fehlklick (AGE-566).
  const eigener = currentUserId !== null && currentUserId === post.author.id;
  const bearbeitbar = eigener && post.kind === "member";
  const [bearbeiten, setBearbeiten] = useState(false);

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
        {bearbeitbar && !bearbeiten && (
          <button
            type="button"
            onClick={() => setBearbeiten(true)}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Bearbeiten
          </button>
        )}
      </header>

      {bearbeiten ? (
        <PostEditor
          post={post}
          uid={currentUserId as string}
          urls={bildUrls}
          onFertig={() => setBearbeiten(false)}
        />
      ) : (
        <>
          <PostBody
            segments={segments}
            skipRaw={video ?? undefined}
            mentionResolver={mentionResolver}
          />

          <PostMedien
            media={post.media}
            urls={bildUrls}
            onFehler={onBildFehler}
            autor={author.name}
          />
        </>
      )}

      {video && <VideoEmbed url={video} title={`Video von ${author.name}`} />}

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
                aria-pressed={gewaehlteTags.includes(tag)}
                onClick={() => onTagUmschalten(tag)}
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  gewaehlteTags.includes(tag)
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

      <InteraktionsLeiste post={post} currentUserId={currentUserId} />
    </Card>
  );
}

// ── Event-Karte ─────────────────────────────────────────────────────────────

/**
 * Ein Event im Feed (AGE-533).
 *
 * Sie steht INNERHALB derselben Liste wie die Beitragskarte, chronologisch
 * zwischen den übrigen Beiträgen — nicht als getrennte Liste daneben.
 *
 * Alles, was sie zeigt, kommt aus `post.event` und damit zur Laufzeit aus
 * `events`. Am Beitrag selbst steht davon nichts: ein umbenanntes Event ändert
 * die Darstellung beim nächsten Abruf, ohne dass irgendwo etwas nachgezogen
 * würde. Genau deshalb gibt es hier auch keinen `body` zu rendern.
 */
function EventCard({
  post,
  currentUserId,
  coverUrls,
}: {
  post: FeedPost;
  currentUserId: string | null;
  coverUrls: Record<string, string>;
}) {
  const event = post.event;
  // Ist das Event für den Betrachter nicht lesbar, liefert die Einbettung null.
  // Dann entfällt die Karte — sie erscheint NICHT leer.
  if (!event) return null;

  const coverUrl = event.coverPath ? coverUrls[event.coverPath] : undefined;

  return (
    <Card className="space-y-4">
      <header className="flex items-center gap-2 text-xs text-muted">
        <CalendarIcon />
        <span>Neues Event</span>
        <span>·</span>
        <span>{timeAgo(post.createdAt)}</span>
        <span>·</span>
        <span>{post.visibility === "members" ? "Nur für Mitglieder" : "Öffentlich"}</span>
      </header>

      {/* Ohne Signatur erscheint die Karte OHNE Bild, nicht gar nicht — der
          Bucket ist privat, und eine fehlende Signatur ist dort der Normalfall
          (fremdes members-Event), kein Fehler. */}
      {coverUrl && (
        /* Der Link braucht einen eigenen Namen: sein einziger Inhalt ist ein
           Bild mit leerem `alt`, und ein Screenreader läse sonst die rohe URL
           vor. Der sichtbare Titel darunter hilft ihm nicht — das ist ein
           zweiter Link (Befund opencode im Diff-Review, LOW). */
        <Link to={`/events/${event.id}`} className="block" aria-label={`Titelbild: ${event.title}`}>
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className="aspect-[3/1] w-full rounded-md object-cover"
          />
        </Link>
      )}

      <div className="space-y-1">
        <Link
          to={`/events/${event.id}`}
          className="font-display text-lg font-semibold text-ink hover:text-accent-strong"
        >
          {event.title}
        </Link>
        <p className="text-sm text-muted">
          {formatEventDate(event.startsAt)}
          {event.location && <> · {event.location}</>}
        </p>
      </div>

      <div>
        <Link to={`/events/${event.id}`}>
          <Button variant="secondary" size="sm">
            Zum Event
          </Button>
        </Link>
      </div>

      <InteraktionsLeiste post={post} currentUserId={currentUserId} />
    </Card>
  );
}

// ── Likes und Kommentare — von BEIDEN Kartentypen benutzt ───────────────────

/**
 * Der Interaktionsbereich einer Karte (AGE-533).
 *
 * Bewusst GETEILT und nicht kopiert: unter einer Event-Karte liegt dieselbe
 * `posts`-Zeile wie unter einem Textbeitrag, Likes und Kommentare funktionieren
 * dort also ohne Sonderweg. Zwei Fassungen desselben Bereichs würden driften —
 * und die Spec sagt diese Gleichheit ausdrücklich zu.
 */
function InteraktionsLeiste({
  post,
  currentUserId,
}: {
  post: FeedPost;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(false);

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

  /**
   * Speichern und Lösen (6.10, und damit 5.11).
   *
   * Die Invalidierung läuft über `feedListKey` und damit über den PRÄFIX jeder
   * Auswahl (5.7): sie schreibt den Zustand dieser Karte UND den Reiter
   * „Gespeichert" gemeinsam fort. Ohne das zeigte die eine Fläche einen Zustand,
   * den die andere schon verworfen hat — ein gelöster Beitrag stünde beim
   * nächsten Betreten weiter unter den gespeicherten.
   */
  const save = useMutation({
    mutationFn: () =>
      toggleSave({ postId: post.id, profileId: currentUserId as string, saved: post.savedByMe }),
    onSuccess: () =>
      /* Das Promise wird ZURÜCKGEGEBEN (Befund codex, MEDIUM). Ohne das endet
         `isPending`, sobald der Schreibvorgang durch ist — aber `post.savedByMe`
         stammt aus der Liste und trägt bis zum Nachladen noch den alten Wert.
         In diesem Fenster ist der Knopf wieder aktiv und zeigt den Zustand von
         vorhin; ein zweiter Klick schickte deshalb DIESELBE Anweisung noch
         einmal statt zurückzuschalten — beim Speichern ein doppelter Schlüssel
         und eine Fehlermeldung für etwas, das gelungen ist. */
      queryClient.invalidateQueries({ queryKey: feedListKey(currentUserId) }),
    onError: (error) => {
      toast({ variant: "error", title: "Aktion fehlgeschlagen", description: errorMessage(error) });
    },
  });

  return (
    <>
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
        {/* Ohne Sitzung erscheint der Knopf GAR NICHT (6.8) — nicht abgeblendet
            wie Herz und Kommentar daneben. Die beiden zeigen eine Zahl, die auch
            ein Ausgeloggter lesen darf; Speichern hat nichts anzuzeigen, was
            ohne Kennung bestünde.

            Der Name bleibt in beiden Zuständen derselbe: der Zustand steht in
            `aria-pressed` und im gefüllten Symbol. Ein Knopf, der zeitweise
            „Gespeichert" hiesse, trüge denselben Namen wie der Reiter.

            Und er heisst „Beitrag speichern", nicht „Speichern": beim
            Bearbeiten steht der Absendeknopf des Editors mit genau diesem Namen
            auf DERSELBEN Karte. Für eine Vorleseausgabe wären das zwei gleich
            benannte Bedienelemente mit völlig verschiedener Wirkung. */}
        {currentUserId && (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            aria-pressed={post.savedByMe}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-md px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${
              post.savedByMe ? "text-accent-strong" : "text-muted hover:text-ink"
            }`}
          >
            <Icon name="bookmark" variant={post.savedByMe ? "solid" : "line"} className="h-4 w-4" />
            <span className="sr-only">Beitrag speichern</span>
          </button>
        )}
      </footer>

      {/* Die letzten Kommentare stehen OFFEN unter dem Beitrag, statt hinter
          einem Klick (AGE-566). Ein Feed, in dem jede Antwort erst
          aufgeklappt werden muss, sieht aus wie ein Feed ohne Antworten —
          und das Gespräch ist hier das Produkt.

          Geladen wird nur, wo es etwas zu laden GIBT: ohne die Bedingung auf
          `commentCount` stellte jede Karte eine eigene Abfrage, auch die
          zwanzig ohne einen einzigen Kommentar. */}
      {(showComments || post.commentCount > 0) && (
        <CommentThread postId={post.id} currentUserId={currentUserId} ausgeklappt={showComments} />
      )}
    </>
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

  const weiter = (schritt: number) => onIndex((index + schritt + media.length) % media.length);

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

/** Wie viele Kommentare ohne Zutun sichtbar sind. */
const KOMMENTAR_VORSCHAU = 2;

function CommentThread({
  postId,
  currentUserId,
  ausgeklappt = false,
}: {
  postId: string;
  currentUserId: string | null;
  /** Über den Kommentar-Knopf der Leiste geöffnet: alles zeigen, samt Eingabe. */
  ausgeklappt?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  /** „mehr" innerhalb der Vorschau — unabhängig vom Knopf in der Leiste. */
  const [alleZeigen, setAlleZeigen] = useState(false);

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

  const alle = comments.data ?? [];
  const zeigeAlle = ausgeklappt || alleZeigen;
  // Die LETZTEN zwei, nicht die ersten: `fetchComments` liefert aufsteigend,
  // und der jüngste Beitrag zum Gespräch ist der, der den Feed lebendig macht.
  const sichtbar = zeigeAlle ? alle : alle.slice(-KOMMENTAR_VORSCHAU);
  const verborgen = alle.length - sichtbar.length;

  return (
    <div className="space-y-3 border-t border-line pt-4">
      {comments.isLoading && <p className="text-sm text-muted">Kommentare werden geladen…</p>}
      {comments.isError && (
        <p className="text-sm text-danger">Kommentare konnten nicht geladen werden.</p>
      )}

      {verborgen > 0 && (
        <button
          type="button"
          onClick={() => setAlleZeigen(true)}
          className="rounded-md text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {verborgen === 1
            ? "1 weiteren Kommentar anzeigen"
            : `${verborgen} weitere Kommentare anzeigen`}
        </button>
      )}

      {sichtbar.map((c) => {
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

      {/* Nur im aufgeklappten Zustand: in der Vorschau erscheint der Bereich
          ausschliesslich, wenn es schon Kommentare GIBT — „noch keine" wäre
          dort eine Aussage über einen Beitrag, den niemand geöffnet hat. */}
      {ausgeklappt && alle.length === 0 && !comments.isLoading && (
        <p className="text-sm text-muted">Noch keine Kommentare. Sei der/die Erste.</p>
      )}

      {/* Die Eingabe gehört zum Aufklappen. Ein Textfeld unter JEDEM Beitrag des
          Feeds wäre zwanzig Aufforderungen auf einem Bildschirm — die Vorschau
          soll zeigen, dass gesprochen wird, nicht zum Sprechen drängen. */}
      {currentUserId && ausgeklappt && (
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
  return <Icon name="heart" variant={filled ? "solid" : "line"} className="h-4 w-4" />;
}

function CalendarIcon() {
  return <Icon name="calendar" className="h-3.5 w-3.5" />;
}

function CommentIcon() {
  return <Icon name="comment" className="h-4 w-4" />;
}

// ── Beitrag bearbeiten (AGE-566) ────────────────────────────────────────────

/**
 * Text, Sichtbarkeit und Bilder eines eigenen Beitrags ändern.
 *
 * WARUM DIE BILDER SOFORT WIRKEN UND DER TEXT ERST BEIM SPEICHERN:
 * Ein Bild lebt in zwei Welten — einer Zeile in `post_media` und einem Objekt
 * im Bucket. Beides bis zum „Speichern" aufzuheben hiesse, Hochladen,
 * Löschen und Textänderung in EINE Zusage zu bündeln, die keine Transaktion
 * trägt: bricht der Lauf in der Mitte ab, bleibt ein halber Zustand zurück, den
 * niemand sieht und niemand aufräumt. Jede Bildänderung ist deshalb für sich
 * abgeschlossen und sofort belegt, der Text bleibt ein Formular.
 *
 * Das ist ehrlicher als ein „Speichern", das drei Dinge verspricht und zwei
 * halten kann — und es sagt es dem Mitglied auch (Hinweiszeile unten).
 */
function PostEditor({
  post,
  uid,
  urls,
  onFertig,
}: {
  post: FeedPost;
  uid: string;
  urls: Record<string, string>;
  onFertig: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState(post.body);
  const [sichtbarkeit, setSichtbarkeit] = useState<PostVisibility>(
    post.visibility as PostVisibility,
  );
  const [laedt, setLaedt] = useState(false);

  function neuLaden() {
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  const speichern = useMutation({
    mutationFn: () =>
      updatePost({
        postId: post.id,
        alterText: post.body,
        alteHashtags: post.hashtags,
        body: text,
        visibility: sichtbarkeit,
      }),
    onSuccess: () => {
      neuLaden();
      onFertig();
      toast({ title: "Beitrag geändert", variant: "success" });
    },
    onError: (e) =>
      toast({ variant: "error", title: "Ändern fehlgeschlagen", description: errorMessage(e) }),
  });

  const loeschen = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      neuLaden();
      toast({ title: "Beitrag gelöscht", variant: "success" });
    },
    onError: (e) =>
      toast({ variant: "error", title: "Löschen fehlgeschlagen", description: errorMessage(e) }),
  });

  const bildWeg = useMutation({
    mutationFn: (m: FeedMedia) => removePostMedia(m.storagePath),
    onSuccess: () => {
      neuLaden();
      toast({ title: "Bild entfernt", variant: "success" });
    },
    onError: (e) => toast({ variant: "error", title: "Bild bleibt", description: errorMessage(e) }),
  });

  async function bilderWaehlen(dateien: File[]) {
    const frei = MAX_BILDER - post.media.length;
    if (frei <= 0) {
      toast({ variant: "error", title: `Mehr als ${MAX_BILDER} Bilder gehen nicht` });
      return;
    }
    setLaedt(true);
    try {
      const fertig: { blob: Blob; width: number; height: number }[] = [];
      for (const datei of dateien.slice(0, frei)) {
        const { blob, width, height } = await shrinkToWebp(datei);
        fertig.push({ blob, width, height });
      }
      // `sort` läuft hinter dem höchsten bestehenden Wert weiter — die Spalte
      // trägt `unique (post_id, sort)`.
      const abSort = post.media.reduce((max, m) => Math.max(max, m.sort), -1) + 1;
      await addPostMedia({ uid, postId: post.id, abSort, bilder: fertig });
      neuLaden();
      toast({
        title: fertig.length === 1 ? "Bild hinzugefügt" : "Bilder hinzugefügt",
        variant: "success",
      });
    } catch (fehler) {
      toast({
        variant: "error",
        title: "Hinzufügen fehlgeschlagen",
        description: errorMessage(fehler),
      });
    } finally {
      setLaedt(false);
    }
  }

  const beschaeftigt = speichern.isPending || loeschen.isPending || bildWeg.isPending || laedt;

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-soft/40 p-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        aria-label="Beitragstext bearbeiten"
      />

      {post.media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.media.map((m) => (
            <div key={m.storagePath} className="relative">
              <img
                src={urls[m.storagePath]}
                alt=""
                className="h-20 w-20 rounded-[var(--radius-card)] object-cover"
              />
              <button
                type="button"
                disabled={beschaeftigt}
                onClick={() => bildWeg.mutate(m)}
                aria-label="Bild entfernen"
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-canvas text-sm text-ink shadow-soft hover:bg-danger hover:text-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">
          <span className="sr-only">Bilder hinzufügen</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={beschaeftigt || post.media.length >= MAX_BILDER}
            onChange={(e) => {
              const dateien = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (dateien.length > 0) void bilderWaehlen(dateien);
            }}
            className="text-sm text-muted"
          />
        </label>
        <Select
          value={sichtbarkeit}
          onChange={(e) => setSichtbarkeit(e.target.value as PostVisibility)}
          aria-label="Sichtbarkeit"
          className="w-auto"
        >
          {VISIBILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Sagt, was sofort gilt — siehe die Notiz über dieser Komponente. */}
      <p className="text-xs text-muted">
        Bildänderungen wirken sofort. Text und Sichtbarkeit erst mit „Speichern".
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={beschaeftigt || text.trim() === ""}
          onClick={() => speichern.mutate()}
        >
          Speichern
        </Button>
        <Button size="sm" variant="ghost" disabled={beschaeftigt} onClick={onFertig}>
          Abbrechen
        </Button>
        <button
          type="button"
          disabled={beschaeftigt}
          onClick={() => {
            // Namentliche Rückfrage wäre hier zu viel Apparat für einen eigenen
            // Beitrag — aber ungefragt löschen ist unumkehrbar. Ein `confirm`
            // wäre ein blockierender Browserdialog; stattdessen zwei Klicks.
            if (loeschen.isIdle) loeschen.mutate();
          }}
          className="ml-auto rounded-md px-2 py-1 text-sm text-danger transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          Beitrag löschen
        </button>
      </div>
    </div>
  );
}
