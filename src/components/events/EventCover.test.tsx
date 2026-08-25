import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventCover } from "./EventCover";

/**
 * Das Bildfeld trägt das Verhältnis, auf das der Zuschneider festlegt (AGE-596).
 *
 * ── WAS DIESE TESTS BELEGEN UND WAS NICHT ───────────────────────────────────
 * Sie sind ausdrücklich STRUKTURELL. Unter `object-cover` wie unter
 * `object-contain` behält die `<img>`-Box die Maße ihres Containers; nur der
 * gemalte Inhalt darin unterscheidet sich, und davon sieht jsdom nichts. Ein
 * Test hier kann die Einpassung also nicht belegen — er nagelt fest, WAS sie
 * trägt: das Verhältnis des Feldes, die `object-fit`-Regel und die Lage des
 * Platzhalters.
 *
 * Der Beleg selbst ist eine Messung im Browser aus `getBoundingClientRect`,
 * `naturalWidth`/`naturalHeight` und `s = min(bw/nw, bh/nh)`. Gemessen am
 * 25.08. vor dem Fix, bei 1370 px: die Kachel (16:9) schnitt von einem
 * 2,70:1-Bild 34,2 % der Breite weg, von einem 3,00:1-Bild 40,7 %.
 */
const START = new Date(2026, 8, 10, 19, 0).toISOString();

describe("EventCover — das Bildfeld ist 3:1", () => {
  function feld(container: HTMLElement) {
    return container.firstElementChild as HTMLElement;
  }

  it("legt die Kachel auf 3:1 — nicht auf 16:9, das jedes Titelbild seitlich beschnitt", () => {
    const { container } = render(<EventCover startsAt={START} url="/c.webp" />);
    expect(feld(container).className).toMatch(/aspect-\[3\/1\]/);
    expect(feld(container).className).not.toMatch(/aspect-\[16\/9\]/);
  });

  it("legt die Kachel auch OHNE Titelbild auf 3:1 — sonst franst das Raster aus", () => {
    // Bebilderte und unbebilderte Events stehen nebeneinander. Ungleiche
    // Bildhöhen wären genau der Zustand, den der Platzhalter verhindern soll.
    const { container } = render(<EventCover startsAt={START} url={null} />);
    expect(feld(container).className).toMatch(/aspect-\[3\/1\]/);
  });

  it("hält den Event-Kopf mit Bild bei 3:1", () => {
    const { container } = render(<EventCover startsAt={START} url="/c.webp" gross />);
    expect(feld(container).className).toMatch(/aspect-\[3\/1\]/);
  });

  it("lässt den Kopf OHNE Bild flach — ein 3:1-Platzhalter drückte den Titel unter die Falz", () => {
    // Bewusst unangetastet: die Begründung dafür steht seit der Sichtprobe im
    // Bauteil. Ohne Bild gibt es kein Bildfeld, dessen Verhältnis zu schützen
    // wäre — die Anforderung greift hier nicht.
    const { container } = render(<EventCover startsAt={START} url={null} gross />);
    expect(feld(container).className).toMatch(/h-28/);
  });

  it("passt das Bild ein, statt es zu beschneiden", () => {
    const { container } = render(<EventCover startsAt={START} url="/c.webp" />);
    const img = container.querySelector("img");
    expect(img?.className).toMatch(/object-contain/);
    expect(img?.className).not.toMatch(/object-cover/);
  });
});

describe("EventCover — der Platzhalter liegt UNTER dem Bild", () => {
  it("steht auch dann im Baum, wenn ein Bild vorhanden ist", () => {
    // Ein Platzhalter, den es nur im Zweig „kein Bild" gibt, lässt beim
    // eingepassten Bild die Fläche des Elternteils durchscheinen. Eine flache
    // Füllfarbe neben dem Motiv liest sich als Fehler, nicht als Rahmung.
    const { container } = render(<EventCover startsAt={START} url="/c.webp" />);
    const verlauf = container.querySelector('[aria-hidden="true"]');
    expect(verlauf).not.toBeNull();
    expect(verlauf?.className).toMatch(/bg-gradient-to-br/);
  });

  it("steht VOR dem Bild im Baum — sonst malt er es zu", () => {
    // Beide sind `absolute` positioniert. Unter gleichem z-index entscheidet
    // die Reihenfolge im DOM, was oben liegt; der Verlauf muss deshalb zuerst
    // kommen. Dieselbe Falle wie beim Avatar des Profilkopfes (AGE-534).
    const { container } = render(<EventCover startsAt={START} url="/c.webp" />);
    const verlauf = container.querySelector('[aria-hidden="true"]')!;
    const img = container.querySelector("img")!;
    expect(verlauf.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("EventCover — die Datumsmarke hängt am Feld, nicht am Bild", () => {
  it("sitzt als Geschwister des Bildes im Feld, auch wenn freie Fläche entsteht", () => {
    // Sie beschriftet die Kachel, nicht das Motiv. Hinge sie am Bild, wanderte
    // sie beim eingepassten Bild mit dessen Rand nach innen.
    const { container, getByText } = render(<EventCover startsAt={START} url="/c.webp" />);
    const marke = getByText("10").closest("div.absolute")!;
    const img = container.querySelector("img")!;
    expect(marke.parentElement).toBe(container.firstElementChild);
    // Und sie kommt NACH dem Bild — unter gleichem z-index entscheidet die
    // Reihenfolge im Baum, sonst verschwände sie darunter. Eine frühere
    // Fassung prüfte hier `marke.closest("img")`: `<img>` ist ein leeres
    // Element und kann nie Vorfahr sein, die Zusage war also konstant erfüllt
    // und hätte jede Regression durchgelassen.
    expect(img.compareDocumentPosition(marke) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
