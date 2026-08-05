/**
 * Zielprüfung für schreibende Befehle gegen ein Supabase-Projekt (AGE-496).
 *
 * Die Prüfung ist zweistufig, und die Reihenfolge ist der Punkt
 * (Entscheidung 11):
 *
 *   Stufe 1 — maschinell. Der aus der Verbindungs-URL abgeleitete Projekt-Ref
 *             wird gegen `scripts/<umgebung>-project-ref.txt` gehalten, eine vom
 *             Ziel unabhängige Quelle. Passt er nicht, bricht der Lauf ab,
 *             **bevor** irgendetwas angezeigt oder abgefragt wird.
 *   Stufe 2 — durch den Menschen. Erst danach werden Host und Dry-Run gezeigt
 *             und der Ref muss abgetippt werden.
 *
 * Ohne Stufe 1 wäre die Prüfung zirkulär: eine falsch hinterlegte URL zeigte
 * einen falschen Host, und der Mensch bestätigte genau den. Beide DB-Passwörter
 * waren bis zu diesem Change byte-gleich — der Fehlgriff hätte keine
 * Fehlermeldung erzeugt, sondern einfach das andere Projekt geschrieben.
 *
 * **Stufe 1 gilt auch dort, wo es keine Stufe 2 gibt.** In CI schreibt
 * `migrate-dev` unbeaufsichtigt; `scripts/assert-target.ts` fährt dieselbe
 * Funktion, damit auch dieser Weg nicht auf das falsche Projekt zeigen kann.
 *
 * Reine Funktionen, kein I/O. Die Aufrufer sind `scripts/push-prod.ts`
 * (interaktiv) und `scripts/assert-target.ts` (CI).
 */

export type Stage1Result =
  | { kind: "abort"; reason: string }
  | { kind: "confirm-required"; ref: string };

export type Stage2Result = { kind: "abort"; reason: string } | { kind: "proceed"; ref: string };

/** Ein Supabase-Projekt-Ref sind genau 20 Kleinbuchstaben. */
const REF_PATTERN = /^[a-z]{20}$/;

/**
 * Zieht den Projekt-Ref aus einer Supabase-Verbindungs-URL. Beide Formen, die
 * das Dashboard ausgibt:
 *   direkt  postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres
 *   Pooler  postgresql://postgres.<ref>:…@aws-0-…pooler.supabase.com:6543/postgres
 */
export function extractProjectRef(dbUrl: string): string | null {
  const direct = dbUrl.match(/@db\.([a-z]{20})\.supabase\.co/);
  if (direct) return direct[1];

  const pooled = dbUrl.match(/\/\/postgres\.([a-z]{20}):/);
  if (pooled) return pooled[1];

  return null;
}

export function evaluateStage1(input: {
  dbUrl: string | undefined;
  expectedRef: string;
  args: string[];
}): Stage1Result {
  const { dbUrl, expectedRef, args } = input;

  // Nichts durchreichen. Die erste Fassung führte eine Sperrliste
  // (`args.includes("--include-seed")`) — die ist ein Vorschlag, keine Sperre:
  // die CLI akzeptiert auch `--include-seed=true`, und `--yes`, `--include-all`
  // oder ein zweites `--db-url` standen ohnehin nie darauf. Ein unabhängiges
  // Review hat das am 2026-08-05 aufgedeckt.
  //
  // Das Skript baut sein Kommando selbst; zusätzliche Argumente hat es nie
  // gebraucht. Wer wirklich ein Sonderflag braucht, ruft `supabase` direkt auf —
  // dann aber sichtbar außerhalb dieser Prüfung, nicht unbemerkt hindurch.
  if (args.length > 0) {
    const seed = args.some((a) => a.startsWith("--include-seed"));
    return {
      kind: "abort",
      reason: seed
        ? "--include-seed ist gegen PROD nicht zulässig: es würde Demo-Daten einspielen."
        : `Zusätzliche Argumente werden nicht durchgereicht: ${args.join(" ")}`,
    };
  }

  if (!dbUrl) {
    return {
      kind: "abort",
      reason: "Die Verbindungs-URL ist nicht gesetzt. Fehlt der Infisical-Kontext?",
    };
  }

  // Fängt auch den Platzhalter ab, den die Datei bis Task 6 trägt: er ist kein
  // gültiger Ref, also greift dieselbe Regel ohne Sonderfall.
  if (!REF_PATTERN.test(expectedRef)) {
    return {
      kind: "abort",
      reason: `Sollwert ist kein Projekt-Ref: "${expectedRef}". Noch nicht gesetzt?`,
    };
  }

  const actualRef = extractProjectRef(dbUrl);
  if (!actualRef) {
    return {
      kind: "abort",
      reason: "Aus der Verbindungs-URL lässt sich kein Projekt-Ref ableiten.",
    };
  }

  if (actualRef !== expectedRef) {
    return {
      kind: "abort",
      reason: `zeigt auf "${actualRef}", erwartet war "${expectedRef}". Abbruch vor jeder Ausgabe.`,
    };
  }

  return { kind: "confirm-required", ref: expectedRef };
}

export function evaluateStage2(input: { ref: string; typed: string }): Stage2Result {
  const { ref, typed } = input;

  if (typed.trim() !== ref) {
    return { kind: "abort", reason: "Eingabe stimmt nicht mit dem Projekt-Ref überein." };
  }

  return { kind: "proceed", ref };
}
