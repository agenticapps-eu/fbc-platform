import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { CardLink, DashboardCard, dateFmt, formatDate } from "./building-blocks";
import { isPastEvent } from "../../lib/events";
import { type DashboardData, type DashboardEvent } from "../../lib/dashboard";

const DEMO_EVENTS: DashboardEvent[] = [
  {
    status: "registered",
    checked_in: false,
    event: {
      id: "demo-1",
      title: "Legacy Dinner Stuttgart",
      type: "dinner",
      starts_at: "2026-07-02T18:00:00Z",
      location: "Stuttgart",
    },
  },
  {
    status: "registered",
    checked_in: false,
    event: {
      id: "demo-2",
      title: "Mastermind: Nachfolge & Beteiligung",
      type: "mastermind",
      starts_at: "2026-07-14T16:00:00Z",
      location: "Online",
    },
  },
];

// 4 ── Meine Events (CORE soweit Daten, sonst DEMO) ────────────────────────────
// Echte Buchungen (gebucht/vergangen) und selbst gehostete Events. DEMO nur, wenn
// das Mitglied noch gar keine Events hat (profile-spec §5: Leerzustand zeigt Demo).
export function EventsWidget({ data }: { data: DashboardData }) {
  const now = new Date();
  const booked = data.events.filter((e) => e.event && e.status !== "cancelled");
  const upcoming = booked.filter((e) => !isPastEvent(e.event!.starts_at, now));
  const past = booked.filter((e) => isPastEvent(e.event!.starts_at, now));
  const hosted = data.hostedEvents;
  const isDemo = booked.length === 0 && hosted.length === 0;

  if (isDemo) {
    return (
      <DashboardCard
        id="events"
        title="Meine Events"
        demo
        action={<CardLink to="/events">Alle anzeigen</CardLink>}
      >
        <ul className="flex flex-col gap-3">
          {DEMO_EVENTS.map((row, i) => (
            <li key={row.event?.id ?? i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {row.event?.title ?? "Event"}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(row.event?.starts_at ?? null, dateFmt)}
                  {row.event?.location && <> · {row.event.location}</>}
                </p>
              </div>
              {row.event?.type && <Badge variant="prime">{row.event.type}</Badge>}
            </li>
          ))}
        </ul>
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
                className="flex items-start justify-between gap-3 hover:text-gold-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-muted">
                    {formatDate(r.starts_at, dateFmt)}
                    {r.location && <> · {r.location}</>}
                  </p>
                </div>
                {r.type && <Badge variant="prime">{r.type}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
