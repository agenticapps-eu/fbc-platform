/**
 * Erzeugt die Startfläche für iOS (AGE-642, B5).
 *
 *   pnpm splash
 *
 * Die Regeln stehen in `splash.logic.ts` und sind dort geprüft; diese Datei tut
 * nur, was ein Test nicht tun kann: dekodieren, rastern, schreiben — und
 * vorher nachweisen, dass die Quellen wirklich gebunden sind.
 *
 * ══ FAIL-CLOSED, UND ZWAR FÜR ALLE DREI QUELLEN ════════════════════════════
 * Marke, Bild und Schrift. Der Grund ist zweimal gemessen und beide Male
 * derselbe Fehlermodus — eine plausibel aussehende Datei, der niemand ansieht,
 * dass sie falsch ist:
 *
 *  1. `rsvg-convert` nimmt auf macOS über pango den CoreText-Pfad und
 *     IGNORIERT dabei jede eigene `fonts.conf` stillschweigend. Gemessen kam
 *     Fraunces als Grotesk heraus, ohne Fehlermeldung.
 *  2. Eingebettete Bilder lädt es über gdk-pixbuf, das bei fehlendem
 *     WebP-Loader ebenso still ausfällt — das Foto wäre dann einfach weg.
 *
 * Gegen (1) steht `pruefeSchriftbindung()`: `fc-match` MUSS für Inter und
 * Fraunces auf die entpackte Repo-TTF zeigen. Das ist ein POSITIVER Nachweis.
 * Die Gegenprobe — dass eine Systemschrift nicht durchgreift — steht daneben,
 * nicht an seiner Stelle: eine gelungene stille Ersetzung als „Positivkontrolle"
 * zu führen wäre genau der Fail-open-Fall, den diese Datei verhindern soll.
 *
 * Gegen (2) steht die Regionsprobe in `main()`: das ausgelieferte Band wird in
 * seiner OBEREN Region gemessen. Ist dort Weiss, ist das Foto nicht angekommen.
 * Ein Mittelwert über das ganze Bild taugte dafür nicht — die Komposition endet
 * absichtlich in demselben Weiss, mit dem die Fläche vorher gefüllt war.
 *
 * ══ DIE ENTPACKTEN TTF WERDEN NICHT VERSIONIERT ════════════════════════════
 * Sie entstehen bei jedem Lauf neu aus den `woff2` im Repo. Die bleiben damit
 * die einzige Fassung der Schriften — eine zweite, die auseinanderlaufen kann,
 * entsteht gar nicht erst.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { leseMarke } from "./app-icons.logic";
import {
  BAND_BILD,
  GRUND,
  SCHRIFTZUG_BILD,
  VERLAUF_BILD,
  bandSvg,
  contentsJson,
  schriftzugSvg,
  verlaufSvg,
} from "./splash.logic";

const FAVICON = "public/brand/compass-favicon.svg";
const FOTO = "public/images/hero-mitglieder.webp";
const SCHRIFTEN = ["inter-latin", "fraunces-latin"];
const XCASSETS = "ios/App/App/Assets.xcassets";

/** Die drei Ebenen. `Splash` behält seinen Namen: das Storyboard kennt ihn
 *  schon, und was sich ändert, ist sein Inhalt, nicht seine Rolle. */
const EBENEN = {
  // Als JPEG, und nur diese eine: das Band ist ein Foto und deckt seine Fläche
  // vollständig — es braucht keinen Alphakanal. Als PNG wog es 1,2 MB und liess
  // `Assets.car` von 108 KB auf 1,3 MB wachsen, also um 8 % des ganzen Bündels,
  // für ein Bild, das beim Start dekodiert wird. Verlauf und Schriftzug bleiben
  // PNG; beide sind durchsichtig und wären als JPEG kaputt.
  band: { set: "Splash", datei: "splash-band.jpg" },
  verlauf: {
    set: "SplashVerlauf",
    datei: "splash-verlauf.png",
    svg: "assets/splash-verlauf.svg",
  },
  schriftzug: {
    set: "SplashSchriftzug",
    datei: "splash-schriftzug.png",
    svg: "assets/splash-schriftzug.svg",
  },
};

/**
 * Gibt es das Werkzeug?
 *
 * Über `which` und nicht über `--version`: `woff2_decompress` kennt keinen
 * solchen Schalter und beendet sich mit einem Fehler, wäre also fälschlich als
 * fehlend gemeldet worden.
 */
function werkzeug(name: string, hinweis: string): void {
  try {
    execFileSync("/usr/bin/which", [name], { stdio: "ignore" });
  } catch {
    throw new Error(`splash: \`${name}\` fehlt. ${hinweis} Es wurde nichts geschrieben.`);
  }
}

function schreibe(pfad: string, inhalt: string): void {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}

/**
 * Entpackt die Repo-Schriften und schreibt eine `fonts.conf`, die NUR sie sieht.
 *
 * Die Isolation ist Absicht: sähe fontconfig zusätzlich die Systemschriften,
 * fiele eine nicht gefundene Familie still auf eine ähnliche zurück, statt zu
 * scheitern.
 */
