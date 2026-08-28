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
 *   * 28.08.: `display_name_test.sql` — 14 Zusagen, seit dem 27.08. auf der
 *     Platte, in keinem Lauf. Gefunden bei einer Handzählung, nicht von CI.
 *
 * Der Absatz in `ci.yml` warnt seit dem 24.08. ausdrücklich davor („Wer hier
 * einen Test ergänzt, muss ihn auch in diese Zeile eintragen") — und der
 * dritte Fall trat trotzdem ein. Eine Warnung ist kein Wächter.
 *
 * Dies ist dieselbe Bauart wie `functions-config.test.ts`: eine Datei liegt da,
 * eine Liste nennt sie nicht, und **nichts wird rot**. Der Ausfall ist von
 * „alles grün" nicht zu unterscheiden, weil er sich als Abwesenheit zeigt.
 *
 * Die Zusage geht in BEIDE Richtungen. Ein Name in `ci.yml` ohne Datei
 * dahinter lässt `supabase test db` scheitern — laut, aber erst in CI.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CI = readFileSync(join(REPO, ".github", "workflows", "ci.yml"), "utf8");

/** Die `*_test.sql` auf der Platte. `probe_*.sql` sind kein pgTAP und zählen nicht. */
function aufDerPlatte(): string[] {
  return readdirSync(join(REPO, "supabase", "tests"))
    .filter((n) => n.endsWith("_test.sql"))
    .sort();
}

/**
 * Die Dateien, die der `supabase test db`-Schritt wirklich nennt.
 *
 * Bewusst nur aus DIESEM Block gelesen und nicht aus der ganzen Datei: ein
 * Dateiname in einem Kommentar daneben ist keine Ausführung. Der Block endet
 * an der ersten Zeile, die keine Fortsetzung mehr ist.
 */
function inCiGenannt(yaml: string): string[] {
  const zeilen = yaml.split("\n");
  const start = zeilen.findIndex((z) => z.trim() === "supabase test db");
  if (start === -1) throw new Error("`supabase test db` steht nicht in ci.yml");
  const genannt: string[] = [];
  for (const zeile of zeilen.slice(start + 1)) {
    const treffer = /^\s+supabase\/tests\/([A-Za-z0-9_]+\.sql)\s*$/.exec(zeile);
    if (treffer === null) break;
    genannt.push(treffer[1]);
  }
  return genannt.sort();
}

describe("pgTAP-Dateiliste in ci.yml", () => {
  it("nennt jede Suite, die auf der Platte liegt", () => {
    expect(inCiGenannt(CI)).toEqual(aufDerPlatte());
  });

  it("nennt keine Datei doppelt", () => {
    const genannt = inCiGenannt(CI);
    expect(genannt).toEqual([...new Set(genannt)]);
  });

  it("liest den Block wirklich — ein Name in einem Kommentar zählt nicht", () => {
    const mitKommentar = CI.replace(
      "          supabase test db\n",
      "          # supabase/tests/erfunden_test.sql\n          supabase test db\n",
    );
    expect(mitKommentar).not.toBe(CI);
    expect(inCiGenannt(mitKommentar)).not.toContain("erfunden_test.sql");
  });
});
