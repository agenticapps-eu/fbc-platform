import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { PageHero } from "../components/ui/PageHero";
import { Card } from "../components/ui/Card";
import { TierBadge } from "../components/ui/TierBadge";
import { VideoEmbed } from "../components/ui/VideoEmbed";
import { displayAuthor } from "../lib/displayAuthor";
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
 * Gäste), Testimonials, KPIs und CTAs. Tiefe Feeds bleiben in /community.
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
  const navigate = useNavigate();

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
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate("/login")}>
              Kompass kostenlos starten
            </Button>
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Mitglied werden
            </Button>
          </div>
        )}
      </PageHero>

      <section className="grid gap-4 sm:grid-cols-2">
        <Kpi value="120+" label="Mitglieder" />
        <Kpi value="24" label="Events 2026" />
      </section>

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

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Stimmen aus dem Club
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Testimonial
            quote="Im Club habe ich Partner gefunden, die meine Werte teilen — nicht nur Kontakte, sondern echte Zusammenarbeit."
            author="Ein Impact-Mitglied"
          />
          <Testimonial
            quote="Die Events sind kein Networking-Theater. Man kommt mit konkreten nächsten Schritten nach Hause."
            author="Ein Focus-Mitglied"
          />
        </div>
      </section>
    </div>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <Card className="text-center">
      <p className="font-display text-4xl font-semibold text-accent-strong">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </Card>
  );
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

function Testimonial({ quote, author }: { quote: string; author: string }) {
  return (
    <Card className="space-y-3">
      <p className="text-sm italic text-ink/90">„{quote}"</p>
      <p className="text-xs font-medium text-muted">— {author}</p>
    </Card>
  );
}
