import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Tabs } from "../ui/Tabs";
import { useToast } from "../ui/toast-context";
import { useAuth } from "../../providers/auth-context";
import {
  createEvent,
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
  if (query.isLoading) return <p className="text-sm text-muted">Events werden geladen…</p>;
  if (query.isError)
    return (
      <p className="text-sm text-danger">Events konnten nicht geladen werden. Bitte neu laden.</p>
    );
  const all = query.data ?? [];
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
  const { upcoming, past } = partitionEvents(all, now);
  const mine = selectMyEvents(all, hostId, now);

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

  return <Tabs tabs={tabs} />;
}

/**
 * Drei Kacheln je Reihe (Entscheidung Meeting 03.08., AGE-531). Vorher standen
 * hier zwei — das Mockup zeigt vier, entschieden wurden drei; der Schritt ist
 * also 2 → 3 und nicht, wie im Issue formuliert, 4 → 3.
 */
function CardGrid({ events, empty }: { events: EventListItem[]; empty: string }) {
  // Ein Signieraufruf für die ganze Reiterseite, nicht einer je Kachel.
  const covers = useEventCovers(events);
  if (events.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <li key={e.id}>
          <EventCard event={e} coverUrl={e.coverPath ? covers[e.coverPath] : null} />
        </li>
      ))}
    </ul>
  );
}

function errMsg(error: unknown): string {
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message: unknown }).message);
  return "Unbekannter Fehler.";
}
