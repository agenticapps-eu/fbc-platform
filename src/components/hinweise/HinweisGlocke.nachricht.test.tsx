import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HinweisGlocke } from "./HinweisGlocke";
import type { Hinweis } from "../../lib/hinweise";

/**
 * AGE-641 — der fünfte Hinweistyp in der Glocke.
 *
 * Zwei Zusagen, die zusammengehören:
 *
 *  1. Der Hinweis ist KEINE Sackgasse. Bis AGE-641 hatte nur `release_note`
 *     ein Ziel; ein Nachrichten-Hinweis ohne Ziel wäre der schlechteste von
 *     allen — er sagt „jemand hat dir geschrieben" und lässt einen dann selbst
 *     suchen, in welchem Gespräch.
 *
 *  2. Der Nachrichtentext taucht nicht auf. Er steht schon in der Nutzlast
 *     nicht drin (Trigger `hinweis_neue_nachricht`), aber diese Datei prüft
 *     die Fläche unabhängig davon: kommt der Text eines Tages doch in der
 *     Zeile an — durch einen anderen Schreiber, eine Migration, einen Import —
 *     darf ihn die Glocke trotzdem nicht anzeigen.
 */

function hinweis(over: Partial<Hinweis> = {}): Hinweis {
  return {
    id: "m1",
    type: "message",
    payload: { thread_id: "t-42", sender_id: "p-1", sender_name: "Detlev Krause" },
    created_at: "2026-08-27T10:00:00Z",
    ...over,
  };
}

function renderGlocke(hinweise: Hinweis[]) {
  return render(
    <MemoryRouter>
      <HinweisGlocke hinweise={hinweise} unbekannt={false} onMarkiere={vi.fn()} onAlle={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("Der Nachrichten-Hinweis in der Glocke", () => {
  it("nennt den Absender und keinen Text", async () => {
    const { getByRole } = renderGlocke([hinweis()]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    expect(await screen.findByText("Detlev Krause hat Ihnen geschrieben.")).toBeInTheDocument();
  });

  it("führt in das Gespräch, aus dem er stammt", async () => {
    const { getByRole } = renderGlocke([hinweis()]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    const link = await screen.findByTestId("hinweis-text");
    expect(link).toHaveAttribute("href", "/chat/t-42");
  });

  it("führt ohne Gesprächs-Kennung auf die Übersicht statt ins Leere", async () => {
    // Dieselbe Regel wie bei der Release-Note: `/chat/undefined` wäre eine
    // Adresse, die nichts öffnet und trotzdem aussieht, als sollte sie.
    const { getByRole } = renderGlocke([hinweis({ payload: { sender_name: "Detlev Krause" } })]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    expect(await screen.findByTestId("hinweis-text")).toHaveAttribute("href", "/chat");
  });

  it("ohne Absendernamen bleibt es ein Satz, kein „undefined“", async () => {
    const { getByRole } = renderGlocke([hinweis({ payload: { thread_id: "t-42" } })]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    expect(await screen.findByText("Ein Mitglied hat Ihnen geschrieben.")).toBeInTheDocument();
  });

  it("zeigt einen Nachrichtentext auch dann nicht, wenn er in der Nutzlast steht", async () => {
    // Der Trigger schreibt ihn nicht hinein. Diese Zusage hält die Fläche
    // unabhängig davon dicht — sie ist die zweite Sperre, nicht die erste.
    const { getByRole } = renderGlocke([
      hinweis({
        payload: {
          thread_id: "t-42",
          sender_name: "Detlev Krause",
          body: "Streng vertraulicher Satz",
          message: "Auch der hier nicht",
        },
      }),
    ]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    await screen.findByTestId("hinweis-text");
    expect(screen.queryByText(/Streng vertraulicher Satz/)).toBeNull();
    expect(screen.queryByText(/Auch der hier nicht/)).toBeNull();
  });
});
