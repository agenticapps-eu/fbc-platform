import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TierBadge } from "../components/ui/TierBadge";
import { useToast } from "../components/ui/toast-context";
import { EventForm } from "../components/events/EventForm";
import { useAuth } from "../providers/auth-context";
import {
  attendeesKey,
  cancelRegistration,
  eventDetailKey,
  eventsListKey,
  eventTypeLabel,
  fetchAttendees,
  fetchEvent,
  formatEventDate,
  isFull,
  isPastEvent,
  rateEvent,
  registerForEvent,
  registrationStatusLabel,
  remainingSpots,
  setCheckIn,
  updateEvent,
  type EventInput,
  type EventListItem,
} from "../lib/events";

/**
 * Event-Detail (AGE-251). Beschreibung/Host/Zeit, An-/Abmeldung (mit Warteliste bei
 * voller capacity), und — für den Host — Werkzeuge: bearbeiten, Teilnehmerliste mit
 * Check-in. Nach dem Event können Teilnehmer 1–5 Sterne vergeben. Sichtbarkeit erzwingt
 * die RLS; anon sieht nur öffentliche Events (sonst „nicht sichtbar").
 */
export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const query = useQuery({
    queryKey: eventDetailKey(uid, id!),
    queryFn: () => fetchEvent(uid, id!),
    enabled: !!id,
  });

  if (query.isLoading) return <p className="text-sm text-muted">Event wird geladen…</p>;
  if (query.isError)
    return <p className="text-sm text-danger">Event konnte nicht geladen werden.</p>;
  const event = query.data;
  if (!event) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Dieses Event existiert nicht oder ist für dich nicht sichtbar.
        </p>
        <Link to="/events" className="text-sm text-gold-strong hover:text-gold">
          ← Zu allen Events
        </Link>
      </div>
    );
  }

  const isHost = !!uid && event.host?.kind === "profile" && event.host.id === uid;
  return (
    <div className="space-y-6">
      <Link to="/events" className="text-sm text-gold-strong hover:text-gold">
        ← Zu allen Events
      </Link>
      <EventHeader event={event} />
      <RegistrationPanel event={event} uid={uid} />
      {isHost && <HostTools event={event} uid={uid} />}
    </div>
  );
}

