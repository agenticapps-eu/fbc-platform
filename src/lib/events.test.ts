import { describe, expect, it } from "vitest";
import {
  eventTypeLabel,
  isFull,
  isPastEvent,
  partitionEvents,
  registrationStatusLabel,
  remainingSpots,
  selectMyEvents,
  VISIBILITY_OPTIONS,
  type EventListItem,
} from "./events";

describe("VISIBILITY_OPTIONS", () => {
  it("bietet nur Werte an, die events_visibility_check akzeptiert (AGE-355)", () => {
    // Die Wahrheit steht in 20260715150000_six_level_model.sql:287:
    //   check (visibility in ('public', 'members'))
    // Eine Option, die die Constraint nicht kennt, ist ein Speichern-Fehler in Prod.
    // Neue Option ⇒ zuerst Migration, dann diese Liste.
    expect(VISIBILITY_OPTIONS.map((o) => o.value).sort()).toEqual(["members", "public"]);
  });
});

const now = new Date("2026-06-15T12:00:00Z");

function evt(id: string, startsAt: string | null): EventListItem {
  return {
    id,
    title: id,
    type: "online",
    startsAt,
    location: null,
    visibility: "members",
    capacity: null,
    host: null,
    registeredCount: 0,
    waitlistCount: 0,
    myStatus: null,
  };
}

describe("partitionEvents", () => {
  it("splits upcoming (asc) and past (desc), undated counts as upcoming first", () => {
    const a = evt("a", "2026-07-01T10:00:00Z");
    const b = evt("b", "2026-06-20T10:00:00Z");
    const past = evt("p", "2026-06-01T10:00:00Z");
    const undated = evt("u", null);
    const { upcoming, past: pastList } = partitionEvents([a, past, undated, b], now);
    expect(upcoming.map((e) => e.id)).toEqual(["u", "b", "a"]);
    expect(pastList.map((e) => e.id)).toEqual(["p"]);
  });
});

describe("selectMyEvents", () => {
  const hosted = {
    ...evt("hosted", "2026-07-01T10:00:00Z"),
    host: { kind: "profile" as const, id: "me", name: "Ich", avatarUrl: null, tier: null },
  };
  const booked = { ...evt("booked", "2026-06-20T10:00:00Z"), myStatus: "registered" as const };
  const waitlisted = {
    ...evt("waitlisted", "2026-06-25T10:00:00Z"),
    myStatus: "waitlist" as const,
  };
  const foreign = evt("foreign", "2026-06-18T10:00:00Z");

  it("nimmt selbst gehostete und gebuchte Events, sonst nichts", () => {
    const ids = selectMyEvents([foreign, hosted, booked, waitlisted], "me", now).map((e) => e.id);
    expect(ids.sort()).toEqual(["booked", "hosted", "waitlisted"]);
  });

  it("zeigt ein selbst gehostetes UND gebuchtes Event nur einmal", () => {
    const both = { ...hosted, myStatus: "registered" as const };
    expect(selectMyEvents([both], "me", now).map((e) => e.id)).toEqual(["hosted"]);
  });

  it("sortiert kommende (asc) vor vergangene (desc)", () => {
    const pastMine = { ...evt("past", "2026-06-01T10:00:00Z"), myStatus: "registered" as const };
    const olderMine = { ...evt("older", "2026-05-01T10:00:00Z"), myStatus: "registered" as const };
    const ids = selectMyEvents([pastMine, hosted, olderMine, booked], "me", now).map((e) => e.id);
    expect(ids).toEqual(["booked", "hosted", "past", "older"]);
  });

  it("ist ohne Login leer — ein Partner-Host ist nie „meins“", () => {
    const partnerHosted = {
      ...evt("partner", "2026-07-01T10:00:00Z"),
      host: { kind: "partner" as const, id: "me", name: "P", avatarUrl: null, tier: null },
    };
    expect(selectMyEvents([hosted, booked], null, now)).toEqual([]);
    expect(selectMyEvents([partnerHosted], "me", now)).toEqual([]);
  });
});

describe("remainingSpots / isFull", () => {
  it("null capacity is unlimited", () => {
    expect(remainingSpots(null, 5)).toBeNull();
    expect(isFull(null, 999)).toBe(false);
  });
  it("clamps remaining at zero and reports full", () => {
    expect(remainingSpots(10, 3)).toBe(7);
    expect(remainingSpots(10, 12)).toBe(0);
    expect(isFull(10, 10)).toBe(true);
    expect(isFull(10, 9)).toBe(false);
  });
});

describe("isPastEvent", () => {
  it("true only when startsAt is strictly before now; null is not past", () => {
    expect(isPastEvent("2026-06-01T10:00:00Z", now)).toBe(true);
    expect(isPastEvent("2026-07-01T10:00:00Z", now)).toBe(false);
    expect(isPastEvent(null, now)).toBe(false);
  });
});

describe("labels", () => {
  it("maps event types and registration statuses to German labels", () => {
    expect(eventTypeLabel("dinner")).toBe("Dinner");
    expect(eventTypeLabel("mastermind")).toBe("Mastermind");
    expect(eventTypeLabel(null)).toBe("Event");
    expect(eventTypeLabel("unknown")).toBe("unknown");
    expect(registrationStatusLabel("registered")).toBe("Angemeldet");
    expect(registrationStatusLabel("waitlist")).toBe("Warteliste");
    expect(registrationStatusLabel("cancelled")).toBe("Abgemeldet");
  });
});
