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

  it("überlappt überhaupt — ohne negativen Rand gäbe es nichts zu stapeln", () => {
    render(<ProfileHero name="Anna Berg" avatarUrl="/a.webp" coverUrl="/c.webp" />);

    const avatar = screen.getByAltText("Anna Berg").parentElement;

    expect(avatar?.className).toMatch(/-mt-10/);
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
