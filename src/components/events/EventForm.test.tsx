import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventForm } from "./EventForm";
import { ToastProvider } from "../ui/Toast";
import { AuthFixture, authAsTier } from "../../test/auth-fixtures";
import type { EventInput, EventListItem } from "../../lib/events";

/**
 * Der Punkt dieser Datei ist nicht, dass das Formular rendert — das täte auch
 * ein leeres. Sie hält die eine Leitplanke aus AGE-531 fest, die beim Ausbau
 * am leichtesten verlorengeht:
 *
 *   „EventForm darf keine Textwüste werden. Ein Mitglied, das abends schnell
 *    ein Event einstellt, soll nicht durch zwölf Pflichtfelder."
 *
 * C8 legt VIER Felder dazu. Genau eines davon wird zur Pflicht, und zwar nicht
 * aus Geschmack, sondern weil `events.starts_at` `not null` geworden ist.
 */

/**
 * ECHTE Provider, kein `vi.mock` auf `EventCoverPicker`. Die Bildauswahl ist
 * Teil dessen, was hier geprüft wird — insbesondere, dass ein Speichern ohne
 * Bildauswahl `coverPath` gar nicht erst mitschickt. Ein Mock an dieser Stelle
 * prüfte den Mock.
 *
 * Die Signatur-Abfrage läuft dabei ins Leere (kein Netzwerk in Unit-Tests) und
 * soll das auch: ohne signierte URL zeigt der Picker seinen Platzhalter, und
 * genau daran hängt keine der Zusicherungen unten. `retry: false`, damit ein
 * Fehlschlag nicht in Wiederholungen läuft.
 */
function setup(initial?: EventListItem) {
  const onSubmit = vi.fn<(input: EventInput) => void>();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AuthFixture value={authAsTier("impact")}>
        <ToastProvider>
          <EventForm
            initial={initial}
            submitLabel="Speichern"
            pending={false}
            onSubmit={onSubmit}
            onCancel={() => {}}
          />
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
  return { onSubmit };
}

const basis: EventListItem = {
  id: "e1",
  title: "Sommerfest",
  type: "dinner",
  startsAt: "2026-08-17T18:00:00.000Z",
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

describe("EventForm — die Pflichtfelder bleiben zwei", () => {
  it("speichert mit Titel und Termin allein; die vier neuen Felder sind optional", () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText(/Titel/), { target: { value: "Spontanes Treffen" } });
    fireEvent.change(screen.getByLabelText(/^Beginn/), { target: { value: "2026-08-17T18:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input.title).toBe("Spontanes Treffen");
    expect(input.startsAt).not.toBeNull();
    expect(input.endsAt).toBeNull();
    expect(input.description).toBeNull();
    expect(input.topics).toBeNull();
  });

  it("blockiert das Absenden ohne Termin, statt es am insert scheitern zu lassen", () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText(/Titel/), { target: { value: "Ohne Termin" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("lehnt ein Ende vor dem Beginn ab, bevor die Constraint es tut", () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText(/Titel/), { target: { value: "Rückwärts" } });
    fireEvent.change(screen.getByLabelText(/^Beginn/), { target: { value: "2026-08-17T18:00" } });
    fireEvent.change(screen.getByLabelText(/^Ende/), { target: { value: "2026-08-17T17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("EventForm — Themen und Titelbild", () => {
  it("wirft leere Zeilen aus den Themen und liefert sonst null", () => {
    const { onSubmit } = setup(basis);
    fireEvent.change(screen.getByLabelText(/Themen/), {
      target: { value: "Club-News\n\n   \nAusblick\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSubmit.mock.calls[0][0].topics).toEqual(["Club-News", "Ausblick"]);
  });

  it("lässt cover_path in Ruhe, wenn kein neues Bild gewählt wurde", () => {
    // Der Datenverlust, den `coverPath?: string | null` verhindert: ein
    // Speichern ohne Bildauswahl darf das bestehende Titelbild nicht löschen.
    const mitBild = { ...basis, coverPath: "uid/alt.webp" };
    const { onSubmit } = setup(mitBild);
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSubmit.mock.calls[0][0].coverPath).toBeUndefined();
  });

  it("setzt cover_path auf null, wenn das Bild ausdrücklich entfernt wird", () => {
    const mitBild = { ...basis, coverPath: "uid/alt.webp" };
    const { onSubmit } = setup(mitBild);
    fireEvent.click(screen.getByRole("button", { name: /Titelbild entfernen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSubmit.mock.calls[0][0].coverPath).toBeNull();
  });
});
