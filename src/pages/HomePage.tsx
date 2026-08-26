import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { buttonKlassen } from "../components/ui/Button";
import { PageHero } from "../components/ui/PageHero";
import { Card } from "../components/ui/Card";
import { TierBadge } from "../components/ui/TierBadge";
import { VideoEmbed } from "../components/ui/VideoEmbed";
import { LEVELS, LEVEL_ORDER } from "../config/levels";
import { displayAuthor } from "../lib/displayAuthor";
import { REGISTRIEREN_PFAD } from "./LoginPage";
import {
  eventsListKey,
  fetchEvents,
  formatEventDate,
  partitionEvents,
  type EventListItem,
} from "../lib/events";
import { fetchFeed, feedQueryKey, type FeedPost } from "../lib/feed";
import { MemberDashboard } from "../components/home/MemberDashboard";
import { useAuth } from "../providers/auth-context";

/**
 * Öffentliche Startseite (`/`) — eine kuratierte Übersicht ÜBER den Community-
 * Formaten, für alle (auch ausgeloggte) Besucher sichtbar. Sie ist NICHT die
 * Community selbst: kommende Events, neue öffentliche Beiträge (anonymisiert für
 * Gäste) und eine Schiene mit den Mitgliedsstufen. Tiefe Feeds bleiben in
 * /community.
 *
 * Was hier BEWUSST NICHT steht (AGE-541): Kennzahlen und Stimmen. „120+
 * Mitglieder" neben rund siebzig echten Konten und zwei Zitate, zugeschrieben
 * an „Ein Impact-Mitglied", waren erfunden. Sie sind ersatzlos entfallen, nicht
 * durch echte Zähler ersetzt — ein Zähler ist eine Produktentscheidung, kein
 * Nebenprodukt des Aufräumens.
 *
 * Datenschicht: beides RLS-gegated und für anon nutzbar — `fetchEvents` liefert nur
 * sichtbare Events, `fetchFeed` für anon NUR `visibility = 'public'` (posts_select_by_
 * visibility). Daher kein eigenes „Public-Only"-Fetching nötig; Identität der Autoren
 * wird rein für die Anzeige über `displayAuthor` maskiert (Gäste sehen „Ein Mitglied").
 */
export default function HomePage() {
  const { user } = useAuth();
  if (user) return <MemberDashboard uid={user.id} />;
  return <PublicHome />;
}

/**
 * Öffentliche Startseite für Gäste (nicht eingeloggt). Eingeloggte Mitglieder
 * sehen stattdessen ihr persönliches Dashboard (<MemberDashboard>, Nav-IA §3).
 */