function EventHeader({ event }: { event: EventListItem }) {
  const remaining = remainingSpots(event.capacity, event.registeredCount);
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          {event.title}
        </h1>
        <Badge variant="neutral">{eventTypeLabel(event.type)}</Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Wann</dt>
          <dd className="text-ink">{formatEventDate(event.startsAt)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Wo</dt>
          {/* break-words: eine location kann eine sehr lange, unbrechbare URL sein
              (Zoom-Join-Link als „Ort"). Auf der Detailseite soll sie ganz sichtbar
              bleiben — also umbrechen statt kürzen, damit sie die Spalte nicht sprengt. */}
          <dd className="break-words text-ink">{event.location ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Teilnehmer</dt>
          <dd className="text-ink">
            {event.registeredCount}
            {event.capacity != null && <> / {event.capacity}</>}
            {event.waitlistCount > 0 && (
              <span className="text-muted"> · {event.waitlistCount} auf Warteliste</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Freie Plätze</dt>
          <dd className="text-ink">{remaining === null ? "Unbegrenzt" : remaining}</dd>
        </div>
      </dl>
      {event.host && (
        <div className="flex items-center gap-2 border-t border-line pt-3">
          <span className="text-xs text-muted">Host:</span>
          {event.host.kind === "profile" ? (
            <Link
              to={`/p/${event.host.id}`}
              className="flex items-center gap-2 hover:text-gold-strong"
            >
              <Avatar name={event.host.name} src={event.host.avatarUrl} size="sm" />
              <span className="text-sm font-medium text-ink">{event.host.name}</span>
              {event.host.tier && <TierBadge tier={event.host.tier} />}
            </Link>
          ) : (
            <span className="flex items-center gap-2">
              <Avatar name={event.host.name} src={event.host.avatarUrl} size="sm" />
              <span className="text-sm font-medium text-ink">{event.host.name}</span>
              <Badge variant="neutral">Partner</Badge>
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function RegistrationPanel({ event, uid }: { event: EventListItem; uid: string | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const full = isFull(event.capacity, event.registeredCount);
  const past = isPastEvent(event.startsAt, new Date());

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: eventDetailKey(uid, event.id) });
    queryClient.invalidateQueries({ queryKey: eventsListKey(uid) });
  }

  const register = useMutation({
    mutationFn: () => registerForEvent(event.id),
    onSuccess: (status) => {
      toast({
        variant: "success",
        title: status === "waitlist" ? "Auf die Warteliste gesetzt" : "Angemeldet",
        description:
          status === "waitlist"
            ? "Das Event ist ausgebucht — du rückst bei Absagen nach."
            : "Wir sehen uns dort.",
      });
      invalidate();
    },
    onError: (e) =>
      toast({ variant: "error", title: "Anmeldung fehlgeschlagen", description: errMsg(e) }),
  });

  const cancel = useMutation({
    mutationFn: () => cancelRegistration(event.id, uid as string),
    onSuccess: () => {
      toast({ variant: "success", title: "Abgemeldet" });
      invalidate();
    },
    onError: (e) =>
      toast({ variant: "error", title: "Abmeldung fehlgeschlagen", description: errMsg(e) }),
  });

  if (!uid) {
    return (
      <Card>
        <p className="text-sm text-muted">Melde dich an, um an diesem Event teilzunehmen.</p>
      </Card>
    );
  }
  if (past) {
    return event.myStatus ? (
      <Card>
        <RatePanel event={event} uid={uid} />
      </Card>
    ) : null;
  }

  const busy = register.isPending || cancel.isPending;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        {event.myStatus ? (
          <span className="font-medium text-gold-strong">
            {registrationStatusLabel(event.myStatus)}
          </span>
        ) : full ? (
          <span className="text-muted">Ausgebucht — Anmeldung führt auf die Warteliste.</span>
        ) : (
          <span className="text-muted">Plätze frei.</span>
        )}
      </div>
      {event.myStatus ? (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => cancel.mutate()}>
          Abmelden
        </Button>
      ) : (
        <Button size="sm" disabled={busy} onClick={() => register.mutate()}>
          {full ? "Auf Warteliste" : "Anmelden"}
        </Button>
      )}
    </Card>
  );
}

function RatePanel({ event, uid }: { event: EventListItem; uid: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Eigene Registrierung dieses Events laden, um die registrationId zu erhalten.
  // RLS: Teilnehmer sieht nur die eigene Zeile, der Host alle — beide enthalten die eigene.
  const { data } = useQuery({
    queryKey: attendeesKey(uid, event.id),
    queryFn: () => fetchAttendees(event.id),
  });
  const myReg = (data ?? []).find((a) => a.profileId === uid);
  const rate = useMutation({
    mutationFn: (value: number) => rateEvent(myReg!.registrationId, value),
    onSuccess: () => {
      toast({ variant: "success", title: "Danke für deine Bewertung" });
      queryClient.invalidateQueries({ queryKey: attendeesKey(uid, event.id) });
    },
    onError: (e) =>
      toast({ variant: "error", title: "Bewertung fehlgeschlagen", description: errMsg(e) }),
  });
  if (!myReg) return <p className="text-sm text-muted">Dieses Event ist vorbei.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Wie war das Event?</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={rate.isPending}
            onClick={() => rate.mutate(n)}
            aria-label={`${n} Sterne`}
            className={`text-2xl disabled:opacity-50 ${myReg.rating && myReg.rating >= n ? "text-gold" : "text-line hover:text-gold/60"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function HostTools({ event, uid }: { event: EventListItem; uid: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const attendees = useQuery({
    queryKey: attendeesKey(uid, event.id),
    queryFn: () => fetchAttendees(event.id),
  });

  const save = useMutation({
    mutationFn: (input: EventInput) => updateEvent(event.id, input),
    onSuccess: () => {
      toast({ variant: "success", title: "Event gespeichert" });
      queryClient.invalidateQueries({ queryKey: eventDetailKey(uid, event.id) });
      queryClient.invalidateQueries({ queryKey: eventsListKey(uid) });
      setEditing(false);
    },
    onError: (e) =>
      toast({ variant: "error", title: "Speichern fehlgeschlagen", description: errMsg(e) }),
  });

  const check = useMutation({
    mutationFn: ({ registrationId, checkedIn }: { registrationId: string; checkedIn: boolean }) =>
      setCheckIn(registrationId, checkedIn),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendeesKey(uid, event.id) }),
    onError: (e) =>
      toast({ variant: "error", title: "Check-in fehlgeschlagen", description: errMsg(e) }),
  });

  const rows = attendees.data ?? [];
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-ink">Host-Werkzeuge</h2>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Bearbeiten
          </Button>
        )}
      </div>

      {editing ? (
        <EventForm
          initial={event}
          submitLabel="Speichern"
          pending={save.isPending}
          onSubmit={(i) => save.mutate(i)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">Teilnehmer ({rows.length})</p>
          {attendees.isLoading && <p className="text-sm text-muted">Wird geladen…</p>}
          <ul className="flex flex-col gap-2">
            {rows.map((a) => (
              <li
                key={a.registrationId}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-soft p-2.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={a.name} src={a.avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{a.name}</span>
                    <span className="text-xs text-muted">{registrationStatusLabel(a.status)}</span>
                  </span>
                </span>
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={a.checkedIn}
                    disabled={check.isPending}
                    onChange={(e) =>
                      check.mutate({
                        registrationId: a.registrationId,
                        checkedIn: e.target.checked,
                      })
                    }
                  />
                  Check-in
                </label>
              </li>
            ))}
            {rows.length === 0 && !attendees.isLoading && (
              <li className="text-sm text-muted">Noch keine Anmeldungen.</li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}

function errMsg(error: unknown): string {
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message: unknown }).message);
  return "Unbekannter Fehler.";
}
