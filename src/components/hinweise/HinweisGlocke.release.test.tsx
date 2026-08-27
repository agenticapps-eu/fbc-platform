import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { HinweisGlocke } from "./HinweisGlocke";
import type { Hinweis } from "../../lib/hinweise";

/**
 * Der Release-Hinweis in der Glocke (AGE-631, Band 5).
 *
 * Zwei Zusagen, und beide fangen einen stillen Fehler:
 *
 *  1. **Der Typ hat einen eigenen Renderer.** Ohne ihn fällt er auf „Es gibt
 *     etwas Neues." zurück — ein Satz, der nichts sagt, und der in jsdom wie in
 *     der Sichtprobe völlig unauffällig ist.
 *  2. **Er führt auf `/neues`.** Sonst wäre die Mitteilung nach dem Wegklicken
 *     unerreichbar; das ist der Grund, warum dieser Typ ohne Opt-out auskommt.
 */

function hinweis(over: Partial<Hinweis> = {}): Hinweis {
  return {
    id: "h1",
    type: "release_note",
    payload: { release_note_id: "n1", title: "Nachrichten stehen jetzt im Rahmen" },
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

describe("Der Release-Hinweis in der Glocke", () => {
  it("nennt den Titel, nicht den Ersatztext", async () => {
    const { getByRole } = renderGlocke([hinweis()]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    expect(
      await screen.findByText("Neu in der App: Nachrichten stehen jetzt im Rahmen"),
    ).toBeInTheDocument();
    // Die Positivkontrolle zur Zusage: der Ersatztext steht NICHT da. Ohne sie
    // wäre „findet den Titel" auch dann grün, wenn beide Texte gerendert würden.
    expect(screen.queryByText("Es gibt etwas Neues.")).not.toBeInTheDocument();
  });

  it("führt auf /neues", async () => {
    const { getByRole } = renderGlocke([hinweis()]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    const link = await screen.findByRole("link", {
      name: "Neu in der App: Nachrichten stehen jetzt im Rahmen",
    });
    expect(link).toHaveAttribute("href", "/neues");
  });

  it("kommt ohne Titel in der Nutzlast trotzdem zu einem Satz", async () => {
    // Die Nutzlast kann alt sein. Ein „undefined" in der Liste wäre schlimmer
    // als ein allgemeiner Satz.
    const { getByRole } = renderGlocke([hinweis({ payload: { release_note_id: "n1" } })]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    expect(await screen.findByText("Es gibt Neues in der App.")).toBeInTheDocument();
  });

  it("lässt die anderen Typen unverlinkt", async () => {
    // Diese Änderung handelt von EINEM Typ. Den anderen sieben ein Ziel
    // anzudichten wäre eine Änderung an sieben Flächen in einem Change, der von
    // einer handelt.
    const { getByRole } = renderGlocke([
      hinweis({ id: "h2", type: "post_created", payload: { autor_name: "Anna" } }),
    ]);
    getByRole("button", { name: /Benachrichtigungen/ }).click();

    expect(await screen.findByText("Anna hat einen Beitrag geschrieben.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
