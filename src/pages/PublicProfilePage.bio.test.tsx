import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * „Über mich" behält seine Zeilenumbrüche (AGE-566).
 *
 * Gemeldet am 17.08.: der Text stand nur in der Bearbeiten-Ansicht gegliedert,
 * auf dem Profil lief alles zu einem Block zusammen. Die Ursache ist keine
 * Logik, sondern HTML — ohne eine `white-space`-Regel faltet der Browser jeden
 * Umbruch zu einem Leerzeichen.
 *
 * WÄCHTER AUF DIE QUELLE, und das steht hier, weil es eine Einschränkung ist:
 * jsdom rechnet keine Tailwind-Klassen aus, und ein Test, der eine EIGENE
 * Kopie des Absatzes rendert, prüfte nur sich selbst — er bliebe grün, während
 * die echte Seite die Regel verliert. Diese Fassung liest die Datei, die
 * ausgeliefert wird. Sie belegt nicht, wie es aussieht; sie belegt, dass die
 * Regel nicht verschwindet. Das Aussehen ist im Browser abgenommen.
 */
const QUELLE = readFileSync("src/pages/PublicProfilePage.tsx", "utf8");

describe("Über mich", () => {
  it("rendert short_bio mit einer Regel, die Zeilenumbrüche erhält", () => {
    // Der Absatz, der `profile.short_bio` ausgibt — samt seiner Klassenzeile.
    const absatz = QUELLE.match(/<p className="([^"]*)"[^>]*>\s*\{profile\.short_bio\}/);
    expect(absatz, "Der Absatz mit {profile.short_bio} wurde nicht gefunden").not.toBeNull();
    expect(absatz![1]).toMatch(/whitespace-pre(-line|-wrap)?\b/);
  });

  it("verlässt sich dabei nicht auf ein zweites Feld", () => {
    // Gegenprobe gegen einen stillen Umbau: gäbe es den Ausdruck gar nicht
    // mehr, bestünde die erste Zusage oben nur, weil sie nichts fände.
    expect(QUELLE).toContain("{profile.short_bio}");
  });
});
