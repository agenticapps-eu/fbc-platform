import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EventsList from "./EventsList";
import { fetchEvents, type EventListItem } from "../../lib/events";

/**
 * Suche und Facetten in der rechten Spalte der Eventliste (AGE-629).
 *
 * Zwei Zusagen, die nicht dasselbe sind:
 *
 *  * die **Art**-Facette bietet die Werte des Schemas an, auch die, die kein
 *    einziges Event gerade trägt. Auf der Produktion steht heute genau ein
 *    künftiges Event mit einem einzigen `type` — eine abgeleitete Facette böte
 *    dort eine Auswahl mit einem Eintrag, was keine Auswahl ist.
 *  * die **Themen**-Facette wird abgeleitet, denn `topics` ist Freitext und das
 *    Schema kennt dafür keine Liste. Ohne Werte rendert sie nicht.
 *
 * Gemockt wird der Datenweg. `useEventCovers` signiert sonst gegen Supabase;
 * die Kachelbilder sind für diese Zusagen ohne Belang.
 */
vi.mock("../../lib/events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/events")>()),
  fetchEvents: vi.fn(),
}));

vi.mock("./useEventCovers", () => ({ useEventCovers: () => ({}) }));

vi.mock("../../providers/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));

/** Weit in der Zukunft, damit `partitionEvents` sie sicher als „kommend" führt. */
function event(teil: Partial<EventListItem> & { id: string; title: string }): EventListItem {
  return {
    type: null,
    startsAt: "2099-01-01T10:00:00+00:00",
    endsAt: null,
    location: null,
    description: null,
    coverPath: null,
    topics: null,
    visibility: "members",
    capacity: null,
    registeredCount: 0,
    myStatus: null,
    hostId: null,
    hostPartnerId: null,
    ...teil,
  } as EventListItem;
}

function renderEvents(events: EventListItem[]) {
  vi.mocked(fetchEvents).mockResolvedValue(events);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/events"]}>
        <EventsList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(fetchEvents).mockReset();
});

describe("Eventliste: Suche und Facetten in der rechten Spalte", () => {
  it("sucht über Titel, Beschreibung und Ort", async () => {
    renderEvents([
      event({ id: "1", title: "Kaminabend" }),
      event({ id: "2", title: "Stammtisch", location: "Esslingen" }),
      event({ id: "3", title: "Impuls", description: "Rund um Esslingen" }),
    ]);
    await screen.findByText("Kaminabend");

    fireEvent.change(screen.getByLabelText(/Volltextsuche/i), {
      target: { value: "esslingen" },
    });

    expect(screen.queryByText("Kaminabend")).toBeNull();
    expect(screen.getByText("Stammtisch")).toBeInTheDocument();
    // Auch die Beschreibung zählt — sonst fände man ein Online-Format nie über
    // das, worum es darin geht.
    expect(screen.getByText("Impuls")).toBeInTheDocument();
  });

  it("bietet in der Art-Facette die Werte des Schemas an, nicht die des Bestands", async () => {
    // EIN Event, EIN Typ — und trotzdem stehen alle fünf zur Wahl.
    renderEvents([event({ id: "1", title: "Kaminabend", type: "dinner" })]);
    await screen.findByText("Kaminabend");

    for (const label of ["Online", "Präsenz", "Dinner", "Workshop", "Mastermind"]) {
      expect(screen.getByRole("checkbox", { name: label })).toBeInTheDocument();
    }
  });

  it("filtert nach Art", async () => {
    renderEvents([
      event({ id: "1", title: "Kaminabend", type: "dinner" }),
      event({ id: "2", title: "Impuls", type: "online" }),
    ]);
    await screen.findByText("Kaminabend");

    fireEvent.click(screen.getByRole("checkbox", { name: "Online" }));

    expect(screen.queryByText("Kaminabend")).toBeNull();
    expect(screen.getByText("Impuls")).toBeInTheDocument();
  });

  it("leitet die Themen-Facette aus dem Bestand ab", async () => {
    renderEvents([
      event({ id: "1", title: "Kaminabend", topics: ["nachfolge"] }),
      event({ id: "2", title: "Impuls", topics: ["marketing"] }),
    ]);
    await screen.findByText("Kaminabend");

    expect(screen.getByRole("checkbox", { name: "nachfolge" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "marketing" })).toBeInTheDocument();
  });

  it("zeigt keine Themen-Karte, wenn kein Event ein Thema trägt", async () => {
    renderEvents([event({ id: "1", title: "Kaminabend" })]);
    await screen.findByText("Kaminabend");

    // Das ist der Zustand der Produktion: `topics` ist dort auf allen Events
    // leer. Eine leere Facettenkarte nähme 280 px und gäbe nichts.
    expect(screen.queryByText("Themen")).toBeNull();
    // Suchfeld und Art-Facette stehen trotzdem — die Spalte trägt auf jeder
    // Datenlage.
    expect(screen.getByLabelText(/Volltextsuche/i)).toBeInTheDocument();
    expect(screen.getByText("Art")).toBeInTheDocument();
  });

  it("wirkt innerhalb des gewählten Reiters, nicht über ihn hinweg", async () => {
    renderEvents([
      event({ id: "1", title: "Kaminabend", type: "dinner" }),
      event({ id: "2", title: "Rückblick", type: "dinner", startsAt: "2020-01-01T10:00:00+00:00" }),
    ]);
    await screen.findByText("Kaminabend");

    fireEvent.click(screen.getByRole("checkbox", { name: "Dinner" }));

    // Der Reiter „Kommende" steht vorn: das vergangene Event bleibt draussen,
    // obwohl es dem Filter entspricht.
    expect(screen.getByText("Kaminabend")).toBeInTheDocument();
    expect(screen.queryByText("Rückblick")).toBeNull();
  });

  it("hält die Spalte auf dem Telefon zusammengeklappt", async () => {
    renderEvents([event({ id: "1", title: "Kaminabend" })]);
    await screen.findByText("Kaminabend");

    const schalter = screen.getByRole("button", { name: /^filter$/i });
    const flaeche = document.getElementById(schalter.getAttribute("aria-controls")!);

    expect(schalter).toHaveAttribute("aria-expanded", "false");
    /* Wie in `CommunityFeed.flaeche.test.tsx`: jsdom rechnet kein CSS, die
       Zusage ist über die Klasse, der Beleg über die Sichtprobe bei 375 px. */
    expect(flaeche).toHaveClass("hidden", "lg:block");

    fireEvent.click(schalter);
    expect(schalter).toHaveAttribute("aria-expanded", "true");
    expect(flaeche).not.toHaveClass("hidden");
  });
});
