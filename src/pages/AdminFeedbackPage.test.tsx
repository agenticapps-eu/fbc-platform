import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die Feedback-Fläche der Verwaltung (AGE-587, Abschnitt 5).
 *
 * Sie löst die alte `AdminFeedbackCard` auf `/admin` ab. Die Karte holte ALLES
 * auf einmal — sie war die letzte listende Fläche ohne Blätterung.
 *
 * Gemockt wird ausschliesslich die SUPABASE-GRENZE, nicht `lib/feedback` und
 * nicht die Seite selbst. Sonst prüfte der Test seine eigenen Mocks; die
 * interessanten Aussagen sind, WELCHE Argumente die Bedienung erzeugt und was
 * die Fläche aus den Antworten macht.
 */
const rpc = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (name: string) => {
      throw new Error(`Kein direkter Tabellenzugriff in der Feedback-Sicht: ${name}`);
    },
  },
}));

import AdminFeedbackPage from "./AdminFeedbackPage";
import { FEEDBACK_SEITENGROESSE } from "../lib/feedback";

function zeile(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    rating: 4,
    likes: "Der Compass ist klar",
    misses: null,
    idea: null,
    route: "/compass",
    ref_type: null,
    created_at: "2026-07-16T10:00:00Z",
    author_name: "Anna Müller",
    profile_id: "u1",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminFeedbackPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Die zuletzt an `admin_list_feedback` übergebenen Argumente. */
function lastArgs(): Record<string, unknown> {
  return (rpc.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [zeile()], error: null });
});

describe("Die Feedback-Seite zeigt, was die Karte zeigte (5.1)", () => {
  it("zeigt Sterne, die drei Texte, Datum, Verfasser und Pfad", async () => {
    rpc.mockResolvedValue({
      data: [
        zeile({
          rating: 3,
          likes: "Der Compass ist klar",
          misses: "Eine Suche fehlt",
          idea: "Mehr Events",
          route: "/compass",
          author_name: "Anna Müller",
        }),
      ],
      error: null,
    });

    renderPage();

    expect(await screen.findByText("Der Compass ist klar")).toBeInTheDocument();
    expect(screen.getByText("Eine Suche fehlt")).toBeInTheDocument();
    expect(screen.getByText("Mehr Events")).toBeInTheDocument();
    // Die Sterne tragen eine Textfassung — die Zeichen allein wären für eine
    // Vorleseausgabe stumm.
    expect(screen.getByText("3 von 5 Sternen")).toBeInTheDocument();
    expect(screen.getByText("16.07.2026")).toBeInTheDocument();
    expect(screen.getByText(/Anna Müller/)).toBeInTheDocument();
    expect(screen.getByText(/\/compass/)).toBeInTheDocument();
  });

  it("liest über die RPC und fordert eine Zeile mehr an, als sie zeigt", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");

    expect(rpc.mock.calls[0][0]).toBe("admin_list_feedback");
    expect(lastArgs()).toEqual({
      p_limit: FEEDBACK_SEITENGROESSE + 1,
      p_offset: 0,
    });
  });
});

describe("Blättern wie in der Mitgliederliste (5.1)", () => {
  it("holt beim Weiterblättern die nächste Seite — an der Datenbank, nicht im Browser", async () => {
    const seite1 = Array.from({ length: FEEDBACK_SEITENGROESSE + 1 }, (_, i) =>
      zeile({ likes: `Erste ${i}` }),
    );
    rpc.mockResolvedValueOnce({ data: seite1, error: null });
    rpc.mockResolvedValueOnce({ data: [zeile({ likes: "Zweite Seite" })], error: null });

    renderPage();
    await screen.findByText("Erste 0");

    fireEvent.click(screen.getByRole("button", { name: /Weiter/i }));

    await screen.findByText("Zweite Seite");
    expect(lastArgs().p_offset).toBe(FEEDBACK_SEITENGROESSE);
    // Die Zusatzzeile wird angefordert, aber NICHT angezeigt.
    expect(screen.queryByText(`Erste ${FEEDBACK_SEITENGROESSE}`)).not.toBeInTheDocument();
  });

  it("bietet auf der ersten Seite keinen Weg zurück", async () => {
    renderPage();
    await screen.findByText("Der Compass ist klar");

    expect(screen.getByRole("button", { name: /Zurück/i })).toBeDisabled();
  });
});

describe("Ein Fehler sieht nicht aus wie Leere (5.6)", () => {
  /**
   * Der Leerzustand behauptet „es gibt kein Feedback". Ein gescheiterter Aufruf
   * weiss das gerade nicht — und in dieser Fläche hat „leer" ohnehin schon eine
   * zweite Ursache (ein Nicht-Admin bekommt null Zeilen). Eine dritte, stumme
   * braucht es nicht.
   */
  it("zeigt bei einem Fehler eine Fehlermeldung und NICHT den Leerzustand", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    renderPage();

    expect(await screen.findByText(/konnte nicht geladen werden/i)).toBeInTheDocument();
    expect(screen.queryByText(/Noch kein Feedback/i)).not.toBeInTheDocument();
  });

  it("zeigt den Leerzustand nur, wenn die Antwort wirklich leer ist", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    renderPage();

    expect(await screen.findByText(/Noch kein Feedback/i)).toBeInTheDocument();
    expect(screen.queryByText(/konnte nicht geladen werden/i)).not.toBeInTheDocument();
  });
});

describe("Jede Zeile führt zu ihrem Verfasser", () => {
  /**
   * `profile_id` ist der Grund, warum die RPC sie überhaupt herausgibt: die
   * Zeile soll verknüpfbar sein und nicht nur lesbar. Ohne diese Zusage wäre
   * die Spalte eine Zusage ohne Leser.
   */
  it("verlinkt den Verfasser auf sein Profil", async () => {
    rpc.mockResolvedValue({
      data: [zeile({ author_name: "Anna Müller", profile_id: "u7" })],
      error: null,
    });

    renderPage();

    const link = await screen.findByRole("link", { name: /Anna Müller/ });
    expect(link).toHaveAttribute("href", "/admin/mitglied/u7");
  });
});
