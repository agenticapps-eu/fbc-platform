import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

/**
 * Prüft die Eigenschaft, die `native-secrets-guard.logic.ts` NICHT haben kann:
 * **der Wächter liest den Baum, nicht den Diff.**
 *
 * Die reine Funktion bekommt eine Liste Pfade und kann gar nicht falsch liegen —
 * woher die Liste kommt, entscheidet allein der Runner. Genau dort sitzt der
 * Fehler, den dieser Test ausschliesst: ein Runner, der auf
 * `git diff --name-only HEAD~1` umgebaut wird, bliebe bei allen Unit-Tests
 * grün und übersähe jedes Geheimnis, das schon länger liegt.
 *
 * Gearbeitet wird deshalb in einem echten Wegwerf-Repository, nicht an einer
 * Attrappe: eine nachgestellte git-Ausgabe würde nur belegen, dass der Test
 * das nachstellt, was er prüfen will.
 */
const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, "..");
const SKRIPT = join(HIER, "native-secrets-guard.ts");
const TSX = join(REPO, "node_modules/.bin/tsx");

let arbeit: string;

function g(...args: string[]) {
  execFileSync("git", args, { cwd: arbeit, stdio: "ignore" });
}

function schreibe(pfad: string, inhalt: string) {
  writeFileSync(join(arbeit, pfad), inhalt);
}

/** Führt den Wächter im Wegwerf-Repo aus. Gibt Exit-Code und STDERR zurück. */
function lauf(): { code: number; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync(TSX, [SKRIPT], {
      cwd: arbeit,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stderr: "", stdout };
  } catch (fehler) {
    const e = fehler as { status: number; stderr: string; stdout: string };
    return { code: e.status, stderr: e.stderr, stdout: e.stdout };
  }
}

beforeEach(() => {
  arbeit = mkdtempSync(join(tmpdir(), "fbc-native-guard-"));
  g("init", "-q");
  g("config", "user.email", "test@example.invalid");
  g("config", "user.name", "Test");
  // Ohne `package.json` bricht der Wächter mit 2 ab (Selbstprüfung gegen den
  // Lauf im falschen Verzeichnis) — sie gehört also in jedes Szenario.
  schreibe("package.json", '{"name":"wegwerf"}\n');
});

afterEach(() => {
  rmSync(arbeit, { recursive: true, force: true });
});

describe("native-secrets-guard.ts — Baum statt Diff", () => {
  test("meldet einen Keystore, den KEIN aktueller Commit anfasst", () => {
    // Commit 1 bringt den Keystore herein …
    schreibe("release.keystore", "nicht wirklich ein Schluessel\n");
    g("add", "package.json", "release.keystore");
    g("commit", "-qm", "erster");

    // … und Commit 2 fasst etwas ganz anderes an. Ein Diff-basierter Wächter
    // sähe ab hier nur noch `harmlos.txt`.
    schreibe("harmlos.txt", "nichts\n");
    g("add", "harmlos.txt");
    g("commit", "-qm", "zweiter");

    const { code, stderr } = lauf();

    expect(code).toBe(1);
    expect(stderr).toContain("release.keystore");
    expect(stderr).toContain("Android-Keystore");
    // Der Hinweis muss die Rotation nennen: ein `git rm` allein wäre die
    // falsche Reaktion und der teuerste Irrtum an dieser Stelle.
    expect(stderr).toContain("ROTATION");
  });

  // Positivkontrolle: ohne sie wäre ein Wächter, der IMMER bricht, von einem,
  // der prüft, nicht zu unterscheiden.
  test("ist grün, wenn derselbe Ablauf ohne den Keystore läuft", () => {
    g("add", "package.json");
    g("commit", "-qm", "erster");

    schreibe("harmlos.txt", "nichts\n");
    g("add", "harmlos.txt");
    g("commit", "-qm", "zweiter");

    const { code, stdout } = lauf();

    expect(code).toBe(0);
    expect(stdout).toContain("kein natives Geheimnis");
  });

  test("meldet auch unverfolgt: ein `git add .` würde ihn öffentlich machen", () => {
    g("add", "package.json");
    g("commit", "-qm", "erster");
    schreibe("upload.p8", "nicht wirklich ein Schluessel\n");

    const { code, stderr } = lauf();

    expect(code).toBe(1);
    expect(stderr).toContain("upload.p8");
  });

  // Die bewusste Ausnahme. B3 verlangt, dass der Keystore lokal und im
  // Signier-Workflow vorliegt — dann liegt er unter einer Ignorierzeile. Schlüge
  // der Wächter darauf an, wäre er auf jedem Rechner rot.
  test("schweigt zu einer ignorierten Datei", () => {
    schreibe(".gitignore", "*.keystore\n");
    schreibe("release.keystore", "nicht wirklich ein Schluessel\n");
    g("add", "package.json", ".gitignore");
    g("commit", "-qm", "erster");

    const { code } = lauf();

    expect(code).toBe(0);
  });

  // Gegenprobe zur Ausnahme darüber: dieselbe Datei, diesmal trotz
  // Ignorierzeile verfolgt (`git add -f`) — genau der Weg, den `.gitignore`
  // nicht abfängt und für den dieser Wächter überhaupt existiert.
  test("meldet eine ignorierte Datei, die per `git add -f` doch verfolgt wird", () => {
    schreibe(".gitignore", "*.keystore\n");
    schreibe("release.keystore", "nicht wirklich ein Schluessel\n");
    g("add", "package.json", ".gitignore");
    g("add", "-f", "release.keystore");
    g("commit", "-qm", "erster");

    const { code, stderr } = lauf();

    expect(code).toBe(1);
    expect(stderr).toContain("release.keystore");
  });

  test("bricht mit 2 ab, statt in einem fremden Verzeichnis grün zu sein", () => {
    rmSync(join(arbeit, "package.json"));
    g("commit", "-qm", "leer", "--allow-empty");

    const { code, stderr } = lauf();

    expect(code).toBe(2);
    expect(stderr).toContain("package.json");
  });
});
