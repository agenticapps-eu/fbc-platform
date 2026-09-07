import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import { ToastProvider } from "../components/ui/Toast";
import type { EventListItem } from "../lib/events";

/**
 * Serienzugehörigkeit am Event (AGE-630, 9.3).
 *
 * Ein Termin aus einer Serie sieht sonst aus wie jeder andere — und genau das
 * ist die Frage, die sich beim Anmelden stellt: „ist das der eine Abend oder
 * einer von zwölf?". Die Antwort steht in `events.vorlage_id`, das bisher zwar
 * geschrieben, aber nirgends gelesen wurde.
 *
 * Bewusst OHNE Rechteprüfung angezeigt: dass `vorlage_id` für fremde
 * Mitglieder lesbar ist, steht als hingenommenes Risiko in `design.md` unter
 * Risks — mit der Begründung, die Termine selbst seien ohnehin sichtbar und
 * ihre Zusammengehörigkeit inhaltlich offensichtlich. Diese Anzeige nutzt genau
 * das aus und schafft keine neue Fläche.
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

function evt(over: Partial<EventListItem> = {}): EventListItem {
  return {
    id: "e1",
    title: "Stammtisch Stuttgart",
    type: "presence",
    startsAt: new Date(2026, 8, 1, 18, 30).toISOString(),
    endsAt: null,
    location: "Stuttgart",
    description: null,
    coverPath: null,
    topics: null,
    visibility: "members",
    capacity: null,
    host: null,
    registeredCount: 0,
    waitlistCount: 0,
    myStatus: null,
    vorlageId: null,
    ...over,
  } as EventListItem;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthFixture value={authAsTier("impact")}>
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
  vi.mocked(fetchEvents).mockResolvedValue([]);
  vi.mocked(fetchEventAttendees).mockResolvedValue([]);
  vi.mocked(fetchAttendees).mockResolvedValue([]);
});

describe("EventDetailPage — Serienzugehörigkeit", () => {
  it("sagt es, wenn der Termin aus einer Serie stammt", async () => {
    mEvent.mockResolvedValue(evt({ vorlageId: "v1" }));
    renderPage();
    expect(await screen.findByText(/Teil einer Serie/i)).toBeInTheDocument();
  });

  it("schweigt bei einem einzeln angelegten Termin", async () => {
    // `vorlage_id` ist bei ALLEN vor der Migration bestehenden Events null.
    // Eine Zeile, die dort „Einzeltermin" sagt, stünde damit unter jedem
    // Bestandsevent und wäre eine Auskunft, die niemand gesucht hat.
    mEvent.mockResolvedValue(evt({ vorlageId: null }));
    renderPage();
    // Als Überschrift, nicht als Text: der Titel steht auch in der Brotkrume,
    // und ein `findByText` fände beide. Der Anker soll belegen, dass die Seite
    // fertig geladen ist — sonst ist das `queryBy` darunter nur ein Beleg
    // dafür, dass noch nichts da war.
    expect(
      await screen.findByRole("heading", { name: "Stammtisch Stuttgart" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Teil einer Serie/i)).not.toBeInTheDocument();
  });
});
