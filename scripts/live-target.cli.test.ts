import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

/**
 * Prüft den VERTRAG, auf dem `.github/workflows/deploy.yml` aufsetzt: STDOUT
 * trägt genau zwei Zeilen (Umgebung, Ref), alles Erklärende geht nach STDERR.
 *
 * Warum als eigener Test und nicht über `live-target.logic.ts`: die reine
 * Funktion kann diesen Vertrag nicht brechen — ein verrutschtes
 * `console.error` → `console.log` in `live-target.ts` schon, und dann liefe der
 * Workflow auf `ref = "Der ausgelieferte Build …"` und schriebe das in die
 * Zusammenfassung, auf die im Vorfall jemand schaut.
 */
const HIER = dirname(fileURLToPath(import.meta.url));
const SKRIPT = join(HIER, "live-target.ts");

function lauf(env: Record<string, string>) {
  const kind = execFileSync("pnpm", ["exec", "tsx", SKRIPT], {
    cwd: join(HIER, ".."),
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return kind;
}

describe("live-target.ts — Vertrag mit dem Workflow", () => {
  test("STDOUT trägt genau zwei Zeilen: Umgebung, dann Ref", () => {
    const stdout = lauf({ VITE_SUPABASE_URL: "https://foelowldexkcqzewvrcf.supabase.co" });
    const zeilen = stdout.split("\n").filter((z) => z !== "");

    expect(zeilen).toEqual(["dev", "foelowldexkcqzewvrcf"]);
  });

  test("die Erklärung steht auf STDERR, nicht auf STDOUT", () => {
    const stdout = lauf({ VITE_SUPABASE_URL: "https://foelowldexkcqzewvrcf.supabase.co" });

    expect(stdout).not.toContain("Build");
    expect(stdout).not.toContain("spricht");
  });

  test("die URL selbst erscheint nirgends in der Ausgabe", () => {
    const stdout = lauf({ VITE_SUPABASE_URL: "https://foelowldexkcqzewvrcf.supabase.co" });

    expect(stdout).not.toContain("https://");
  });

  test("ein unbekanntes Projekt beendet das Skript mit Fehlercode", () => {
    expect(() => lauf({ VITE_SUPABASE_URL: "https://zzzzyyyyxxxxwwwwvvvv.supabase.co" })).toThrow();
  });

  test("fehlende URL beendet das Skript mit Fehlercode", () => {
    expect(() => lauf({ VITE_SUPABASE_URL: "" })).toThrow();
  });
});
