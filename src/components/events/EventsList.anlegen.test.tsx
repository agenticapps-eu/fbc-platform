import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EventsList from "./EventsList";
import { fetchEvents } from "../../lib/events";
import { fetchVorlagen } from "../../lib/event-vorlagen";
import type { Berechtigung } from "../../config/berechtigungen";

/**
 * „Event anlegen" verlangt das Recht `events.erstellen` (AGE-1000).
 *
 * ══ WAS HIER AUF DEM SPIEL STEHT ══════════════════════════════════════════
 * Bis AGE-1000 durfte **jedes aktivierte Konto** Events anlegen:
 * `events_write_host` prüfte nur `is_activated()` und den Host — gemessen am
 * Katalog von PROD, nicht aus den Migrationen gelesen. Detlevs SPEC 01
 * (V5 FINAL) führt „eigene Events erstellen" als Recht allein für IMPACT, und
 * die Go-live-Checkliste führt es unter A8 als kritisch.
 *
 * Die Grenze trägt die Datenbank (`supabase/tests/rechte_v5_test.sql`: Rang 4
 * und Rang 5 werden beim INSERT mit 42501 abgewiesen). Hier geht es um die
 * andere Hälfte: der Knopf hört auf, etwas zu versprechen, was die RLS
 * ablehnt. Ohne diese Datei wäre genau das unbemerkt — ein sichtbarer Knopf,
 * der in eine Ablehnung führt, ist schlechter als keiner.
 *
 * Gemockt wird der Hook und nicht `ladeMeineRechte`: Gegenstand ist die
 * Fläche, nicht der Hook — der hat sein eigenes Testfile.
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

let user: { id: string } | null = { id: "u-1" };
vi.mock("../../providers/auth-context", () => ({
  useAuth: () => ({ user }),
}));

let rechte: Berechtigung[] = [];
let laedt = false;
let fehler = false;
vi.mock("../../hooks/useDarf", () => ({
  useMeineRechte: () => ({ rechte, laedt, fehler }),
  useDarf: (k: Berechtigung) => ({ darf: rechte.includes(k), laedt, fehler }),
}));

function zeige() {
  vi.mocked(fetchEvents).mockResolvedValue([]);
  vi.mocked(fetchVorlagen).mockResolvedValue([]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/events"]}>
        <EventsList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const knopf = () => screen.queryByRole("button", { name: "Event anlegen" });

describe("Eventliste: „Event anlegen“ hängt am Recht", () => {
  beforeEach(() => {
    user = { id: "u-1" };
    rechte = [];
    laedt = false;
    fehler = false;
  });

  it("zeigt den Knopf einem Konto mit `events.erstellen`", () => {
    rechte = ["events.erstellen"];
    zeige();
    expect(knopf()).toBeInTheDocument();
  });

  it("zeigt ihn einem Konto ohne das Recht nicht", () => {
    rechte = ["suche_biete", "vorschlaege"];
    zeige();
    expect(knopf()).not.toBeInTheDocument();
  });

  it("zeigt ihn auch dem Konto ohne jedes Recht nicht — DISCOVER", () => {
    // Die Positivkontrolle zur Zusage darüber: ein leeres Rechte-Array ist der
    // Normalfall für DISCOVER, und er darf nicht an einem Sonderweg
    // vorbeikommen.
    rechte = [];
    zeige();
    expect(knopf()).not.toBeInTheDocument();
  });

  // ══ LADEN UND FEHLER SIND NICHT DERSELBE FALL ════════════════════════════
  // Befund des Diff-Reviews (codex, MEDIUM): die erste Fassung behandelte beide
  // als „nein" und setzte `laedt` im Test immer auf `false` — der Unterschied
  // war also weder gebaut noch gemessen.
  it("verbirgt ihn, solange die Rechte laden — auch fuer ein berechtigtes Konto", () => {
    rechte = ["events.erstellen"];
    laedt = true;
    zeige();
    // Er kommt einen Augenblick spaeter. Ihn vorher zu zeigen fuehrte ein
    // unberechtigtes Konto in ein Formular, das es ausfuellt und dann an der
    // RLS verliert.
    expect(knopf()).not.toBeInTheDocument();
  });

  it("zeigt ihn bei einem gescheiterten Abruf — der Zustand loest sich nicht auf", () => {
    rechte = [];
    fehler = true;
    zeige();
    // Ein IMPACT-Konto verloere sonst dauerhaft eine Faehigkeit, weil eine
    // Abfrage schiefging. Scheitert das Anlegen dann an der RLS, sagt die
    // bestehende Meldung „Anlegen fehlgeschlagen" — benannt, statt dass die
    // Funktion verschwindet.
    expect(knopf()).toBeInTheDocument();
  });

  it("verbirgt ihn, wenn Laden UND Fehler zusammentreffen — Laden gewinnt", () => {
    // Die Reihenfolge ist eine Entscheidung und keine Nebenwirkung: solange
    // noch geladen wird, ist der Fehler ein Zwischenstand.
    rechte = [];
    laedt = true;
    fehler = true;
    zeige();
    expect(knopf()).not.toBeInTheDocument();
  });

  it("zeigt ihn ausgeloggt nicht", () => {
    user = null;
    rechte = ["events.erstellen"];
    zeige();
    // Die zweite Bedingung bleibt `user`: ohne Sitzung gäbe es keinen Host für
    // die neue Zeile. Dass hier trotzdem ein Recht gesetzt ist, ist Absicht —
    // sonst wäre die Zusage auch von der Rechteprüfung allein erfüllt und sagte
    // nichts über die Sitzung.
    expect(knopf()).not.toBeInTheDocument();
  });
});
