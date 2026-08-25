import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AGE-593 — ein gescheiterter Abruf ist nicht dasselbe wie ein leerer Posteingang.
 *
 * `MeineAnfragenWidget` fasste `isLoading`, `isError` und `data.length === 0` in
 * EINE Bedingung, die `null` lieferte. Ein Abruf, der mit `42501` oder einem
 * Netzwerkfehler endet, sah damit exakt aus wie „es liegt nichts an" — und die
 * Fläche, die eine wartende Kontaktanfrage anzeigen soll, schwieg genau dann,
 * wenn sie es nicht durfte.
 *
 * Gemockt ist der Datenrand (`fetchIncomingRequests`), nicht die Komponente:
 * Eine Attrappe auf die eigene Komponente bewiese nur sich selbst.
 */
vi.mock("../../lib/contact-requests", async (original) => ({
  ...(await original<typeof import("../../lib/contact-requests")>()),
  fetchIncomingRequests: vi.fn(),
}));

import { fetchIncomingRequests, incomingRequestsQueryKey } from "../../lib/contact-requests";
import { MeineAnfragenWidget } from "./kontakte-widgets";
import { ToastProvider } from "../ui/Toast";

const holen = vi.mocked(fetchIncomingRequests);

const ANFRAGE = {
  id: "req-1",
  message: null,
  created_at: "2026-08-25T09:19:00.000Z",
  from: { id: "p1", name: "Maxi Muster", avatar_url: null, company: null, region: null },
};

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <MeineAnfragenWidget uid="mein-konto" />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe("MeineAnfragenWidget — der Fehlerfall redet", () => {
  // Geschweifte Klammern sind hier PFLICHT, nicht Geschmack: `mockReset()` gibt
  // die Attrappe zurück, und eine aus `beforeEach` ZURÜCKGEGEBENE Funktion hält
  // vitest für die Aufräumroutine — es ruft sie nach jedem Test auf. Die
  // Attrappe feuerte dann ein zweites Mal, ohne dass jemand ihre abgelehnte
  // Zusage entgegennimmt, und der Test scheiterte an dieser Zurückweisung statt
  // an seiner eigenen Aussage. Eine Stunde, und keine Zeile davon lag im Code,
  // der geprüft werden sollte.
  beforeEach(() => {
    holen.mockReset();
  });

  it("meldet einen gescheiterten Abruf sichtbar", async () => {
    holen.mockRejectedValue(new Error("permission denied for table contact_requests"));

    renderWidget();

    expect(await screen.findByText(/nicht geladen werden/i)).toBeInTheDocument();
  });

  /**
   * Die Gegenprobe, ohne die aus dem Fix ein Leerzustand bei JEDEM Aufruf würde.
   * Ein leerer Posteingang bleibt still — ein „Noch keine Anfragen" auf jeder
   * Dashboard-Ansicht ist Lärm, und Lärm wird nicht mehr gelesen.
   */
  it("bleibt bei einer leeren Liste weiterhin still", async () => {
    holen.mockResolvedValue([]);

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ToastProvider>
            <MeineAnfragenWidget uid="mein-konto" />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(holen).toHaveBeenCalled());
    expect(screen.queryByText(/nicht geladen werden/i)).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
  });

  /**
   * Befund des Plan-Reviews (codex, MEDIUM): Fehler beim NACHLADEN ist etwas
   * anderes als Fehler beim ersten Laden. Ein nackter `isError`-Zweig hätte hier
   * eine beantwortbare Anfrage hinter einer Fehlermeldung versteckt — während
   * das Abzeichen in der Seitenleiste ihre Zahl weiter zeigt. Eine wartende
   * Anfrage zu verbergen, weil ihre Aktualisierung scheiterte, richtet mehr
   * Schaden an als der veraltete Stand.
   */
  it("versteckt vorliegende Anfragen nicht, wenn ein Nachladen scheitert", async () => {
    holen.mockResolvedValueOnce([ANFRAGE]);
    const client = renderWidget();
    expect(await screen.findByText("Maxi Muster")).toBeInTheDocument();

    holen.mockRejectedValueOnce(new Error("network"));
    await act(async () => {
      await client.refetchQueries({ queryKey: incomingRequestsQueryKey("mein-konto") });
    });

    // Ohne diese Zeile belegte der Test nichts: Fände gar kein zweiter Abruf
    // statt, wäre er auch nicht gescheitert, und die Liste stünde aus dem
    // trivialen Grund noch da, dass nie etwas passiert ist.
    expect(holen).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Maxi Muster")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annehmen" })).toBeEnabled();
  });
});
