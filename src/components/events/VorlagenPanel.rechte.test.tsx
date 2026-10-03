import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VorlagenPanel } from "./VorlagenPanel";
import { ToastProvider } from "../ui/Toast";
import type { VorlageItem } from "../../lib/event-vorlagen";
import type { Berechtigung } from "../../config/berechtigungen";

/**
 * „Vorlage anlegen" hängt am Recht `events.erstellen` (AGE-1000).
 *
 * Eine Vorlage ist kein eigener Gegenstand, sondern ein Gerät zum Anlegen von
 * Events: `event_serie_erzeugen` ist `SECURITY INVOKER` und legt die Termine
 * als **Aufrufer** an. Ohne dieselbe Hürde liesse sich hier eine Vorlage samt
 * Wiederholungsregel pflegen — und beim Erzeugen scheitern. Der Fehler käme
 * nach der Arbeit.
 *
 * Das BEARBEITEN bestehender Vorlagen bleibt unberührt. Dieselbe Regel wie
 * überall in diesem Change: Anlegen fällt, Pflegen bleibt.
 */

vi.mock("./useEventCovers", () => ({ useEventCovers: () => ({}) }));

let rechte: Berechtigung[] = [];
let laedt = false;
let fehler = false;
vi.mock("../../hooks/useDarf", () => ({
  useMeineRechte: () => ({ rechte, laedt, fehler }),
  useDarf: (k: Berechtigung) => ({ darf: rechte.includes(k), laedt, fehler }),
}));

const UID = "11111111-1111-1111-1111-111111111111";

const BESTAND: VorlageItem[] = [
  {
    id: "22222222-2222-2222-2222-222222222222",
    hostId: UID,
    title: "Monatlicher Stammtisch",
    type: null,
    location: null,
    description: null,
    capacity: null,
    visibility: "members",
    topics: null,
    coverPath: null,
    wiederholung: "woechentlich",
    wochentag: 2,
    tagImMonat: null,
    wochentagPosition: null,
    ortszeit: "19:00",
    zeitzone: "Europe/Berlin",
    dauer: null,
  } as VorlageItem,
];

function zeige(vorlagen: VorlageItem[] = BESTAND) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <VorlagenPanel hostId={UID} vorlagen={vorlagen} fehler={false} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const anlegen = () => screen.queryByRole("button", { name: "Vorlage anlegen" });

describe("Vorlagen: Anlegen hängt am Recht", () => {
  beforeEach(() => {
    rechte = [];
    laedt = false;
    fehler = false;
  });

  it("zeigt den Knopf mit `events.erstellen`", () => {
    rechte = ["events.erstellen"];
    zeige();
    expect(anlegen()).toBeInTheDocument();
  });

  it("zeigt ihn ohne das Recht nicht", () => {
    rechte = [];
    zeige();
    expect(anlegen()).not.toBeInTheDocument();
  });

  it("zeigt die bestehende Vorlage auch ohne das Recht weiter", () => {
    // Die Positivkontrolle zur Zusage darüber: ohne sie wäre sie auch erfüllt,
    // wenn das Panel gar nichts mehr rendert — und eine Vorlage, die
    // verschwindet, sähe wie eine gelöschte aus.
    rechte = [];
    zeige();
    expect(screen.getByText("Monatlicher Stammtisch")).toBeInTheDocument();
  });

  it("verbirgt ihn, solange die Rechte laden", () => {
    rechte = ["events.erstellen"];
    laedt = true;
    zeige();
    expect(anlegen()).not.toBeInTheDocument();
  });

  it("zeigt ihn bei einem gescheiterten Abruf", () => {
    rechte = [];
    fehler = true;
    zeige();
    expect(anlegen()).toBeInTheDocument();
  });
});
