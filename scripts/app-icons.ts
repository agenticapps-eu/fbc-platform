/**
 * Erzeugt die App-Symbole beider Plattformen (AGE-642).
 *
 *   pnpm app:icons
 *
 * Quelle ist `public/brand/compass-favicon.svg` — dieselbe Marke, die der
 * Browser-Tab trägt. Die Regeln stehen in `app-icons.logic.ts` und sind dort
 * geprüft; diese Datei tut nur noch das, was ein Test nicht tun kann: rastern
 * und schreiben.
 *
 * ══ WARUM rsvg-convert UND NICHT EIN NPM-MODUL ═════════════════════════════
 * Ein Bildmodul (`sharp`, `@capacitor/assets`) wäre eine Abhängigkeit mit
 * nativen Anteilen für einen Lauf, der ein paarmal im Jahr stattfindet, und
 * käme in jedes `pnpm install` und in jeden CI-Lauf. `rsvg-convert` liegt auf
 * dieser Maschine (Homebrew, librsvg). Fehlt es, sagt dieser Lauf das — er
 * erzeugt dann nichts Halbes.
 *
 * ══ DIE ERZEUGTEN SVG BLEIBEN LIEGEN ═══════════════════════════════════════
 * `assets/app-icon.svg` und `assets/app-icon-foreground.svg` sind Zwischen-
 * ergebnisse und werden trotzdem versioniert: sie sind die einzige Fassung des
 * Symbols, die man in einem Diff LESEN kann. Fünfzehn PNG sagen im Diff nichts.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";

import { ZIELE, hintergrundXml, leseMarke, symbolSvg, vordergrundSvg } from "./app-icons.logic";

const QUELLE = "public/brand/compass-favicon.svg";
const SVG_VOLL = "assets/app-icon.svg";
const SVG_RUND = "assets/app-icon-round.svg";
const SVG_VORDERGRUND = "assets/app-icon-foreground.svg";
const ANDROID_RES = "android/app/src/main/res";

function schreibe(pfad: string, inhalt: string): void {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}

/** Rastert ein SVG auf eine quadratische Kantenlänge. */
function rastere(svg: string, png: string, px: number): void {
  mkdirSync(dirname(png), { recursive: true });
  execFileSync("rsvg-convert", ["-w", String(px), "-h", String(px), svg, "-o", png]);
}

function pruefeWerkzeug(): void {
  try {
    execFileSync("rsvg-convert", ["--version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "app-icons: `rsvg-convert` fehlt. Auf macOS: `brew install librsvg`. " +
        "Es wurde nichts geschrieben.",
    );
  }
}

function main(): void {
  pruefeWerkzeug();

  const marke = leseMarke(readFileSync(QUELLE, "utf8"));

  // Die drei lesbaren Zwischenschritte.
  schreibe(SVG_VOLL, symbolSvg(marke) + "\n");
  schreibe(SVG_RUND, symbolSvg(marke, { rund: true }) + "\n");
  schreibe(SVG_VORDERGRUND, vordergrundSvg(marke) + "\n");

  // iOS — ein Slot, 1024 px. Alles Kleinere rechnet das System selbst.
  for (const ziel of ZIELE.ios) {
    rastere(SVG_VOLL, ziel.pfad, ziel.px);
    console.log(`ios      ${ziel.px.toString().padStart(4)} px  ${ziel.pfad}`);
  }

  // Android — je Dichte drei Dateien: die zwei alten Wege (vor Android 8) und
  // der Vordergrund des adaptiven Symbols.
  for (const { dichte, px, adaptivPx } of ZIELE.android) {
    const ordner = `${ANDROID_RES}/mipmap-${dichte}`;
    rastere(SVG_VOLL, `${ordner}/ic_launcher.png`, px);
    rastere(SVG_RUND, `${ordner}/ic_launcher_round.png`, px);
    rastere(SVG_VORDERGRUND, `${ordner}/ic_launcher_foreground.png`, adaptivPx);
    console.log(
      `android  ${px.toString().padStart(4)} px  mipmap-${dichte} ` +
        `(Vordergrund ${adaptivPx} px)`,
    );
  }

  // Die Fläche des adaptiven Symbols ist eine Farbe, kein Bild.
  schreibe(`${ANDROID_RES}/values/ic_launcher_background.xml`, hintergrundXml() + "\n");
  console.log(`android         values/ic_launcher_background.xml`);
}

main();
