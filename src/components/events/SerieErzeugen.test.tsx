import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SerieErzeugen } from "./SerieErzeugen";
import { ToastProvider } from "../ui/Toast";
import { serieErzeugen, serieSlots, type SerieSlot, type VorlageItem } from "../../lib/event-vorlagen";

/**
 * Der Erzeugen-Dialog (AGE-630, 9.2).
 *
 * Die Zusage, die hier wirklich zählt, ist die Reihenfolge: **erzeugen erst
 * nach der Vorschau**. 52 Termine sind ein Schreibvorgang, der sich nicht mit
 * einem Klick zurücknehmen lässt, und die Regelfelder einer Vorlage sind genau
 * die Sorte Eingabe, bei der man sich um einen Wochentag vertut. Ein Knopf, der
 * ohne gesehene Liste schreibt, macht diesen Vertipper unbemerkbar.
 *
 * Die Vorschau selbst wird NICHT nachgerechnet — sie kommt aus
 * `event_serie_slots()`, derselben Funktion, die danach schreibt. Ein Test, der
 * die Daten hier nachbildete, prüfte seine eigene Nachbildung.
 */

vi.mock("../../lib/event-vorlagen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/event-vorlagen")>()),
  serieSlots: vi.fn(),
  serieErzeugen: vi.fn(),
}));

const UID = "11111111-1111-1111-1111-111111111111";
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => ({ user: { id: UID } }),
}));

const VORLAGE: VorlageItem = {
  id: "v1",
  hostId: UID,
  title: "Stammtisch",
  type: "presence",
  location: "Stuttgart",
  description: null,
  topics: null,
  capacity: null,
  visibility: "members",
  coverPath: null,
  ortszeit: "18:30:00",
  zeitzone: "Europe/Berlin",
  dauer: null,
  wiederholung: "woechentlich",
  wochentag: 2,
  tagImMonat: null,
  wochentagPosition: null,
  createdAt: "2026-09-01T10:00:00+00:00",
};

function slot(datum: string): SerieSlot {
  return { slotDatum: datum, startsAt: `${datum}T16:30:00+00:00` };
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SerieErzeugen vorlage={VORLAGE} onDone={() => {}} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(serieSlots).mockReset();
  vi.mocked(serieErzeugen).mockReset();
});

describe("SerieErzeugen", () => {
  it("schreibt nicht, bevor die Vorschau gesehen wurde", async () => {
    renderDialog();
    const knopf = screen.getByRole("button", { name: "Termine erzeugen" });
    expect(knopf).toBeDisabled();

    // Und der Klick darauf bleibt folgenlos — `disabled` ist die Anzeige, die
    // ausbleibende Wirkung ist die Zusage.
    fireEvent.click(knopf);
    expect(vi.mocked(serieErzeugen)).not.toHaveBeenCalled();
  });

  it("zeigt die Termine der Vorschau und schreibt danach genau diese", async () => {
    const slots = [slot("2026-09-01"), slot("2026-09-08"), slot("2026-09-15")];
    vi.mocked(serieSlots).mockResolvedValue(slots);
    vi.mocked(serieErzeugen).mockResolvedValue(3);
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Vorschau" }));
    expect(await screen.findByText("3 Termine")).toBeTruthy();

    const knopf = screen.getByRole("button", { name: "Termine erzeugen" });
    await waitFor(() => expect(knopf).not.toBeDisabled());
    fireEvent.click(knopf);

    // Dieselbe Liste, die auf dem Schirm stand — nicht neu geholt.
    await waitFor(() =>
      expect(vi.mocked(serieErzeugen)).toHaveBeenCalledWith(UID, VORLAGE, expect.any(String), slots),
    );
  });

  it("eine leere Vorschau bleibt ein Nicht-Schreiben", async () => {
    vi.mocked(serieSlots).mockResolvedValue([]);
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Vorschau" }));
    expect(await screen.findByText(/kein Termin auf die Regel/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Termine erzeugen" })).toBeDisabled();
  });

  it("jede Änderung an den Eingaben verwirft die Vorschau", async () => {
    vi.mocked(serieSlots).mockResolvedValue([slot("2026-09-01")]);
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Vorschau" }));
    expect(await screen.findByText("1 Termin")).toBeTruthy();

    // Sonst stünde eine Liste zu Eingaben, die es nicht mehr gibt — und der
    // Erzeugen-Knopf schriebe sie.
    fireEvent.change(screen.getByLabelText(/Anzahl/), { target: { value: "9" } });
    await waitFor(() => expect(screen.queryByText("1 Termin")).toBeNull());
    expect(screen.getByRole("button", { name: "Termine erzeugen" })).toBeDisabled();
  });
});
