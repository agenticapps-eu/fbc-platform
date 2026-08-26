import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThreadList } from "./ThreadList";
import type { ChatThread } from "../../lib/chat";

/**
 * AGE-583 — die Markierung ungelesener Gespräche.
 *
 * WARUM DAS ZUM ZÄHLER GEHÖRT und nicht extra ist: eine Zahl in der Kopfzeile,
 * die auf eine Liste führt, in der nichts hervorsticht, verlangt vom Mitglied,
 * die Suche selbst zu Ende zu führen. Der Zähler sagt „drei", die Liste sagt
 * nichts — man öffnet Gespräche der Reihe nach, bis man sie gefunden hat.
 *
 * DIE ZAHL STEHT IM ZUGÄNGLICHEN NAMEN. Ein Punkt neben einem Namen ist für
 * jemanden, der ihn nicht sieht, gar nichts; Farbe trägt in diesem Projekt nie
 * allein eine Bedeutung.
 */
function thread(id: string, name: string): ChatThread {
  return {
    id,
    partner: { id: `p-${id}`, name, avatarUrl: null, company: null, tier: null },
    lastMessage: { body: "Hallo", createdAt: "2026-08-26T10:00:00Z", fromMe: false },
    lastActivityAt: "2026-08-26T10:00:00Z",
  };
}

const DREI = [thread("t1", "Anna Testfall"), thread("t2", "Bernd Testfall")];

describe("ThreadList markiert Ungelesenes (AGE-583)", () => {
  it("markiert genau die Zeile mit ungelesenen Nachrichten", () => {
    render(
      <ThreadList
        threads={DREI}
        activeId={null}
        onSelect={() => {}}
        ungelesenJeThread={new Map([["t1", 3]])}
      />,
    );

    expect(screen.getByRole("button", { name: /Anna Testfall.*3 ungelesen/i })).toBeInTheDocument();
    // Und die andere Zeile trägt es NICHT. Ohne diese Hälfte wäre ein Bauteil,
    // das ALLE Zeilen markiert, ebenfalls grün.
    expect(screen.getByRole("button", { name: /Bernd Testfall/ })).not.toHaveAccessibleName(
      /ungelesen/i,
    );
  });

  it("markiert bei null gar nichts", () => {
    // Die erste Fassung prüfte hier zusätzlich `queryByText(/ungelesen/i)`.
    // Das war eine tote Zeile (Diff-Review, opencode, LOW): das Wort steht
    // ausschliesslich im `aria-label`, im sichtbaren Text kommt es nie vor —
    // die Zusage wäre auch dann grün gewesen, wenn eine Blase mit „0" gerendert
    // hätte. Geprüft wird deshalb, was tatsächlich rendern könnte: die Blase.
    const { container } = render(
      <ThreadList
        threads={DREI}
        activeId={null}
        onSelect={() => {}}
        ungelesenJeThread={new Map()}
      />,
    );

    expect(container.querySelector("span[aria-hidden]")).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByRole("button", { name: /Anna Testfall/ })).not.toHaveAccessibleName(
      /ungelesen/i,
    );
  });
});
