import EventsList from "../components/events/EventsList";
import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";

export default function EventsPage() {
  return (
    <div>
      <FormatHero meta={FORMAT_HERO["/events"]} bereich="events" />
      <EventsList />
    </div>
  );
}
