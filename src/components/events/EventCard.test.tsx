import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EventCard } from "./EventCard";
import type { EventListItem } from "../../lib/events";

function evt(over: Partial<EventListItem> = {}): EventListItem {
  return {
    id: "e1",
    title: "Business Dinner Stuttgart",
    type: "dinner",
    startsAt: new Date(2026, 7, 14, 19, 0).toISOString(),
    endsAt: new Date(2026, 7, 14, 22, 0).toISOString(),
    location: "Restaurant Délice, Stuttgart",
    description: null,
    coverPath: null,
    topics: null,
    visibility: "members",
    capacity: null,
    host: null,
    registeredCount: 24,
    waitlistCount: 0,
    myStatus: null,
    ...over,
  };
}

function zeige(event: EventListItem, coverUrl?: string | null) {
  return render(
    <MemoryRouter>
      <EventCard event={event} coverUrl={coverUrl} />
    </MemoryRouter>,
  );
}

describe("EventCard", () => {
  it("zeigt Datumsmarke, Von–Bis, Ort und Teilnehmerzahl", () => {
    zeige(evt());
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText(/19:00 – 22:00 Uhr/)).toBeInTheDocument();
    expect(screen.getByText("Restaurant Délice, Stuttgart")).toBeInTheDocument();
    expect(screen.getByText("24 nehmen teil")).toBeInTheDocument();
  });

  it("zeigt eine Zahl, keine Gesichter — die Übersicht ruft event_attendees nicht auf", () => {
    // Das Mockup der Übersicht trägt „63 nehmen teil"; Avatare stehen nur auf
    // der Detailseite. Wer hier Gesichter einbaut, braucht plötzlich eine
    // Signatur- UND eine Teilnehmerabfrage je Kachel.
    const { container } = zeige(evt({ registeredCount: 63 }));
    expect(screen.getByText("63 nehmen teil")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("behält die Kachel ohne Titelbild — der Platzhalter hält die Höhe", () => {
    // Seit AGE-596 ist das Feld 3:1 statt 16:9 — das Verhältnis, auf das der
    // Zuschneider festlegt. Die Zusage dieses Tests ist unverändert: bebilderte
    // und unbebilderte Kacheln stehen gleich hoch nebeneinander.
    const { container } = zeige(evt({ coverPath: null }));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".aspect-\\[3\\/1\\]")).not.toBeNull();
  });

  it("zeigt das Titelbild, wenn eine signierte URL vorliegt", () => {
    const { container } = zeige(evt({ coverPath: "uid/a.webp" }), "https://signiert.example/a");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://signiert.example/a");
  });

  it("fällt auf den Platzhalter zurück, wenn die Signatur fehlt", () => {
    // Ein nicht signierbares Objekt heißt: der Betrachter darf das Bild nicht
    // sehen. Das ist kein Fehlerfall, den die Kachel anzeigen müsste.
    const { container } = zeige(evt({ coverPath: "uid/a.webp" }), null);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Business Dinner Stuttgart")).toBeInTheDocument();
  });

  it("nennt die Einzahl richtig", () => {
    zeige(evt({ registeredCount: 1 }));
    expect(screen.getByText("1 nimmt teil")).toBeInTheDocument();
  });

  it("nennt auch den letzten freien Platz in der Einzahl", () => {
    zeige(evt({ capacity: 25, registeredCount: 24 }));
    expect(screen.getByText("1 Platz frei")).toBeInTheDocument();
  });
});
