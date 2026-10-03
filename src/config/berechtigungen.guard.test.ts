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
 * vergleicht sie Schlüssel für Schlüssel.
 *
 * Er liest absichtlich eine Datei und nicht die laufende Datenbank: der Test
 * läuft in `verify` ohne Stack. Welche Datei — und warum nicht die Migration —
 * steht am Kopf von `erwartungAusPgtap`.
 */

/**
 * Verglichen wird gegen die ERWARTUNG DES pgTAP-TESTS, nicht gegen eine
 * Migration.
 *
 * Die erste Fassung las `20261003100000_berechtigungen.sql` — also den ERSTEN
 * Seed. Das bricht genau die Zusage, um die es in diesem Change geht: „eine
 * Verschiebung ist eine Migration und keine Frontend-Änderung". Sobald eine
 * spätere, vorwärtsgerichtete Migration `update public.berechtigungen set
 * min_rank = …` fährt, verglich der Wächter gegen einen überholten Stand — rot
 * bei richtig nachgezogenem Client, grün bei falscher Stufenaussage. Befund des
 * Diff-Reviews (IMPORTANT).
 *
 * Stattdessen hängt die Kette jetzt so: die **laufende Tabelle** wird in
 * `supabase/tests/rechte_v5_test.sql` per `results_eq` gegen eine dort
 * ausgeschriebene Liste geprüft, und dieser Test prüft `BERECHTIGUNG_STUFE`
 * gegen dieselbe Liste. Verschiebt eine Migration eine Schwelle, wird der
 * pgTAP-Test rot, bis die Liste nachgezogen ist — und dann dieser Test, bis der
 * Client nachgezogen ist. Zwei rote Tests in der richtigen Reihenfolge statt
 * eines grünen über einer Lüge.
 */
const PGTAP = "supabase/tests/rechte_v5_test.sql";

/** Liest die `values ('schluessel'::text, rang)`-Liste aus dem pgTAP-Test. */
function erwartungAusPgtap(): Map<string, number> {
  const sql = readFileSync(PGTAP, "utf8");
  const start = sql.indexOf("select results_eq(");
  if (start < 0) throw new Error(`${PGTAP}: kein results_eq gefunden`);
  const block = sql.slice(start, sql.indexOf("$$,", sql.indexOf("$$ values", start)));
  const zeilen = [...block.matchAll(/\('([a-z_.]+)'::text,\s*(\d+)\)/g)];
  if (zeilen.length === 0) throw new Error(`${PGTAP}: keine values-Zeilen erkannt`);
  return new Map(zeilen.map(([, schluessel, rang]) => [schluessel, Number(rang)]));
}

describe("Berechtigungen: Client-Text gegen die pgTAP-Erwartung", () => {
  it("nennt genau die Schlüssel, die der pgTAP-Test erwartet", () => {
    const seed = erwartungAusPgtap();
    expect([...seed.keys()].sort()).toEqual([...BERECHTIGUNGEN].sort());
  });

  it("ordnet jedem Schlüssel die Stufe zu, deren Rang der pgTAP-Test erwartet", () => {
    const seed = erwartungAusPgtap();
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
