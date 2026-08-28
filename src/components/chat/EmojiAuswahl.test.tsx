import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "../../lib/chat";

// Ein kleiner Datensatz statt der echten 1914 Einträge: der Test soll das
// Verhalten prüfen, nicht das Laden. Dass die AUSGELIEFERTE Datei „Herz"
// wirklich findet, steht als eigener Test in `emoji.generated.test.ts` — die
// beiden Fragen sind verschieden, und eine Attrappe kann die zweite nicht
// beantworten.
vi.mock("../../content/emoji.generated", () => ({
  EMOJI: [
    ["❤️", "rotes Herz", "herz rotes herz", 8],
    ["👍", "Daumen hoch", "daumen hoch gut", 1],
    ["🍺", "Bierkrug", "bier krug prost", 4],
  ],
  EMOJI_GRUPPEN: [
    [1, "Menschen & Körper"],
    [4, "Essen & Trinken"],
    [8, "Symbole"],
  ],
}));

// jsdom kennt `scrollIntoView` nicht; `Conversation` ruft es beim Montieren.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const { Conversation } = await import("./Conversation");

const THREAD = {
  id: "t1",
  partner: { name: "Detlev Krause", avatarUrl: null, company: null },
};

function zeige(onSend: (b: string) => void = () => {}) {
  render(
    <Conversation thread={THREAD} messages={[] as ChatMessage[]} myId="ich" onSend={onSend} />,
  );
  return {
    eingabe: screen.getByLabelText("Nachricht schreiben") as HTMLTextAreaElement,
    schalter: screen.getByLabelText("Emoji auswählen"),
  };
}

async function oeffne() {
  const { eingabe, schalter } = zeige();
  fireEvent.click(schalter);
  await screen.findByRole("dialog");
  return { eingabe, schalter };
}

