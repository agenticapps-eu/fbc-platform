import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { FilterSpalte } from "../ui/FilterSpalte";
import { Input } from "../ui/Input";
import { Tabs } from "../ui/Tabs";
import { useToast } from "../ui/toast-context";
import { useAuth } from "../../providers/auth-context";
import {
  createEvent,
  EVENT_TYPE_OPTIONS,
  eventsListKey,
  fetchEvents,
  partitionEvents,
  selectMyEvents,
  type EventInput,
  type EventListItem,
} from "../../lib/events";
import { EventCard } from "./EventCard";
import { EventForm } from "./EventForm";
import { useEventCovers } from "./useEventCovers";

/**
 * Events-Übersicht (AGE-251). Drei Reiter: Kommende, Vergangene, Meine Events
 * (AGE-442 — gebuchte und selbst gehostete zusammen, keine eigene Unterseite mehr).
 * Sichtbarkeit erzwingt die RLS — der Client zeigt nur, was `fetchEvents` zurückgibt.
 */
export default function EventsList() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [creating, setCreating] = useState(false);

  const events = useQuery({ queryKey: eventsListKey(uid), queryFn: () => fetchEvents(uid) });

  return (
    <section className="space-y-6">
      {user && !creating && (
        <header className="flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            Event anlegen
          </Button>
        </header>
      )}

      {creating && user && (
        <Card>
          <CreateEvent hostId={user.id} onDone={() => setCreating(false)} />
        </Card>
      )}

      <EventsBody query={events} hostId={user?.id ?? null} />
    </section>
  );
}

function CreateEvent({ hostId, onDone }: { hostId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useMutation({
    mutationFn: (input: EventInput) => createEvent(hostId, input),
    onSuccess: (id) => {
      toast({ variant: "success", title: "Event angelegt" });
      queryClient.invalidateQueries({ queryKey: eventsListKey(hostId) });
      onDone();
      navigate(`/events/${id}`);
    },
    onError: (error) =>
      toast({ variant: "error", title: "Anlegen fehlgeschlagen", description: errMsg(error) }),
  });
  return (
    <EventForm
      submitLabel="Event anlegen"
      pending={create.isPending}
      onSubmit={(i) => create.mutate(i)}
      onCancel={onDone}
    />
  );
}

function EventsBody({
  query,
  hostId,
}: {
  query: ReturnType<typeof useQuery<EventListItem[]>>;
  hostId: string | null;
}) {
  // Die Zustandsgrößen stehen VOR den frühen Rückgaben. Ein `useState` hinter
  // `if (isLoading) return` liefe beim ersten Rendern nicht und beim zweiten
  // doch — React verlangt dieselbe Reihenfolge in jedem Durchlauf.
  const [suche, setSuche] = useState("");
  const [arten, setArten] = useState<string[]>([]);
  const [themen, setThemen] = useState<string[]>([]);

  const all = useMemo(() => query.data ?? [], [query.data]);

  /** Themen kommen aus dem Bestand — das Schema kennt für `topics` keine Liste. */
  const themenImBestand = useMemo(
    () => [...new Set(all.flatMap((e) => e.topics ?? []))].sort(),
    [all],
  );

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    return all.filter((e) => {
      if (begriff) {
        // Titel, Beschreibung UND Ort: ein Online-Format findet man sonst nie
        // über das, worum es darin geht.
        const heuhaufen = [e.title, e.description, e.location]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!heuhaufen.includes(begriff)) return false;
      }
      // Mehrere Marken einer Facette wirken als ODER, die Facetten
      // untereinander als UND — dieselbe Regel wie im Verzeichnis.
      if (arten.length > 0 && (e.type === null || !arten.includes(e.type))) return false;
      if (themen.length > 0 && !(e.topics ?? []).some((t) => themen.includes(t))) return false;
      return true;
    });
  }, [all, suche, arten, themen]);

  if (query.isLoading) return <p className="text-sm text-muted">Events werden geladen…</p>;
  if (query.isError)
    return (
      <p className="text-sm text-danger">Events konnten nicht geladen werden. Bitte neu laden.</p>
    );
  if (all.length === 0) {
    return (
      // AGE-494: Am 17.08. sehen ~70 Menschen diesen Zustand beim ersten Login.
      // „Sobald Veranstaltungen geplant sind, erscheinen sie hier" ist eine
      // Zustandsmeldung — sie sagt, was fehlt, statt was als Nächstes passiert.
      <EmptyState
        title="Die ersten Termine entstehen gerade"
        description="Der Club trifft sich regelmäßig — Sommerfest, Stammtische, Formate der Mitglieder. Sobald ein Termin steht, findest du ihn hier und kannst dich direkt anmelden."
      />
    );
  }
  const now = new Date();
  const { upcoming, past } = partitionEvents(gefiltert, now);
  const mine = selectMyEvents(gefiltert, hostId, now);

  const tabs = [
    {
      value: "upcoming",
      label: `Kommende (${upcoming.length})`,
      content: <CardGrid events={upcoming} empty="Keine kommenden Events." />,
    },
    {
      value: "past",
      label: `Vergangene (${past.length})`,
      content: <CardGrid events={past} empty="Keine vergangenen Events." />,
    },
  ];
  // Ohne Login gibt es nichts Eigenes — dann bleibt der Reiter weg statt leer.
  if (hostId) {
    tabs.push({
      value: "mine",
      label: `Meine Events (${mine.length})`,
      content: <CardGrid events={mine} empty="Du hast noch keine Events gebucht oder angelegt." />,
    });
  }

  return (
    <FilterSpalte
      id="events-filter"
      filter={
        <div className="space-y-4">
          <Card className="space-y-3">
            <label htmlFor="events-suche" className="font-display text-sm font-semibold text-ink">
              Suche
            </label>
            <Input
              id="events-suche"
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Titel, Beschreibung, Ort …"
              aria-label="Volltextsuche in den Events"
            />
          </Card>

          {/* FESTE Liste aus dem Schema, nicht aus dem Bestand: auf der
              Produktion steht heute ein einziges künftiges Event mit einem
              einzigen Typ, und eine Auswahl mit einem Eintrag ist keine.
              `events.arten.test.ts` hält die Liste am CHECK-Constraint fest. */}
          <MarkenFacette
            titel="Art"
            optionen={EVENT_TYPE_OPTIONS.map((o) => ({ wert: o.value, label: o.label }))}
            gewaehlt={arten}
            onUmschalten={(w) => setArten(umschalten(arten, w))}
          />

          {/* ABGELEITET, denn `topics` ist Freitext ohne Schema-Liste. Ohne
              Werte rendert die Karte nicht — dasselbe Muster wie die Tag-Karte
              der Aktivität. */}
          <MarkenFacette
            titel="Themen"
            optionen={themenImBestand.map((t) => ({ wert: t, label: t }))}
            gewaehlt={themen}
            onUmschalten={(w) => setThemen(umschalten(themen, w))}
          />
        </div>
      }
    >
      <Tabs tabs={tabs} />
    </FilterSpalte>
  );
}

