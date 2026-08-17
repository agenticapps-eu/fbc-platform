import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarCropper } from "./AvatarCropper";

/**
 * Ein Bild, das der Browser nicht lesen kann (AGE-566).
 *
 * GEMELDET AUS DER PROBE-UMGEBUNG am 17.08.: „ich kann kein Bild hochladen".
 * Der Zuschnitt lud die Datei nur über `img.onload` — ohne `onerror`. Konnte
 * der Browser sie nicht dekodieren (HEIC vom iPhone ist der Regelfall), feuerte
 * gar nichts: leere Fläche, toter „Übernehmen"-Knopf, kein Wort dazu.
 *
 * jsdom lädt Bilder nie wirklich; beide Zweige müssen hier von Hand ausgelöst
 * werden. Der Test greift sich dafür die erzeugte `Image`-Instanz — das ist der
 * einzige Weg, den Fehlerpfad überhaupt zu erreichen, und er prüft genau die
 * Zusage: es steht etwas Lesbares da statt einer stummen Fläche.
 */
class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  #src = "";
  static letzte: TestImage | null = null;
  constructor() {
    TestImage.letzte = this;
  }
  set src(v: string) {
    this.#src = v;
  }
  get src() {
    return this.#src;
  }
}

function renderCropper() {
  vi.stubGlobal("Image", TestImage as unknown as typeof Image);
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  const datei = new File(["x"], "foto.heic", { type: "image/heic" });
  render(
    <AvatarCropper
      file={datei}
      aspect={1}
      outWidth={512}
      label="Profilbild zuschneiden"
      onCancel={() => {}}
      onConfirm={() => {}}
    />,
  );
  return TestImage.letzte!;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Der Zuschnitt sagt, wenn er ein Bild nicht lesen kann", () => {
  it("nennt den Grund statt stumm zu bleiben", async () => {
    const img = renderCropper();

    img.onerror?.();

    // Der Hinweis nennt das Format beim Namen — „Fehler beim Laden" hülfe
    // niemandem, der ein iPhone-Foto ausgewählt hat.
    expect(await screen.findByText(/HEIC/i)).toBeInTheDocument();
    expect(screen.getByText(/JPG oder PNG/i)).toBeInTheDocument();
  });

  it("zeigt die Bedienhilfe nur, solange kein Fehler vorliegt", async () => {
    const img = renderCropper();
    expect(screen.getByText(/Ziehen zum Verschieben/i)).toBeInTheDocument();

    img.onerror?.();

    // Sonst stünde „Ziehen zum Verschieben" über einer Fläche, die es nicht
    // mehr gibt — eine Aufforderung zu etwas Unmöglichem.
    await waitFor(() => expect(screen.queryByText(/Ziehen zum Verschieben/i)).toBeNull());
    expect(screen.queryByLabelText("Zoom")).toBeNull();
  });

  it("laesst den Uebernehmen-Knopf nach einem Lesefehler gesperrt", async () => {
    const img = renderCropper();

    img.onerror?.();

    await screen.findByText(/HEIC/i);
    expect(screen.getByRole("button", { name: /Übernehmen/i })).toBeDisabled();
    // Und der Weg hinaus bleibt offen.
    expect(screen.getByRole("button", { name: /Abbrechen/i })).toBeEnabled();
  });

  it("zeigt bei einem lesbaren Bild keine Fehlermeldung", async () => {
    const img = renderCropper();

    img.onload?.();

    await waitFor(() => expect(screen.getByRole("button", { name: /Übernehmen/i })).toBeEnabled());
    expect(screen.queryByText(/HEIC/i)).toBeNull();
    expect(screen.getByText(/Ziehen zum Verschieben/i)).toBeInTheDocument();
  });
});
