import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "../../lib/chat";
import { Conversation } from "./Conversation";

/** AGE-645 — der Zeitstempel an der Blase.
 *
 *  Die Zusicherungen prüfen die FORM (`HH:MM`, bzw. `TT.MM., HH:MM`) und den
 *  maschinenlesbaren Wert, nicht eine ausgeschriebene Uhrzeit. Grund: die
 *  Anzeige steht bewusst in der Zone des Betrachters, und ein Test, der
 *  „11:15" erwartet, prüfte in Wahrheit die Zeitzone des Rechners, auf dem er
 *  läuft — er wäre auf einem anderen rot, ohne dass sich etwas geändert hätte.
 */

// jsdom kennt `scrollIntoView` nicht; `Conversation` ruft es beim Montieren.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const THREAD = {
  id: "t1",
  partner: { name: "Detlev Krause", avatarUrl: null, company: null },
};
const ICH = "mich";

function nachricht(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    threadId: "t1",
    senderId: ICH,
    body: "Servus",
    createdAt: "2026-08-28T09:15:00.000Z",
    ...over,
  };
}

function zeige(messages: ChatMessage[]) {
  render(<Conversation thread={THREAD} messages={messages} myId={ICH} onSend={() => {}} />);
}

describe("Conversation — Zeitstempel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // „Heute" ist der 28.08.2026. Ohne feste Uhr wäre der Test am Tag nach
    // seiner Entstehung ein anderer.
    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("zeigt an einer bestätigten Nachricht von heute nur die Uhrzeit", () => {
    zeige([nachricht()]);
    const zeit = screen.getByTestId("nachricht-zeit");
    expect(zeit.textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it("trägt den vollen Zeitstempel maschinenlesbar", () => {
    zeige([nachricht()]);
    const zeit = screen.getByTestId("nachricht-zeit");
    expect(zeit.tagName).toBe("TIME");
    expect(zeit).toHaveAttribute("dateTime", "2026-08-28T09:15:00.000Z");
  });

  // Geändert, nachdem Tagesmarker dazukamen: der Tag steht jetzt EINMAL im
  // Trenner über der Gruppe, nicht in jeder Blase. Die Zwischenfassung
  // schrieb `TT.MM., HH:MM` in ältere Blasen — richtig, solange es keine
  // Marker gab, danach nur noch Doppelung.
  it("zeigt auch an einer älteren Nachricht NUR die Uhrzeit", () => {
    zeige([nachricht({ createdAt: "2026-08-25T09:15:00.000Z" })]);
    const zeit = screen.getByTestId("nachricht-zeit");
    expect(zeit.textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it("setzt über jeden Kalendertag genau einen Marker", () => {
    zeige([
      nachricht({ id: "a", createdAt: "2026-08-25T09:15:00.000Z" }),
      nachricht({ id: "b", createdAt: "2026-08-25T14:00:00.000Z" }),
      nachricht({ id: "c", createdAt: "2026-08-27T09:00:00.000Z" }),
      nachricht({ id: "d", createdAt: "2026-08-28T09:00:00.000Z" }),
    ]);
    const marker = screen.getAllByTestId("tagestrenner").map((m) => m.textContent);
    expect(marker).toEqual(["Dienstag", "Gestern", "Heute"]);
  });

  it("zeigt an einer schwebenden Blase KEINE Zeit", () => {
    // Die optimistische Zeile trägt die Uhr des Geräts, die bestätigte die des
    // Servers. Eine angezeigte Zeit spränge beim Eintreffen des Echos um die
    // Differenz — deshalb erscheint sie erst, wenn die Serverzeile da ist.
    zeige([nachricht({ pending: true })]);
    expect(screen.queryByTestId("nachricht-zeit")).toBeNull();
  });

  it("zeigt die Zeit, sobald dieselbe Nachricht bestätigt ist", () => {
    zeige([nachricht({ pending: true }), nachricht({ id: "m2" })]);
    expect(screen.getAllByTestId("nachricht-zeit")).toHaveLength(1);
  });
});
