/**
 * Feature-Grafik fuer die Play Console (1024x500, Pflichtfeld).
 *
 * Braucht eine laufende lokale vite-Instanz auf 5209 — nur wegen der Schriften:
 * die Vorlage laedt Fraunces und Inter aus `public/fonts/`. Ueber `/@fs/` liest
 * vite die Vorlage an ihrem Ort im Repo, sie muss also nicht nach `public/`.
 *
 *   pnpm exec vite --port 5209 --strictPort
 *   S=$(mktemp -d) && npm --prefix "$S" install playwright-core
 *   S=$S node scripts/store-feature-graphic.mjs
 */
/* global document */ // laeuft in page.evaluate(), also im Browser
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(process.env.S + "/x.js");
const { chromium } = require("playwright-core");

const HIER = dirname(fileURLToPath(import.meta.url));
const VORLAGE = join(HIER, "store-feature-graphic.html");
const ZIEL = join(HIER, "..", "docs", "store-assets", "play-feature-graphic.png");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

await page.goto(`http://localhost:5209/@fs${VORLAGE}`, { waitUntil: "networkidle" });
// Ohne das Warten auf die Schriften faellt der Schriftzug auf Georgia zurueck —
// im Bild sichtbar, aber leicht zu uebersehen.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

await page.screenshot({ path: ZIEL });
await browser.close();
console.log(`geschrieben: ${ZIEL}`);
