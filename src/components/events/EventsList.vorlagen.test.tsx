import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EventsList from "./EventsList";
import { ToastProvider } from "../ui/Toast";
import { fetchEvents, type EventListItem } from "../../lib/events";
import { fetchVorlagen, type VorlageItem } from "../../lib/event-vorlagen";

/**
 * Der VIERTE Reiter unter `/events` (AGE-630, Gruppe 9.1).
 *
 * Der Ort ist eine Entscheidung, keine Ableitung — Donald am 07.09.: die
 * Vorlagen bekommen **keine eigene Seite**. Das folgt zwei dokumentierten
 * Vorgängern in `src/config/nav.ts`: AGE-442 hat „Meine Events" als dritten
 * Reiter hierher gelegt, ausdrücklich mit „keine weitere Unterseite", und
 * AGE-494 hat mehrere Menüpunkte mit der Begründung entfernt, ein eigener
 * Eintrag daneben sei „ein dritter Weg zum selben Ort".
 *
 * Die Zusage, die dabei am leichtesten kippt, steht als eigener Fall unten:
 * ohne Anmeldung darf der Reiter **gar nicht erst erscheinen**. Eine Vorlage
 * gehört immer genau einem Host; die RLS gäbe ausgeloggt ohnehin nichts heraus,
 * aber ein leerer Reiter, der nach einem Fehler aussieht, ist schlechter als
 * keiner — dieselbe Regel, die „Meine Events" schon befolgt.
 */

vi.mock("../../lib/events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/events")>()),
  fetchEvents: vi.fn(),
}));

vi.mock("../../lib/event-vorlagen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/event-vorlagen")>()),
  fetchVorlagen: vi.fn(),
}));

vi.mock("./useEventCovers", () => ({ useEventCovers: () => ({}) }));

const UID = "11111111-1111-1111-1111-111111111111";
let angemeldet = true;
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => ({ user: angemeldet ? { id: UID } : null }),
}));

function vorlage(teil: Partial<VorlageItem> & { id: string; title: string }): VorlageItem {
  return {
    hostId: UID,
    type: "online",
    location: null,
    description: null,
    topics: null,
    capacity: null,
    visibility: "members",
    coverPath: null,
    ortszeit: "18:30:00",
    zeitzone: "Europe/Berlin",
    dauer: null,
    wiederholung: null,
    wochentag: null,
    tagImMonat: null,
    wochentagPosition: null,
    createdAt: "2026-09-01T10:00:00+00:00",
    ...teil,
  } as VorlageItem;
}

/**
 * Ein Event weit in der Zukunft. Ausgeloggt gebraucht, weil der Leerzustand
 * dort weiterhin die ganze Reiterleiste ersetzt — angemeldet tut er das seit
 * AGE-630 nicht mehr, sonst wäre der Vorlagen-Reiter unerreichbar.
 */
function einEvent(): EventListItem {
  return {
    id: "e1",
    title: "Sommerfest",
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
  } as unknown as EventListItem;
}

function renderEvents(vorlagen: VorlageItem[], events: EventListItem[] = []) {
  vi.mocked(fetchEvents).mockResolvedValue(events);
  vi.mocked(fetchVorlagen).mockResolvedValue(vorlagen);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/events"]}>
          <EventsList />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  angemeldet = true;
  vi.mocked(fetchEvents).mockReset();
  vi.mocked(fetchVorlagen).mockReset();
});

describe("Vorlagen-Reiter", () => {
  it("steht als vierter Reiter in der Leiste und zählt die eigenen Vorlagen", async () => {
    renderEvents([vorlage({ id: "v1", title: "Stammtisch" }), vorlage({ id: "v2", title: "Jour fixe" })]);

    const leiste = await screen.findByRole("tablist");
    const reiter = within(leiste).getAllByRole("tab");
    expect(reiter.map((b) => b.textContent)).toEqual([
      "Kommende (0)",
      "Vergangene (0)",
      "Meine Events (0)",
      "Vorlagen (2)",
    ]);
  });

  it("zeigt die Vorlagen erst, wenn der Reiter gewählt ist", async () => {
    renderEvents([vorlage({ id: "v1", title: "Stammtisch" })]);

    // Der erste Reiter ist „Kommende" — vorher darf die Vorlage nicht stehen.
    expect(screen.queryByText("Stammtisch")).toBeNull();

    fireEvent.click(await screen.findByRole("tab", { name: "Vorlagen (1)" }));
    expect(await screen.findByText("Stammtisch")).toBeTruthy();
  });

  it("ohne Anmeldung gibt es den Reiter nicht — und keine Abfrage", async () => {
    angemeldet = false;
    renderEvents([], [einEvent()]);

    const leiste = await screen.findByRole("tablist");
    const beschriftungen = within(leiste)
      .getAllByRole("tab")
      .map((b) => b.textContent ?? "");
    expect(beschriftungen.some((t) => t.startsWith("Vorlagen"))).toBe(false);

    // Nicht nur unsichtbar, sondern ungefragt: eine Abfrage, die die RLS
    // ohnehin leer beantwortet, ist eine Anfrage zu viel auf jedem Seitenaufruf.
    expect(vi.mocked(fetchVorlagen)).not.toHaveBeenCalled();
  });

  it("sagt im Leerzustand, wozu Vorlagen da sind", async () => {
    renderEvents([]);

    fireEvent.click(await screen.findByRole("tab", { name: "Vorlagen (0)" }));
    expect(await screen.findByText(/noch keine Vorlage/i)).toBeTruthy();
  });

  // Diff-Review (opencode, NIEDRIG): `vorlagen.data ?? []` machte aus einer
  // gescheiterten Abfrage eine leere Liste — der Reiter zeigte „Vorlagen (0)"
  // und den Erstkontakt-Text, obwohl Vorlagen existieren. Für die Events-
  // Abfrage daneben gibt es diesen Fehlerzustand seit jeher; für Vorlagen
  // nicht. Der Fehler wäre erst beim nächsten Anlegen aufgefallen.
  it("unterscheidet eine gescheiterte Abfrage von einer leeren Liste", async () => {
    vi.mocked(fetchEvents).mockResolvedValue([]);
    vi.mocked(fetchVorlagen).mockRejectedValue(new Error("PGRST301"));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/events"]}>
            <EventsList />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "Vorlagen (0)" }));
    expect(await screen.findByText(/konnten nicht geladen werden/i)).toBeTruthy();
    // Und ausdrücklich NICHT die Meldung, die eine Aussage über den Bestand
    // macht, die niemand geprüft hat.
    expect(screen.queryByText(/noch keine Vorlage/i)).toBeNull();
  });

  it("bietet im Reiter das Anlegen an und öffnet das Formular", async () => {
    renderEvents([]);

    fireEvent.click(await screen.findByRole("tab", { name: "Vorlagen (0)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Vorlage anlegen" }));

    // Das Formular ist `EventForm`s Zwilling: Titel ist Pflicht, und die
    // Regelauswahl kommt dazu. Beides muss sichtbar sein.
    expect(await screen.findByLabelText(/Titel/)).toBeTruthy();
    expect(await screen.findByLabelText(/Wiederholung/)).toBeTruthy();
  });
});
