#!/usr/bin/env tsx
/**
 * Wächter über die Erstlast (AGE-642).
 *
 *   pnpm build && tsx scripts/entry-chunk-guard.ts
 *
 * Prüft, dass keine Seitenkomponente beim ersten Aufruf mitgeladen wird ausser
 * denen, die der erste Bildschirm braucht. Die Spec verlangt genau das, und zwar
 * als Struktur statt als Zahl: eine Zahl driftet mit dem nächsten Feature und
 * sagt beim Überschreiten nicht, wer sie verschoben hat.
 *
 * **Geprüft wird die Erstlast, nicht nur das Eintrittsbündel.** Die erste
 * Fassung dieses Wächters las allein `index-*.js` — und wäre damit blind
 * gewesen: Vite legt gemeinsam genutzten Code in eigene Dateien und lädt sie
 * über `<link rel="modulepreload">` **zusammen** mit dem Eintritt. Gemessen am
 * 27.08. waren das neun weitere Dateien, darunter der Supabase-Client mit
 * 202,89 kB. Eine eigene Datei ist eben nicht dasselbe wie „wird nicht
 * geladen"; eine Seite, die dorthin rutscht, käme sonst unbemerkt zurück in den
 * Erststart.
 *
 * Gelesen wird die **Source-Map**, nicht der Quelltext. Was ein Bündel enthält,
 * entscheidet der Bundler, nicht die Absicht des Autors — ein `lazy()` um eine
 * Komponente, die anderswo auch statisch importiert wird, teilt gar nichts, und
 * im Quelltext sähe es richtig aus.
 */
import { existsSync, readFileSync } from "node:fs";

import { ERLAUBT_IM_EINTRITT, verbotereSeitenImEintritt } from "./entry-chunk-guard.logic";

const HTML = "dist/index.html";

if (!existsSync(HTML)) {
  console.error(`${HTML} fehlt — erst \`pnpm build\` laufen lassen.`);
  process.exit(2);
}

const html = readFileSync(HTML, "utf8");

// Alles, was das Dokument selbst anzieht: das Eintrittsskript (`src=`) und jede
// vorgeladene Datei (`href=`). Beides landet vor dem ersten Bild im Netz.
const erstlast = [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);

if (erstlast.length === 0) {
  console.error(`${HTML} nennt kein einziges JS-Bündel — der Bau ist unvollständig.`);
  process.exit(2);
}

const quellen: string[] = [];
const ohneMap: string[] = [];

for (const pfad of erstlast) {
  const map = `dist${pfad}.map`;
  if (!existsSync(map)) {
    ohneMap.push(pfad);
    continue;
  }
  quellen.push(...(JSON.parse(readFileSync(map, "utf8")) as { sources: string[] }).sources);
}

// Eine fehlende Source-Map macht den Wächter blind, ohne ihn rot zu machen —
// deshalb ist sie selbst ein Abbruch und keine Warnung.
if (ohneMap.length > 0) {
  console.error(`Ohne Source-Map nicht prüfbar: ${ohneMap.join(", ")}`);
  console.error("`build.sourcemap` in vite.config.ts muss gesetzt bleiben.");
  process.exit(2);
}

// Ein Wächter, der ein LEERES Bündel prüft, ist grün und sagt nichts. Genau das
// kann passieren, wenn ein Bau die Anwendung wegoptimiert — etwa weil eine
// Modulebene ohne Konfiguration wirft und der Bundler den Rest als unerreichbar
// erkennt. Auf dem heutigen Stand (vite 8) geschieht das nicht; die Zusage
// hängt aber an einem Verhalten des Bundlers, nicht an einer Absicht. Deshalb
// muss der Wächter belegen, dass er überhaupt Anwendungscode gesehen hat.
if (!quellen.some((q) => q.includes("src/App.tsx"))) {
  console.error(
    "Die Erstlast enthält nicht einmal `src/App.tsx` — das ist kein vollständiger\n" +
      "Bau, und eine Prüfung darauf wäre grün, ohne etwas zu belegen.",
  );
  process.exit(2);
}

const verboten = verbotereSeitenImEintritt(quellen);

if (verboten.length > 0) {
  console.error(`${verboten.length} Seite(n) werden beim ersten Aufruf mitgeladen:\n`);
  for (const seite of verboten) console.error(`  ${seite}`);
  console.error(
    "\nJede davon lädt jedes Mitglied mit, auch wenn es sie nie öffnet.\n" +
      "Entweder die Route auf `lazy()` umstellen — oder, wenn die Seite wirklich\n" +
      "zum ersten Bildschirm gehört, sie in ERLAUBT_IM_EINTRITT aufnehmen und\n" +
      "dort begründen.",
  );
  process.exit(1);
}

console.log(
  `Erstlast geprüft: ${erstlast.length} Datei(en), keine unerlaubte Seite darin ` +
    `(erlaubt: ${ERLAUBT_IM_EINTRITT.join(", ")}).`,
);
