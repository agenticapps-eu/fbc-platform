import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * Was der Annahme-Dialog benennt (AGE-537, C6a).
 *
 * Beide Reviewer des Plans haben unabhängig gemeldet: „Kontaktdaten werden
 * geteilt" deckte sich mit der Erwartung, solange die Zeile E-Mail und Telefon
 * trug. Mit der vollständigen Anschrift tut es das nicht mehr — und wer
 * annimmt, entscheidet über seine eigene Anschrift mit.
 *
 * Gemockt ist nur der Datenrand: die Anfrage selbst.
 */

vi.mock("../../lib/contact-requests", async (original) => ({
  ...(await original<typeof import("../../lib/contact-requests")>()),
  fetchIncomingRequests: async () => [
    {
      id: "req-1",
      message: null,
      created_at: new Date().toISOString(),
      from: {
        id: "p1",
        name: "Maxi Muster",
        avatar_url: null,
        company: null,
        region: null,
      },
    },
  ],
}));

import { MeineAnfragenWidget } from "./kontakte-widgets";
import { ToastProvider } from "../ui/Toast";

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <MeineAnfragenWidget uid="mein-konto" />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MeineAnfragenWidget — was eine Annahme freigibt", () => {
  it("nennt E-Mail, Telefon und Anschrift, nicht bloß „Kontaktdaten“", async () => {
    renderWidget();

    const hinweis = await screen.findByText(/Annahme/);
    expect(hinweis.textContent).toMatch(/Anschrift/);
    expect(hinweis.textContent).toMatch(/E-Mail/);
    expect(hinweis.textContent).toMatch(/Telefon/);
  });
});
