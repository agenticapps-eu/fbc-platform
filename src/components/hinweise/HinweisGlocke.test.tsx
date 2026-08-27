import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Hinweis } from "../../lib/hinweise";
import { HinweisGlocke } from "./HinweisGlocke";

function zeige(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function hinweis(teil: Partial<Hinweis> & { id: string }): Hinweis {
  return {
    type: "post_created",
    payload: { autor_name: "Anna Beispiel", post_id: "p1" },
    created_at: "2026-08-27T06:00:00Z",
    ...teil,
  };
}

const NICHTS: Hinweis[] = [];

describe("HinweisGlocke (AGE-620)", () => {
  it("zeigt bei null Ungelesenen KEINE Zahl", () => {
    zeige(
      <HinweisGlocke hinweise={NICHTS} unbekannt={false} onMarkiere={vi.fn()} onAlle={vi.fn()} />,
    );

    const knopf = screen.getByRole("button", { name: "Benachrichtigungen" });
    // Eine „0" waere eine Zahl, die nichts meldet. Die Glocke ist anders als die
    // Sprechblase kein ORT, den man wiederfinden muss — sie darf still sein.
    expect(knopf.textContent).not.toMatch(/\d/);
  });

  it("nennt die Zahl im zugaenglichen Namen, nicht nur in der Blase", () => {
    zeige(
      <HinweisGlocke
        hinweise={[hinweis({ id: "1" }), hinweis({ id: "2" })]}
        unbekannt={false}
        onMarkiere={vi.fn()}
        onAlle={vi.fn()}
      />,
    );

    // Farbe traegt in diesem Projekt nie allein eine Bedeutung, und eine Ziffer
    // ohne Gegenstand ist fuer einen Screenreader nichts.
    expect(screen.getByRole("button", { name: /2 ungelesen/i })).toBeInTheDocument();
  });

  it("kennzeichnet einen gescheiterten Abruf als unbekannt, nicht als null", () => {
    zeige(<HinweisGlocke hinweise={NICHTS} unbekannt onMarkiere={vi.fn()} onAlle={vi.fn()} />);

    // Sonst saehe ein Fehler aus wie „nichts Neues" — die Fehlanzeige, die
    // niemandem auffaellt.
    expect(
      screen.getByRole("button", { name: /konnte nicht geladen werden/i }),
    ).toBeInTheDocument();
  });

  it("oeffnet erst auf Klick und meldet den Zustand ueber aria-expanded", () => {
    zeige(
      <HinweisGlocke
        hinweise={[hinweis({ id: "1" })]}
        unbekannt={false}
        onMarkiere={vi.fn()}
        onAlle={vi.fn()}
      />,
    );

    const knopf = screen.getByRole("button", { name: /Benachrichtigungen/i });
    expect(knopf.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(knopf);
    expect(knopf.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("schliesst mit Escape", () => {
    zeige(
      <HinweisGlocke
        hinweise={[hinweis({ id: "1" })]}
        unbekannt={false}
        onMarkiere={vi.fn()}
        onAlle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Benachrichtigungen/i }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("schliesst bei einem Klick ausserhalb", () => {
    zeige(
      <HinweisGlocke
        hinweise={[hinweis({ id: "1" })]}
        unbekannt={false}
        onMarkiere={vi.fn()}
        onAlle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Benachrichtigungen/i }));

    // `mousedown`, nicht `focusout`: jsdom bewegt beim Klick den Fokus nicht,
    // ein Umschalter auf `focusout` waere hier gruen und im Browser kaputt.
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sagt im leeren Zustand, dass nichts offen ist", () => {
    zeige(
      <HinweisGlocke hinweise={NICHTS} unbekannt={false} onMarkiere={vi.fn()} onAlle={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Benachrichtigungen/i }));

    expect(screen.getByText(/Keine neuen Benachrichtigungen/i)).toBeInTheDocument();
    // Ohne Inhalt gibt es nichts zu markieren.
    expect(screen.queryByRole("button", { name: /Alle als gelesen/i })).toBeNull();
  });

  it("reicht beim Markieren genau die eine Kennung durch", () => {
    const onMarkiere = vi.fn();
    zeige(
      <HinweisGlocke
        hinweise={[hinweis({ id: "abc" }), hinweis({ id: "def" })]}
        unbekannt={false}
        onMarkiere={onMarkiere}
        onAlle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Benachrichtigungen/i }));

    fireEvent.click(screen.getAllByRole("button", { name: /als gelesen markieren/i })[0]);
    expect(onMarkiere).toHaveBeenCalledWith("abc");
    expect(onMarkiere).toHaveBeenCalledTimes(1);
  });

  it("markiert alle in EINEM Aufruf", () => {
    const onAlle = vi.fn();
    zeige(
      <HinweisGlocke
        hinweise={[hinweis({ id: "1" }), hinweis({ id: "2" })]}
        unbekannt={false}
        onMarkiere={vi.fn()}
        onAlle={onAlle}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Benachrichtigungen/i }));

    fireEvent.click(screen.getByRole("button", { name: /Alle als gelesen/i }));
    expect(onAlle).toHaveBeenCalledTimes(1);
  });

  it("gibt jedem der acht Typen einen eigenen, lesbaren Satz", () => {
    const typen = [
      "contact_request",
      "contact_request_accepted",
      "contact_request_declined",
      "member_joined",
      "post_created",
      "event_created",
      "comment_on_post",
      "like_on_post",
    ];
    zeige(
      <HinweisGlocke
        hinweise={typen.map((t, i) => hinweis({ id: String(i), type: t }))}
        unbekannt={false}
        onMarkiere={vi.fn()}
        onAlle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Benachrichtigungen/i }));

    const texte = screen.getAllByTestId("hinweis-text").map((e) => e.textContent?.trim() ?? "");
    // Acht verschiedene Saetze: faellt einer auf einen Sammeltext zurueck, ist
    // die Menge kleiner als acht.
    expect(new Set(texte).size).toBe(8);
    // Und keiner davon ist der Rohtyp.
    for (const t of texte) expect(t).not.toMatch(/_/);
  });

  it("faellt bei einem unbekannten Typ auf einen Satz zurueck, statt leer zu bleiben", () => {
    zeige(
      <HinweisGlocke
        hinweise={[hinweis({ id: "1", type: "irgendwas_neues" })]}
        unbekannt={false}
        onMarkiere={vi.fn()}
        onAlle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Benachrichtigungen/i }));

    const text = screen.getByTestId("hinweis-text").textContent ?? "";
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/irgendwas_neues/);
  });

  it("kommt ohne Nutzlast aus", () => {
    // Ein Hinweis, dessen Gegenstand geloescht wurde, hat womoeglich nichts mehr
    // in der Nutzlast. Er darf die Liste nicht aufreissen.
    zeige(
      <HinweisGlocke
        hinweise={[hinweis({ id: "1", payload: null, type: null })]}
        unbekannt={false}
        onMarkiere={vi.fn()}
        onAlle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Benachrichtigungen/i }));

    expect(screen.getByTestId("hinweis-text").textContent).toBeTruthy();
  });
});
