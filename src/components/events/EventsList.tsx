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
  type EventInput,
  type EventListItem,
} from "../../lib/events";
import { EventCard } from "./EventCard";
import { EventForm } from "./EventForm";

/**
 * Events-Übersicht (AGE-251). Kommende/vergangene Events als Karten, plus eine
 * „Meine Events"-Sektion für selbst gehostete. Sichtbarkeit erzwingt die RLS — der
 * Client zeigt nur, was `fetchEvents` zurückgibt.
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
      <EmptyState
        title="Noch keine Events"
        description="Sobald Veranstaltungen geplant sind, erscheinen sie hier."
      />
    );
  }
  const { upcoming, past } = partitionEvents(all, new Date());
  const hosted = hostId
    ? all.filter((e) => e.host?.kind === "profile" && e.host.id === hostId)
    : [];

  return (
    <div className="space-y-8">
      <Tabs
        tabs={[
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
        ]}
      />
      {hosted.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Meine Events</h2>
          <CardGrid events={hosted} empty="" />
        </div>
      )}
    </div>
  );
}

function CardGrid({ events, empty }: { events: EventListItem[]; empty: string }) {
  if (events.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {events.map((e) => (
        <li key={e.id}>
          <EventCard event={e} />
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
