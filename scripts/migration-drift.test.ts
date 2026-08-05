import { describe, expect, it } from "vitest";

import { findeDrift, leseMigrationsliste } from "./migration-drift.logic";

/**
 * Der Parser des Drift-Gates (AGE-496 / AGE-257).
 *
 * Warum das hier steht: am 2026-08-05 hat die Supabase-CLI zwischen 2.107.0
 * und 2.111.0 ihr Ausgabeformat von einer ASCII-Tabelle auf JSON umgestellt.
 * Der damalige `sed`-Parser fand danach **keine einzige Zeile** — und hätte
 * ohne die Kreuzprobe gegen die Dateien im Repo „keine Abweichung" gemeldet,
 * während auf PROD null von 40 Migrationen angewendet waren.
 *
 * Genau deshalb gilt hier: **Was nicht sicher gelesen werden kann, ist ein
 * Fehler, kein leeres Ergebnis.**
 */

const zeile = (local: string, remote: string) => ({ local, remote, time: "2026-06-11 11:56:55" });
const ausgabe = (m: Array<{ local: string; remote: string; time: string }>) =>
  JSON.stringify({ migrations: m, message: "Migrations listed" });

describe("leseMigrationsliste", () => {
  it("liest die Einträge aus der JSON-Ausgabe der CLI", () => {
    const roh = ausgabe([zeile("20260611115655", "20260611115655"), zeile("20260612065636", "")]);

    expect(leseMigrationsliste(roh)).toEqual([
      { local: "20260611115655", remote: "20260611115655" },
      { local: "20260612065636", remote: "" },
    ]);
  });

  it("überspringt Vorspann, den die CLI vor das JSON schreibt", () => {
    const roh = `Connecting to remote database...\n${ausgabe([zeile("20260611115655", "20260611115655")])}`;

    expect(leseMigrationsliste(roh)).toHaveLength(1);
  });

  it("wirft, wenn die Ausgabe kein JSON ist — das ist der Formatwechsel von 2026-08-05", () => {
    const tabelle = [
      "   Local          | Remote         | Time (UTC)          ",
      "  ----------------|----------------|---------------------",
      "   20260611115655 | 20260611115655 | 2026-06-11 11:56:55 ",
    ].join("\n");

    expect(() => leseMigrationsliste(tabelle)).toThrow();
  });

  it("wirft, wenn das JSON kein migrations-Feld trägt", () => {
    expect(() => leseMigrationsliste('{"message":"nichts"}')).toThrow();
  });
});

describe("findeDrift", () => {
  it("meldet keine Abweichung, wenn jede Migration beidseitig steht", () => {
    const eintraege = [
      { local: "20260611115655", remote: "20260611115655" },
      { local: "20260612065636", remote: "20260612065636" },
    ];

    expect(findeDrift(eintraege, 2)).toEqual([]);
  });

  it("meldet lokal vorhandene, auf dem Ziel fehlende Migrationen", () => {
    const drift = findeDrift([{ local: "20260612065636", remote: "" }], 1);

    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ art: "lokal-nur", version: "20260612065636" });
  });

  it("meldet auf dem Ziel vorhandene, lokal fehlende Migrationen", () => {
    const drift = findeDrift([{ local: "", remote: "20260612065636" }], 0);

    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ art: "remote-nur", version: "20260612065636" });
  });

  it("meldet abweichende Zuordnung als Reihenfolge-Drift", () => {
    const drift = findeDrift([{ local: "20260611115655", remote: "20260612065636" }], 1);

    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ art: "reihenfolge" });
  });

  it("wirft, wenn weniger lokale Einträge gelesen wurden als Dateien im Repo liegen", () => {
    // Die Kreuzprobe. Sie ist der Grund, warum der Formatwechsel auffiel statt
    // durchzurutschen: ein Parser, der die Hälfte liest, meldet sonst die
    // halbe Wahrheit als ganze.
    expect(() => findeDrift([{ local: "20260611115655", remote: "20260611115655" }], 40)).toThrow();
  });

  it("wirft bei leerer Liste, obwohl Dateien im Repo liegen", () => {
    expect(() => findeDrift([], 40)).toThrow();
  });
});
