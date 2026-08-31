import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBildauswahl } from "./useBildauswahl";

/**
 * Die Attrappen sitzen an der PLATTFORMGRENZE, nicht um die eigene Logik
 * herum: `@capacitor/core` sagt, ob nativ, `@capacitor/camera` ist die native
 * Schnittstelle, und `fetch` holt das Bild von einem `capacitor://`-Pfad, den
 * es in jsdom nicht gibt. Alles dazwischen — die Entscheidung, die Grenze, das
 * Umwandeln in eine Datei, der Abbruch — laeuft echt.
 */
const nativ = vi.fn(() => false);
const takePhoto = vi.fn();
const chooseFromGallery = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => nativ(),
  },
}));

vi.mock("@capacitor/camera", () => ({
  Camera: {
    takePhoto: (o: unknown) => takePhoto(o),
    chooseFromGallery: (o: unknown) => chooseFromGallery(o),
  },
  EncodingType: { JPEG: 0, PNG: 1 },
  MediaTypeSelection: { Photo: 0, Video: 1, All: 2 },
}));

let uebernommen: File[][];

beforeEach(() => {
  uebernommen = [];
  nativ.mockReturnValue(false);
  takePhoto.mockReset();
  chooseFromGallery.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ blob: async () => new Blob(["x"], { type: "image/jpeg" }) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ mehrere = false, frei = 1 }: { mehrere?: boolean; frei?: number }) {
  const { oeffnen, rueckfrage } = useBildauswahl((dateien) => uebernommen.push(dateien));
  const feld = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => oeffnen(feld.current, { mehrere, frei })}>
        Bild wählen
      </button>
      <input type="file" data-testid="feld" ref={feld} className="hidden" />
      {rueckfrage}
    </>
  );
}

describe("useBildauswahl", () => {
  it("löst im Web das bestehende Dateifeld aus und fragt nichts", () => {
    render(<Probe />);
    const feld = screen.getByTestId("feld") as HTMLInputElement;
    const klick = vi.fn();
    feld.click = klick;

    fireEvent.click(screen.getByRole("button", { name: "Bild wählen" }));

    expect(klick).toHaveBeenCalledTimes(1);
    // Die Rueckfrage im Browser waere schlimmer als keine: hinter „Aufnehmen"
    // stuende dort keine Kamera-API.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fragt nativ nach der Quelle, statt das Feld auszulösen", () => {
    nativ.mockReturnValue(true);
    render(<Probe />);
    const feld = screen.getByTestId("feld") as HTMLInputElement;
    const klick = vi.fn();
    feld.click = klick;

    fireEvent.click(screen.getByRole("button", { name: "Bild wählen" }));

    expect(klick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aufnehmen/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mediathek/ })).toBeInTheDocument();
  });

  it("nimmt über die Kamera genau ein Bild entgegen und schliesst die Rückfrage", async () => {
    nativ.mockReturnValue(true);
    takePhoto.mockResolvedValue({ webPath: "capacitor://foto-1", saved: false, type: 0 });
    render(<Probe />);

    fireEvent.click(screen.getByRole("button", { name: "Bild wählen" }));
    fireEvent.click(screen.getByRole("button", { name: /Aufnehmen/ }));

    await waitFor(() => expect(uebernommen).toHaveLength(1));
    expect(uebernommen[0]).toHaveLength(1);
    expect(uebernommen[0][0].type).toBe("image/jpeg");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Die Zusage, die den Feed traegt: `limit` ist der REST, nicht das Maximum.
  it("reicht Mehrfachauswahl und Rest an die Mediathek durch", async () => {
    nativ.mockReturnValue(true);
    chooseFromGallery.mockResolvedValue({
      results: [{ webPath: "capacitor://a" }, { webPath: "capacitor://b" }],
    });
    render(<Probe mehrere frei={4} />);

    fireEvent.click(screen.getByRole("button", { name: "Bild wählen" }));
    fireEvent.click(screen.getByRole("button", { name: /Mediathek/ }));

    await waitFor(() => expect(uebernommen).toHaveLength(1));
    expect(uebernommen[0]).toHaveLength(2);
    expect(chooseFromGallery).toHaveBeenCalledWith(
      expect.objectContaining({ allowMultipleSelection: true, limit: 4 }),
    );
  });

  // Der haeufigste Ausgang ueberhaupt. Ohne diese Zusage bliebe die Rueckfrage
  // nach einem Abbruch offen stehen — mit gesperrter Seite dahinter.
  it("behandelt den Abbruch als leere Auswahl, nicht als Fehler", async () => {
    nativ.mockReturnValue(true);
    takePhoto.mockRejectedValue(new Error("User cancelled photos app"));
    render(<Probe />);

    fireEvent.click(screen.getByRole("button", { name: "Bild wählen" }));
    fireEvent.click(screen.getByRole("button", { name: /Aufnehmen/ }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(uebernommen).toHaveLength(0);
  });
});
