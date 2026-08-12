import { captureException } from "@sentry/react";

import { supabase } from "./supabase";

export type EventType = "online" | "presence" | "dinner" | "workshop" | "mastermind";
/** Spiegelt `events_visibility_check` (20260715150000_six_level_model.sql:287). */
export type EventVisibility = "public" | "members";
export type RegistrationStatus = "registered" | "waitlist" | "cancelled";

export interface EventHost {
  kind: "profile" | "partner";
  id: string;
  name: string;
  avatarUrl: string | null;
  tier: string | null;
}

export interface EventListItem {
  id: string;
  title: string;
  type: string | null;
  /**
   * `events.starts_at` ist seit AGE-531 `not null`. Der Typ bleibt hier
   * trotzdem tolerant: `partitionEvents`, `isPastEvent` und `formatEventDate`
   * behandeln null seit AGE-251, und diese Zweige zu entfernen wäre ein Umbau,
   * den C8 nicht verlangt. Das SCHREIB-Modell (`EventInput`) ist verengt — dort
   * gehört die Zusicherung hin.
   */
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  /** Pfad im privaten Bucket `event-covers`, KEINE URL — siehe `event-cover.ts`. */
  coverPath: string | null;
  topics: string[] | null;
  visibility: string;
  capacity: number | null;
  host: EventHost | null;
  registeredCount: number;
  waitlistCount: number;
  /** Eigener Registrierungsstatus (null = nicht angemeldet / abgemeldet). */
  myStatus: RegistrationStatus | null;
}

const TYPE_LABELS: Record<string, string> = {
  online: "Online",
  presence: "Präsenz",
  dinner: "Dinner",
  workshop: "Workshop",
  mastermind: "Mastermind",
};

export const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "presence", label: "Präsenz" },
  { value: "dinner", label: "Dinner" },
  { value: "workshop", label: "Workshop" },
  { value: "mastermind", label: "Mastermind" },
];

/**
 * Events sind bewusst asymmetrisch zu posts: sichtbar für ALLE (das Schaufenster),
 * die Anmeldung ist ab `exchange` die Leistung — die Stufung sitzt dort, nicht im
 * Sichtbarkeitswert. Wer hier eine Option ergänzt, ändert zuerst
 * `events_visibility_check`, sonst scheitert das Speichern.
 */
export const VISIBILITY_OPTIONS: { value: EventVisibility; label: string }[] = [
  { value: "members", label: "Mitglieder" },
  { value: "public", label: "Öffentlich" },
];

export function eventTypeLabel(type: string | null): string {
  if (!type) return "Event";
  return TYPE_LABELS[type] ?? type;
}

export function registrationStatusLabel(status: string): string {
  if (status === "registered") return "Angemeldet";
  if (status === "waitlist") return "Warteliste";
  if (status === "cancelled") return "Abgemeldet";
  return status;
}

const eventDateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Datum + Uhrzeit eines Events; ohne Termin „Termin offen". */
export function formatEventDate(startsAt: string | null): string {
  if (!startsAt) return "Termin offen";
  const d = new Date(startsAt);
  return Number.isNaN(d.getTime()) ? "Termin offen" : `${eventDateTimeFmt.format(d)} Uhr`;
}

const spanDateFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const spanTimeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

/**
 * „Selber Tag" heißt: derselbe Kalendertag in der Zone des BETRACHTERS. Deshalb
 * der Vergleich über die lokalen Datumsanteile und nicht über die Differenz in
 * Millisekunden — an der Sommerzeitgrenze hat ein lokaler Tag 23 oder 25
 * Stunden, und „weniger als 24 h" wäre dort falsch.
 */
