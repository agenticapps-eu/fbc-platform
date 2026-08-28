import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "../../lib/chat";
import { Conversation } from "./Conversation";

/**
 * AGE-655 — der Weg zu älteren Nachrichten, und der Sprung, der ihn zunichte
 * machte.
 *
 * Der Scroll-Effect hing an `messages.length`. Ältere Nachrichten davorzusetzen
 * ändert die Länge **genauso** wie eine neue anzuhängen — jedes „Ältere laden"
 * riss das Mitglied damit ans untere Ende, also weg von genau der Stelle, für
 * die es den Knopf gedrückt hat. Das steht in keinem Issue; es fiel beim Lesen
 * des bestehenden Effects auf.
 *
 * **Was diese Datei belegen kann und was nicht.** `scrollIntoView` gibt es in
 * jsdom nicht als Verhalten, nur als Attrappe. Geprüft wird also, ob sie
 * gerufen wird — beim Anhängen ja, beim Vorsetzen nein. Dass die gelesene Zeile
 * danach optisch stehenbleibt, belegt allein die Sichtprobe im Browser
 * (tasks.md §4). Das eine ersetzt das andere nicht.
 */

const ICH = "ich";

function n(id: string, createdAt: string): ChatMessage {
  return { id, threadId: "t1", senderId: "wer-anders", body: `Text ${id}`, createdAt };
}

const mittag = n("b", "2026-08-28T12:00:00Z");
const nachmittag = n("c", "2026-08-28T15:00:00Z");
const vormittag = n("a", "2026-08-28T09:00:00Z");
/** Tags zuvor — macht eine EIGENE Tagesgruppe auf. */
const gestern = n("v", "2026-08-27T18:00:00Z");

const thread = { id: "t1", partner: { name: "Anna Berger", avatarUrl: null } };

let scrollIntoView: ReturnType<typeof vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>>;

beforeEach(() => {
  scrollIntoView = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>();
  Element.prototype.scrollIntoView = scrollIntoView;
});

function zeige(messages: ChatMessage[], props: Record<string, unknown> = {}) {
  return render(
    <Conversation
      thread={thread}
      messages={messages}
      myId={ICH}
      onSend={() => {}}
      hatAeltere={false}
      laedtAeltere={false}
      onLadeAeltere={() => {}}
      {...props}
    />,
  );
}

describe("Conversation — der Sprung ans Ende", () => {
  it("springt, wenn unten eine Nachricht dazukommt", () => {
    const { rerender } = zeige([mittag]);
    scrollIntoView.mockClear();

    rerender(
      <Conversation
        thread={thread}
        messages={[mittag, nachmittag]}
        myId={ICH}
        onSend={() => {}}
        hatAeltere={false}
        laedtAeltere={false}
        onLadeAeltere={() => {}}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalled();
  });

  // Die Zusage dieses Changes. Sie braucht die Positivkontrolle oben, sonst wäre
  // sie von „die Attrappe wird nie gerufen" nicht zu unterscheiden.
  it("springt NICHT, wenn oben ältere Nachrichten davorgesetzt werden", () => {
    const { rerender } = zeige([mittag]);
    scrollIntoView.mockClear();

    rerender(
      <Conversation
        thread={thread}
        messages={[vormittag, mittag]}
        myId={ICH}
        onSend={() => {}}
        hatAeltere={false}
        laedtAeltere={false}
        onLadeAeltere={() => {}}
      />,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("Conversation — der Knopf „Ältere laden“", () => {
  it("steht da, wenn es ältere gibt", () => {
    zeige([mittag], { hatAeltere: true });
    expect(screen.getByRole("button", { name: /Ältere laden/ })).toBeInTheDocument();
  });

  it("steht NICHT da, wenn der Verlauf vollständig ist", () => {
    zeige([mittag], { hatAeltere: false });
    expect(screen.queryByRole("button", { name: /Ältere laden/ })).toBeNull();
  });

  it("meldet den Klick nach oben", () => {
    const onLadeAeltere = vi.fn();
    zeige([mittag], { hatAeltere: true, onLadeAeltere });

    fireEvent.click(screen.getByRole("button", { name: /Ältere laden/ }));

    expect(onLadeAeltere).toHaveBeenCalledTimes(1);
  });

  it("ist gesperrt, solange geladen wird — und sagt das auch", () => {
    zeige([mittag], { hatAeltere: true, laedtAeltere: true });

    const knopf = screen.getByRole("button", { name: /Wird geladen/ });
    expect(knopf).toBeDisabled();
  });
});

describe("Conversation — der Tagesmarker nach dem Nachladen", () => {
  it("wandert zur ältesten Zeile seines Tages", () => {
    // Vorher: der 28.08. beginnt bei „b" (mittag).
    const { rerender } = zeige([mittag]);
    const vorher = screen.getAllByRole("separator").length;
    expect(vorher).toBe(1);

    // Nachgeladen: eine Zeile desselben Tages und eine vom Vortag.
    rerender(
      <Conversation
        thread={thread}
        messages={[gestern, vormittag, mittag]}
        myId={ICH}
        onSend={() => {}}
        hatAeltere={false}
        laedtAeltere={false}
        onLadeAeltere={() => {}}
      />,
    );

    // Zwei Kalendertage, zwei Marker.
    const marker = screen.getAllByRole("separator");
    expect(marker).toHaveLength(2);
    // Die Blase trägt seit AGE-645 auch die Uhrzeit, deshalb auf den Anfang
    // prüfen statt auf Gleichheit. Es geht um die REIHENFOLGE.
    const texte = screen.getAllByText(/^Text /).map((el) => el.textContent?.slice(0, 6));
    expect(texte).toEqual(["Text v", "Text a", "Text b"]);

    // **Und die namensgebende Zusage selbst** — die fehlte, und der Test hiess
    // trotzdem so (Diff-Review, codex, NIEDRIG): der Marker des zweiten Tages
    // muss jetzt über „a" stehen, nicht mehr über „b". Reihenfolge und Anzahl
    // allein hätten auch dann gestimmt, wenn er stehengeblieben wäre.
    //
    // Gemessen an der Dokumentposition, nicht am DOM-Baum: `compareDocumentPosition`
    // sagt, was das Mitglied wirklich untereinander sieht.
    const zweiterMarker = marker[1];
    const a = screen.getByText(/^Text a/);
    const b = screen.getByText(/^Text b/);
    const vor = (x: Element, y: Element) =>
      Boolean(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(vor(zweiterMarker, a)).toBe(true);
    expect(vor(a, b)).toBe(true);
  });
});
