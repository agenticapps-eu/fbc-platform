import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EVENT_TYPE_OPTIONS } from "./events";

/**
 * Die Art-Facette bietet eine FESTE Liste an (Entscheidung Donald, 31.08.), und
 * diese Liste ist genau der CHECK-Constraint aus dem Schema.
 *
 * Warum fest und nicht aus dem Bestand abgeleitet: auf der Produktion steht
 * heute ein einziges künftiges Event mit einem einzigen `type`. Eine abgeleitete
 * Facette böte dort eine Auswahl mit einem Eintrag — was keine Auswahl ist.
 *
 * Der Einwand gegen feste Listen ist, dass sie auslaufen. Genau davor steht
 * dieser Test: migriert jemand einen sechsten Typ, laufen Liste und Constraint
 * auseinander und der Lauf wird rot. Ohne ihn böte die Facette den neuen Typ
 * stillschweigend nie an, und niemand fiele es auf, bis ein Event unauffindbar
 * wäre.
 *
 * Er ist beim Schreiben GRÜN — das ist kein Versehen. Er sichert einen Zustand,
 * der heute stimmt, gegen eine Änderung, die morgen kommt; ein RED gäbe es nur,
 * wenn man ihn erst nach dem Auseinanderlaufen schriebe, und dann wäre es zu
 * spät.
 */
const MIGRATIONEN = "supabase/migrations";

/**
 * Alle Stellen, an denen das Schema die erlaubten Event-Arten festlegt.
 *
 * Bewusst über ALLE Migrationen und nicht über die eine bekannte Datei: eine
 * spätere Migration darf den Constraint ersetzen, und dann muss dieser Test sie
 * sehen. Findet er mehr als eine, ist das kein Fehler dieses Tests, sondern die
 * Aufforderung, nachzusehen, welche gilt — deshalb schlägt er dann fehl statt
 * stillschweigend die erste zu nehmen.
 */
function arterlaubnisseAusMigrationen(): string[][] {
  const treffer: string[][] = [];
  for (const name of readdirSync(MIGRATIONEN).sort()) {
    if (!name.endsWith(".sql")) continue;
    const quelle = readFileSync(join(MIGRATIONEN, name), "utf8");
    for (const m of quelle.matchAll(/type\s+text\s+check\s*\(\s*type\s+in\s*\(([^)]+)\)/gi)) {
      treffer.push([...m[1].matchAll(/'([^']+)'/g)].map((w) => w[1]));
    }
  }
  return treffer;
}

describe("Die Art-Facette kennt genau die Werte des Schemas", () => {
  it("findet genau eine Constraint-Definition", () => {
    const gefunden = arterlaubnisseAusMigrationen();
    expect(
      gefunden.length,
      "Mehr als eine Definition heisst: nachsehen, welche gilt, und diesen Test nachziehen.",
    ).toBe(1);
  });

  it("bietet genau die erlaubten Arten zur Auswahl an", () => {
    const [ausSchema] = arterlaubnisseAusMigrationen();
    // Sortiert verglichen: die Reihenfolge in der Facette ist eine
    // Gestaltungsfrage, die Menge ist die Zusage.
    expect([...EVENT_TYPE_OPTIONS.map((o) => o.value)].sort()).toEqual([...ausSchema].sort());
  });

  it("gibt jeder Art eine Beschriftung, die nicht ihr Schlüssel ist", () => {
    // Sonst stünde „presence" in der Facette. Die Falle ist real: `TYPE_LABELS`
    // fällt bei einem unbekannten Schlüssel auf den Schlüssel selbst zurück,
    // und das sähe wie eine Beschriftung aus.
    for (const o of EVENT_TYPE_OPTIONS) {
      expect(o.label, `Art ${o.value} ohne eigene Beschriftung`).not.toBe(o.value);
    }
  });
});
