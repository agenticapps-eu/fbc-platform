/**
 * Die Startfläche für iOS, aus den Quellen dieses Repositories (AGE-642, B5).
 *
 * ══ WAS HIER DAS PROBLEM WAR ═══════════════════════════════════════════════
 * `npx cap add` legt ein weisses 2732×2732-PNG ab, und das stand bis zum 28.08.
 * zwischen dem Antippen des Symbols und dem ersten Bild der Anwendung. Es trägt
 * keine fremde Marke — es trägt gar keine.
 *
 * ══ DREI EBENEN, UND WARUM NICHT ZWEI ══════════════════════════════════════
 * Der naheliegende Aufbau wäre ein Bild mit eingebackenem Verlauf plus ein
 * Schriftzug. Er ist falsch, und zwar erst im Querformat: die App erlaubt
 * Landscape (`UISupportedInterfaceOrientations`) und ist universell gebaut
 * (`TARGETED_DEVICE_FAMILY = "1,2"`). Ein formatfüllend beschnittenes Bild
 * nimmt den eingebackenen Verlauf mit in den Schnitt — seine Unterkante läge
 * dann mitten im Farbverlauf, und die Kante des Fotos wäre sichtbar.
 *
 * Deshalb liegt der Verlauf als eigene, GESTRECKTE Ebene über dem Foto. Er
 * spannt immer genau die Fläche des Fotos und endet immer an deren Unterkante
 * in `GRUND` — derselben Farbe, die auch die Fläche darunter trägt. Damit ist
 * die Kante bei jeder Bildschirmgrösse und in jeder Orientierung unsichtbar,
 * ohne dass irgendwo eine Höhe nachgerechnet wird.
 *
 * ══ DIE INVARIANTE ═════════════════════════════════════════════════════════
 * Alle drei Ebenen hängen an ANTEILEN der Bildschirmhöhe, nicht an Punkten.
 * Daraus folgt die eine Zusage, die den Text von jeder Bildlage trennt:
 *
 *     SCHRIFTZUG_OBEN >= BAND_ANTEIL * (1 - RAMPE_DECKEND_AB)
 *
 * Der Schriftzug beginnt also erst dort, wo die Rampe schon deckend ist. Weil
 * beide Seiten Anteile DERSELBEN Höhe sind, gilt sie für jedes Gerät und jede
 * Orientierung zugleich — und ein Test kann sie prüfen, im Gegensatz zu „sieht
 * auf dem SE auch gut aus".
 *
 * ══ WARUM DIE SCHRIFT AUS DEM REPO KOMMEN MUSS, UND WARUM DAS KEIN SELBST-
 *    LÄUFER IST ═════════════════════════════════════════════════════════════
 * `rsvg-convert` nimmt auf macOS über pango den CoreText-Pfad und ignoriert
 * dabei jede eigene `fonts.conf` STILLSCHWEIGEND. Gemessen: Fraunces kam als
 * Grotesk heraus, ohne Fehlermeldung, und im PNG ist das nicht als Fehler zu
 * erkennen. Die Bindung wird deshalb in `splash.ts` positiv nachgewiesen, bevor
 * gerastert wird. Diese Datei kennt nur die Namen.
 */
import type { Marke } from "./app-icons.logic";

/** `--color-canvas`. Ausdrücklich gesetzt und NICHT die Systemfarbe: das
 *  Storyboard stand auf `systemBackgroundColor`, das im Dunkelmodus schwarz
 *  wird. Unter dem alten deckenden PNG fiel das nicht auf; hier wäre es die
 *  Fläche unter dunkler Schrift. Ein dunkles Inhaltsthema hat diese App nicht
 *  (`data-variant` kennt `hell` und `navy`, beide mit weissem Canvas). */
export const GRUND = "#ffffff";
/** `--color-ink`. */
export const INK = "#1e2a3a";
/** `--color-accent` — die Punkte in „eff.bee.zee", laut Vorlage das einzige
 *  Farbdetail der Wortmarke. */
export const AKZENT = "#2f6bd1";
/** `--color-muted`. */
export const GEDAEMPFT = "#626f85";

/**
 * Die Rampe des Login-Panels (`LoginPage.tsx:277`), Stopp für Stopp.
 *
 * `offset` läuft von der UNTERKANTE nach oben, wie das `0deg` des CSS-Verlaufs.
 * Vier Übergänge, nicht einer: mit einem harten Wechsel von deckend auf
 * halbtransparent entstand dort eine sichtbare Kante bei 26 %, und die Mitte
 * wurde milchig.
 */
export const RAMPE = [
  { offset: 0, deckung: 1 },
  { offset: 0.22, deckung: 1 },
  { offset: 0.32, deckung: 0.7 },
  { offset: 0.44, deckung: 0.25 },
  { offset: 0.58, deckung: 0 },
] as const;

