import { describe, expect, it } from "vitest";
import {
  eventTypeLabel,
  formatEventSpan,
  isFull,
  isPastEvent,
  partitionEvents,
  registrationStatusLabel,
  remainingSpots,
  selectMyEvents,
  selectSimilarEvents,
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
    endsAt: null,
    location: null,
    description: null,
    coverPath: null,
    topics: null,
    visibility: "members",
    capacity: null,
    host: null,
    registeredCount: 0,
    waitlistCount: 0,
    myStatus: null,
  };
}

/**
 * Lokale Zeit → ISO. Die Tests unten konstruieren ihre Zeitpunkte bewusst so
 * und nicht als feste UTC-Zeichenketten: „selber Tag" ist eine Frage der Zone
 * des Betrachters, und diese Suite pinnt keine (vite.config.ts setzt kein TZ).
 * Ein hartkodiertes `2026-07-29T23:30:00Z` fiele je nach Maschine auf den 29.
 * oder den 30. — der Test wäre in Berlin grün und in einer UTC-CI rot, ohne
 * dass sich am Code etwas geändert hätte.
 */
function lokal(jahr: number, monat: number, tag: number, std: number, min = 0): string {
  return new Date(jahr, monat - 1, tag, std, min).toISOString();
}

describe("formatEventSpan", () => {
  // Geprüft wird die STRUKTUR, nicht die genaue Zeichenkette: „29. Aug." gegen
  // „29. Aug" ist eine Frage der ICU-Version der Laufzeit und sagt nichts über
  // die Regel aus, um die es hier geht — steht das Datum einmal oder zweimal da.
  it("nennt das Datum EINMAL, wenn Beginn und Ende auf denselben lokalen Tag fallen", () => {
    const s = formatEventSpan(lokal(2026, 7, 29, 20), lokal(2026, 7, 29, 21, 30));
    expect(s.match(/29\./g)).toHaveLength(1);
    expect(s).toContain("20:00");
    expect(s).toContain("21:30");
    expect(s).toContain("–");
  });

  it("nennt BEIDE Daten, wenn das Event über lokale Mitternacht läuft", () => {
    const s = formatEventSpan(lokal(2026, 7, 29, 22), lokal(2026, 7, 30, 1));
    expect(s).toContain("29.");
    expect(s).toContain("30.");
  });

  it("zeigt ohne Ende nur den Beginn und keinen Gedankenstrich", () => {
    const s = formatEventSpan(lokal(2026, 7, 29, 20), null);
    expect(s).toContain("20:00");
    expect(s).not.toContain("–");
  });

  it("bleibt an der Sommerzeitgrenze bei einem Tag", () => {
    // In Europa endet die Sommerzeit am letzten Sonntag im Oktober; an dem Tag
    // hat der lokale Tag 25 Stunden. Ein Vergleich über die reine Differenz in
    // Millisekunden („weniger als 24 h ⇒ selber Tag") ginge hier schief.
    const s = formatEventSpan(lokal(2026, 10, 25, 1), lokal(2026, 10, 25, 23));
    expect(s.match(/25\./g)).toHaveLength(1);
  });
});

describe("selectSimilarEvents", () => {
  const jetzt = new Date("2026-06-15T12:00:00Z");
  const typ = (id: string, t: string, tage: number): EventListItem => ({
    ...evt(id, new Date(jetzt.getTime() + tage * 86400000).toISOString()),
    type: t,
  });

  const self = typ("self", "workshop", 1);

  it("nimmt die drei nächsten kommenden desselben Typs", () => {
    const alle = [
      self,
      typ("w1", "workshop", 2),
      typ("w2", "workshop", 3),
      typ("w3", "workshop", 4),
    ];
    expect(selectSimilarEvents(alle, self, jetzt).map((e) => e.id)).toEqual(["w1", "w2", "w3"]);
  });

  it("lässt das Event selbst aus", () => {
    const alle = [self, typ("w1", "workshop", 2)];
    expect(selectSimilarEvents(alle, self, jetzt).map((e) => e.id)).toEqual(["w1"]);
  });

  it("füllt mit den nächsten kommenden auf, wenn es zu wenige desselben Typs gibt", () => {
    const alle = [self, typ("w1", "workshop", 5), typ("d1", "dinner", 2), typ("o1", "online", 3)];
    // w1 zuerst (gleicher Typ), dann die nächsten überhaupt in Datumsfolge.
    expect(selectSimilarEvents(alle, self, jetzt).map((e) => e.id)).toEqual(["w1", "d1", "o1"]);
  });

  it("nimmt keine vergangenen Events", () => {
    const alle = [self, typ("alt", "workshop", -5), typ("w1", "workshop", 2)];
    expect(selectSimilarEvents(alle, self, jetzt).map((e) => e.id)).toEqual(["w1"]);
  });

  it("ist leer, wenn es nur das Event selbst gibt", () => {
    expect(selectSimilarEvents([self], self, jetzt)).toEqual([]);
  });
});

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
