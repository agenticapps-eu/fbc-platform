import { captureException } from "@sentry/react";

import { supabase } from "./supabase";

export type EventType = "online" | "presence" | "dinner" | "workshop" | "mastermind";
export type EventVisibility = "public" | "members" | "prime" | "legacy";
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
  startsAt: string | null;
  location: string | null;
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

export const VISIBILITY_OPTIONS: { value: EventVisibility; label: string }[] = [
  { value: "members", label: "Mitglieder" },
  { value: "public", label: "Öffentlich" },
  { value: "prime", label: "Prime & Legacy" },
  { value: "legacy", label: "Nur Legacy" },
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

export function remainingSpots(capacity: number | null, registeredCount: number): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - registeredCount);
}

export function isFull(capacity: number | null, registeredCount: number): boolean {
  if (capacity === null) return false;
  return registeredCount >= capacity;
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
  startsAt: string | null;
  location: string | null;
  capacity: number | null;
  visibility: EventVisibility;
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

interface EventRow {
  id: string;
  title: string;
  type: string | null;
  starts_at: string | null;
  location: string | null;
  visibility: string;
  capacity: number | null;
  host_id: string | null;
  host_partner_id: string | null;
}

const EVENT_COLUMNS =
  "id, title, type, starts_at, location, visibility, capacity, host_id, host_partner_id";

/**
 * Hosts je Event auflösen. Profil-Hosts aus der View `profiles_public` (für
 * authenticated lesbar), Partner-Hosts aus `partners` (für alle lesbar). Best-effort:
 * fehlt ein Host (z. B. anon ohne profiles_public-Zugriff), bleibt host = null.
 * Ein Partner-Host hat Vorrang vor host_id (ein Event wird i. d. R. nur eines haben).
 */
async function hostsFor(rows: EventRow[]): Promise<Map<string, EventHost>> {
  const byEventId = new Map<string, EventHost>();
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
    location: r.location,
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
    hostsFor(rows),
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
    hostsFor([row]),
    countsFor([id]),
    myStatuses(uid, [id]),
  ]);
  return toItem(row, hosts, counts, statuses);
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

/** Legt ein Event an (host_id = self). Gibt die neue Event-ID zurück. */
export async function createEvent(hostId: string, input: EventInput): Promise<string> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      host_id: hostId,
      title: input.title,
      type: input.type,
      starts_at: input.startsAt,
      location: input.location,
      capacity: input.capacity,
      visibility: input.visibility,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Aktualisiert ein Event. RLS (events_write_host): nur der Host. */
export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({
      title: input.title,
      type: input.type,
      starts_at: input.startsAt,
      location: input.location,
      capacity: input.capacity,
      visibility: input.visibility,
    })
    .eq("id", id);
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
