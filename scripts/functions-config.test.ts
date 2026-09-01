import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Jede Edge Function braucht einen Block in `supabase/config.toml` — sonst gilt
 * die Vorgabe `verify_jwt = true`.
 *
 * Warum das ein eigener Wächter ist und nicht Sorgfalt: es ist dieselbe Bauart
 * wie die pgTAP-Dateiliste in `ci.yml`. Eine Datei liegt auf der Platte, eine
 * Liste nennt sie nicht, und **nichts wird rot** — der Ausfall zeigt sich erst
 * in einer fremden Konsole. Bei `ci.yml` heisst er „der Test lief nie", hier
 * heisst er „das Gateway weist den Webhook mit 401 ab, bevor die Function
 * ueberhaupt laeuft".
 *
 * Gefunden am 28.08. an `send-push` (AGE-641): die Datei traegt im Kopf
 * „verify_jwt=false (siehe config.toml)", und in `config.toml` stand nichts.
 * Ein Kommentar ist keine Konfiguration.
 *
 * Deshalb liest dieser Wächter beide echten Artefakte von der Platte und
 * ueberspringt Kommentarzeilen ausdruecklich: ein auskommentierter Block darf
 * die Zusage nicht erfuellen.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = readFileSync(join(REPO, "supabase", "config.toml"), "utf8");

const functionOrdner = readdirSync(join(REPO, "supabase", "functions"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

/** Blocküberschriften, die wirklich gelten — auskommentierte zählen nicht. */
function deklarierteFunctions(toml: string): string[] {
  return toml
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => !z.startsWith("#"))
    .map((z) => /^\[functions\.([^\]]+)\]$/.exec(z)?.[1])
    .filter((n): n is string => Boolean(n))
    .sort();
}

/** `verify_jwt` des Blocks, oder `undefined`, wenn er nichts dazu sagt. */
function verifyJwt(toml: string, name: string): boolean | undefined {
  const zeilen = toml.split("\n").map((z) => z.trim());
  const start = zeilen.indexOf(`[functions.${name}]`);
  if (start === -1) return undefined;
  for (const z of zeilen.slice(start + 1)) {
    if (z.startsWith("[")) break;
    if (z.startsWith("#")) continue;
    const m = /^verify_jwt\s*=\s*(true|false)$/.exec(z);
    if (m) return m[1] === "true";
  }
  return undefined;
}

describe("supabase/config.toml", () => {
  it("kennt jede Function, die auf der Platte liegt", () => {
    // Positivkontrolle: ohne Ordner belegt der Vergleich nichts.
    expect(functionOrdner.length).toBeGreaterThan(0);

    expect(deklarierteFunctions(CONFIG)).toEqual(functionOrdner);
  });

  it("schaltet die JWT-Pruefung fuer `send-push` ab — ein DB-Webhook traegt keines", () => {
    // Ohne diese Zeile weist das Gateway den Webhook mit 401 ab, und zwar
    // BEVOR die Pruefung des gemeinsamen Geheimnisses im Handler laeuft. Der
    // Schutz ist dann nicht schwaecher, sondern die Function unerreichbar.
    expect(verifyJwt(CONFIG, "send-push")).toBe(false);
  });

  it.each(["ota-update", "ota-channel", "ota-stats"])(
    "schaltet die JWT-Pruefung fuer `%s` ab — eine native Schale traegt keines",
    (name) => {
      // Dieselbe Bauart wie bei `send-push`, aber der Ausfall sieht anders aus:
      // dort haengt ein DB-Webhook, hier haengt jedes ausgelieferte Geraet. Mit
      // `verify_jwt = true` antwortet das Gateway mit 401, bevor der Handler
      // laeuft — und der Luftweg steht still, ohne dass eine Zeile in einem
      // unserer Logs davon erzaehlt.
      expect(verifyJwt(CONFIG, name)).toBe(false);
    },
  );

  it("zaehlt einen auskommentierten Block NICHT als Deklaration", () => {
    // Die Gegenprobe zum Wächter selbst: eine Zusage, die ein Kommentar
    // erfuellt, misst den Kommentar und nicht die Konfiguration.
    expect(deklarierteFunctions("# [functions.gibt-es-nicht]\n[functions.echt]\n")).toEqual([
      "echt",
    ]);
  });
});
