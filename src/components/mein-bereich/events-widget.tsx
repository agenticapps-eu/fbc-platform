import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { CardLink, DashboardCard, dateFmt, formatDate } from "./building-blocks";
import { isPastEvent } from "../../lib/events";
import { type DashboardData } from "../../lib/dashboard";

// 4 ── Meine Events ──────────────────────────────────────────────────────────
// Echte Buchungen (gebucht/vergangen) und selbst gehostete Events.
//
// AGE-494: Der Leerzustand zeigte bis hierher ZWEI ERFUNDENE EVENTS mit
// „Demo"-Marke (profile-spec §5). Am 17.08. melden sich ~70 Menschen zum ersten
// Mal an und hätten alle diese beiden Termine gesehen — erfundene Daten sind ein
// schlechterer erster Eindruck als eine ehrliche Leere, und sie machen aus einer
// Plattform ein Technik-Projekt. Jetzt steht dort, was als Nächstes zu tun ist.
export function EventsWidget({ data }: { data: DashboardData }) {
  const now = new Date();
  const booked = data.events.filter((e) => e.event && e.status !== "cancelled");
  const upcoming = booked.filter((e) => !isPastEvent(e.event!.starts_at, now));
  const past = booked.filter((e) => isPastEvent(e.event!.starts_at, now));
  const hosted = data.hostedEvents;
  const isEmpty = booked.length === 0 && hosted.length === 0;

  if (isEmpty) {
    return (
      <DashboardCard
        id="events"
        title="Meine Events"
        action={<CardLink to="/events">Alle anzeigen</CardLink>}
      >
        <EmptyState
          title="Noch nichts gebucht"
          description="Hier sammeln sich die Termine, zu denen du dich angemeldet hast — und die, die du selbst ausrichtest."
          action={
            <Link to="/events">
              <Button variant="primary" size="sm">
                Events ansehen
              </Button>
            </Link>
          }
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      id="events"
      title="Meine Events"
      action={<CardLink to="/events">Alle anzeigen</CardLink>}
    >
      <div className="flex flex-col gap-4">
        <EventGroup
          title="Gebucht"
          rows={upcoming.map((e) => e.event!)}
          empty="Keine kommenden Buchungen."
        />
        {past.length > 0 && (
          <EventGroup title="Vergangen" rows={past.map((e) => e.event!)} empty="" />
        )}
        {hosted.length > 0 && <EventGroup title="Eigene Events" rows={hosted} empty="" />}
      </div>
    </DashboardCard>
  );
}

function EventGroup({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: {
    id: string;
    title: string;
    type: string | null;
    starts_at: string | null;
    location: string | null;
  }[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/events/${r.id}`}
                className="flex items-start justify-between gap-3 hover:text-accent-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                  <p className="truncate text-xs text-muted">
                    {formatDate(r.starts_at, dateFmt)}
                    {r.location && <> · {r.location}</>}
                  </p>
                </div>
                {r.type && <Badge variant="soft">{r.type}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