function gleicherTag(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Von–Bis eines Events (AGE-531). Drei Formen, in dieser Reihenfolge:
 * ohne Ende nur der Beginn · gleicher Tag ein Datum mit zwei Uhrzeiten ·
 * über Mitternacht beide Daten.
 */
export function formatEventSpan(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "Termin offen";
  const s = new Date(startsAt);
  if (Number.isNaN(s.getTime())) return "Termin offen";
  const beginn = `${spanDateFmt.format(s)} · ${spanTimeFmt.format(s)}`;
  if (!endsAt) return `${beginn} Uhr`;
  const e = new Date(endsAt);
  if (Number.isNaN(e.getTime())) return `${beginn} Uhr`;
  return gleicherTag(s, e)
    ? `${beginn} – ${spanTimeFmt.format(e)} Uhr`
    : `${beginn} Uhr – ${spanDateFmt.format(e)} · ${spanTimeFmt.format(e)} Uhr`;
}

/** ms-Zeit von starts_at; null/ungültig → null. */
function startMs(startsAt: string | null): number | null {
  if (!startsAt) return null;
  const t = new Date(startsAt).getTime();
  return Number.isNaN(t) ? null : t;
}

export function isPastEvent(startsAt: string | null, now: Date): boolean {
  const ms = startMs(startsAt);
  return ms !== null && ms < now.getTime();
}

/**
 * Teilt Events in kommende (inkl. undatierter) und vergangene. Kommende aufsteigend
 * (undatierte zuerst), vergangene absteigend (jüngste zuerst).
 */
export function partitionEvents<T extends { startsAt: string | null }>(
  events: T[],
  now: Date,
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const e of events) {
    if (isPastEvent(e.startsAt, now)) past.push(e);
    else upcoming.push(e);
  }
  upcoming.sort((a, b) => (startMs(a.startsAt) ?? -Infinity) - (startMs(b.startsAt) ?? -Infinity));
  past.sort((a, b) => (startMs(b.startsAt) ?? -Infinity) - (startMs(a.startsAt) ?? -Infinity));
  return { upcoming, past };
}

/**
 * „Meine Events" (AGE-442): selbst gehostete UND gebuchte in einer Liste, kommende
 * zuerst. Beides kommt aus demselben `fetchEvents`-Ergebnis (`myStatus` steht dort
 * schon drin), darum ist das ein Filter und kein zweiter Datenweg — ein Event, das
 * man selbst hostet und gebucht hat, kann so gar nicht doppelt erscheinen.
 */
export function selectMyEvents(
  events: EventListItem[],
  uid: string | null,
  now: Date,
): EventListItem[] {
  if (!uid) return [];
  const mine = events.filter(
    (e) => e.myStatus !== null || (e.host?.kind === "profile" && e.host.id === uid),
  );
  const { upcoming, past } = partitionEvents(mine, now);
  return [...upcoming, ...past];
}

/**
 * „Ähnliche Events" der Detailseite (AGE-531): die drei nächsten KOMMENDEN
 * desselben Typs, das eigene ausgenommen; sind es weniger als drei, wird mit
 * den nächsten kommenden überhaupt aufgefüllt.
 *
 * Reine Funktion über die Liste, die die Seite ohnehin lädt — kein zweiter
 * Datenweg. Wer sie füttert, muss sicherstellen, dass die Liste geladen IST;
 * beim Direktaufruf einer Detailseite war sie es nie (Befund aus dem
 * Plan-Review), deshalb hängt sich die Seite mit `useQuery` an denselben
 * Schlüssel, statt auf einen gefüllten Cache zu hoffen.
 */
export function selectSimilarEvents(
  events: EventListItem[],
  event: EventListItem,
  now: Date,
  limit = 3,
): EventListItem[] {
  const { upcoming } = partitionEvents(
    events.filter((e) => e.id !== event.id),
    now,
  );
  const gleicherTyp = upcoming.filter((e) => e.type === event.type);
  const rest = upcoming.filter((e) => e.type !== event.type);
  return [...gleicherTyp, ...rest].slice(0, limit);
}

export function remainingSpots(capacity: number | null, registeredCount: number): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - registeredCount);
}

export function isFull(capacity: number | null, registeredCount: number): boolean {
  if (capacity === null) return false;
  return registeredCount >= capacity;
}

/**
 * Ein Gesicht in der Teilnehmerreihe. Bewusst schmaler als `Attendee`: kein
 * `registrationId`, kein `checkedIn`, kein `rating` — die RPC gibt sie nicht
 * heraus, und das ist der Punkt.
 */
export interface AttendeeFace {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  status: string;
}

export interface Attendee {
  registrationId: string;
  profileId: string;
  name: string;
  avatarUrl: string | null;
  tier: string | null;
  status: string;
  checkedIn: boolean;
  rating: number | null;
}

