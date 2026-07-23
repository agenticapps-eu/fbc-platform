import { Link } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import {
  eventTypeLabel,
  formatEventDate,
  isFull,
  registrationStatusLabel,
  remainingSpots,
  type EventListItem,
} from "../../lib/events";

export function EventCard({ event }: { event: EventListItem }) {
  const remaining = remainingSpots(event.capacity, event.registeredCount);
  const full = isFull(event.capacity, event.registeredCount);
  return (
    <Link
      to={`/events/${event.id}`}
      className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-soft"
    >
      <Card className="space-y-3 transition-colors hover:border-gold/50">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-ink">{event.title}</h3>
          <Badge variant="neutral">{eventTypeLabel(event.type)}</Badge>
        </div>
        {/* truncate: eine location kann eine sehr lange, unbrechbare URL sein
            (z. B. ein Zoom-Join-Link als „Ort" eines Online-Events). Ohne Klemme
            sprengt der String die Karte und – im Grid – die ganze Spalte. Die
            volle Adresse steht auf der Event-Detailseite. */}
        <p className="truncate text-sm text-muted">
          {formatEventDate(event.startsAt)}
          {event.location && <> · {event.location}</>}
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          {event.host ? (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={event.host.name} src={event.host.avatarUrl} size="sm" />
              <span className="truncate text-sm text-ink">{event.host.name}</span>
            </span>
          ) : (
            <span className="text-sm text-muted">FBC</span>
          )}
          <span className="shrink-0 text-xs font-medium">
            {event.myStatus ? (
              <span className="text-gold-strong">{registrationStatusLabel(event.myStatus)}</span>
            ) : remaining === null ? (
              <span className="text-muted">Offen</span>
            ) : full ? (
              <span className="text-danger">Ausgebucht · Warteliste</span>
            ) : (
              <span className="text-muted">{remaining} Plätze frei</span>
            )}
          </span>
        </div>
      </Card>
    </Link>
  );
}
