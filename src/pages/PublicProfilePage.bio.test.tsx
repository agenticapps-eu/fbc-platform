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
 *
 * SEIT AGE-534 STEHT DER ABSATZ IN `Biografie` (drei Zeilen, der Rest auf
 * Klick) und bekommt den Text als `text`. Die erste Fassung dieses Wächters
 * suchte `<p …>{profile.short_bio}` und fand nach dem Umzug nichts mehr —
 * während die Regel unverändert dastand. Der Wächter folgt jetzt dem Text an
 * seinen neuen Ort, und die Gegenprobe unten hält die Verbindung dorthin fest.
 */
const QUELLE = readFileSync("src/pages/PublicProfilePage.tsx", "utf8");

describe("Über mich", () => {
  it("rendert die Biografie mit einer Regel, die Zeilenumbrüche erhält", () => {
    const rumpf = QUELLE.match(/function Biografie\([\s\S]*?\n\}/);
    expect(rumpf, "Die Komponente `Biografie` wurde nicht gefunden").not.toBeNull();

    // Der Absatz, der den Text ausgibt — samt seiner Klassenzeile.
    const absatz = rumpf![0].match(/<p\b[\s\S]*?>\s*\{text\}/);
    expect(absatz, "Der Absatz mit {text} wurde nicht gefunden").not.toBeNull();
    expect(absatz![0]).toMatch(/whitespace-pre(-line|-wrap)?\b/);
  });

  it("verlässt sich dabei nicht auf ein zweites Feld", () => {
    // Gegenprobe gegen einen stillen Umbau: bekäme `Biografie` den Text gar
    // nicht mehr, bestünde die Zusage oben nur, weil sie ins Leere greift.
    expect(QUELLE).toContain("<Biografie text={profile.short_bio} />");
  });
});
