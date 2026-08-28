import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Jede pgTAP-Suite auf der Platte muss in der Dateiliste von `ci.yml` stehen —
 * sonst läuft sie **nie**.
 *
 * `supabase test db` bekommt die Dateien einzeln genannt und nicht das
 * Verzeichnis, und zwar mit Grund: die `probe_*.sql` daneben sind manuelle
 * `begin`/`rollback`-Skripte ohne `plan()`/`finish()`, an denen `pg_prove`
 * scheitern würde. Der Preis dafür ist eine von Hand gepflegte Liste, und die
 * ist in diesem Repo schon dreimal auseinandergelaufen:
 *
 *   * 23.08. → 24.08.: `member_lifecycle_test.sql` und
 *     `member_lifecycle_rpc_test.sql` lagen einen Tag lang als vollwertiges
 *     pgTAP im Repo (zusammen 46k) und liefen kein einziges Mal.
 *   * 28.08.: `display_name_test.sql` — 14 Zusagen, seit dem **26.08.** auf der
 *     Platte (Commit `27b06e8`), in keinem Lauf. Gefunden bei einer
 *     Handzählung, nicht von CI.
 *
 * Der Absatz in `ci.yml` warnt seit dem **05.08.** ausdrücklich davor (Commit
 * `b2def2f`, AGE-494: „Wer hier einen Test ergänzt, muss ihn auch in diese
 * Zeile eintragen") — und beide Fälle traten danach ein, der erste nach 18
 * Tagen, der zweite nach 23. Eine Warnung ist kein Wächter.
 *
 * Dies ist dieselbe Bauart wie `functions-config.test.ts`: eine Datei liegt da,
 * eine Liste nennt sie nicht, und **nichts wird rot**. Der Ausfall ist von
 * „alles grün" nicht zu unterscheiden, weil er sich als Abwesenheit zeigt.
 *
 * Die Zusage geht in BEIDE Richtungen. Ein Name in `ci.yml` ohne Datei
 * dahinter lässt `supabase test db` scheitern — laut, aber erst in CI.
 *
 * ── WIE DER PARSER AUSFÄLLT ─────────────────────────────────────────────────
 * Zwei fremde Reviewer haben ihn am 28.08. gegen Umformatierungen gemessen:
 * einzeiliger `run:`, `\`-Fortsetzung, YAML-Liste, Kommentar mitten im Block,
 * ein zweiter `supabase test db`-Aufruf weiter vorne, Bindestrich im Namen.
 * In **keinem** dieser Fälle wurde er fälschlich grün; er wirft oder liefert
 * eine zu kurze Liste, und der Vergleich mit dem Verzeichnis schlägt fehl.
 * Das ist die Ausfallrichtung, die dieser Wächter braucht — nur sagt die
 * Meldung dann nicht, WARUM. Wer ihn rot sieht, ohne eine Datei ergänzt zu
 * haben, hat die Schreibweise des Blocks verändert.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CI = readFileSync(join(REPO, ".github", "workflows", "ci.yml"), "utf8");

/**
 * Die `*_test.sql` auf der Platte.
 *
 * `probe_*.sql` sind kein pgTAP und zählen nicht — und das ist hier eine
 * ZUSAGE an die Benennung, keine Beobachtung: was nicht laufen soll, heisst
 * nie `*_test.sql`. Hiesse es doch so, zwänge dieser Wächter es in die Liste
 * und `pg_prove` fiele darüber — laut, nicht blind.
 */
function aufDerPlatte(): string[] {
  return readdirSync(join(REPO, "supabase", "tests"))
    .filter((n) => n.endsWith("_test.sql"))
    .sort();
}

/**
 * Die Dateien, die der `supabase test db`-Schritt wirklich nennt.
 *
 * Bewusst nur aus DIESEM Block gelesen und nicht aus der ganzen Datei: ein
 * Dateiname in einem Kommentar daneben ist keine Ausführung.
 *
 * Der Block endet an der ersten Zeile, die keine Fortsetzung mehr ist — und
 * das gilt AUCH für einen Kommentar mitten drin. Dort abzubrechen ist Absicht:
 * die Alternative wäre, Kommentarzeilen zu überspringen, und dann zählte eine
 * auskommentierte Datei je nach Schreibweise doch. Lieber eine zu kurze Liste,
 * die den Vergleich rot macht, als eine zu lange, die grün lügt.
 */
function inCiGenannt(yaml: string): string[] {
  const zeilen = yaml.split("\n");
  const start = zeilen.findIndex((z) => z.trim() === "supabase test db");
  if (start === -1) throw new Error("`supabase test db` steht nicht in ci.yml");
  const genannt: string[] = [];
  for (const zeile of zeilen.slice(start + 1)) {
    // Bindestriche und Punkte sind erlaubt, obwohl heute keine Datei sie trägt:
    // ein Name, den der Ausdruck nicht kennt, bricht die Schleife ab und macht
    // den Wächter rot, ohne zu sagen warum.
    const treffer = /^\s+supabase\/tests\/([A-Za-z0-9_.-]+\.sql)\s*$/.exec(zeile);
    if (treffer === null) break;
    genannt.push(treffer[1]);
  }
  return genannt.sort();
}

describe("pgTAP-Dateiliste in ci.yml", () => {
  // Ohne Dateien belegt der Vergleich nichts — `[]` gleicht `[]`. Dieselbe
  // Gegenprobe steht im Schwester-Wächter `functions-config.test.ts`.
  it("misst überhaupt etwas", () => {
    expect(aufDerPlatte().length).toBeGreaterThan(0);
    expect(inCiGenannt(CI).length).toBeGreaterThan(0);
  });

  it("nennt jede Suite, die auf der Platte liegt", () => {
    expect(inCiGenannt(CI)).toEqual(aufDerPlatte());
  });

  it("nennt keine Datei doppelt", () => {
    const genannt = inCiGenannt(CI);
    expect(genannt).toEqual([...new Set(genannt)]);
  });

  /**
   * Der gefährliche Ort für einen auskommentierten Namen ist MITTEN in der
   * Liste, nicht davor: vor dem Anker liest der Parser ohnehin nicht, dort
   * bliebe auch ein viel dümmerer Parser grün. Beide Diff-Reviewer haben
   * unabhängig darauf gezeigt.
   */
  it("zählt einen auskommentierten Namen MITTEN im Block nicht mit", () => {
    const anker = "          supabase/tests/rls_test.sql\n";
    const mitKommentar = CI.replace(
      anker,
      `${anker}          # supabase/tests/erfunden_test.sql\n`,
    );
    expect(mitKommentar).not.toBe(CI);
    expect(inCiGenannt(mitKommentar)).not.toContain("erfunden_test.sql");
  });

  it("bricht an dieser Kommentarzeile ab — und macht den Vergleich damit rot", () => {
    const anker = "          supabase/tests/rls_test.sql\n";
    const mitKommentar = CI.replace(
      anker,
      `${anker}          # supabase/tests/erfunden_test.sql\n`,
    );
    // Die Zusage ist nicht „er überspringt den Kommentar", sondern „er hört
    // dort auf". Beides schliesst den erfundenen Namen aus; nur das zweite
    // stimmt, und ein Test, der das Falsche zusichert, verspricht eine Stärke,
    // die der Parser nicht hat.
    expect(inCiGenannt(mitKommentar)).not.toEqual(aufDerPlatte());
    expect(inCiGenannt(mitKommentar).length).toBeLessThan(aufDerPlatte().length);
  });
});
