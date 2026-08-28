import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthFixture, authAsTier } from "../../test/auth-fixtures";
import { ToastProvider } from "../ui/Toast";

vi.mock("../../lib/event-cover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/event-cover")>();
  return { ...actual, signEventCovers: vi.fn(), uploadEventCover: vi.fn() };
});
import { signEventCovers } from "../../lib/event-cover";

import { EventCoverPicker } from "./EventCoverPicker";

/**
 * Die Vorschau des Titelbilds muss dasselbe zeigen wie die Kachel (AGE-600).
 *
 * AGE-596 hat `EventCover` auf `object-contain` gebracht und die Vorschau hier
 * ausdrücklich ausgenommen. Danach widersprachen sich die beiden: die Kachel
 * passte ein, die Vorschau daneben schnitt weiter ab. Bei den 1,50:1-Bildern
 * des Demo-Seeds (AGE-599) schnitt sie 50 % der Breite weg, während die Kachel
 * das ganze Bild zeigte.
 *
 * ── WAS DIESER TEST BELEGT UND WAS NICHT ────────────────────────────────────
 * Er ist strukturell, aus demselben Grund wie `EventCover.test.tsx`: unter
 * `object-cover` wie unter `object-contain` behält die `<img>`-Box die Maße
 * ihres Containers, nur der gemalte Inhalt unterscheidet sich — und davon sieht
 * jsdom nichts. Festgenagelt wird deshalb, dass Vorschau und Kachel DIESELBE
 * Regel tragen; der Augenschein steht in der Abnahme des Vorgangs.
 */

const mockedSign = vi.mocked(signEventCovers);

beforeEach(() => {
  mockedSign.mockReset();
  mockedSign.mockResolvedValue({ "events/eins.webp": "/signiert.webp" });
});

function renderPicker() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthFixture value={authAsTier("impact")}>
        <ToastProvider>
          <EventCoverPicker
            initialPath="events/eins.webp"
            value={undefined}
            onChange={() => {}}
          />
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
}

describe("EventCoverPicker — die Vorschau zeigt, was die Kachel zeigt (AGE-600)", () => {
  it("passt ein statt zu beschneiden", async () => {
    renderPicker();
    const img = await screen.findByRole("presentation");
    expect(img.className).toMatch(/object-contain/);
    expect(img.className).not.toMatch(/object-cover/);
  });

  it("behält dabei das 3:1-Feld der Kachel", async () => {
    renderPicker();
    const img = await screen.findByRole("presentation");
    expect(img.className).toMatch(/aspect-\[3\/1\]/);
  });
});
