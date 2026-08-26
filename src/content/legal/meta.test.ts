import { describe, expect, it } from "vitest";
import { rechtsseiten } from "./meta";

/**
 * Die Naht zwischen Metadaten und Volltext (AGE-497).
 *
 * Seit der Text nachgeladen wird, gibt es den Titel an zwei Stellen: in
 * `meta.ts` (fuer Footer und Routen) und im Dokument selbst (fuer die
 * Ueberschrift). Zwei Stellen koennen auseinanderlaufen — dieser Test ist der
 * Grund, warum sie es nicht tun.
 *
 * Dass dieser Test alle vier Volltexte laedt, ist unschaedlich: Tests werden
 * nicht gebuendelt. Genau deshalb gibt es keine `index.ts` mehr, die alle vier
 * eager einsammelt — die waere eine Falle fuer den Naechsten.
 */
describe("Metadaten und Volltext", () => {
  it("nennen dieselben vier Seiten", () => {
    expect(rechtsseiten.map((s) => s.slug)).toEqual(["impressum", "datenschutz", "agb", "cookies"]);
  });

  it.each(["impressum", "datenschutz", "agb", "cookies"])(
    "tragen fuer %s denselben Titel",
    async (slug) => {
      const seite = rechtsseiten.find((s) => s.slug === slug)!;
      const dokument = await seite.lade();
      expect(dokument.titel).toBe(seite.titel);
      expect(dokument.slug).toBe(seite.slug);
    },
  );

  it("haben je einen eigenen Titel", () => {
    // Sonst bestuende „alle vier Routen rendern" auch, wenn alle vier
    // dasselbe Dokument zeigen (codex, Plan-Review).
    expect(new Set(rechtsseiten.map((s) => s.titel)).size).toBe(4);
  });

  it("nennen ihre Herkunft und ihre offenen Punkte", async () => {
    for (const seite of rechtsseiten) {
      const d = await seite.lade();
      expect(d.quelle).toMatch(/\.docx/);
      if (d.provisorisch) expect(d.offenePunkte.length).toBeGreaterThan(0);
    }
  });
});
