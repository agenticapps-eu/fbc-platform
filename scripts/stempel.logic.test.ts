import { describe, expect, it } from "vitest";

import { EINGABEN, ERGEBNISSE, abweichungen, berechne, pruefsumme } from "./stempel.logic";

/**
 * Der Stempel (AGE-714).
 *
 * WAS DIESE TESTS WIRKLICH BEWACHEN: dass der Wächter die zwei Fehler MELDET,
 * gegen die er gebaut ist — geänderte Quelle ohne Neuerzeugung, und von Hand
 * geschriebenes Ergebnis. Ein Wächter, der immer grün ist, sieht genauso aus
 * wie einer, der funktioniert; der Unterschied zeigt sich nur, wenn man ihm
 * einen Fehler vorlegt.
 *
 * Deshalb arbeiten sie mit eingespeisten Datei-Lesern statt am echten Baum:
 * ein Test, der `public/images/hero-mitglieder.webp` verändern müsste, um
 * etwas zu belegen, wäre keiner.
 */

/** Ein Baum aus Pfad → Inhalt, als Ersatz für das Dateisystem. */
function baum(dateien: Record<string, string>) {
  return {
    da: (p: string) => p in dateien,
    lies: (p: string) => Buffer.from(dateien[p] ?? ""),
  };
}

const EIN = ["quelle.svg"];
const ERG = ["erzeugt.png"];

describe("Der Stempel hält Eingaben und Ergebnisse zusammen", () => {
  it("meldet eine geänderte QUELLE — der Fehler, gegen den er gebaut ist", () => {
    const vorher = baum({ "quelle.svg": "stern", "erzeugt.png": "bild" });
    const nachher = baum({ "quelle.svg": "stern NEU", "erzeugt.png": "bild" });

    const a = berechne(EIN, ERG, vorher.da, vorher.lies);
    const b = berechne(EIN, ERG, nachher.da, nachher.lies);

    const raus = abweichungen(a, b);
    expect(raus).toHaveLength(1);
    expect(raus[0]).toContain("eingaben");
    expect(raus[0]).toContain("quelle.svg");
  });

  it("meldet ein von Hand geändertes ERGEBNIS", () => {
    const vorher = baum({ "quelle.svg": "stern", "erzeugt.png": "bild" });
    const nachher = baum({ "quelle.svg": "stern", "erzeugt.png": "bild VON HAND" });

    const raus = abweichungen(
      berechne(EIN, ERG, vorher.da, vorher.lies),
      berechne(EIN, ERG, nachher.da, nachher.lies),
    );
    expect(raus).toHaveLength(1);
    expect(raus[0]).toContain("ergebnisse");
  });

  // DIE Positivkontrolle. Ohne sie belegten die beiden Tests darüber nichts:
  // ein `abweichungen`, das immer etwas zurückgibt, bestünde sie ebenfalls.
  it("ist still, wenn sich nichts geändert hat", () => {
    const b = baum({ "quelle.svg": "stern", "erzeugt.png": "bild" });
    const stempel = berechne(EIN, ERG, b.da, b.lies);
    expect(abweichungen(stempel, stempel)).toEqual([]);
  });

  // Eine fehlende erzeugte Datei ist genau der Zustand, den der Wächter melden
  // soll. Würde sie übersprungen, fehlte sie auf beiden Seiten gleich — und der
  // Vergleich bliebe grün. Das ist die Falle, die eine Musterliste hätte.
  it("wirft, wenn eine erzeugte Datei fehlt, statt sie zu überspringen", () => {
    const b = baum({ "quelle.svg": "stern" });
    expect(() => berechne(EIN, ERG, b.da, b.lies)).toThrow(/erzeugt\.png/);
  });

  it("wirft, wenn eine Quelle fehlt", () => {
    const b = baum({ "erzeugt.png": "bild" });
    expect(() => berechne(EIN, ERG, b.da, b.lies)).toThrow(/quelle\.svg/);
  });

  it("ist unabhängig von der Reihenfolge der Liste", () => {
    const b = baum({ a: "1", c: "2", "erzeugt.png": "bild" });
    const eins = berechne(["a", "c"], ERG, b.da, b.lies);
    const zwei = berechne(["c", "a"], ERG, b.da, b.lies);
    expect(eins).toEqual(zwei);
  });
});

describe("Die Listen decken beide Erzeuger ab", () => {
  it("nennt die vier Quellen, aus denen erzeugt wird", () => {
    expect(EINGABEN).toContain("public/brand/compass-favicon.svg");
    expect(EINGABEN).toContain("public/images/hero-mitglieder.webp");
    // Die Schriften gehören dazu: der Schriftzug der Startfläche ist ein
    // gerastertes Bild, kein Text. Ein Schrifttausch ohne Neuerzeugung wäre
    // sonst unsichtbar.
    expect(EINGABEN.filter((p) => p.endsWith(".woff2"))).toHaveLength(2);
  });

  it("deckt Startfläche UND App-Symbole ab", () => {
    const hat = (teil: string) => ERGEBNISSE.some((p) => p.includes(teil));
    expect(hat("Splash.imageset")).toBe(true);
    expect(hat("splash_icon.xml")).toBe(true);
    expect(hat("splash-band.webp")).toBe(true);
    expect(hat("AppIcon")).toBe(true);
    expect(hat("ic_launcher")).toBe(true);
  });

  // Fünf Dichten mal drei Dateien, plus iOS. Wäre das aus `ZIELE` abgeleitete
  // Stück still leer, deckte der Stempel die Symbole gar nicht ab — und wäre
  // trotzdem grün.
  it("führt jede Android-Dichte mit ihren drei Symboldateien", () => {
    const launcher = ERGEBNISSE.filter((p) => p.includes("mipmap-"));
    expect(launcher).toHaveLength(15);
  });

  it("enthält keinen Pfad doppelt", () => {
    expect(new Set(ERGEBNISSE).size).toBe(ERGEBNISSE.length);
  });
});

describe("Die Prüfsumme ist eine echte", () => {
  it("unterscheidet zwei Inhalte", () => {
    const lies = (p: string) => Buffer.from(p);
    expect(pruefsumme("a", lies)).not.toBe(pruefsumme("b", lies));
  });

  it("ist SHA-256, also 64 Hexzeichen", () => {
    const lies = () => Buffer.from("x");
    expect(pruefsumme("a", lies)).toMatch(/^[0-9a-f]{64}$/);
  });
});