function richteSchriftenEin(arbeit: string): string {
  const ordner = join(arbeit, "fonts");
  mkdirSync(ordner, { recursive: true });
  for (const name of SCHRIFTEN) {
    const woff2 = join(ordner, `${name}.woff2`);
    writeFileSync(woff2, readFileSync(`public/fonts/${name}.woff2`));
    execFileSync("woff2_decompress", [woff2], { stdio: "ignore" });
  }
  const conf = join(arbeit, "fonts.conf");
  writeFileSync(
    conf,
    [
      '<?xml version="1.0"?>',
      '<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">',
      "<fontconfig>",
      `  <dir>${ordner}</dir>`,
      `  <cachedir>${join(arbeit, "fccache")}</cachedir>`,
      "</fontconfig>",
      "",
    ].join("\n"),
  );
  return conf;
}

/** Die Umgebung, in der gerastert wird. Beide Variablen sind nötig. */
function umgebung(conf: string): NodeJS.ProcessEnv {
  return { ...process.env, FONTCONFIG_FILE: conf, PANGOCAIRO_BACKEND: "fc" };
}

/**
 * Der positive Nachweis: löst die verlangte Familie auf die Repo-TTF auf?
 *
 * Geprüft wird am VERHALTEN, nicht am Namen der Umgebungsvariablen — ob
 * `PANGOCAIRO_BACKEND=fc` in einem anderen pango-Bau wirkt, weiss diese Datei
 * nicht, und sie muss es auch nicht wissen.
 */
function pruefeSchriftbindung(conf: string, arbeit: string): void {
  for (const familie of ["Inter", "Fraunces"]) {
    const treffer = execFileSync("fc-match", ["--format=%{file}", familie], {
      env: umgebung(conf),
      encoding: "utf8",
    });
    if (!treffer.startsWith(join(arbeit, "fonts"))) {
      throw new Error(
        `splash: \`${familie}\` löst nicht auf die Schrift dieses Repositories auf, ` +
          `sondern auf \`${treffer}\`. Es wurde nichts geschrieben.`,
      );
    }
  }
  // Gegenprobe, nicht Kontrolle: in dieser Isolation darf eine Systemschrift
  // nicht durchgreifen. Schlägt sie fehl, ist die Prüfung oben wertlos, weil
  // dann irgendetwas anderes die Auflösung besorgt.
  const fremd = execFileSync("fc-match", ["--format=%{file}", "Georgia"], {
    env: umgebung(conf),
    encoding: "utf8",
  });
  if (!fremd.startsWith(join(arbeit, "fonts"))) {
    throw new Error(
      `splash: die Schrift-Isolation greift nicht — \`Georgia\` fand \`${fremd}\` ` +
        `ausserhalb des Repositories. Es wurde nichts geschrieben.`,
    );
  }
}

/** Kantenlängen eines Bildes, über `sips`. */
function groesse(pfad: string): { breite: number; hoehe: number } {
  const aus = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", pfad], {
    encoding: "utf8",
  });
  const b = /pixelWidth:\s*(\d+)/.exec(aus);
  const h = /pixelHeight:\s*(\d+)/.exec(aus);
  if (!b || !h) throw new Error(`splash: konnte \`${pfad}\` nicht vermessen.`);
  return { breite: Number(b[1]), hoehe: Number(h[1]) };
}

/**
 * Die Farbe einer Region, als `#rrggbb`.
 *
 * Über BMP, weil das unkomprimiert ist und der Bildpunkt an einer bekannten
 * Stelle steht — ein PNG müsste erst dekodiert werden.
 */