function PublicHome() {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const eventsQuery = useQuery({
    queryKey: eventsListKey(uid),
    queryFn: () => fetchEvents(uid),
  });
  const feedQuery = useQuery({
    queryKey: feedQueryKey(uid, null),
    queryFn: () => fetchFeed({ uid }),
  });

  const upcoming = eventsQuery.data
    ? partitionEvents(eventsQuery.data, new Date()).upcoming.slice(0, 4)
    : [];
  const posts = (feedQuery.data?.posts ?? []).slice(0, 3);

  return (
    <div className="space-y-12">
      <PageHero
        image="/images/hero-start.webp"
        title="Willkommen im Fair Business Club"
        subtitle="Das Business-Netzwerk, das auf Werten statt Visitenkarten aufbaut: lerne andere Mitglieder kennen, entdecke Events und finde die richtigen Verbindungen."
      >
        {!user && (
          // Beide laden zum Beitritt ein und landeten bis AGE-616 im
          // LOGIN-Formular: `mode` war lokaler Zustand ohne Adresse. Wer auf
          // „Mitglied werden" klickt und ein Anmeldeformular bekommt, wird
          // aufgefordert, etwas zu tun, was er gerade nicht kann.
          //
          // LINKS, keine Knöpfe: seit die Registrierung eine Adresse hat, soll
          // man sie auch in einem neuen Tab öffnen können, und ein Screenreader
          // soll „Link" sagen für etwas, das navigiert. Der Diff-Review hat
          // zusätzlich gezeigt, dass ein Knopf hier den Test unterläuft — eine
          // Abfrage nach `role: link` fand ihn nicht, ein Rückfall auf
          // `/login` wäre also grün durchgegangen.
          <div className="flex flex-wrap gap-3">
            <Link to={REGISTRIEREN_PFAD} className={buttonKlassen("primary")}>
              Kompass kostenlos starten
            </Link>
            <Link to={REGISTRIEREN_PFAD} className={buttonKlassen("ghost")}>
              Mitglied werden
            </Link>
          </div>
        )}
      </PageHero>

      {/* ZWEI Spalten wie auf der eingeloggten Startseite — dasselbe Raster wie
          `MemberDashboard`, NICHT das des Feeds (`1fr/16rem`): die beiden sind
          verschieden, und eine Startseite ist die nähere Entsprechung einer
          Startseite. Der Seitenkopf läuft darüber über die volle Breite; in der
          schmaleren Hauptspalte litten sein langer Untertitel und die zwei
          Knöpfe.

          Unterhalb von `lg` bricht es auf eine Spalte um, und die Schiene
          wandert UNTER den Leseinhalt — sie ist Beiwerk, nicht der Anfang. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="space-y-12">
      <section className="space-y-4">
        <SectionHeader title="Neue Events" to="/events" linkLabel="Alle Events" />
        {eventsQuery.isLoading ? (
          <p className="text-sm text-muted">Events werden geladen…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted">Aktuell sind keine Events geplant.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((event) => (
              <li key={event.id}>
                <EventPreview event={event} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Neue öffentliche Beiträge"
          to="/aktivitaet"
          linkLabel="Zur Aktivität"
        />
        {feedQuery.isLoading ? (
          <p className="text-sm text-muted">Beiträge werden geladen…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted">Noch keine öffentlichen Beiträge.</p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id}>
                <PostPreview post={post} isLoggedIn={!!user} />
              </li>
            ))}
          </ul>
        )}
      </section>

        </div>

        <Stufenschiene />
      </div>
    </div>
  );
}

/**
 * Die rechte Schiene der Gästeseite (AGE-616).
 *
 * Inhalt bewusst nur, was ohne Abfrage echt ist: die Stufen, die die Anwendung
 * ohnehin definiert, und eine Einladung. Auf dieser Seite standen bis AGE-541
 * vier erfundene Angaben; die Schiene ist nicht der Ort, an dem neue entstehen.
 *
 * Gelesen wird aus `LEVEL_ORDER` und `LEVELS`, nicht aus einer abgeschriebenen
 * Liste: eine zweite Liste driftet von dem weg, was die Plattform verkauft.
 */
function Stufenschiene() {
  return (
    <aside className="space-y-4" aria-labelledby="stufen-titel">
      <h2
        id="stufen-titel"
        className="font-display text-2xl font-semibold tracking-tight text-ink"
      >
        Mitglied werden
      </h2>
      <p className="text-sm text-muted">
        Sechs Stufen, aufsteigend. Du startest kostenlos und wechselst, wenn du mehr brauchst.
      </p>

      <ul className="space-y-2">
        {LEVEL_ORDER.map((key) => {
          const stufe = LEVELS[key];
          return (
            <li key={key}>
              <Card className="p-4" padded={false}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">{stufe.label}</span>
                  <span className="shrink-0 text-sm text-muted">{preis(stufe)}</span>
                </div>
                {stufe.priceYear > 0 && (
                  <p className="text-xs text-muted">oder {stufe.priceMonth} € monatlich</p>
                )}
                <p className="mt-1 text-sm text-muted">{stufe.summary}</p>
              </Card>
            </li>
          );
        })}
      </ul>

      <Link to={REGISTRIEREN_PFAD} className={buttonKlassen("primary", "md", "w-full")}>
        Mitglied werden
      </Link>
    </aside>
  );
}

/** Preis mit Intervall, nicht als nackte Zahl — und „kostenlos" statt „0 €",
 *  weil eine Null neben fünf Preisen wie ein Fehler aussieht.
 *
 *  Der JAHRESPREIS steht vorn, der Monatspreis darunter. Das ist keine Frage
 *  des Geschmacks: bei `discover` sind es 150 € im Jahr, aber 15 € im Monat —
 *  zwölf Monate ergäben 180. Der Monatspreis allein verschwiege also, dass die
 *  Jahreszahlung günstiger ist, und das wäre auf genau der Seite falsch, deren
 *  Zweck es ist, keine unbelegten Angaben mehr zu machen. */
function preis(stufe: { priceMonth: number; priceYear: number }) {
  if (stufe.priceMonth === 0 && stufe.priceYear === 0) return "kostenlos";
  return `${stufe.priceYear} € / Jahr`;
}

function SectionHeader({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <Link to={to} className="text-sm font-medium text-accent-strong hover:underline">
        {linkLabel} →
      </Link>
    </div>
  );
}

function EventPreview({ event }: { event: EventListItem }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="block h-full rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-soft"
    >
      {/* `h-full` an Link und Karte: seit der Untertitel umbricht, ist eine Karte
          der Reihe zweizeilig und die andere einzeilig. Ohne das füllt die
          niedrigere Karte ihre Rasterzelle nicht und die Reihe steht ungleich. */}
      <Card className="h-full space-y-2 transition-colors hover:border-accent/50">
        <h3 className="font-display text-lg font-semibold text-ink">{event.title}</h3>
        {/* Kein `truncate`: Datum und Ort sind beide Information. Eine vollständige
            Veranstaltungsadresse braucht bei 1440 px rund 591 px in einem 495-px-Kasten
            und wurde mitten im Straßennamen abgeschnitten (AGE-612). */}
        <p className="text-sm text-muted">
          {formatEventDate(event.startsAt)}
          {event.location && <> · {event.location}</>}
        </p>
      </Card>
    </Link>
  );
}

export function PostPreview({ post, isLoggedIn }: { post: FeedPost; isLoggedIn: boolean }) {
  const author = displayAuthor(post.author, isLoggedIn);
  // Wie im Community-Feed (CommunityFeed/PostBody skipRaw): ein enthaltenes
  // Video wird eingebettet, und seine nackte URL fällt aus dem Vorschautext —
  // sonst stünde auf der Startseite der rohe YouTube-Link statt des Players.
  //
  // Die URL kommt seit AGE-533 aus `post.videoUrl`, nicht mehr aus einem
  // erneuten Parsen des Bodys. Sonst gäbe es zwei Quellen fürs Rendern, und die
  // Academy — die über die Spalte filtert — könnte Beiträge zeigen, deren Karte
  // etwas anderes einbettet. Die Spalte trägt denselben rohen Token, den der
  // Body enthält, deshalb schneidet `replace` ihn weiterhin sauber heraus.
  const video = post.videoUrl;
  // Ein Event-Beitrag trägt einen LEEREN Body (AGE-533). Ohne diese Zeile
  // stünde auf der Startseite eine Vorschaukarte ganz ohne Text. Titel und
  // Datum kommen zur Laufzeit aus `events`, nicht aus dem Beitrag.
  const text =
    post.kind === "event" && post.event
      ? `Neues Event: ${post.event.title}`
      : video
        ? post.body.replace(video, "").trim()
        : post.body;
  return (
    <Card className="space-y-3">
      <header className="flex items-center gap-3">
        {author.masked ? (
          <Avatar
            name={author.name}
            src={author.avatarUrl}
            masked
            size="sm"
            className="ring-1 ring-accent/40"
          />
        ) : (
          <Link to={`/p/${post.author.id}`} className="shrink-0">
            <Avatar
              name={author.name}
              src={author.avatarUrl}
              size="sm"
              className="ring-1 ring-accent/40"
            />
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-2">
          {author.masked ? (
            <span className="font-display text-sm font-semibold text-ink">{author.name}</span>
          ) : (
            <>
              <Link
                to={`/p/${post.author.id}`}
                className="font-display text-sm font-semibold text-ink hover:text-accent-strong"
              >
                {author.name}
              </Link>
              {post.author.tier && <TierBadge tier={post.author.tier} />}
            </>
          )}
        </div>
      </header>
      {text && <p className="line-clamp-3 text-sm text-ink/90">{text}</p>}
      {video && <VideoEmbed url={video} title={`Video von ${author.name}`} />}
    </Card>
  );
}

