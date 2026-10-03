import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BERECHTIGUNGEN, BERECHTIGUNG_STUFE, type Berechtigung } from "./berechtigungen";
import { LEVEL_RANK } from "./levels";

/**
 * Wächter gegen Drift zwischen der Konfiguration in der Datenbank und der
 * Textquelle im Client (AGE-1000).
 *
 * `BERECHTIGUNG_STUFE` ist eine Kopie der Mindestränge aus
 * `berechtigungen`. Sie entscheidet nichts — aber sie SAGT etwas („ab IMPACT"),
 * und eine falsche Aussage über eine Stufe ist schlimmer als keine. Dieser Test
 * liest den Seed der Migration und vergleicht Schlüssel für Schlüssel.
 *
 * Er liest absichtlich die MIGRATION und nicht die laufende Datenbank: der Test
 * läuft in `verify` ohne Stack, und der Seed ist die Quelle, aus der die
 * laufende Datenbank entstanden ist. Dass die Datenbank ihm entspricht, belegt
 * `supabase/tests/rechte_v5_test.sql` mit einem `results_eq` über die ganze
 * Tabelle.
 */

const MIGRATION = "supabase/migrations/20261003100000_berechtigungen.sql";

/** Liest die Seed-Zeilen `('schluessel', rang, '…')` aus der Migration. */
function seedAusMigration(): Map<string, number> {
  const sql = readFileSync(MIGRATION, "utf8");
  const insert = sql.slice(sql.indexOf("insert into public.berechtigungen"));
  const zeilen = [...insert.matchAll(/\('([a-z_.]+)',\s*(\d+),/g)];
  return new Map(zeilen.map(([, schluessel, rang]) => [schluessel, Number(rang)]));
}

describe("Berechtigungen: Client-Text gegen DB-Seed", () => {
  it("nennt genau die Schlüssel, die die Migration anlegt", () => {
    const seed = seedAusMigration();
    expect([...seed.keys()].sort()).toEqual([...BERECHTIGUNGEN].sort());
  });

  it("ordnet jedem Schlüssel die Stufe zu, deren Rang die Migration setzt", () => {
    const seed = seedAusMigration();
    for (const schluessel of BERECHTIGUNGEN) {
      const stufe = BERECHTIGUNG_STUFE[schluessel];
      expect(LEVEL_RANK[stufe], `${schluessel} → ${stufe}`).toBe(seed.get(schluessel));
    }
  });

  it("führt kein Recht auf oder unterhalb der Clubschwelle", () => {
    // Die Gegenprobe zum Check-Constraint in der Migration, auf der Client-Seite:
    // ein Recht mit Rang 4 wäre eine zweite Kopie der Türzahl.
    for (const schluessel of BERECHTIGUNGEN) {
      expect(LEVEL_RANK[BERECHTIGUNG_STUFE[schluessel]]).toBeGreaterThan(4);
    }
  });

  it("deckt den Record vollständig ab — kein Schlüssel ohne Stufe", () => {
    // `Record<Berechtigung, …>` erzwingt das schon beim Typcheck; dieser Fall
    // fängt den Weg über ein `as`-Cast oder einen späteren Index-Typ ab.
    const fehlend = BERECHTIGUNGEN.filter((k: Berechtigung) => !BERECHTIGUNG_STUFE[k]);
    expect(fehlend).toEqual([]);
  });
});