function farbe(
  png: string,
  arbeit: string,
  region: { x: number; y: number; breite: number; hoehe: number },
): string {
  const schnitt = join(arbeit, "region.png");
  execFileSync(
    "sips",
    [
      "-c",
      String(region.hoehe),
      String(region.breite),
      "--cropOffset",
      String(region.y),
      String(region.x),
      png,
      "--out",
      schnitt,
    ],
    { stdio: "ignore" },
  );
  // `-z 1 1` (genaue Grösse) und NICHT `-Z 1` (grösste Kante): letzteres
  // rechnet bei einer flachen Region die kurze Kante auf null und bricht mit
  // „Unable to render destination image" ab.
  const punkt = join(arbeit, "punkt.png");
  execFileSync("sips", ["-z", "1", "1", schnitt, "--out", punkt], { stdio: "ignore" });
  const bmp = join(arbeit, "region.bmp");
  execFileSync("sips", ["-s", "format", "bmp", punkt, "--out", bmp], { stdio: "ignore" });
  const roh = readFileSync(bmp);
  // Der Anfang der Bildpunkte steht im Kopf (Byte 10) und ist NICHT immer 54:
  // `sips` schreibt je nach Quelle einen längeren DIB-Kopf. Fest auf 54 gelesen
  // kam hier `#ff0000` heraus — eine Farbe, die im Bild gar nicht vorkommt.
  const anfang = roh.readUInt32LE(10);
  const [b, g, r] = [roh[anfang], roh[anfang + 1], roh[anfang + 2]];
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function rastere(svg: string, png: string, breite: number, env: NodeJS.ProcessEnv): void {
  mkdirSync(dirname(png), { recursive: true });
  execFileSync("rsvg-convert", ["-w", String(breite), svg, "-o", png], { env });
}

function legeAb(ebene: { set: string; datei: string }, png: string): void {
  const ordner = `${XCASSETS}/${ebene.set}.imageset`;
  // Erst leeren: `Splash` trägt heute drei identische 2732er-PNG des
  // Frameworks. Blieben sie liegen, lägen sie im Bündel weiter mit — und der
  // Diff zeigte nicht, dass sie ersetzt wurden.
  rmSync(ordner, { recursive: true, force: true });
  mkdirSync(ordner, { recursive: true });
  writeFileSync(`${ordner}/${ebene.datei}`, readFileSync(png));
  writeFileSync(`${ordner}/Contents.json`, contentsJson(ebene.datei));
}

function main(): void {
  werkzeug("rsvg-convert", "Auf macOS: `brew install librsvg`.");
  werkzeug("woff2_decompress", "Auf macOS: `brew install woff2`.");

  const arbeit = mkdtempSync(join(tmpdir(), "fbc-splash-"));
  try {
    const conf = richteSchriftenEin(arbeit);
    pruefeSchriftbindung(conf, arbeit);
    const env = umgebung(conf);
    console.log("Schriften: Inter und Fraunces binden auf die Dateien dieses Repos.");

    // Das `webp` wird dekodiert, nicht eingebettet: gdk-pixbuf fiele sonst
    // still aus, und das Foto wäre einfach weg.
    const fotoPng = join(arbeit, "foto.png");
    execFileSync("sips", ["-s", "format", "png", FOTO, "--out", fotoPng], { stdio: "ignore" });
    const quelle = groesse(fotoPng);
    console.log(`Foto: ${FOTO} → ${quelle.breite}×${quelle.hoehe} px dekodiert.`);

    const marke = leseMarke(readFileSync(FAVICON, "utf8"));

    // Das Band-SVG zeigt relativ auf das Foto daneben und bleibt deshalb im
    // Arbeitsordner; versioniert werden die beiden, die man im Diff LESEN kann.
    const bandDatei = join(arbeit, "band.svg");
    writeFileSync(bandDatei, bandSvg("foto.png", quelle) + "\n");
    schreibe(EBENEN.verlauf.svg, verlaufSvg() + "\n");
    schreibe(EBENEN.schriftzug.svg, schriftzugSvg(marke) + "\n");

    const bandPng = join(arbeit, "band.png");
    const bandJpg = join(arbeit, EBENEN.band.datei);
    const verlaufPng = join(arbeit, EBENEN.verlauf.datei);
    const schriftzugPng = join(arbeit, EBENEN.schriftzug.datei);
    rastere(bandDatei, bandPng, BAND_BILD.breite, env);
    execFileSync(
      "sips",
      ["-s", "format", "jpeg", "-s", "formatOptions", "85", bandPng, "--out", bandJpg],
      {
        stdio: "ignore",
      },
    );
    rastere(EBENEN.verlauf.svg, verlaufPng, VERLAUF_BILD.breite, env);
    rastere(EBENEN.schriftzug.svg, schriftzugPng, SCHRIFTZUG_BILD.breite, env);

    // Der Nachweis, dass das Foto angekommen ist — am AUSGELIEFERTEN JPEG, nicht
    // am PNG davor. Ein Mittelwert über das ganze Bild taugte dafür nicht: die
    // Komposition endet absichtlich in Weiss.
    const oben = farbe(bandJpg, arbeit, {
      x: 0,
      y: 0,
      breite: BAND_BILD.breite,
      hoehe: Math.round(BAND_BILD.hoehe * 0.2),
    });
    if (oben.toLowerCase() === GRUND.toLowerCase()) {
      throw new Error(
        "splash: die obere Region des Bandes ist reines Weiss — das Foto ist nicht " +
          "angekommen (gdk-pixbuf ohne WebP-Loader?). Es wurde nichts geschrieben.",
      );
    }
    const unten = farbe(verlaufPng, arbeit, {
      x: 0,
      y: VERLAUF_BILD.hoehe - 4,
      breite: VERLAUF_BILD.breite,
      hoehe: 4,
    });
    if (unten.toLowerCase() !== GRUND.toLowerCase()) {
      throw new Error(
        `splash: die Unterkante des Verlaufs misst ${unten} statt ${GRUND}. ` +
          "Die Kante des Fotos wäre sichtbar. Es wurde nichts geschrieben.",
      );
    }
    console.log(`Band oben: ${oben} (nicht Weiss) · Verlauf unten: ${unten}`);

    legeAb(EBENEN.band, bandJpg);
    legeAb(EBENEN.verlauf, verlaufPng);
    legeAb(EBENEN.schriftzug, schriftzugPng);
    for (const e of Object.values(EBENEN)) {
      console.log(`ios      ${XCASSETS}/${e.set}.imageset/${e.datei}`);
    }
  } finally {
    rmSync(arbeit, { recursive: true, force: true });
  }
}

main();
