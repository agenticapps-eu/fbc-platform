/**
 * Der Abschnitt „Bilder holen" (AGE-534, Aufgaben 6.1–6.5).
 *
 *   pnpm tsx supabase/seed/wp_bilder_holen.ts <quelldatei>
 *
 * EIGENER EINSTIEG, ABSICHTLICH. Er ist für sich wiederholbar und hat mit der
 * Datenübernahme nichts zu tun: er spricht mit der alten Seite und schreibt in
 * die Zwischenablage, sonst nichts. Keine Datenbank, kein Bucket — das ist 6.3.
 *
 * WARUM ER FRÜH LÄUFT. Die Bilder liegen ausschliesslich auf der alten Seite.
 * Fällt sie ab, bevor dieser Abschnitt einmal gelaufen ist, sind sie weg; jede
 * andere Gegenmassnahme käme dann zu spät. Deshalb füllt er die Zwischenablage,
 * lange bevor irgendetwas geschrieben wird.
 *
 * DIE AUSGABE TRÄGT KEINE PERSONENDATEN: Kennung, Bildart, Stand. Kein Name,
 * keine Adresse — dieselbe Regel wie in `stdoutZeile` (4.7).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BILDQUELLE,
  type Holergebnis,
  KANTE,
  bildauftraege,
  holeBild,
  wandleBild,
} from "./wp_bilder";
import { leseDatensaetze } from "./wp_import";
import { ablageorte, pruefeQuellPfad } from "./wp_import.lib";

const REPO_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Eine kurze Pause zwischen den Anfragen. Es ist ein fremder Server, und 123
 * Anfragen in einem Zug sehen von dort aus wie etwas anderes als eine Migration.
 */
const PAUSE_MS = 150;

function abbruch(grund: string): never {
  console.error(grund);
  process.exit(1);
}

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (!argument) {
    abbruch("Aufruf: tsx supabase/seed/wp_bilder_holen.ts <quelldatei>");
  }

  const pfad = pruefeQuellPfad({ pfad: argument, cwd: process.cwd(), repoWurzel: REPO_WURZEL });
  if (pfad.kind === "abbruch") abbruch(pfad.grund);

  // Die Zwischenablage ist NICHT zeitgestempelt (1.2): sie soll über Läufe
  // hinweg bestehen bleiben, sonst schützt sie nicht gegen das Abschalten.
  const { zwischenablage } = ablageorte({ quellPfad: pfad.pfad, zeitstempel: "" });

  const { zeilen } = leseDatensaetze(readFileSync(pfad.pfad, "utf8"));
  const auftraege = zeilen.flatMap((row) =>
    bildauftraege({ row, basis: BILDQUELLE, zwischenablage }),
  );

  console.log(`${zeilen.length} Datensätze, ${auftraege.length} Bilder. Ablage: ${zwischenablage}`);

  const ergebnisse: Holergebnis[] = [];
  for (const auftrag of auftraege) {
    const ergebnis = await holeBild(auftrag);
    ergebnisse.push(ergebnis);
    console.log(
      `  ${auftrag.kennung} · ${auftrag.art} · ${ergebnis.stand}${ergebnis.grund ? ` (${ergebnis.grund})` : ""}`,
    );
    if (ergebnis.stand === "geholt") await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  const zaehle = (stand: Holergebnis["stand"]) =>
    ergebnisse.filter((e) => e.stand === stand).length;

  console.log(
    `\ngeholt ${zaehle("geholt")} · schon vorhanden ${zaehle("vorhanden")} · fehlt ${zaehle("fehlt")}`,
  );

  // ── Wandeln: verkleinern und nach WebP, neben das Original ────────────────
  // Im selben Abschnitt und nicht im Import: er hat kein Netz mehr nötig, und
  // was hier entsteht, ist genau das, was spaeter in den Bucket geht (6.3).
  console.log("\nWandeln:");
  let gewandelt = 0;
  let untauglich = 0;
  let vorhanden = 0;

  for (const { auftrag, stand } of ergebnisse) {
    if (stand === "fehlt") continue;

    const ergebnis = await wandleBild({
      quelle: auftrag.ablage,
      ziel: `${auftrag.ablage.replace(/\.[^.]+$/, "")}.webp`,
      maxKante: auftrag.art === "profil" ? KANTE.avatar : KANTE.cover,
    });

    if (ergebnis.stand === "gewandelt") gewandelt++;
    else if (ergebnis.stand === "vorhanden") vorhanden++;
    else {
      untauglich++;
      console.log(`  ${auftrag.kennung} · ${auftrag.art} · UNTAUGLICH (${ergebnis.grund})`);
    }
  }

  console.log(`gewandelt ${gewandelt} · schon vorhanden ${vorhanden} · untauglich ${untauglich}`);

  // Ein fehlendes Bild ist kein Fehler des Laufs (6.4) — der Ausgang bleibt 0.
  // Es steht oben einzeln da und geht in den Bericht des Imports ein.
}

await main();
