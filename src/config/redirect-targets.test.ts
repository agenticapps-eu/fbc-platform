import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * „Kein gerenderter Link zeigt auf eine Route, die nur umleitet" (AGE-494).
 *
 * Der Anlass ist real und wiederholt sich: AGE-450 nahm `/meine-chancen` aus dem
 * Menü und legte einen Redirect darüber — der `CardLink` im Matching-Widget blieb
 * aber stehen und führte wochenlang ins Nichts. Dieser Change hätte denselben
 * Fehler mit `/compass` und `/mein-bereich` gleich viermal wiederholt.
 *
 * Der Test liest den Quelltext statt den gerenderten Baum: ein Redirect-Ziel ist
 * eine statische Zeichenkette, und ein toter Link soll auffallen, ohne dass
 * jemand erst die passende Seite mit der passenden Stufe rendern muss.
 */

/** Routen, die in App.tsx ausschließlich per <Navigate> beantwortet werden. */
const NUR_REDIRECT = [
  "/compass",
  "/mein-bereich",
  "/meine-chancen",
  "/matching",
  "/community",
  "/verzeichnis",
  "/angebote-gesuche",
];

/** Dateien, die absichtlich auf diese Pfade verweisen: die Redirects selbst. */
const ERLAUBT = new Set(["src/App.tsx"]);

function quelldateien(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      // src/vision/ ist eingefrorener Entwurf und wird von nirgends importiert
      // (siehe App.test.tsx) — seine Links rendern nie.
      if (name === "vision" || name === "test") continue;
      quelldateien(pfad, acc);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      acc.push(pfad);
    }
  }
  return acc;
}

describe("Tote Links (AGE-494)", () => {
  it.each(NUR_REDIRECT)("keine Navigation zeigt auf %s", (route) => {
    // `to="/x"` (Link, NavLink, CardLink, Navigate) und `navigate("/x")`.
    const muster = new RegExp(`(to=["']${route}["']|navigate\\(["']${route}["'])`);

    const treffer = quelldateien("src")
      .filter((f) => !ERLAUBT.has(f))
      .filter((f) => muster.test(readFileSync(f, "utf8")));

    expect(treffer).toEqual([]);
  });
});
