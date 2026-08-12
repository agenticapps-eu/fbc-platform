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
import { EventCard } from "../components/events/EventCard";
import { EventCover } from "../components/events/EventCover";
import { useEventCovers } from "../components/events/useEventCovers";
import {
  attendeesKey,
  cancelRegistration,
  eventAttendeesKey,
  eventDetailKey,
  eventsListKey,
  eventTypeLabel,
  fetchAttendees,
  fetchEvent,
  fetchEvents,
  fetchEventAttendees,
  formatEventSpan,
  isFull,
  isPastEvent,
  rateEvent,
  registerForEvent,
  registrationStatusLabel,
  remainingSpots,
  selectSimilarEvents,
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
        <Link to="/events" className="text-sm text-accent-strong hover:text-accent">
          ← Zu allen Events
        </Link>
      </div>
    );
  }

  const isHost = !!uid && event.host?.kind === "profile" && event.host.id === uid;
  return (
    <div className="space-y-6">
      <Link to="/events" className="text-sm text-accent-strong hover:text-accent">
        ← Zu allen Events
      </Link>
      <EventHeader event={event} />
      <RegistrationPanel event={event} uid={uid} />
      {/* Ohne Session gibt es keine Teilnehmer: `event_attendees` trägt kein
          `execute` für `anon`. Der Block entfällt dann ganz, statt einen 42501
          in die Konsole zu schreiben — dieselbe Regel wie in AGE-530 für
          `profiles_public` und `partners`. */}
      {uid && <AttendeeRow event={event} uid={uid} />}
      {isHost && <HostTools event={event} uid={uid} />}
      <SimilarEvents event={event} uid={uid} />
    </div>
  );
}

/**
 * Die Avatarreihe des Mockups: bis zu fünf Gesichter, dann „+n".
 *
 * Die GESAMTZAHL kommt aus `event_registration_counts` und wird NICHT aus den
 * Gesichtern gerechnet. `event_attendees` lässt Mitglieder aus, deren Profil
 * nicht öffentlich ist — die Zahl ist deshalb im Zweifel größer als das, was
 * hier zu sehen ist, und das ist die ehrlichere Auskunft (siehe
 * openspec/changes/events-content/proposal.md).
 */
const SICHTBARE_GESICHTER = 5;

function AttendeeRow({ event, uid }: { event: EventListItem; uid: string }) {
  const { data, isLoading } = useQuery({
    queryKey: eventAttendeesKey(uid, event.id),
    queryFn: () => fetchEventAttendees(event.id),
  });
  const rows = data ?? [];
  if (isLoading) return null;
  if (event.registeredCount === 0) return null;

  const sichtbar = rows.slice(0, SICHTBARE_GESICHTER);
  const weitere = event.registeredCount - sichtbar.length;
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">
        Teilnehmer ({event.registeredCount})
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {sichtbar.map((a) => (
          <Link
            key={a.profileId}
            to={`/p/${a.profileId}`}
            title={a.name}
            className="rounded-full focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <Avatar name={a.name} src={a.avatarUrl} size="sm" />
          </Link>
        ))}
        {weitere > 0 && (
          <span className="rounded-full bg-soft px-3 py-1.5 text-xs font-medium text-muted">
            +{weitere}
          </span>
        )}
      </div>
    </Card>
  );
}

/**
 * „Ähnliche Events": die drei nächsten kommenden desselben Typs.
 *
 * Gespeist aus DERSELBEN Abfrage wie die Übersicht — nicht aus dem Cache
 * gelesen und gehofft, dass er gefüllt ist. Beim Direktaufruf, beim Neuladen
 * und beim Lesezeichen war die Liste nie geladen; `useQuery` auf denselben
 * Schlüssel holt sie dann nach und teilt sie sonst.
 */
function SimilarEvents({ event, uid }: { event: EventListItem; uid: string | null }) {
  const { data } = useQuery({ queryKey: eventsListKey(uid), queryFn: () => fetchEvents(uid) });
  const aehnlich = selectSimilarEvents(data ?? [], event, new Date());
  const covers = useEventCovers(aehnlich);
  if (aehnlich.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">Ähnliche Events</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {aehnlich.map((e) => (
          <li key={e.id}>
            <EventCard event={e} coverUrl={e.coverPath ? covers[e.coverPath] : null} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventHeader({ event }: { event: EventListItem }) {
  const remaining = remainingSpots(event.capacity, event.registeredCount);
  // Ein einzelnes Cover, aber über denselben gebündelten Weg wie die Liste —
  // eine zweite Signier-Implementierung wäre eine zweite Stelle, an der
  // Gültigkeit und Cache-Fenster auseinanderlaufen könnten.
  const covers = useEventCovers([event]);
  return (
    <Card className="space-y-4 overflow-hidden !p-0">
      <EventCover
        startsAt={event.startsAt}
        url={event.coverPath ? (covers[event.coverPath] ?? null) : null}
        gross
      />
      <div className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            {event.title}
          </h1>
          <Badge variant="neutral">{eventTypeLabel(event.type)}</Badge>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs tracking-wide text-muted uppercase">Wann</dt>
            <dd className="text-ink">{formatEventSpan(event.startsAt, event.endsAt)}</dd>
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
        {event.description && (
          <div className="space-y-2 border-t border-line pt-4">
            <h2 className="text-xs tracking-wide text-muted uppercase">Beschreibung</h2>
            {/* whitespace-pre-line: das Feld ist mehrzeilig, und Absätze des
              Veranstalters sollen Absätze bleiben. Kein Markdown — der Text
              kommt von Mitgliedern und wird nirgends als HTML gedeutet. */}
            <p className="whitespace-pre-line text-sm text-ink">{event.description}</p>
          </div>
        )}
        {event.topics && event.topics.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            <h2 className="text-xs tracking-wide text-muted uppercase">Themen</h2>
            {/* Häkchenliste, nicht Chip-Reihe: das Mockup zeigt hier die
              Tagesordnung dieses einen Events („Aktuelle Club-News",
              „Neue Mitglieder begrüßen"), keine Schlagworte. Deshalb auch
              kein Bezug zu den 15 kuratierten Tags aus C7. */}
            <ul className="space-y-1.5">
              {event.topics.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-ink">
                  <span aria-hidden className="mt-0.5 text-accent-strong">
                    ✓
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {event.host && (
          <div className="flex items-center gap-2 border-t border-line pt-3">
            <span className="text-xs text-muted">Host:</span>
            {event.host.kind === "profile" ? (
              <Link
                to={`/p/${event.host.id}`}
                className="flex items-center gap-2 hover:text-accent-strong"
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
      </div>
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
    // Die Teilnehmerreihe hängt an einem EIGENEN Schlüssel (nicht `attendeesKey`,
    // der die vollen Registrierungszeilen für Host-Werkzeug und Bewertung hält).
    // Ohne diese Zeile zeigte sie nach der eigenen Anmeldung veraltete Gesichter
    // — der Befund aus dem Plan-Review, der den zweiten Schlüssel überhaupt
    // nötig gemacht hat.
    queryClient.invalidateQueries({ queryKey: eventAttendeesKey(uid, event.id) });
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
          <span className="font-medium text-accent-strong">
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
            className={`text-2xl disabled:opacity-50 ${myReg.rating && myReg.rating >= n ? "text-accent" : "text-line hover:text-accent/60"}`}
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
