#!/usr/bin/env tsx
/**
 * Duenner Aufruf um `deploy-base.logic.ts` (AGE-506, Aufgabe 5).
 *
 * Liest die Laeufe als JSON-Array von stdin — neuester zuerst, je Eintrag
 * `{ id, sha, functions }`, wobei `functions` die `conclusion` des
 * `functions`-JOBS in diesem Lauf ist — und schreibt zwei Zeilen nach stdout:
 *
 *   1. den SHA der Vergleichsbasis (leer, wenn keiner zu finden war)
 *   2. den Grund fuer diese Wahl
 *
 * Zwei Zeilen statt JSON, damit die Shell sie ohne Parser lesen kann. Der Grund
 * steht in Zeile 2 und nicht in einer Log-Ausgabe, weil er ins Protokoll gehoert:
 * eine Basis ohne genannte Herkunft ist ein Wert, den hinterher niemand
 * nachschlagen kann.
 *
 * Hier steht mit Absicht KEINE Logik. Alles Entscheidende liegt in
 * `deploy-base.logic.ts` und hat dort einen Test daneben.
 */
import { gewaehlteBasis, type Lauf } from "./deploy-base.logic";

const eingabe = await new Promise<string>((auf) => {
  let roh = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (stueck) => (roh += stueck));
  process.stdin.on("end", () => auf(roh));
});

// Leere Eingabe ist ein moeglicher Zustand (gh lieferte nichts) und keine
// Ausnahme — sie fuehrt zur selben Antwort wie „kein Erfolg gefunden".
const laeufe: Lauf[] = eingabe.trim() ? JSON.parse(eingabe) : [];

const { sha, grund } = gewaehlteBasis(laeufe);

process.stdout.write(`${sha ?? ""}\n${grund}\n`);
