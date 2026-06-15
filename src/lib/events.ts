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
