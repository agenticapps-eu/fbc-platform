import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import LegalRoute from "./LegalRoute";
import { rechtsseiten } from "../content/legal/meta";

/**
 * Der Wechsel zwischen zwei Rechtsseiten (AGE-497).
 *
 * React montiert `LegalRoute` beim Wechsel NICHT neu — beide Routen rendern
 * denselben Elementtyp. Ohne den Slug-Abgleich im Zustand bliebe nach dem
 * Klick das alte Dokument unter der neuen Adresse stehen, bis der neue Text
 * nachgeladen ist.
 *
 * Dieser Test war rot, bevor der Abgleich da war. Gefunden hat ihn kein
 * Reviewer, sondern die Frage „was passiert eigentlich beim Wechsel?".
 */
describe("Wechsel zwischen zwei Rechtsseiten", () => {
  it("zeigt nicht das vorige Dokument weiter", async () => {
    render(
      <MemoryRouter initialEntries={["/impressum"]}>
        <Routes>
          {rechtsseiten.map((s) => (
            <Route key={s.slug} path={`/${s.slug}`} element={<LegalRoute seite={s} />} />
          ))}
        </Routes>
      </MemoryRouter>,
    );
    // Auf INHALT warten, nicht auf die Ueberschrift: die steht schon
    // waehrend des Ladens da (sie kommt aus den Metadaten). Ein Test, der nur
    // die Ueberschrift prueft, waere auch dann gruen, wenn der Text nie kommt.
    await screen.findAllByText("Stockholmer Platz 1");

    fireEvent.click(screen.getByRole("link", { name: "Allgemeine Geschäftsbedingungen" }));

    // Unmittelbar nach dem Klick: steht die alte Ueberschrift noch da?
    // Mehrzahl: die Anschrift steht im Impressum zweimal (§ 5 DDG und § 18 MStV).
    const altesNochDa = screen.queryAllByText("Stockholmer Platz 1");

    await waitFor(() =>
      expect(screen.getAllByText(/Widerrufsbelehrung/).length).toBeGreaterThan(0),
    );
    expect(altesNochDa, "altes Dokument stand nach dem Klick noch da").toEqual([]);
  });
});

describe("Wenn der Text nicht geladen werden kann", () => {
  it("zeigt einen Ausweg statt einer leeren Seite", async () => {
    // Der reale Fall: nach einem Deploy zeigen alte Seiten auf Bündelstücke,
    // die es nicht mehr gibt. Eine ErrorBoundary faengt das NICHT — sie sieht
    // nur Fehler beim Rendern, keine abgewiesene Zusage. Ohne den catch-Zweig
    // bliebe hier dauerhaft eine leere Impressumsseite stehen.
    const kaputt = {
      slug: "impressum",
      titel: "Impressum",
      lade: () => Promise.reject(new Error("chunk 404")),
    };
    render(
      <MemoryRouter>
        <LegalRoute seite={kaputt} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Der Text konnte nicht geladen werden/)).toBeInTheDocument();
    // Der Titel steht trotzdem — er kommt aus den Metadaten.
    expect(screen.getByRole("heading", { level: 1, name: "Impressum" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seite neu laden" })).toBeInTheDocument();
  });
});

describe("Der Tab-Titel", () => {
  it("nennt die Rechtsseite und stellt den vorigen Titel wieder her", async () => {
    document.title = "eff.bee.zee";
    const seite = rechtsseiten.find((s) => s.slug === "agb")!;
    const { unmount } = render(
      <MemoryRouter>
        <LegalRoute seite={seite} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.title).toMatch(/Allgemeine Geschäftsbedingungen/));
    unmount();
    expect(document.title).toBe("eff.bee.zee");
  });
});