describe("EmojiAuswahl", () => {
  it("meldet am Schalter, ob es offen ist", async () => {
    const { schalter } = zeige();
    expect(schalter).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(schalter);
    await screen.findByRole("dialog");
    expect(schalter).toHaveAttribute("aria-expanded", "true");
  });

  it("legt den Fokus beim Öffnen ins Suchfeld", async () => {
    await oeffne();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Emoji suchen")));
  });

  it("nennt jedes Feld beim deutschen Namen, nicht beim Zeichen", async () => {
    await oeffne();
    expect(screen.getByRole("button", { name: "rotes Herz" })).toBeInTheDocument();
  });

  it("sucht auf Deutsch", async () => {
    await oeffne();
    fireEvent.change(screen.getByLabelText("Emoji suchen"), { target: { value: "Herz" } });
    expect(screen.getByRole("button", { name: "rotes Herz" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bierkrug" })).toBeNull();
  });

  it("sucht über die Suchbegriffe, nicht nur über den Namen", async () => {
    await oeffne();
    fireEvent.change(screen.getByLabelText("Emoji suchen"), { target: { value: "prost" } });
    expect(screen.getByRole("button", { name: "Bierkrug" })).toBeInTheDocument();
  });

  it("fügt AN DER CURSORPOSITION ein, nicht am Ende", async () => {
    const { eingabe, schalter } = zeige();
    fireEvent.change(eingabe, { target: { value: "Hallo Welt" } });
    // Cursor hinter „Hallo“.
    eingabe.setSelectionRange(5, 5);

    fireEvent.click(schalter);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "rotes Herz" }));

    expect(eingabe.value).toBe("Hallo❤️ Welt");
  });

  it("gibt den Fokus in die Eingabe zurück und setzt den Cursor hinter das Emoji", async () => {
    const { eingabe, schalter } = zeige();
    fireEvent.change(eingabe, { target: { value: "Hallo Welt" } });
    eingabe.setSelectionRange(5, 5);

    fireEvent.click(schalter);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "rotes Herz" }));

    expect(document.activeElement).toBe(eingabe);
    expect(eingabe.selectionStart).toBe(5 + "❤️".length);
  });

  it("schliesst mit Escape und gibt den Fokus zurück", async () => {
    const { eingabe } = await oeffne();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(eingabe);
  });

  it("schliesst bei einem Klick daneben", async () => {
    await oeffne();
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("hängt am document.body, nicht im Formular", async () => {
    const { schalter } = await oeffne();
    const dialog = screen.getByRole("dialog");
    // Wäre er ein Nachfahre der Sendezeile, finge ihn dort jeder Vorfahre mit
    // `transform` oder `backdrop-filter` ein — in diesem Repo dreimal passiert.
    expect(dialog.closest("form")).toBeNull();
    expect(schalter.closest("form")).not.toBeNull();
  });

  // Die 1900 Rasterfelder waren normale Tabstopps. Wer per Tastatur öffnete,
  // ins Raster wechselte und dann Tab drückte, verliess den portalierten
  // Dialog — das Overlay blieb offen, und das nächste Escape wurde am
  // fokussierten Hintergrundelement ausgelöst und erreichte den Handler am
  // Dialog nicht mehr. Ein offenes Overlay ohne Tastaturweg hinaus.
  // Gefunden von einem fremden Reviewer.
  it("nimmt die Rasterfelder aus der Tab-Reihenfolge", async () => {
    await oeffne();
    fireEvent.change(screen.getByLabelText("Emoji suchen"), { target: { value: "Herz" } });
    const feld = await screen.findByRole("button", { name: "rotes Herz" });
    // Erreichbar bleibt es über die Pfeiltasten, nicht über Tab.
    expect(feld).toHaveAttribute("tabindex", "-1");
  });

  it("schliesst mit Escape auch, wenn der Fokus den Dialog verlassen hat", async () => {
    const { eingabe } = await oeffne();
    // Fokus ausserhalb des Overlays — der Zustand, in dem der Handler am
    // Dialog nicht mehr greift.
    eingabe.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Der Preis eines dokumentweiten Lauschers: `AppShell` schliesst die
  // Chat-Schublade ihrerseits bei Escape über einen `document`-Lauscher in der
  // BLASENphase (`AppShell.tsx`, `chatDrawerOpen`). Liefe unserer ebenfalls
  // dort, schlösse ein Tastendruck den Picker UND die Schublade — der Picker
  // sässe ja gerade in ihr. Deshalb Capture plus `stopPropagation`; hier wird
  // genau das nachgestellt, statt es zu behaupten.
  it("lässt das erste Escape nicht bis zu einem Blasen-Lauscher durch", async () => {
    await oeffne();
    const fremd = vi.fn();
    document.addEventListener("keydown", fremd);
    try {
      fireEvent.keyDown(document.body, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(fremd).not.toHaveBeenCalled();

      // Und danach kommt er wieder durch — sonst wäre die Schublade taub.
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(fremd).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", fremd);
    }
  });

  // `ChatPage` rendert beim Wechsel des Gesprächs DIESELBE `Conversation`
  // weiter — es gibt dort kein `key`. Ein Klick in die Threadliste schliesst
  // den Picker über `mousedown`; ein Wechsel per Zurück/Vorwärts oder über die
  // Tastatur tut das NICHT. Ohne eigenen Schlüssel stünde er danach offen über
  // dem anderen Gespräch, und die nächste Wahl landete in dessen Entwurf.
  // Gefunden von einem fremden Reviewer.
  it("schliesst, wenn das Gespräch wechselt — ohne Klick", async () => {
    const ergebnis = render(
      <Conversation thread={THREAD} messages={[] as ChatMessage[]} myId="ich" onSend={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText("Emoji auswählen"));
    await screen.findByRole("dialog");

    ergebnis.rerender(
      <Conversation
        thread={{ ...THREAD, id: "t2", partner: { ...THREAD.partner, name: "Anna Berger" } }}
        messages={[] as ChatMessage[]}
        myId="ich"
        onSend={() => {}}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
