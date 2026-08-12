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
  return <EventBody event={event} uid={uid} isHost={isHost} />;
}

/**
 * Der Rumpf als eigene Komponente, damit die Haken nicht hinter den frühen
 * Rückgaben oben stehen (React verbietet bedingte Haken).
 *
 * Hier sitzt der EINE Signieraufruf der Detailseite: Header-Cover und die
 * Cover der ähnlichen Events werden in EINEM Stapel signiert, nicht in zweien.
 * Das ist die Zusicherung aus dem Spec-Delta („one batched signing call per
 * view"), und die erste Fassung hat sie verletzt — zwei Komponenten riefen den
 * Haken je für sich auf. Befund aus dem Diff-Review.
 */
function EventBody({
  event,
  uid,
  isHost,
}: {
  event: EventListItem;
  uid: string | null;
  isHost: boolean;
}) {
  const alle = useQuery({ queryKey: eventsListKey(uid), queryFn: () => fetchEvents(uid) });
  const aehnlich = selectSimilarEvents(alle.data ?? [], event, new Date());
  // Erst signieren, wenn die Eventliste steht: sonst ginge ein Stapel mit dem
  // Header-Cover raus und gleich danach einer mit allen dreien.
  const covers = useEventCovers([event, ...aehnlich], !alle.isLoading);

  // Welche Blöcke entstehen überhaupt? Davon hängt die Spaltenzahl ab.
  const hatThemen = !!event.topics && event.topics.length > 0;
  const hatHost = !!uid && !!event.host;
  const hatBeschreibung = !!event.description;
  const hatTeilnehmer = !!uid && event.registeredCount > 0;

  return (
    <div className="space-y-4">
      {/* Brotkrume statt „← Zu allen Events" (Mockup). Sie sagt zusätzlich, wo
          man ist, nicht nur wohin man zurückkann. */}
      <nav aria-label="Brotkrume" className="text-sm text-muted">
        <Link to="/events" className="text-accent-strong hover:text-accent">
          Events
        </Link>
        <span aria-hidden className="px-1.5">
          ›
        </span>
        <span aria-current="page" className="text-ink">
          {event.title}
        </span>
      </nav>

      <EventHero event={event} covers={covers} uid={uid} />

      {/* Die Spaltenzahl folgt den TATSÄCHLICH vorhandenen Blöcken. Eine feste
          Dreierteilung ließ die Spuren stehen, wenn Themen oder Host fehlen —
          im Browser gemessen: eine einzelne Karte blieb 344 px breit, während
          700 px Spur daneben leer standen. React rendert für `null` zwar kein
          Element, aber das Raster rechnet trotzdem mit drei Spalten. */}
      <div
        className={`grid gap-4 ${SPALTEN[Math.max(1, [true, hatThemen, hatHost].filter(Boolean).length)]}`}
      >
        <DetailsCard event={event} />
        {hatThemen && <TopicsCard event={event} />}
        {hatHost && <HostCard event={event} />}
      </div>

      <div
        className={`grid gap-4 ${hatBeschreibung && hatTeilnehmer ? "lg:grid-cols-[2fr_1fr]" : ""}`}
      >
        <DescriptionCard event={event} />
        {/* Ohne Session gibt es keine Teilnehmer: `event_attendees` trägt kein
            `execute` für `anon`. Der Block entfällt dann ganz, statt einen 42501
            in die Konsole zu schreiben — dieselbe Regel wie in AGE-530 für
            `profiles_public` und `partners`. */}
        {uid && <AttendeeRow event={event} uid={uid} />}
      </div>

      {isHost && uid && <HostTools event={event} uid={uid} />}
      <SimilarEvents events={aehnlich} covers={covers} />
    </div>
  );
}

/** Tailwind sieht nur ganze Klassennamen — deshalb eine Tabelle statt Interpolation. */
const SPALTEN: Record<number, string> = {
  1: "",
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
};

/**
 * Die Sichtbarkeit in Worten — und zwar in KORREKTEN. Die erste Fassung sagte
 * bei `public` „Offen für alle Mitglieder"; das ist gleich zweimal daneben:
 * ein öffentliches Event ist auch ohne Session sichtbar, und der Satz vermischte
 * Sichtbarkeit mit Anmeldeberechtigung (die für `members`-Events zusätzlich
 * mindestens `discover` verlangt, siehe `register_for_event`). Befund aus dem
 * Diff-Review.
 *
 * Deshalb ausdrücklich „sichtbar": die Zeile beantwortet, WER das Event sieht,
 * und verspricht nichts über das Anmelden.
 */