export interface EventInput {
  title: string;
  type: EventType;
  /** Nicht nullbar: `events.starts_at` ist seit AGE-531 `not null`. */
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  topics: string[] | null;
  capacity: number | null;
  visibility: EventVisibility;
  /**
   * `undefined` = unangetastet lassen, `null` = entfernen, String = neu setzen.
   * Die Unterscheidung ist der Grund, warum das Feld optional ist: ein
   * Speichern ohne neue Bildauswahl darf das bestehende Titelbild nicht
   * löschen, und ein Entfernen muss ausdrücklich sein.
   */
  coverPath?: string | null;
}

/**
 * Query-Keys nach `uid` getrennt: Event-Sichtbarkeit hängt am Principal (tier-gegated
 * über RLS), darum darf der Cache eines Betrachters nicht an einen anderen ausgespielt
 * werden (vgl. feed.ts).
 */
export const eventsListKey = (uid: string | null) => ["events", "list", uid] as const;
export const eventDetailKey = (uid: string | null, id: string) =>
  ["events", "detail", uid, id] as const;
export const attendeesKey = (uid: string | null, eventId: string) =>
  ["events", "attendees", uid, eventId] as const;
/**
 * EIGENER Schlüssel für die öffentliche Teilnehmerreihe — bewusst nicht
 * `attendeesKey`. Die beiden tragen verschiedene Datenformen: `attendeesKey`
 * hält die vollen Registrierungszeilen (mit `registrationId`, `checkedIn`,
 * `rating`) und wird von ZWEI privilegierten Stellen gelesen, `HostTools` und
 * `RatePanel`. Ein geteilter Schlüssel spielte einer davon die falsche Form
 * aus und bräche Bewertung oder Check-in.
 */
export const eventAttendeesKey = (uid: string | null, eventId: string) =>
  ["events", "attendee-row", uid, eventId] as const;

interface EventRow {
  id: string;
  title: string;
  type: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  description: string | null;
  cover_path: string | null;
  topics: string[] | null;
  visibility: string;
  capacity: number | null;
  host_id: string | null;
  host_partner_id: string | null;
}

// EINE Zeichenkette, nicht zusammengesetzt: supabase-js leitet die Zeilenform
// aus dem LITERAL ab. Ein `"a, b" + "c"` ist für den Typprüfer nur `string`,
// und die Abfrage fiele still auf `GenericStringError` zurück.
// prettier-ignore
const EVENT_COLUMNS =
  "id, title, type, starts_at, ends_at, location, description, cover_path, topics, visibility, capacity, host_id, host_partner_id";

/**
 * Hosts je Event auflösen. Profil-Hosts aus der View `profiles_public`,
 * Partner-Hosts aus `partners`. Best-effort: fehlt ein Host, bleibt host = null.
 * Ein Partner-Host hat Vorrang vor host_id (ein Event wird i. d. R. nur eines haben).
 *
 * OHNE Session wird KEINE der beiden gefragt (AGE-530). Beide sind für `anon`
 * gesperrt — `profiles_public` seit AGE-239, `partners` per Grant nur an
 * `authenticated` (20260715140000_explicit_grants.sql:62) —, ausgeloggt kämen also
 * zwei `42501` zurück und der Host bliebe so oder so leer. Ein Event erscheint
 * ausgeloggt daher ohne Host-Angabe.
 */
