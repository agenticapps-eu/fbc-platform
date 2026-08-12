import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { EventCover } from "./EventCover";
import {
  eventTypeLabel,
  formatEventSpan,
  isFull,
  registrationStatusLabel,
  remainingSpots,
  type EventListItem,
} from "../../lib/events";

/**
 * Eine Kachel der Eventübersicht, nach dem Mockup vom 29.07.
 * (`docs/mockups/eventuebersicht-2026-07-29.png`): Titelbild mit Datumsmarke,
 * Typ-Marke, Titel, Von–Bis, Ort, Teilnehmerzahl, Knopf.
 *
 * Die Teilnehmer**zahl** und nicht Gesichter — das Mockup zeigt hier „63 nehmen
 * teil". Sie kommt aus `event_registration_counts`, das jeder Betrachter eines
 * Events ohnehin aufrufen darf; `event_attendees` wird auf der Übersicht gar
 * nicht gebraucht.
 */
export function EventCard({ event, coverUrl }: { event: EventListItem; coverUrl?: string | null }) {
  const remaining = remainingSpots(event.capacity, event.registeredCount);
  const full = isFull(event.capacity, event.registeredCount);
  return (
    <Link
      to={`/events/${event.id}`}
      className="group block h-full rounded-[var(--radius-card)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-soft focus-visible:outline-none"
    >
      <Card className="flex h-full flex-col gap-3 overflow-hidden !p-0 transition-colors hover:border-accent/50">
        <EventCover startsAt={event.startsAt} url={coverUrl ?? null} />
        <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
          <Badge variant="neutral" className="self-start">
            {eventTypeLabel(event.type)}
          </Badge>
          <h3 className="font-display text-lg leading-snug font-semibold text-ink">
            {event.title}
          </h3>
          <p className="text-sm text-muted">{formatEventSpan(event.startsAt, event.endsAt)}</p>
          {/* truncate: eine location kann eine sehr lange, unbrechbare URL sein
              (z. B. ein Zoom-Join-Link als „Ort" eines Online-Events). Ohne Klemme
              sprengt der String die Karte und – im Grid – die ganze Spalte. Die
              volle Adresse steht auf der Event-Detailseite. */}
          {event.location && <p className="truncate text-sm text-muted">{event.location}</p>}
          <p className="text-sm text-muted">
            {event.registeredCount === 1 ? "1 nimmt teil" : `${event.registeredCount} nehmen teil`}
          </p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-xs font-medium">
            <span className="text-accent-strong group-hover:underline">Details ansehen</span>
            <span>
              {event.myStatus ? (
                <span className="text-accent-strong">
                  {registrationStatusLabel(event.myStatus)}
                </span>
              ) : remaining === null ? (
                <span className="text-muted">Offen</span>
              ) : full ? (
                <span className="text-danger">Ausgebucht · Warteliste</span>
              ) : (
                <span className="text-muted">{remaining} Plätze frei</span>
              )}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