function sichtbarkeitSatz(visibility: string): string {
  return visibility === "public" ? "Öffentlich sichtbar" : "Nur für Mitglieder sichtbar";
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
  // NUR Angemeldete. Die RPC gibt dem HOST jeden Status heraus — das braucht
  // sein Werkzeug —, aber diese Reihe beantwortet „wer kommt", und da hat eine
  // Abmeldung nichts verloren. Befund aus dem Diff-Review; für einen
  // Nicht-Host ist der Filter wirkungslos, weil die RPC ihm ohnehin nur
  // `registered` liefert.
  const rows = (data ?? []).filter((a) => a.status === "registered");
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
 * Auswahl und Signaturen kommen von oben (`EventBody`), damit die Seite EINEN
 * Signierstapel macht und die Liste aus DERSELBEN Abfrage wie die Übersicht
 * stammt — nicht aus einem Cache, auf dessen Füllung man hofft. Beim
 * Direktaufruf, beim Neuladen und beim Lesezeichen war sie nie geladen.
 */
function SimilarEvents({
  events: aehnlich,
  covers,
}: {
  events: EventListItem[];
  covers: Record<string, string>;
}) {
  if (aehnlich.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Ähnliche Events</h2>
        <Link to="/events" className="text-sm text-accent-strong hover:text-accent">
          Alle Events anzeigen →
        </Link>
      </div>
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

/**
 * Die Hero-Karte des Mockups: Titelbild, Typ-Marke, Titel, „Veranstaltet von"
 * — und rechts das Anmelde-Feld. Auf schmalen Fenstern rutscht es darunter.
 *
 * Der Veranstalter erscheint hier bewusst NUR als Zeile; seine Karte steht in
 * der Dreierreihe darunter (`HostCard`). Das Mockup führt beides, und die
 * Zeile beantwortet die Frage „von wem?" schon oben, ohne die Karte zu
 * verdoppeln.
 */
/**
 * Zeigt die rechte Hero-Spalte überhaupt etwas? Bei einem vergangenen Event,
 * an dem man nicht teilgenommen hat, gibt `RegistrationPanel` `null` zurück.
 * Ohne diese Prüfung blieben eine Trennlinie und 288 px Leerraum stehen —
 * im Browser gesehen, nicht hergeleitet (Befund aus dem Diff-Review).
 */
function hatTeilnahmeBlock(event: EventListItem, uid: string | null): boolean {
  if (!uid) return true; // „Melde dich an, um teilzunehmen."
  if (isPastEvent(event.startsAt, new Date())) return !!event.myStatus; // nur die Bewertung
  return true;
}

function EventHero({
  event,
  covers,
  uid,
}: {
  event: EventListItem;
  covers: Record<string, string>;
  uid: string | null;
}) {
  const teilnahme = hatTeilnahmeBlock(event, uid);
  return (
    <Card className="overflow-hidden !p-0">
      <EventCover
        startsAt={event.startsAt}
        url={event.coverPath ? (covers[event.coverPath] ?? null) : null}
        gross
      />
      <div className={`grid gap-6 p-5 ${teilnahme ? "lg:grid-cols-[1fr_18rem]" : ""}`}>
        <div className="space-y-3">
          <Badge variant="neutral">{eventTypeLabel(event.type)}</Badge>
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink">
            {event.title}
          </h1>
          {event.host && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted">Veranstaltet von</span>
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
        {teilnahme && (
          <div className="lg:border-l lg:border-line lg:pl-6">
            <RegistrationPanel event={event} uid={uid} />
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Vier Symbole für den „Details"-Block, im Hausstil: inline, `currentColor`,
 * 1,6 px, runde Enden, 24er-Viewbox — dieselben Regeln wie `NavIcon`
 * (`src/components/ui/NavIcon.tsx`), das aus demselben Grund keine
 * Icon-Bibliothek zieht.
 *
 * Nicht in `NavIcon` aufgenommen: die Datei bildet ROUTEN auf Symbole ab. Vier
 * Symbole, die keine Route haben, gehörten dort nicht hin.
 *
 * Emoji wären billiger gewesen und sahen in der Sichtprobe auch so aus: bunt,
 * je nach Betriebssystem anders, und neben dem sonst monochromen Chrome fremd.
 */
const DETAIL_ICONS = {
  kalender: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </>
  ),
  ort: (
    <>
      <path d="M12 21s6.5-5.4 6.5-10a6.5 6.5 0 1 0-13 0c0 4.6 6.5 10 6.5 10Z" />
      <circle cx="12" cy="11" r="2.4" />
    </>
  ),
  personen: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.8c1.9.5 3 2.2 3 4.7" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3.5a2.5 2.5 0 0 0 0-5Z" />
      <path d="M13.5 6v2M13.5 11v2M13.5 16v2" />
    </>
  ),
} as const;

/** Eine Zeile im „Details"-Block: Symbol, Text. Fehlt der Text, fehlt die Zeile. */
function DetailZeile({
  icon,
  label,
  children,
}: {
  icon: keyof typeof DETAIL_ICONS;
  /**
   * Für Screenreader. Die Symbole sind `aria-hidden`, also hörte man ohne das
   * hier nur nackte Werte — „Online (Zoom)" ohne „Wo". Die frühere Fassung war
   * eine `<dl>` mit sichtbaren Beschriftungen; das Mockup hat sie nicht, die
   * Ansage darf trotzdem nicht verlorengehen (Befund aus dem Diff-Review).
   */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink">
      <span className="sr-only">{label}: </span>
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-4 w-4 shrink-0 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {DETAIL_ICONS[icon]}
      </svg>
      {/* break-words: eine location kann eine sehr lange, unbrechbare URL sein
          (Zoom-Join-Link als „Ort"). Umbrechen statt kürzen — auf der
          Detailseite soll sie ganz sichtbar bleiben. */}
      <span className="break-words">{children}</span>
    </li>
  );
}

function DetailsCard({ event }: { event: EventListItem }) {
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-base font-semibold text-ink">Details</h2>
      <ul className="space-y-2">
        <DetailZeile icon="kalender" label="Wann">
          {formatEventSpan(event.startsAt, event.endsAt)}
        </DetailZeile>
        {event.location && (
          <DetailZeile icon="ort" label="Wo">
            {event.location}
          </DetailZeile>
        )}
        {/* Die Sichtbarkeit als Satz. Sie beantwortet die Frage, die sich
            genau beim Anmelden stellt, und stand vorher nirgends. */}
        <DetailZeile icon="personen" label="Sichtbarkeit">
          {sichtbarkeitSatz(event.visibility)}
        </DetailZeile>
        {/* Die TEILNEHMERZAHL steht hier und nicht nur in der Teilnehmer-Karte:
            die gibt es ohne Session nicht, und ein ausgeloggter Besucher sah
            dadurch gar keine Zahl mehr — eine Verschlechterung gegenüber der
            Fassung vor dem Layout-Nachzug (Befund aus dem Diff-Review). */}
        <DetailZeile icon="ticket" label="Plätze">
          {event.capacity === null
            ? `${event.registeredCount} ${event.registeredCount === 1 ? "Teilnehmer" : "Teilnehmer"} · Plätze unbegrenzt`
            : `${event.registeredCount} von ${event.capacity} Plätzen belegt`}
          {event.waitlistCount > 0 && (
            <span className="text-muted"> · {event.waitlistCount} auf Warteliste</span>
          )}
        </DetailZeile>
      </ul>
    </Card>
  );
}

function TopicsCard({ event }: { event: EventListItem }) {
  if (!event.topics || event.topics.length === 0) return null;
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-base font-semibold text-ink">Themen</h2>
      {/* Häkchenliste, nicht Chip-Reihe: das Mockup zeigt hier die Tagesordnung
          dieses einen Events („Aktuelle Club-News", „Neue Mitglieder begrüßen"),
          keine Schlagworte. Deshalb auch kein Bezug zu den 15 kuratierten Tags
          aus C7. */}
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
      <p className="pt-1 text-xs text-muted">Änderungen vorbehalten.</p>
    </Card>
  );
}

/**
 * Die Veranstalter-Karte. Rolle, Firma und Kurzbio kommen aus
 * `profiles_public`; fehlt eines davon, entfällt die Zeile ganz — eine
 * Beschriftung ohne Wert ist schlechter als keine.
 */
function HostCard({ event }: { event: EventListItem }) {
  const host = event.host;
  if (!host) return null;
  const rolle = [host.roles?.join(" · "), host.company].filter(Boolean).join(" · ");
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-base font-semibold text-ink">Veranstalter</h2>
      <div className="flex items-center gap-3">
        <Avatar name={host.name} src={host.avatarUrl} size="md" />
        <div className="min-w-0">
          {/* break-words statt truncate: mehrere Rollen oder ein langer
              Firmenname wären in der schmalen Karte sonst unlesbar
              abgeschnitten (Befund aus dem Diff-Review). */}
          <p className="text-sm font-medium break-words text-ink">{host.name}</p>
          {rolle && <p className="text-xs break-words text-muted">{rolle}</p>}
        </div>
      </div>
      {host.shortBio && <p className="text-sm text-muted">{host.shortBio}</p>}
      {host.kind === "profile" && (
        <Link
          to={`/p/${host.id}`}
          className="inline-flex w-full items-center justify-center rounded-[var(--radius-control)] border border-line px-3 py-2 text-sm font-medium text-accent-strong hover:border-accent/50"
        >
          Profil ansehen
        </Link>
      )}
    </Card>
  );
}

function DescriptionCard({ event }: { event: EventListItem }) {
  if (!event.description) return null;
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-base font-semibold text-ink">Beschreibung</h2>
      {/* whitespace-pre-line: das Feld ist mehrzeilig, und Absätze des
          Veranstalters sollen Absätze bleiben. Kein Markdown — der Text kommt
          von Mitgliedern und wird nirgends als HTML gedeutet. */}
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{event.description}</p>
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

  // KEIN eigenes Card-Gehäuse mehr: dieser Block sitzt seit dem Layout-Nachzug
  // in der rechten Spalte der Hero-Karte.
  if (!uid) {
    return <p className="text-sm text-muted">Melde dich an, um an diesem Event teilzunehmen.</p>;
  }
  if (past) {
    return event.myStatus ? <RatePanel event={event} uid={uid} /> : null;
  }

  const busy = register.isPending || cancel.isPending;
  return (
    <div className="flex flex-col gap-3">
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
    </div>
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