/** Anteil der Bandhöhe, ab dem die Rampe von unten her deckend ist. */
export const RAMPE_DECKEND_AB = 0.22;

/** Anteil der Bildschirmhöhe, den das Foto einnimmt. */
export const BAND_ANTEIL = 0.62;
/** Oberkante des Schriftzugs, als Anteil der Bildschirmhöhe. */
export const SCHRIFTZUG_OBEN = 0.58;
/** Höhe des Schriftzugs, als Anteil der Bildschirmhöhe. */
export const SCHRIFTZUG_HOEHE = 0.25;
/** Breite geteilt durch Höhe des Schriftzugs. Dieselbe Zahl steht als
 *  `multiplier` im Storyboard — sie ist die einzige Kopplung zwischen beiden
 *  Dateien, deshalb rund gewählt. */
export const SCHRIFTZUG_SEITENVERHAELTNIS = 1.2;

/**
 * Der Ausschnitt des Quellbildes — als ANTEIL, nicht in Pixeln.
 *
 * Feste Koordinaten würden beim Tausch des Quellbildes stumm auf einen anderen
 * Bildbereich zeigen, und genau dieser Tausch ist in der Anforderung
 * ausdrücklich vorgesehen.
 *
 * `oben` schneidet den oberen Rand weg. Das ist eine Designentscheidung mit
 * einem Grund: mit dem Ausschnitt des Login-Panels lagen beide Gesichter genau
 * in der Zone, in der die Rampe einsetzt, und wurden halb weggeblendet.
 */
export const AUSSCHNITT = {
  /** Oberkante des Fensters, als Anteil der Quellhöhe. */
  oben: 0.118,
  /** Höhe des Fensters, als Anteil der Quellhöhe. */
  hoehe: 0.882,
  /** Mitte des Fensters, als Anteil der Quellbreite. */
  mitteX: 0.40625,
} as const;

/** Die Worte. Dieselben, die das Login-Panel zeigt — die Startfläche darf
 *  nichts anderes versprechen als die Seite, auf der man gleich landet. */
export const CLAIM = ["Gemeinsam", "erfolgreich"] as const;
export const SUBLINE = "verbinden, wachsen, vertrauen";

/** Kantenlängen der erzeugten Bilder. Rechengrössen: gerastert wird über
 *  `rsvg-convert -w`, die SVG selbst sind auflösungsfrei. */
export const BAND_BILD = { breite: 1290, hoehe: 1734 } as const;
export const SCHRIFTZUG_BILD = { breite: 1200, hoehe: 1000 } as const;
export const VERLAUF_BILD = { breite: 8, hoehe: 1024 } as const;

type Groesse = { breite: number; hoehe: number };
type Lage = { x: number; y: number; breite: number; hoehe: number };

/** Drei Nachkommastellen. Mehr sagt bei einer Rastergrösse nichts. */
function rund(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Wohin das Quellbild gelegt wird, damit `AUSSCHNITT` die Zielfläche füllt.
 *
 * Formatfüllend, also über die Breite des Fensters skaliert; das Fenster selbst
 * bekommt das Seitenverhältnis der Zielfläche, sonst verzerrte der Ausschnitt.
 */
export function bildLage(quelle: Groesse, ziel: Groesse): Lage {
  const fensterHoehe = quelle.hoehe * AUSSCHNITT.hoehe;
  const fensterBreite = fensterHoehe * (ziel.breite / ziel.hoehe);
  const fensterOben = quelle.hoehe * AUSSCHNITT.oben;
  const fensterLinks = quelle.breite * AUSSCHNITT.mitteX - fensterBreite / 2;

  const faktor = ziel.breite / fensterBreite;
  return {
    x: rund(-fensterLinks * faktor),
    y: rund(-fensterOben * faktor),
    breite: rund(quelle.breite * faktor),
    hoehe: rund(quelle.hoehe * faktor),
  };
}

/**
 * Das Foto — und NUR das Foto.
 *
 * Kein Verlauf hier drin: siehe den Kopf dieser Datei. Der Pfad zeigt auf ein
 * PNG, nicht auf das `webp` im Repo — `rsvg-convert` lädt eingebettete Bilder
 * über gdk-pixbuf und fällt bei fehlendem WebP-Loader still aus. Dekodiert wird
 * vorher, in `splash.ts`, mit Abbruch.
 */
export function bandSvg(pngPfad: string, quelle: Groesse, ziel: Groesse = BAND_BILD): string {
  const lage = bildLage(quelle, ziel);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `     width="${ziel.breite}" height="${ziel.hoehe}" viewBox="0 0 ${ziel.breite} ${ziel.hoehe}">`,
    `  <image xlink:href="${pngPfad}" x="${lage.x}" y="${lage.y}"`,
    `         width="${lage.breite}" height="${lage.hoehe}" preserveAspectRatio="none"/>`,
    `</svg>`,
  ].join("\n");
}

