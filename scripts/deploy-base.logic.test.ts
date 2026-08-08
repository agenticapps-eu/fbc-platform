import { describe, expect, it } from "vitest";
import { gewaehlteBasis, type Lauf } from "./deploy-base.logic";

/**
 * Diese Wahl entscheidet, WOMIT der Deploy-Job vergleicht — und damit, was er
 * ueberhaupt zu sehen bekommt (AGE-506, Aufgabe 5).
 *
 * Der Fehler, den sie abstellt, ist bereits eingetreten: Lauf 31211729060
 * (Merge 36b662a) sprang `functions` uebersprungen, weil `drift-gate` rot war.
 * Der Merge aenderte `send-activation/index.ts`. Der Folgelauf verglich
 * `HEAD^..HEAD` und sah davon nichts mehr. Auf das Ziel kam die Aenderung nur,
 * weil der naechste Merge zufaellig dieselbe Function anfasste.
 *
 * Gemessen wird das Ergebnis des `functions`-JOBS, nicht des Laufs: ein
 * uebersprungener Job macht einen Lauf nicht rot.
 */
describe("gewaehlteBasis", () => {
  const lauf = (id: number, sha: string, functions: string | null): Lauf => ({
    id,
    sha,
    functions,
  });

  it("nimmt den juengsten Lauf, in dem der functions-Job erfolgreich war", () => {
    const w = gewaehlteBasis([
      lauf(31247900892, "57032b5", "success"),
      lauf(31212202918, "c5862fd", "success"),
    ]);
    expect(w.sha).toBe("57032b5");
  });

  // ── Der Fall, der den Auftrag ausgeloest hat ─────────────────────────────
  // Ein uebersprungener Lauf ZWISCHEN zwei erfolgreichen muss den AELTEREN SHA
  // ergeben — sonst faellt der uebersprungene Merge dauerhaft aus dem Diff und
  // nichts holt ihn je nach.
  it("uebergeht einen uebersprungenen Lauf und faellt auf den aelteren Erfolg zurueck", () => {
    const w = gewaehlteBasis([
      lauf(31212202918, "c5862fd", "skipped"),
      lauf(31211729060, "36b662a", "skipped"),
      lauf(31211428349, "78a1b04", "success"),
    ]);
    expect(w.sha).toBe("78a1b04");
  });

  it("nimmt einen fehlgeschlagenen Lauf nicht als Basis", () => {
    // Fehlgeschlagen heisst: moeglicherweise nur auf DEV ausgeliefert und auf
    // PROD nicht. Was dann als ausgeliefert gilt, waere geraten.
    const w = gewaehlteBasis([
      lauf(31212202918, "c5862fd", "failure"),
      lauf(31211428349, "78a1b04", "success"),
    ]);
    expect(w.sha).toBe("78a1b04");
  });

  it("uebergeht Laeufe ohne functions-Job", () => {
    // `null` heisst: der Job stand in diesem Commit noch nicht im Workflow —
    // oder er laeuft gerade noch (der eigene Lauf). Beides ist kein Nachweis.
    const w = gewaehlteBasis([
      lauf(31212202918, "c5862fd", null),
      lauf(31211428349, "78a1b04", "success"),
    ]);
    expect(w.sha).toBe("78a1b04");
  });

  it("ohne Laeufe gibt es keine Basis", () => {
    expect(gewaehlteBasis([]).sha).toBeNull();
  });

  it("ohne einen einzigen Erfolg gibt es keine Basis", () => {
    const w = gewaehlteBasis([
      lauf(31212202918, "c5862fd", "skipped"),
      lauf(31211729060, "36b662a", "failure"),
    ]);
    expect(w.sha).toBeNull();
  });

  // ── Der Grund ist kein Beiwerk ───────────────────────────────────────────
  // Er landet im Protokoll. Eine Basis ohne genannte Herkunft ist ein Wert, den
  // hinterher niemand nachschlagen kann — und dann liest sich der Lauf
  // vollstaendig, ohne belegt zu sein.
  it("nennt die Lauf-ID, aus der die Basis stammt", () => {
    const w = gewaehlteBasis([lauf(31247900892, "57032b5", "success")]);
    expect(w.grund).toContain("31247900892");
  });

  it("sagt beim Fehlen ausdruecklich, dass kein erfolgreicher Lauf gefunden wurde", () => {
    expect(gewaehlteBasis([]).grund).toMatch(/kein/i);
  });
});
