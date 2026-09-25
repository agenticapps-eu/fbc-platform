import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HilfeTutorialsPage, { etappenMitKapiteln } from "./HilfeTutorialsPage";
import { RELEASE_GESCHICHTEN } from "../content/release-geschichten";
import { RELEASE_TUTORIAL } from "../content/release-tutorial";
import type { ReleaseGeschichte, TutorialEtappe } from "../types/release";

/**
 * Die Tutorial-Fläche (AGE-904).
 *
 * Zwei Sorten Zusage, bewusst getrennt: die AUSWAHLREGEL wird an erfundenen
 * Entwürfen geprüft (die echte Datei hat heute keinen, eine Zusage darüber wäre
 * also die ganze Zeit grün und belegte nichts), die FLÄCHE am echten Inhalt —
 * sie ist der Grund, warum die Bilder umgezogen sind, und eine Attrappe mit
 * erfundenen Pfaden hätte den Umzug nicht gemerkt.
 */

function geschichte(teil: Partial<ReleaseGeschichte>): ReleaseGeschichte {
  return {
    slug: "eine-geschichte",
    datum: "2026-09-07",
    titel: "Ein Titel",
    text: "Ein Absatz.",
    bild: { src: "/tutorial/x.webp", alt: "Was zu sehen ist", width: 800, height: 500 },
    freigegeben: true,
    ...teil,
  };
}

function etappe(titel: string, kapitel: string[]): TutorialEtappe {
  return { titel, einleitung: "Worum es geht.", motiv: "hero-start.webp", kapitel };
}

describe("etappenMitKapiteln — welcher Teil des Weges sichtbar ist", () => {
  it("lässt einen Entwurf weg, ohne die Etappe zu verlieren", () => {
    const [erste] = etappenMitKapiteln(
      [etappe("Ankommen", ["fertig", "entwurf"])],
      [geschichte({ slug: "fertig" }), geschichte({ slug: "entwurf", freigegeben: false })],
    );
    expect(erste.kapitel.map((k) => k.slug)).toEqual(["fertig"]);
  });

  it("lässt eine Etappe ganz weg, deren Kapitel alle Entwürfe sind", () => {
    // Sonst stünde eine Überschrift über einer leeren Strecke — und verriete,
    // dass es dort etwas gibt, das noch niemand sehen soll.
    const sichtbar = etappenMitKapiteln(
      [etappe("Ankommen", ["fertig"]), etappe("Geheim", ["entwurf"])],
      [geschichte({ slug: "fertig" }), geschichte({ slug: "entwurf", freigegeben: false })],
    );
    expect(sichtbar.map((e) => e.titel)).toEqual(["Ankommen"]);
  });

  it("hängt die Kennung an die Stelle in der GEPFLEGTEN Liste, nicht an die nach dem Filtern", () => {
    // Sonst verschöbe die Freigabe eines einzigen Kapitels die Sprungziele
    // aller folgenden Etappen — und jeder geteilte Link zeigte danach woandershin.
    const sichtbar = etappenMitKapiteln(
      [etappe("Entwurfsstrecke", ["entwurf"]), etappe("Ankommen", ["fertig"])],
      [geschichte({ slug: "fertig" }), geschichte({ slug: "entwurf", freigegeben: false })],
    );
    expect(sichtbar).toHaveLength(1);
    expect(sichtbar[0].id).toBe("etappe-2");
  });

  it("führt die Kapitel in der Reihenfolge der Etappe, nicht in der der Geschichten", () => {
    const [erste] = etappenMitKapiteln(
      [etappe("Ankommen", ["zweite", "erste"])],
      [geschichte({ slug: "erste" }), geschichte({ slug: "zweite" })],
    );
    expect(erste.kapitel.map((k) => k.slug)).toEqual(["zweite", "erste"]);
  });
});

describe("Die Tutorial-Fläche am echten Inhalt", () => {
  it("zeigt jede Etappe mit freigegebenem Kapitel, in der Reihenfolge des Weges", () => {
    render(<HilfeTutorialsPage />);
    const erwartet = etappenMitKapiteln(RELEASE_TUTORIAL, RELEASE_GESCHICHTEN).map((e) => e.titel);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      erwartet,
    );
    // Die Ordnung ist die Zusage — ohne diese Zeile wäre jede Reihenfolge grün.
    expect(erwartet[0]).toBe("Ankommen");
  });

  it("zeigt jedes freigegebene Kapitel genau einmal", () => {
    render(<HilfeTutorialsPage />);
    const kapitel = RELEASE_GESCHICHTEN.filter((g) => g.freigegeben);
    const ueberschriften = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(ueberschriften).toHaveLength(kapitel.length);
    expect(new Set(ueberschriften).size).toBe(ueberschriften.length);
  });

  it("führt jede Sprungmarke auf einen Abschnitt, den es wirklich gibt", () => {
    const { container } = render(<HilfeTutorialsPage />);
    const marken = screen.getAllByRole("link");
    expect(marken.length).toBeGreaterThan(0);
    for (const marke of marken) {
      const ziel = marke.getAttribute("href") ?? "";
      expect(ziel.startsWith("#"), `Sprungmarke „${marke.textContent}“`).toBe(true);
      expect(container.querySelector(`section[id="${ziel.slice(1)}"]`)).not.toBeNull();
    }
  });

  it("liefert jedes Bild aus der ANWENDUNG aus, mit Breite und Höhe", () => {
    // Der Kern von AGE-904: bis hierher lagen diese Aufnahmen ausserhalb des
    // Bündels und kamen vom Blog. Mit AGE-906 geht der offline — eine Adresse
    // dorthin wäre ein Tutorial, das an dem Tag seine Bilder verliert.
    const { container } = render(<HilfeTutorialsPage />);
    const bilder = Array.from(container.querySelectorAll("img"));
    expect(bilder.length).toBeGreaterThan(0);
    for (const bild of bilder) {
      expect(bild.getAttribute("src")).toMatch(/^\/tutorial\/[a-z0-9-]+\.webp$/);
      expect(Number(bild.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(bild.getAttribute("height"))).toBeGreaterThan(0);
      expect(bild.getAttribute("alt")?.trim()).not.toBe("");
    }
  });

  it("lädt das erste Bild sofort und alle weiteren später", () => {
    const { container } = render(<HilfeTutorialsPage />);
    const bilder = Array.from(container.querySelectorAll("img"));
    expect(bilder[0].getAttribute("loading")).toBeNull();
    expect(bilder.slice(1).every((b) => b.getAttribute("loading") === "lazy")).toBe(true);
  });

  it("setzt echte Absätze, statt den Text in einen Block zu giessen", () => {
    // Der Klartext trennt Absätze mit einer Leerzeile. In EINEM <p> wäre die
    // Fläche eine Textwand — 23 Kapitel hintereinander liest so niemand.
    const mehrabsaetzig = RELEASE_GESCHICHTEN.filter(
      (g) => g.freigegeben && g.text.includes("\n\n"),
    );
    expect(mehrabsaetzig.length).toBeGreaterThan(0);
    const { container } = render(<HilfeTutorialsPage />);
    const ersterAbsatz = mehrabsaetzig[0].text.split(/\n{2,}/)[0].trim();
    const treffer = Array.from(container.querySelectorAll("article p")).filter(
      (p) => p.textContent === ersterAbsatz,
    );
    expect(treffer).toHaveLength(1);
  });
});
