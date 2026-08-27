import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { eintraegeAusArchiv } from "./generate-release-entries";
import { RELEASE_EINTRAEGE } from "../src/content/release-entries.generated";

/**
 * Der Wächter über das ERZEUGTE Modul (AGE-631, Band 1).
 *
 * Zwei verschiedene Zusagen, und die zweite ist die wichtigere:
 *
 * 1. Der Erzeuger kommt mit dem **echten** Archiv zurecht — nicht mit
 *    erfundenen Verzeichnissen. Genau dort sitzen die Rückfälle: 21 von 50
 *    Proposals haben keine Titelzeile, 19 keine Linear-Zeile (gemessen 27.08.).
 *
 * 2. Das **eingecheckte** Modul passt zum Archiv. Ohne diese Zusage driftet es
 *    still: jemand archiviert einen Change, vergisst den Erzeuger, und die
 *    Admin-Fläche zeigt Altes — eine kürzere Liste sieht aus wie eine
 *    vollständige.
 */

const ARCHIVE = readdirSync("openspec/changes/archive", { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

describe("Der Erzeuger gegen das echte Archiv", () => {
  it("liefert für JEDES Archivverzeichnis genau einen Eintrag", () => {
    const eintraege = eintraegeAusArchiv();
    expect(eintraege).toHaveLength(ARCHIVE.length);
    expect([...eintraege.map((e) => e.slug)].sort()).toEqual([...ARCHIVE].sort());
  });

  it("lässt keinen Eintrag ohne Titel und ohne Datum zurück", () => {
    for (const e of eintraegeAusArchiv()) {
      expect(e.titel, e.slug).not.toBe("");
      expect(e.datum, e.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("misst den Rückfall an der Wirklichkeit, nicht an einer Erfindung", () => {
    // Die Zahl steht hier NICHT als Erwartung — sie bewegt sich mit jedem neuen
    // Archiv. Die Zusage lautet: es GIBT Proposals ohne Titelzeile, und für die
    // trägt der Eintrag den Verzeichnisnamen. Wäre die Zahl irgendwann null,
    // prüfte dieser Test nichts mehr, und genau das fängt die Assertion.
    const ohneTitelzeile = ARCHIVE.filter((slug) => {
      try {
        return !/^# /.test(readFileSync(`openspec/changes/archive/${slug}/proposal.md`, "utf8"));
      } catch {
        return true;
      }
    });
    expect(ohneTitelzeile.length).toBeGreaterThan(0);

    const eintraege = eintraegeAusArchiv();
    for (const slug of ohneTitelzeile) {
      const e = eintraege.find((x) => x.slug === slug)!;
      expect(e.titel, slug).toBe(slug.replace(/^\d{4}-\d{2}-\d{2}-/, ""));
    }
  });
});

describe("Das eingecheckte Modul passt zum Archiv", () => {
  it("ist inhaltlich nicht gegenüber dem Archiv veraltet", () => {
    // Verglichen wird der INHALT, nicht der Dateitext. Die erste Fassung
    // verglich die erzeugte Zeichenkette mit der eingecheckten Datei — und
    // wurde rot, sobald Prettier die Datei anfasste, obwohl nichts veraltet
    // war. Ein Wächter, der Fehlalarm gibt, wird weggeklickt, und dann fängt
    // er auch den echten Fall nicht mehr.
    expect(
      RELEASE_EINTRAEGE,
      "src/content/release-entries.generated.ts ist veraltet — `pnpm release:entries` ausführen",
    ).toEqual(eintraegeAusArchiv());
  });

  it("deckt dieselben Slugs ab wie das Archiv", () => {
    // Positivkontrolle zum Vergleich oben: fiele der Erzeuger komplett aus und
    // lieferte eine leere Liste, wäre der Vergleich oben trivial erfüllt,
    // sobald auch das Modul leer wäre. Diese Zusage hängt am Archiv selbst.
    expect([...RELEASE_EINTRAEGE.map((e) => e.slug)].sort()).toEqual([...ARCHIVE].sort());
    expect(RELEASE_EINTRAEGE.length).toBeGreaterThan(0);
  });
});