async function hostsFor(uid: string | null, rows: EventRow[]): Promise<Map<string, EventHost>> {
  const byEventId = new Map<string, EventHost>();
  if (!uid) return byEventId;
  const profileIds = [...new Set(rows.map((r) => r.host_id).filter((x): x is string => !!x))];
  const partnerIds = [
    ...new Set(rows.map((r) => r.host_partner_id).filter((x): x is string => !!x)),
  ];

  const [profilesRes, partnersRes] = await Promise.all([
    profileIds.length
      ? supabase.from("profiles_public").select("id, name, avatar_url, tier").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    partnerIds.length
      ? supabase.from("partners").select("id, name, logo_url").in("id", partnerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profiles = new Map<string, EventHost>();
  for (const p of profilesRes.data ?? []) {
    if (!p.id) continue; // profiles_public ist eine View → id ist nullable im Typ.
    profiles.set(p.id, {
      kind: "profile",
      id: p.id,
      name: p.name ?? "Mitglied",
      avatarUrl: p.avatar_url,
      tier: p.tier,
    });
  }
  const partners = new Map<string, EventHost>();
  for (const p of partnersRes.data ?? []) {
    partners.set(p.id, {
      kind: "partner",
      id: p.id,
      name: p.name,
      avatarUrl: p.logo_url,
      tier: null,
    });
  }

  for (const r of rows) {
    if (r.host_partner_id && partners.has(r.host_partner_id)) {
      byEventId.set(r.id, partners.get(r.host_partner_id)!);
    } else if (r.host_id && profiles.has(r.host_id)) {
      byEventId.set(r.id, profiles.get(r.host_id)!);
    }
  }
  return byEventId;
}

/**
 * Teilnehmerzähler je Event aus der read-only RPC `event_registration_counts`. Nicht
 * kritisch: schlägt sie fehl, zeigen wir 0/0 (statt zu brechen), melden aber an Sentry.
 */
async function countsFor(
  eventIds: string[],
): Promise<Map<string, { registered: number; waitlist: number }>> {
  const out = new Map<string, { registered: number; waitlist: number }>();
  if (eventIds.length === 0) return out;
  const { data, error } = await supabase.rpc("event_registration_counts", {
    p_event_ids: eventIds,
  });
  if (error) {
    captureException(error, { tags: { area: "events.counts" } });
    return out;
  }
  for (const c of data ?? []) {
    out.set(c.event_id, { registered: c.registered_count, waitlist: c.waitlist_count });
  }
  return out;
}

/** Eigene aktive Registrierungen (status) je Event-ID. RLS: nur die eigenen Zeilen. */
async function myStatuses(
  uid: string | null,
  eventIds: string[],
): Promise<Map<string, RegistrationStatus>> {
  const map = new Map<string, RegistrationStatus>();
  if (!uid || eventIds.length === 0) return map;
  const { data, error } = await supabase
    .from("event_registrations")
    .select("event_id, status")
    .eq("profile_id", uid)
    .in("event_id", eventIds);
  if (error) throw error;
  for (const r of data ?? []) map.set(r.event_id, r.status as RegistrationStatus);
  return map;
}

function toItem(
  r: EventRow,
  hosts: Map<string, EventHost>,
  counts: Map<string, { registered: number; waitlist: number }>,
  statuses: Map<string, RegistrationStatus>,
): EventListItem {
  const c = counts.get(r.id);
  const status = statuses.get(r.id) ?? null;
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    location: r.location,
    description: r.description,
    coverPath: r.cover_path,
    topics: r.topics,
    visibility: r.visibility,
    capacity: r.capacity,
    host: hosts.get(r.id) ?? null,
    registeredCount: c?.registered ?? 0,
    waitlistCount: c?.waitlist ?? 0,
    // Eine abgemeldete Registrierung gilt als „nicht angemeldet".
    myStatus: status === "cancelled" ? null : status,
  };
}

/** Lädt alle sichtbaren Events (RLS erzwingt Sichtbarkeit), chronologisch aufsteigend. */
export async function fetchEvents(uid: string | null): Promise<EventListItem[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .order("starts_at", { ascending: true, nullsFirst: true });
  if (error) throw error;
  const rows = (data ?? []) as EventRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [hosts, counts, statuses] = await Promise.all([
    hostsFor(uid, rows),
    countsFor(ids),
    myStatuses(uid, ids),
  ]);
  return rows.map((r) => toItem(r, hosts, counts, statuses));
}

/** Lädt ein einzelnes Event (oder null, wenn nicht sichtbar/vorhanden). */
export async function fetchEvent(uid: string | null, id: string): Promise<EventListItem | null> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as EventRow;
  const [hosts, counts, statuses] = await Promise.all([
    hostsFor(uid, [row]),
    countsFor([id]),
    myStatuses(uid, [id]),
  ]);
  return toItem(row, hosts, counts, statuses);
}

/**
 * Die Teilnehmerreihe der Detailseite (AGE-531) über die RPC `event_attendees`.
 *
 * Getrennt von `fetchAttendees` und nicht deren Ersatz: jene liest die
 * Registrierungszeilen direkt und liefert `registrationId`, `checkedIn` und
 * `rating` — beides braucht der Host (Check-in) bzw. der Teilnehmer selbst
 * (Bewertung), und beides gibt diese RPC bewusst NICHT heraus, weil RLS
 * zeilenweise wirkt und eine geöffnete Policy fremde Bewertungen mitliefern
 * würde.
 *
 * Die RPC lässt Mitglieder ohne öffentliches Profil ganz aus. Die Auflösung
 * über `profiles_public` ist deshalb vollständig; der Ersatztext bleibt für den
 * Fall eines inzwischen gelöschten Profils.
 */
export async function fetchEventAttendees(eventId: string): Promise<AttendeeFace[]> {
  const { data, error } = await supabase.rpc("event_attendees", { p_event_id: eventId });
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.profile_id))];
  if (ids.length === 0) return [];
  const { data: pdata } = await supabase
    .from("profiles_public")
    .select("id, name, avatar_url")
    .in("id", ids);
  const profiles = new Map((pdata ?? []).flatMap((p) => (p.id ? [[p.id, p] as const] : [])));
  return rows.map((r) => {
    const p = profiles.get(r.profile_id);
    return {
      profileId: r.profile_id,
      name: p?.name ?? "Ein Mitglied",
      avatarUrl: p?.avatar_url ?? null,
      status: r.status,
    };
  });
}

