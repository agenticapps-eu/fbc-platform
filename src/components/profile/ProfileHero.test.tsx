import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileHero } from "./ProfileHero";

/**
 * Der Avatar überlappt das Headerbild — und er muss DARÜBER liegen.
 *
 * ── WARUM DAS EIN TEST IST UND NICHT NUR EINE KLASSE ────────────────────────
 * Der Banner-Block ist `relative`, also POSITIONIERT. Positionierte Elemente
 * werden über statischem Inhalt gemalt, unabhängig von der Reihenfolge im DOM —
 * der Avatar lag deshalb immer darunter, obwohl er später im Baum steht. Am
 * laufenden Stack gemessen (15.08.): `elementFromPoint` auf der 12 px breiten
 * Überlappung traf das Banner-`img`, nicht den Avatar.
 *
 * Sichtbar wurde es erst mit AGE-534, als die ersten Mitglieder ein Headerbild
 * bekamen. Davor verdeckte ein heller Verlauf dieselbe Fehlstellung.
 *
 * jsdom rechnet keine Stapelreihenfolge aus, dieser Test kann den Fehler also
 * nicht selbst sehen. Er nagelt fest, WAS ihn behebt: nimmt jemand `relative`
 * oder `z-10` weg, wird er rot — statt dass es erst wieder jemandem auf einem
 * Profil auffällt.
 */
describe("ProfileHero — der Avatar liegt über dem Headerbild", () => {
  it("trägt relative und z-10, ohne die er unter den Banner rutscht", () => {
    render(<ProfileHero name="Anna Berg" avatarUrl="/a.webp" coverUrl="/c.webp" />);

    const avatar = screen.getByAltText("Anna Berg").parentElement;

    expect(avatar).toHaveClass("relative");
    expect(avatar).toHaveClass("z-10");
  });

  /**
   * WAS DIESER TEST NICHT KANN, und warum das hier steht: jsdom hat keine
   * Layout-Engine, er kann eine Überlappung nicht messen. Geprüft wird deshalb
   * nur, dass es überhaupt einen negativen Rand gibt — in BEIDEN Stufen, denn
   * die schmale und die breite Ansicht tragen verschiedene Werte.
   *
   * Am 25.08. hat sich gezeigt, wie wenig das belegt: Der Test war grün, und im
   * Browser ragte der Avatar trotzdem nur 12 px von 112 (10 %) in den Banner.
   * Der negative Rand war wirkungslos, weil die Zeile `items-end` trug — dort
   * richtet Flexbox die Unterkanten aus, und `margin-top` verschiebt die
   * Marginbox-Unterkante nicht. Die 12 px waren ein Nebenprodukt der
   * Höhendifferenz zwischen Avatar und Textblock, hingen also an der Zeilenzahl
   * des Textes.
   *
   * Die Ausrichtung ist deshalb Teil der Zusage. Ein konkreter Überlappungswert
   * gehört in eine Messung im Browser, nicht hierher.
   */
  it("trägt einen negativen Rand in beiden Ansichtsbreiten", () => {
    render(<ProfileHero name="Anna Berg" avatarUrl="/a.webp" coverUrl="/c.webp" />);

    const avatar = screen.getByAltText("Anna Berg").parentElement;

    expect(avatar?.className).toMatch(/(^|\s)-mt-\d/);
    expect(avatar?.className).toMatch(/(^|\s)sm:-mt-\d/);
  });

  it("richtet die Identitätszeile oben aus, sonst ist der negative Rand wirkungslos", () => {
    render(<ProfileHero name="Anna Berg" avatarUrl="/a.webp" coverUrl="/c.webp" />);

    const zeile = screen.getByAltText("Anna Berg").closest("div.flex");

    // `items-end` würde die Unterkanten ausrichten und den negativen Rand
    // aushebeln — genau der Zustand vom 25.08.
    expect(zeile?.className).not.toMatch(/sm:items-end/);
    expect(zeile?.className).toMatch(/sm:items-start/);
  });

  it("gilt auch ohne Headerbild — dort steht der Avatar auf dem Verlauf", () => {
    // Der Verlauf gehört demselben positionierten Block. Ein Avatar, der nur
    // MIT Bild oben liegt, wäre die halbe Behebung.
    render(<ProfileHero name="Anna Berg" avatarUrl="/a.webp" />);

    const avatar = screen.getByAltText("Anna Berg").parentElement;

    expect(avatar).toHaveClass("relative");
    expect(avatar).toHaveClass("z-10");
  });
});