/** Eine Marke hinzufügen oder wegnehmen. */
function umschalten(menge: string[], wert: string): string[] {
  return menge.includes(wert) ? menge.filter((w) => w !== wert) : [...menge, wert];
}

/**
 * Eine Facette aus Auswahlkästchen.
 *
 * Kästchen und keine Chips: sie versprechen Mehrfachauswahl, und genau die gibt
 * es hier — mehrere Marken wirken als ODER. Dieselbe Begründung wie in der
 * Filterspalte der Aktivität.
 *
 * OHNE Optionen rendert sie GAR NICHT. Eine leere Facettenkarte nähme 280 px
 * Breite und gäbe nichts zurück; auf der Produktion wäre das heute der Fall.
 */
function MarkenFacette({
  titel,
  optionen,
  gewaehlt,
  onUmschalten,
}: {
  titel: string;
  optionen: { wert: string; label: string }[];
  gewaehlt: string[];
  onUmschalten: (wert: string) => void;
}) {
  if (optionen.length === 0) return null;
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-sm font-semibold text-ink">{titel}</h2>
      <ul className="space-y-1.5">
        {optionen.map((o) => (
          <li key={o.wert}>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={gewaehlt.includes(o.wert)}
                onChange={() => onUmschalten(o.wert)}
                className="size-4 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Drei Kacheln je Reihe (Entscheidung Meeting 03.08., AGE-531). Vorher standen
 * hier zwei — das Mockup zeigt vier, entschieden wurden drei; der Schritt ist
 * also 2 → 3 und nicht, wie im Issue formuliert, 4 → 3.
 *
 * Die DREI bleibt; seit AGE-629 wechselt nur ihr Auslöser. Vorher hing sie am
 * Fenster, jetzt an der Breite dieser Liste — mit der Filterspalte daneben
 * verengt sich die Liste, das Fenster aber nicht, und ein Viewport-Breakpoint
 * quetschte drei Kacheln in eine Fläche, die eine trägt: gemessen 115 px je
 * Kachel bei 1280 px Fenster.
 *
 * Der Behälter ist ein eigenes `div` und nicht die `<ul>` selbst: ein Element
 * kann seinen EIGENEN Container nicht abfragen, `@[41rem]:` an der Liste
 * fragte sonst einen Vorfahren — oder gar nichts — und wäre lautlos wirkungslos.
 *
 * 41rem = 3 × 208 px + 2 × 16 px Abstand, 27rem = 2 × 208 px + 16 px. Die
 * 208 px sind keine Wahl: es ist die schmalste Kachel, die die Anwendung
 * heute schon ausliefert (1280 px mit angedockter Nachrichten-Leiste, AGE-627).
 */
function CardGrid({ events, empty }: { events: EventListItem[]; empty: string }) {
  // Ein Signieraufruf für die ganze Reiterseite, nicht einer je Kachel.
  const covers = useEventCovers(events);
  if (events.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="@container">
      <ul className="grid grid-cols-1 gap-4 @[27rem]:grid-cols-2 @[41rem]:grid-cols-3">
        {events.map((e) => (
          <li key={e.id}>
            <EventCard event={e} coverUrl={e.coverPath ? covers[e.coverPath] : null} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function errMsg(error: unknown): string {
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message: unknown }).message);
  return "Unbekannter Fehler.";
}
