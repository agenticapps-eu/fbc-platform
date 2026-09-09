import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Der Zoom-Regler im Zuschnitt (AGE-642, C3) — geprüft an den zwei Dateien, die
 * ihn tragen.
 *
 * WARUM DIESE DATEI EXISTIERT. Am 08.09. am iPhone 17 Pro gemessen, nachdem der
 * native Bildweg (C3) belegt war: der Regler liess sich praktisch nicht
 * bedienen. Zwei Gründe, beide unsichtbar für jeden Test im Browser —
 *
 *   1. Der System-Knopf von iOS ist WEISS. Der Zuschnitt steht auf
 *      `bg-canvas` (#ffffff), also weiss auf weiss. `accent-color` half nicht:
 *      es färbt auf iOS die Schiene, nicht den Knopf.
 *   2. Die Trefffläche eines Standard-Reglers ist rund 30 px hoch. Apple nennt
 *      44 px als Mindestmass, und Donalds Wortlaut war „ich muss schon sehr
 *      drücken".
 *
 * Beides ist am Desktop nicht zu sehen: dort trifft ein Mauszeiger pixelgenau,
 * und WebKit zeichnet den Knopf auf macOS dunkel. jsdom hat gar kein Layout.
 * Deshalb steht die Zusage hier am Quelltext und nicht in einem Render-Test.
 */
const CSS = readFileSync("src/index.css", "utf8");
const CROPPER = readFileSync("src/components/profile/AvatarCropper.tsx", "utf8");
const ONBOARDING = readFileSync("src/pages/OnboardingPage.tsx", "utf8");

/** Apples Mindestmass für eine Trefffläche. */
const TREFFFLAECHE_MIN = 44;
/** Der Knopf muss auf Armlänge zu sehen sein, nicht nur zu treffen. */
const KNOPF_MIN = 24;

/** Der Rumpf einer Regel, roh — mehr braucht keine der Fragen hier. */
function regel(css: string, selektor: string): string {
  const muster = new RegExp(
    `${selektor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
    "g",
  );
  const treffer = [...css.matchAll(muster)];
  expect(treffer, `Regel fehlt: ${selektor}`).toHaveLength(1);
  return treffer[0][1];
}

/** `px`-Wert einer Eigenschaft aus einem Regelrumpf. */
function px(rumpf: string, eigenschaft: string): number {
  const treffer = rumpf.match(new RegExp(`(?:^|;)\\s*${eigenschaft}\\s*:\\s*(-?[\\d.]+)px`));
  expect(treffer, `${eigenschaft} fehlt oder ist nicht in px`).not.toBeNull();
  return Number(treffer![1]);
}

describe("Der Zoom-Regler ist am Finger bedienbar", () => {
  // Mutation: die Klasse aus dem `<input type="range">` streichen → rot. Ohne
  // sie greift keine der Regeln unten, und es gilt wieder der System-Regler.
  it("der Regler im Zuschnitt trägt die Klasse", () => {
    const eingabe = CROPPER.match(/<input[^>]*type="range"[\s\S]*?\/>/);
    expect(eingabe, 'kein <input type="range"> im Zuschnitt gefunden').not.toBeNull();
    expect(eingabe![0]).toMatch(/className="[^"]*\bfbc-regler\b/);
  });

  // Mutation: `appearance: none` streichen → rot. WebKit ignoriert JEDE
  // Knopf-Regel, solange der Regler in der Systemdarstellung steht — die
  // Farbe unten wäre dann wirkungslos und der Knopf wieder weiss.
  it("der Regler wird selbst gezeichnet, sonst greift keine Knopf-Regel", () => {
    const rumpf = regel(CSS, ".fbc-regler");
    expect(rumpf).toMatch(/-webkit-appearance:\s*none/);
    expect(rumpf).toMatch(/(?:^|;)\s*appearance:\s*none/);
  });

  // Mutation: die Höhe auf 30px setzen → rot. Das ist genau der Zustand vom
  // 08.09., und er sah im Code nicht falsch aus.
  it("die Trefffläche hält Apples Mindestmass", () => {
    expect(px(regel(CSS, ".fbc-regler"), "height")).toBeGreaterThanOrEqual(TREFFFLAECHE_MIN);
  });

  // Mutation: den Knopf auf 16px verkleinern → rot.
  // Mutation: `background` auf `#ffffff` setzen → rot. Das ist der Fehler.
  it.each([
    [".fbc-regler::-webkit-slider-thumb", "WebKit — iOS und Chrome"],
    [".fbc-regler::-moz-range-thumb", "Firefox"],
  ])("%s ist gross genug und trägt den Akzent (%s)", (selektor) => {
    const rumpf = regel(CSS, selektor);
    expect(px(rumpf, "width")).toBeGreaterThanOrEqual(KNOPF_MIN);
    expect(px(rumpf, "height")).toBeGreaterThanOrEqual(KNOPF_MIN);
    expect(rumpf).toMatch(/background:\s*var\(--color-accent-strong\)/);
  });

  // Mutation: eine der beiden Schienen-Regeln streichen → rot. `appearance:
  // none` nimmt in BEIDEN Maschinen Schiene und Knopf weg; fehlt der jeweilige
  // Satz, ist der Regler dort unsichtbar statt nur blass — also schlimmer als
  // vorher. Genau diese Falle steht heute in `OnboardingPage.tsx:212`.
  it.each([".fbc-regler::-webkit-slider-runnable-track", ".fbc-regler::-moz-range-track"])(
    "%s wird mitgezeichnet",
    (selektor) => {
      expect(px(regel(CSS, selektor), "height")).toBeGreaterThan(0);
    },
  );
});

/**
 * Derselbe Fehler im Onboarding (AGE-711) — und dort schärfer.
 *
 * Der Kommentar am Ende des Blocks oben nannte die Stelle schon beim Namen:
 * `OnboardingPage.tsx:212` stand auf `appearance-none` **ohne jede**
 * Knopf-Regel. `accent-color` (dort als `accent-accent`) hilft nicht — es färbt
 * die Schiene, nicht den Knopf. Der Knopf war damit in WebKit und in Firefox
 * unsichtbar, und zwar auch am Schreibtisch, nicht nur am Telefon.
 *
 * WARUM EIN EIGENER SATZ REGELN und nicht `.fbc-regler`: der Zuschnitt sitzt
 * auf `--color-canvas`, das Onboarding auf den **Chrome**-Tokens. Die kippen mit
 * `html[data-variant="navy"]` (index.css:209) — `--color-chrome` ist hell weiss
 * und navy `#081527`. Die Regeln hier müssen deshalb Tokens tragen, keine festen
 * Farben, sonst ist der Knopf in genau einer der beiden Varianten wieder weg.
 */
describe("Der Regler im Onboarding ist sichtbar und bedienbar", () => {
  // Mutation: die Klasse aus dem `<input type="range">` streichen → rot.
  it("der Regler im Onboarding trägt die Klasse", () => {
    const eingabe = ONBOARDING.match(/<input[^>]*type="range"[\s\S]*?\/>/);
    expect(eingabe, 'kein <input type="range"> im Onboarding gefunden').not.toBeNull();
    expect(eingabe![0]).toMatch(/className="[^"]*\bfbc-regler-chrome\b/);
  });

  // Mutation: `appearance: none` streichen → rot, wie oben.
  it("der Regler wird selbst gezeichnet", () => {
    const rumpf = regel(CSS, ".fbc-regler-chrome");
    expect(rumpf).toMatch(/-webkit-appearance:\s*none/);
    expect(rumpf).toMatch(/(?:^|;)\s*appearance:\s*none/);
  });

  // Mutation: die Höhe auf 8px setzen (der Stand vor AGE-711, `h-2`) → rot.
  it("die Trefffläche hält Apples Mindestmass", () => {
    expect(px(regel(CSS, ".fbc-regler-chrome"), "height")).toBeGreaterThanOrEqual(
      TREFFFLAECHE_MIN,
    );
  });

  // DIE Zusage des Vorgangs. Mutation: einen der beiden Sätze streichen → rot.
  // Genau das war der Zustand: `appearance-none` nimmt den Knopf in BEIDEN
  // Maschinen weg, und ohne Ersatz ist er unsichtbar statt nur blass.
  //
  // Mutation: `background` auf eine feste Farbe setzen → rot. Ein fester Wert
  // sitzt in einer der beiden Chrome-Varianten falsch.
  it.each([
    [".fbc-regler-chrome::-webkit-slider-thumb", "WebKit — iOS und Chrome"],
    [".fbc-regler-chrome::-moz-range-thumb", "Firefox"],
  ])("%s ist gross genug und trägt einen Chrome-Token (%s)", (selektor) => {
    const rumpf = regel(CSS, selektor);
    expect(px(rumpf, "width")).toBeGreaterThanOrEqual(KNOPF_MIN);
    expect(px(rumpf, "height")).toBeGreaterThanOrEqual(KNOPF_MIN);
    expect(rumpf).toMatch(/background:\s*var\(--color-accent-on-chrome\)/);
  });

  // Mutation: eine der beiden Schienen-Regeln streichen → rot.
  it.each([
    ".fbc-regler-chrome::-webkit-slider-runnable-track",
    ".fbc-regler-chrome::-moz-range-track",
  ])("%s wird mitgezeichnet", (selektor) => {
    expect(px(regel(CSS, selektor), "height")).toBeGreaterThan(0);
  });

  // Positivkontrolle gegen den eigentlichen Rückfall: `accent-color` allein
  // genügt NICHT, und die alte Klasse `accent-accent` liesse genau das
  // zurück. Sie darf am Regler nicht mehr stehen.
  it("verlässt sich nicht mehr auf accent-color allein", () => {
    const eingabe = ONBOARDING.match(/<input[^>]*type="range"[\s\S]*?\/>/)![0];
    expect(eingabe).not.toMatch(/\baccent-accent\b/);
  });
});
