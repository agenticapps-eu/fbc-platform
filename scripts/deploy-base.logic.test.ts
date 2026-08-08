import { describe, expect, it } from "vitest";
import { gewaehlteBasis, type Lauf } from "./deploy-base.logic";

/**
 * Diese Wahl entscheidet, WOMIT der Deploy-Job vergleicht — und damit, was er
 * ueberhaupt zu sehen bekommt (AGE-506, Aufgabe 5).
 *
 * Der Fehler, den sie abstellt, ist bereits eingetreten: Lauf 31211729060
 * (Merge 36b662a) uebersprang den `functions`-Job, weil `drift-gate` rot war.
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

  // ── Die Reihenfolge wird hergestellt, nicht vorausgesetzt ────────────────
  // „Neuester zuerst" hing bisher an einer Sortier-Vorgabe der API, die
  // nirgends zugesichert ist und die ein `&sort=` im Aufruf still umdreht.
  // Dann waere das Ergebnis exakt invertiert — die AELTESTE Basis gaelte als
  // die juengste, und der Diff verloere alles dazwischen.
  it("stellt die Reihenfolge selbst her, statt sie vorauszusetzen", () => {
    const w = gewaehlteBasis([
      lauf(31211428349, "78a1b047", "success"),
      lauf(31247900892, "57032b5", "success"),
      lauf(31212202918, "c5862fdc", "success"),
    ]);
    expect(w.sha).toBe("57032b5");
  });

  // ── Ein Erfolg ohne brauchbaren SHA ist kein Erfolg ──────────────────────
  // `--jq '{id, sha: .head_sha}'` reicht durch, was die API gab. Faellt der
  // Wert leer aus, meldete die Wahl bisher `sha: null` MIT dem Grund
  // „zuletzt erfolgreich ausgeliefert in Lauf X" — eine Basis, die es nicht
  // gibt, mit einer Herkunft, die Erfolg behauptet.
  it("uebergeht einen Erfolg ohne brauchbaren SHA", () => {
    const w = gewaehlteBasis([
      lauf(31247900892, "", "success"),
      lauf(31211428349, "78a1b047", "success"),
    ]);
    expect(w.sha).toBe("78a1b047");
  });

  it("uebergeht einen SHA, der kein Hex ist", () => {
    const w = gewaehlteBasis([
      lauf(31247900892, "HEAD; rm -rf /", "success"),
      lauf(31211428349, "78a1b047", "success"),
    ]);
    expect(w.sha).toBe("78a1b047");
  });

  // ── Der Grund ist kein Beiwerk ───────────────────────────────────────────
  // Er landet im Protokoll. Eine Basis ohne genannte Herkunft ist ein Wert, den
  // hinterher niemand nachschlagen kann — und dann liest sich der Lauf
  // vollstaendig, ohne belegt zu sein.
  it("nennt die Lauf-ID, aus der die Basis stammt", () => {
    const w = gewaehlteBasis([lauf(31247900892, "57032b5", "success")]);
    expect(w.grund).toContain("31247900892");
  });

  // SHA und Grund muessen ZUSAMMEN stimmen. Getrennt geprueft liesse eine
  // Fassung durch, die den richtigen SHA nennt und die falsche Lauf-ID dazu.
  it("nennt bei mehreren Erfolgen den SHA und die ID DESSELBEN Laufs", () => {
    const w = gewaehlteBasis([
      lauf(31247900892, "57032b5", "success"),
      lauf(31211428349, "78a1b047", "success"),
    ]);
    expect(w).toEqual({ sha: "57032b5", grund: expect.stringContaining("31247900892") });
    expect(w.grund).not.toContain("31211428349");
  });

  // ── „Kein Erfolg" hat zwei sehr verschiedene Ursachen ────────────────────
  // Ein zu kurzes Fenster ist ein Historienzustand. Ein Job, der ueberall
  // fehlt, ist ein kaputter Selektor — etwa weil der Job umbenannt wurde oder
  // eine `strategy.matrix` bekam. Beides als dieselbe Meldung auszugeben
  // hiesse, den Dauerschaden wie ein Rauschen aussehen zu lassen.
  it('nennt die Fenstergroesse, statt „in der Historie" zu behaupten', () => {
    const w = gewaehlteBasis([
      lauf(31212202918, "c5862fdc", "skipped"),
      lauf(31211729060, "36b662ac", "failure"),
    ]);
    expect(w.grund).toContain("2");
  });

  it("unterscheidet einen kaputten Selektor von einem zu kurzen Fenster", () => {
    const ohneJob = gewaehlteBasis([
      lauf(31212202918, "c5862fdc", null),
      lauf(31211729060, "36b662ac", null),
    ]);
    expect(ohneJob.sha).toBeNull();
    expect(ohneJob.grund).toMatch(/functions-Job/);
    expect(ohneJob.grund).not.toEqual(
      gewaehlteBasis([lauf(31212202918, "c5862fdc", "skipped")]).grund,
    );
  });

  it("sagt beim Fehlen ausdruecklich, dass kein erfolgreicher Lauf gefunden wurde", () => {
    expect(gewaehlteBasis([]).grund).toMatch(/kein/i);
  });
});
