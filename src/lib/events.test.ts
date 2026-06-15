import { describe, expect, it } from "vitest";
import {
  eventTypeLabel,
  isFull,
  isPastEvent,
  partitionEvents,
  registrationStatusLabel,
  remainingSpots,
  type EventListItem,
} from "./events";

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
