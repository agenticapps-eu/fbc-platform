#!/usr/bin/env tsx
/**
 * Wächter gegen native Geheimnisse im öffentlichen Repo (AGE-642 B2).
 *
 *   pnpm exec tsx scripts/native-secrets-guard.ts
 *
 * Läuft im Verzeichnis, in dem er aufgerufen wird, und prüft dessen **Baum** —
 * nicht den Diff. Das ist der ganze Punkt: ein Geheimnis, das seit drei Wochen
 * liegt, fasst kein aktueller Commit an und wäre für jede Diff-Prüfung
 * unsichtbar.
 *
 * Der Baum ist hier zweierlei:
 *
 * 1. **verfolgte Dateien** (`git ls-files`) — was tatsächlich im öffentlichen
 *    Repo steht, also der eingetretene Schaden;
 * 2. **unverfolgte, aber NICHT ignorierte Dateien**
 *    (`git ls-files --others --exclude-standard`) — was ein einziges
 *    `git add .` öffentlich machen würde.
 *
 * **Ignorierte Dateien bleiben absichtlich aussen vor.** Der Keystore MUSS
 * lokal und im Signier-Workflow vorliegen (B3) — er liegt dann unter einer
 * Ignorierzeile. Ein Wächter, der darauf anschlägt, wäre auf jedem Rechner rot,
 * und ein Wächter, der immer rot ist, wird abgeschaltet.
 */
import { execFileSync } from "node:child_process";

import { nativeGeheimnisseImBaum } from "./native-secrets-guard.logic";

function git(args: string[]): string[] {
  const roh = execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return roh.split("\0").filter((z) => z !== "");
}

let baum: string[];
try {
  baum = [
    ...new Set([
      ...git(["ls-files", "-z"]),
      ...git(["ls-files", "--others", "--exclude-standard", "-z"]),
    ]),
  ];
} catch (fehler) {
  console.error(`git nicht ausführbar oder kein Repository: ${(fehler as Error).message}`);
  process.exit(2);
}

// Ein Wächter, der einen LEEREN Baum prüft, ist grün und belegt nichts — und
// genau so sähe ein Lauf im falschen Verzeichnis oder mit kaputtem git aus.
// Deshalb muss er zeigen, dass er das Repo überhaupt gesehen hat.
if (!baum.includes("package.json")) {
  console.error(
    `Der Baum enthält nicht einmal \`package.json\` (${baum.length} Datei(en) gesehen).\n` +
      "Das ist kein Lauf in diesem Repository — eine Prüfung darauf wäre grün,\n" +
      "ohne etwas zu belegen.",
  );
  process.exit(2);
}

const treffer = nativeGeheimnisseImBaum(baum);

if (treffer.length > 0) {
  console.error(`${treffer.length} natives Geheimnis/Geheimnisse im Baum:\n`);
  for (const t of treffer) console.error(`  ${t.pfad}\n      ${t.grund}`);
  console.error(
    "\nDieses Repository ist ÖFFENTLICH. Ein `git rm` genügt nicht — was einmal\n" +
      "gepusht wurde, gilt als offengelegt. Der richtige Schritt ist eine\n" +
      "ROTATION im Apple- bzw. Google-Portal, danach das Entfernen.\n" +
      "Soll die Datei lokal bleiben: in `.gitignore` aufnehmen und mit\n" +
      "`git rm --cached` aus der Verfolgung nehmen.",
  );
  process.exit(1);
}

console.log(`Baum geprüft: ${baum.length} Datei(en), kein natives Geheimnis darin.`);
