#!/usr/bin/env tsx
/**
 * Schreibt oder prüft den Stempel über Startfläche und App-Symbole (AGE-714).
 *
 *   pnpm assets:stempel          schreibt ihn neu
 *   pnpm assets:check            prüft ihn, ohne zu schreiben
 *
 * Die Regeln stehen in `stempel.logic.ts` und sind dort geprüft; diese Datei
 * ist die Klammer um Dateisystem und Ausgabe.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { abweichungen, alsJson, berechne, type Stempel } from "./stempel.logic";

const STEMPEL = "assets/erzeugt.stempel.json";

function main(): void {
  const pruefen = process.argv.includes("--check");
  const gemessen = berechne();

  if (!pruefen) {
    writeFileSync(STEMPEL, alsJson(gemessen));
    const n = Object.keys(gemessen.ergebnisse).length;
    process.stdout.write(
      `Stempel geschrieben: ${Object.keys(gemessen.eingaben).length} Eingaben, ` +
        `${n} Ergebnisse → ${STEMPEL}\n`,
    );
    return;
  }

  if (!existsSync(STEMPEL)) {
    throw new Error(
      `stempel: ${STEMPEL} fehlt. \`pnpm assets:stempel\` erzeugt ihn — aber erst, ` +
        "nachdem `pnpm splash` und `pnpm app:icons` gelaufen sind.",
    );
  }

  const erwartet = JSON.parse(readFileSync(STEMPEL, "utf8")) as Stempel;
  const raus = abweichungen(erwartet, gemessen);
  if (raus.length > 0) {
    throw new Error(
      `stempel: ${raus.length} Abweichung(en) gegen ${STEMPEL}:\n  ${raus.join("\n  ")}\n\n` +
        "Eine abweichende EINGABE heisst: die Quelle wurde geändert, ohne neu zu " +
        "erzeugen — `pnpm splash && pnpm app:icons` laufen lassen und das Ergebnis " +
        "mit einchecken.\nEin abweichendes ERGEBNIS heisst: eine erzeugte Datei wurde " +
        "von Hand geschrieben.",
    );
  }

  process.stdout.write(
    `Stempel geprüft: ${Object.keys(gemessen.eingaben).length} Eingaben und ` +
      `${Object.keys(gemessen.ergebnisse).length} Ergebnisse unverändert.\n`,
  );
}

main();
