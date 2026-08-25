import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import { ToastProvider } from "../components/ui/Toast";
import type { EventHost, EventListItem } from "../lib/events";
import type { MembershipLevel } from "../config/levels";

/**
 * AGE-594 — der Anmeldeknopf verspricht nichts, was die Stufe nicht hergibt.
 *
 * `register_for_event` (Migration 20260722070000) lässt zu einem `members`-Event
 * nur ab `discover` (rank 3) oder den Host. Die Seite prüfte das nicht: Ein
 * `basic`-Mitglied sah einen normalen „Anmelden"-Knopf, drückte ihn und bekam
 * eine Fehlermeldung mit dem ROHEN Text der Datenbank — „membership level too
 * low to register". Englisch, technisch, und erst NACH dem Klick.
 *
 * Derselbe Fehlermodus wie AGE-591/592/593, nur andersherum: Statt zu schweigen
 * verspricht die Fläche hier etwas, das sie nicht halten kann.
 *
 * Gemockt ist der Netzweg, nicht die Seite.
 */
vi.mock("../lib/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/events")>();
  return {
    ...actual,
    fetchEvent: vi.fn(),
    fetchEvents: vi.fn(),
    fetchEventAttendees: vi.fn(),
    fetchAttendees: vi.fn(),
  };
});
vi.mock("../lib/event-cover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/event-cover")>();
  return { ...actual, signEventCovers: vi.fn(async () => ({})) };
});

import { fetchEvent, fetchEvents, fetchEventAttendees, fetchAttendees } from "../lib/events";
import EventDetailPage from "./EventDetailPage";

const mEvent = vi.mocked(fetchEvent);
const mEvents = vi.mocked(fetchEvents);
const mFaces = vi.mocked(fetchEventAttendees);
const mAttendees = vi.mocked(fetchAttendees);

/** Dieselbe Kennung, die `authAsTier` vergibt — für den Host-Fall. */
const ICH = "test-user";

function evt(over: Partial<EventListItem> = {}): EventListItem {
  return {
    id: "e1",
    title: "Mitglieder-Runde",
    type: "online",
    startsAt: new Date(2030, 6, 29, 20, 0).toISOString(),
    endsAt: null,
    location: "Online",
    description: null,
    coverPath: null,
    topics: null,
    visibility: "members",
    capacity: null,
    host: null,
    registeredCount: 0,
    waitlistCount: 0,
    myStatus: null,
    ...over,
  };
}

function host(id: string): EventHost {
  return {
    kind: "profile",
    id,
    name: "Gastgeberin",
    avatarUrl: null,
    tier: "impact",
    company: null,
    roles: null,
    shortBio: null,
  };
}

function renderMitStufe(stufe: MembershipLevel) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthFixture value={authAsTier(stufe)}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/events/e1"]}>
            <Routes>
              <Route path="/events/:id" element={<EventDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mEvents.mockResolvedValue([]);
  mFaces.mockResolvedValue([]);
  mAttendees.mockResolvedValue([]);
});

describe("Der Anmeldeknopf hält sich an die Teilnahmeschwelle (AGE-594)", () => {
  it("sperrt ihn für eine Stufe unter discover bei einem Mitglieder-Event", async () => {
    mEvent.mockResolvedValue(evt());
    renderMitStufe("basic");

    const knopf = await screen.findByRole("button", { name: /Anmelden/ });
    expect(knopf).toBeDisabled();
  });

  /**
   * Sperren allein wäre nur die halbe Miete — ein grauer Knopf ohne Grund ist
   * seinerseits eine Fläche, die nichts sagt. Der Grund muss dastehen, VOR dem
   * Klick, auf Deutsch, und er muss die nötige Stufe benennen.
   */
  it("nennt den Grund und die nötige Stufe, bevor jemand klickt", async () => {
    mEvent.mockResolvedValue(evt());
    renderMitStufe("connect");

    expect(await screen.findByText(/Discover/)).toBeInTheDocument();
    // Der rohe Text der Datenbank darf nirgends auftauchen.
    expect(screen.queryByText(/membership level too low/i)).toBeNull();
  });

  it("lässt ihn ab discover frei", async () => {
    mEvent.mockResolvedValue(evt());
    renderMitStufe("discover");

    expect(await screen.findByRole("button", { name: /Anmelden/ })).toBeEnabled();
  });

  /**
   * Die Gegenprobe, ohne die aus dem Fix eine zu breite Sperre würde: Zu einem
   * ÖFFENTLICHEN Event darf jedes eingeloggte, aktivierte Mitglied — auch
   * `basic`. Das steht so in der Spec und so in der Funktion.
   */
  it("sperrt bei einem öffentlichen Event NICHT", async () => {
    mEvent.mockResolvedValue(evt({ visibility: "public" }));
    renderMitStufe("basic");

    expect(await screen.findByRole("button", { name: /Anmelden/ })).toBeEnabled();
  });

  /**
   * Die Ausnahme, die in der Funktion steht und die eine reine Stufenprüfung
   * übersieht: Der HOST darf zu seinem eigenen Mitglieder-Event, unabhängig von
   * seiner Stufe.
   */
  it("lässt den Host zu seinem eigenen Mitglieder-Event, auch auf basic", async () => {
    mEvent.mockResolvedValue(evt({ host: host(ICH) }));
    renderMitStufe("basic");

    expect(await screen.findByRole("button", { name: /Anmelden/ })).toBeEnabled();
  });
});