/** Teilnehmerliste eines Events. RLS (regs_select_self_or_host): nur der Host sieht alle. */
export async function fetchAttendees(eventId: string): Promise<Attendee[]> {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("id, profile_id, status, checked_in, rating")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];
  const profiles = new Map<
    string,
    { name: string | null; avatar_url: string | null; tier: string | null }
  >();
  if (profileIds.length > 0) {
    const { data: pdata } = await supabase
      .from("profiles_public")
      .select("id, name, avatar_url, tier")
      .in("id", profileIds);
    for (const p of pdata ?? []) {
      if (!p.id) continue;
      profiles.set(p.id, { name: p.name, avatar_url: p.avatar_url, tier: p.tier });
    }
  }
  return rows.map((r) => {
    const p = profiles.get(r.profile_id);
    return {
      registrationId: r.id,
      profileId: r.profile_id,
      name: p?.name ?? "Mitglied",
      avatarUrl: p?.avatar_url ?? null,
      tier: p?.tier ?? null,
      status: r.status,
      checkedIn: r.checked_in,
      rating: r.rating,
    };
  });
}

/** Die Felder, die Anlegen und Bearbeiten gemeinsam haben. */
function eventPatch(input: EventInput) {
  return {
    title: input.title,
    type: input.type,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    location: input.location,
    description: input.description,
    topics: input.topics,
    capacity: input.capacity,
    visibility: input.visibility,
  };
}

/** Legt ein Event an (host_id = self). Gibt die neue Event-ID zurück. */
export async function createEvent(hostId: string, input: EventInput): Promise<string> {
  const { data, error } = await supabase
    .from("events")
    .insert({ host_id: hostId, ...eventPatch(input), cover_path: input.coverPath ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Aktualisiert ein Event. RLS (events_write_host): nur der Host, und
 * `cover_path` muss im eigenen `{uid}/`-Präfix liegen (AGE-531).
 *
 * `coverPath === undefined` lässt die Spalte in Ruhe. Ohne diese Unterscheidung
 * setzte jedes Speichern ohne neue Bildauswahl das Titelbild auf null — ein
 * Datenverlust, den niemand auslösen wollte.
 */
export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const patch = { ...eventPatch(input) } as ReturnType<typeof eventPatch> & {
    cover_path?: string | null;
  };
  if (input.coverPath !== undefined) patch.cover_path = input.coverPath;
  const { error } = await supabase.from("events").update(patch).eq("id", id);
  if (error) throw error;
}

/** Anmeldung über die RPC; liefert den resultierenden Status (registered|waitlist). */
export async function registerForEvent(eventId: string): Promise<RegistrationStatus> {
  const { data, error } = await supabase.rpc("register_for_event", { p_event_id: eventId });
  if (error) throw error;
  return data as RegistrationStatus;
}

/** Abmelden: eigene Registrierung auf 'cancelled' (RLS regs_write_own). */
export async function cancelRegistration(eventId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("event_registrations")
    .update({ status: "cancelled" })
    .eq("event_id", eventId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

/** Check-in setzen/entfernen über die Host-RPC. */
export async function setCheckIn(registrationId: string, checkedIn: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_event_check_in", {
    p_registration_id: registrationId,
    p_checked_in: checkedIn,
  });
  if (error) throw error;
}

/** Bewertung (1–5) der eigenen Registrierung (RLS regs_write_own). */
export async function rateEvent(registrationId: string, rating: number): Promise<void> {
  const { error } = await supabase
    .from("event_registrations")
    .update({ rating })
    .eq("id", registrationId);
  if (error) throw error;
}