/**
 * Die Rampe als eigene Ebene.
 *
 * Schmal und hoch: sie wird im Storyboard GESTRECKT (`scaleToFill`), nicht
 * formatfüllend beschnitten. Ein senkrechter Verlauf verträgt das ohne
 * Artefakte — und nur so liegt seine Unterkante immer auf der Unterkante des
 * Fotos.
 */
export function verlaufSvg(breite = VERLAUF_BILD.breite, hoehe = VERLAUF_BILD.hoehe): string {
  const stopps = RAMPE.map(
    (s) => `      <stop offset="${s.offset}" stop-color="${GRUND}" stop-opacity="${s.deckung}"/>`,
  ).join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${hoehe}" viewBox="0 0 ${breite} ${hoehe}">`,
    `  <defs>`,
    `    <linearGradient id="rampe" gradientUnits="userSpaceOnUse" x1="0" y1="${hoehe}" x2="0" y2="0">`,
    stopps,
    `    </linearGradient>`,
    `  </defs>`,
    `  <rect width="${breite}" height="${hoehe}" fill="url(#rampe)"/>`,
    `</svg>`,
  ].join("\n");
}

/** Grössen innerhalb der Schriftzug-Fläche. Reine Layoutzahlen. */
const MARKE_GROESSE = 220;
const WORTMARKE = { x: 270, basis: 155, groesse: 126 };
const CLAIM_ZEILEN = { x: 0, basis: [520, 695], groesse: 152 };
const SUBLINE_ZEILE = { x: 0, basis: 900, groesse: 70 };
/** `tracking-tight` ist -0.025em; hier in Bildpunkten der jeweiligen Grösse. */
const ENG = -0.025;

/**
 * Marke, Wortmarke, Claim und Subline auf durchsichtigem Grund.
 *
 * Die Marke wird aus dem Favicon gelesen und nicht abgeschrieben — dieselbe
 * Entscheidung wie beim App-Symbol, aus demselben Grund: eine weitere Kopie im
 * Repo liefe still auseinander, und der Unterschied fiele erst auf einem Gerät
 * auf. Anders als dort steht sie hier in `INK` statt in Weiss, weil sie auf der
 * hellen Fläche neben dunkler Schrift sitzt.
 */
export function schriftzugSvg(marke: Marke): string {
  const faktor = rund(MARKE_GROESSE / marke.kante);
  const { cx, cy, r, strichbreite } = marke.ring;
  const punkt = (t: string) => `<tspan fill="${AKZENT}">${t}</tspan>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SCHRIFTZUG_BILD.breite}" height="${SCHRIFTZUG_BILD.hoehe}"`,
    `     viewBox="0 0 ${SCHRIFTZUG_BILD.breite} ${SCHRIFTZUG_BILD.hoehe}">`,
    `  <g transform="scale(${faktor})">`,
    `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="${strichbreite}"/>`,
    `    <path d="${marke.stern}" fill="${INK}"/>`,
    `  </g>`,
    `  <text x="${WORTMARKE.x}" y="${WORTMARKE.basis}" font-family="Inter" font-weight="600"`,
    `        font-size="${WORTMARKE.groesse}" letter-spacing="${rund(WORTMARKE.groesse * ENG)}"`,
    `        fill="${INK}">eff${punkt(".")}bee${punkt(".")}zee</text>`,
    ...CLAIM.map(
      (zeile, i) =>
        `  <text x="${CLAIM_ZEILEN.x}" y="${CLAIM_ZEILEN.basis[i]}" font-family="Fraunces" font-weight="600"\n` +
        `        font-size="${CLAIM_ZEILEN.groesse}" letter-spacing="${rund(CLAIM_ZEILEN.groesse * ENG)}"\n` +
        `        fill="${INK}">${zeile}</text>`,
    ),
    `  <text x="${SUBLINE_ZEILE.x}" y="${SUBLINE_ZEILE.basis}" font-family="Inter" font-weight="400"`,
    `        font-size="${SUBLINE_ZEILE.groesse}" fill="${GEDAEMPFT}">${SUBLINE}</text>`,
    `</svg>`,
  ].join("\n");
}

/**
 * Der Eintrag eines Image Sets.
 *
 * Ein einziger, universeller Slot statt der drei, die Capacitor anlegt: die
 * Grösse der drei Ebenen bestimmen im Storyboard Constraints, nicht die
 * intrinsische Grösse des Bildes. Drei identische Auflösungen wären drei Mal
 * dieselbe Datei im Bündel.
 */
export function contentsJson(dateiname: string): string {
  return (
    JSON.stringify(
      {
        images: [{ idiom: "universal", filename: dateiname, scale: "1x" }],
        info: { author: "xcode", version: 1 },
      },
      null,
      2,
    ) + "\n"
  );
}
