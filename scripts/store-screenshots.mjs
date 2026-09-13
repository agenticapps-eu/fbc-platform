/* global document, location */ // laufen in page.evaluate(), also im Browser
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(process.env.S + "/x.js");
const { chromium } = require("playwright-core");

const BASE = "http://localhost:5209";
const OUT  = "docs/store-assets";   // ios-6.9/ und play-telefon/
const USER = "hans-peter.stadler@demo.fbc.invalid";
const PASS = "sichtprobe-lokal-2026";

// iOS 6,9" verlangt 1290x2796; Play-Telefon 9:16 → 1080x1920.
const GERAETE = [
  { name: "ios",     ordner: "ios-6.9",      praefix: "ios",     viewport: { width: 430, height: 932 }, dpr: 3 },
  { name: "android", ordner: "play-telefon", praefix: "android", viewport: { width: 360, height: 640 }, dpr: 3 },
];
const SEITEN = [
  { slug: "1-aktivitaet", pfad: "/aktivitaet" },
  { slug: "2-mitglieder", pfad: "/mitglieder" },
  { slug: "3-events",     pfad: "/events" },
  { slug: "4-profil",     pfad: "/profil" },
  { slug: "5-chat",       pfad: "/chat", klick: "Gregor Pilz" },
];

for (const g of GERAETE) mkdirSync(`${OUT}/${g.ordner}`, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });

for (const g of GERAETE) {
  const ctx = await browser.newContext({
    viewport: g.viewport, deviceScaleFactor: g.dpr,
    isMobile: true, hasTouch: true, locale: "de-DE", colorScheme: "light",
  });
  const page = await ctx.newPage();

  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.fill("#email", USER);
  await page.fill("#password", PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), null, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(2500);

  // BELEG statt Annahme: ohne Sitzung im Speicher wird nicht weitergeschossen.
  const angemeldet = await page.evaluate(() =>
    Object.keys(localStorage).some((k) =>
      /auth-token/.test(k) && (localStorage.getItem(k) || "").includes("access_token")));
  if (!angemeldet) throw new Error(`[${g.name}] ANMELDUNG FEHLGESCHLAGEN — url ${page.url()}`);
  console.log(`[${g.name}] angemeldet, url ${page.url()}`);

  // Der Testumgebungs-Hinweis (EnvironmentBanner) verschwindet nur bei
  // VITE_ENVIRONMENT=prod. Die lokale Umgebung als "prod" auszugeben waere
  // eine Luege in einer Datei, die liegen bleiben kann — deshalb hier, zur
  // Aufnahmezeit, und nur fuer das Bild.
  await ctx.addInitScript(() => {
    const css = "[data-testid='environment-banner'], " +
      "div[class*='pointer-events-none'][class*='fixed'][class*='bottom-'] { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () => {
      const el = document.createElement("style"); el.textContent = css;
      document.head.appendChild(el);
    });
  });

  for (const s of SEITEN) {
    await page.goto(BASE + s.pfad, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    // Fallback, falls die Klassenkette nicht greift: per Text finden.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("div")) {
        if (el.textContent?.trim().startsWith("Testumgebung — Daten sind nicht echt")
            && el.className.includes("fixed")) el.style.display = "none";
      }
    });
    await page.waitForTimeout(300);
    if (s.klick) {
      await page.getByText(s.klick, { exact: false }).first().click().catch(() => {});
      await page.waitForTimeout(2000);
    }
    // Zweiter Beleg je Seite: der Anmelde-Knopf darf im Kopf NICHT stehen.
    const nochAusgeloggt = await page.evaluate(() =>
      !!document.querySelector("header")?.textContent?.includes("Anmelden"));
    const datei = `${OUT}/${g.ordner}/${g.praefix}-${s.slug}.png`;
    await page.screenshot({ path: datei });
    console.log(`  ${g.name} ${s.pfad} → ${datei}${nochAusgeloggt ? "   ⚠️ KOPF ZEIGT ANMELDEN" : ""}`);
  }
  await ctx.close();
}
await browser.close();
console.log("fertig");
