import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { leseMarke } from "./app-icons.logic";
import {
  AKZENT,
  AUSSCHNITT,
  AUSSCHNITT_QUER,
  BAND_ANTEIL,
  BAND_QUER,
  CLAIM,
  GEDAEMPFT,
  GRUND,
  INK,
  RAMPE,
  RAMPE_DECKEND_AB,
  SCHRIFTZUG_HOEHE,
  SCHRIFTZUG_OBEN,
  SCHRIFTZUG_SEITENVERHAELTNIS,
  SUBLINE,
  ANDROID_SYMBOL,
  MARKE_AUF_WEISS,
  androidSymbolXml,
  bandSvg,
  bildLage,
  schriftzugSvg,
  verlaufSvg,
} from "./splash.logic";

/**
 * Die Startfläche (AGE-642, B5).
 *
 * WAS DIESER TEST WIRKLICH BEWACHT: dass die Fläche, die vor der Anwendung
 * steht, dieselbe Marke, dieselbe Rampe und dieselben Worte trägt wie das
 * Login-Panel — und dass sie das auf jeder Bildschirmgrösse und in jeder
 * Orientierung tut, ohne dass jemand sie dort nachrechnet.
 *
 * Was er ausdrücklich NICHT kann: sagen, wie es aussieht. Der Beleg dafür ist
 * ein Bildschirmfoto vom Gerät, nach frischer Installation — iOS hält den
 * Startbildschirm sonst aus dem Zwischenspeicher.
 */
const FAVICON = readFileSync("public/brand/compass-favicon.svg", "utf8");
const LOGIN = readFileSync("src/pages/LoginPage.tsx", "utf8");

const marke = leseMarke(FAVICON);

describe("Die Rampe ist die des Login-Panels", () => {
  it("läuft über vier Übergänge aus, nicht über einen", () => {
    // Ein harter Wechsel von deckend auf halbtransparent ergab im Login eine
    // sichtbare Kante bei 26 %. Fünf Stopps, also vier Übergänge — eine
    // Startfläche mit zwei Stopps hätte denselben Fehler, nur an einer Stelle,
    // die niemand aufruft.
    expect(RAMPE).toHaveLength(5);
  });

  it("hat dieselben Offsets und Deckungen wie `LoginPage.tsx`", () => {
    expect(RAMPE).toEqual([
      { offset: 0, deckung: 1 },
      { offset: 0.22, deckung: 1 },
      { offset: 0.32, deckung: 0.7 },
      { offset: 0.44, deckung: 0.25 },
      { offset: 0.58, deckung: 0 },
    ]);
    // Und dieselben Zahlen stehen wirklich im Login-Panel — nicht nur hier.
    for (const anteil of ["22%", "32%", "44%", "58%"]) {
      expect(LOGIN).toContain(anteil);
    }
  });

  it("endet unten in genau der Farbe, auf der der Schriftzug steht", () => {
    const unten = RAMPE.find((s) => s.offset === 0)!;
    expect(unten.deckung).toBe(1);
    expect(GRUND).toBe("#ffffff");
  });

  it("erzeugt einen Verlauf, dessen unterste Zeile deckend ist", () => {
    const svg = verlaufSvg(8, 1024);
    expect(svg).toContain('stop-opacity="1"');
    expect(svg).toContain(`stop-color="${GRUND}"`);
    // Der Verlauf steht als EIGENE Ebene und wird gestreckt, nicht
    // formatfüllend beschnitten. Deshalb darf er kein Foto kennen.
    expect(svg).not.toContain("<image");
  });
});

describe("Die Verhältnis-Invariante trennt den Text von jeder Bildlage", () => {
  /**
   * Das ist die eigentliche Zusage dieser Fläche, und sie ist eine Rechnung,
   * kein Augenmass: der Schriftzug beginnt erst dort, wo die Rampe schon
   * deckend ist. Weil beide Seiten Anteile DERSELBEN Höhe sind, gilt sie für
   * jede Bildschirmgrösse und jede Orientierung zugleich.
   */
  it("beginnt der Schriftzug unterhalb des deckenden Rampenanteils", () => {
    expect(SCHRIFTZUG_OBEN).toBeGreaterThanOrEqual(BAND_ANTEIL * (1 - RAMPE_DECKEND_AB));
  });

  it("bleibt der Schriftzug innerhalb der Fläche", () => {
    expect(SCHRIFTZUG_OBEN + SCHRIFTZUG_HOEHE).toBeLessThan(1);
  });

  it("passt der Schriftzug quer auf ein iPhone", () => {
    // 402 pt Höhe im Querformat (iPhone 17 Pro). Die Invariante oben ist
    // anteilig, also gilt sie hier auch — geprüft wird, dass die Anteile in
    // echten Punkten keine unlesbare Grösse ergeben.
    const querHoehe = 402;
    const zugHoehe = querHoehe * SCHRIFTZUG_HOEHE;
    expect(zugHoehe).toBeGreaterThan(80);
    const zugBreite = zugHoehe * SCHRIFTZUG_SEITENVERHAELTNIS;
    expect(zugBreite + 32).toBeLessThan(874); // Querbreite, plus linker Rand
  });
});

describe("Der Ausschnitt ist ein Anteil, keine Pixelkoordinate", () => {
  it("bleibt beim Tausch des Quellbildes derselbe Bildbereich", () => {
    const klein = bildLage({ breite: 1600, hoehe: 1067 }, { breite: 1290, hoehe: 1734 });
    const gross = bildLage({ breite: 3200, hoehe: 2134 }, { breite: 1290, hoehe: 1734 });
    // Doppelte Quelle, gleiches Ergebnis auf der Zielfläche: der Ausschnitt
    // hängt an Anteilen, nicht an Pixeln.
    expect(gross.x).toBeCloseTo(klein.x, 1);
    expect(gross.y).toBeCloseTo(klein.y, 1);
    expect(gross.breite).toBeCloseTo(klein.breite, 1);
    expect(gross.hoehe).toBeCloseTo(klein.hoehe, 1);
  });

  it("deckt die Zielfläche vollständig ab", () => {
    const ziel = { breite: 1290, hoehe: 1734 };
    const lage = bildLage({ breite: 1600, hoehe: 1067 }, ziel);
    expect(lage.x).toBeLessThanOrEqual(0);
    expect(lage.y).toBeLessThanOrEqual(0);
    expect(lage.x + lage.breite).toBeGreaterThanOrEqual(ziel.breite);
    expect(lage.y + lage.hoehe).toBeGreaterThanOrEqual(ziel.hoehe);
  });

  it("schneidet oben ab, damit die Gesichter über der Rampe stehen", () => {
    // Der Ausschnitt lässt den oberen Rand des Quellbildes weg. Mit dem
    // Login-Ausschnitt lagen beide Gesichter in der Zone, in der die Rampe
    // einsetzt. Die Zahl ist eine Designentscheidung; geprüft wird nur, dass
    // sie wirkt — sonst wäre sie beim nächsten Bildtausch stumm verschwunden.
    expect(AUSSCHNITT.oben).toBeGreaterThan(0);
    expect(AUSSCHNITT.hoehe).toBeLessThan(1);
  });
});

/**
 * Der Querformat-Ausschnitt (AGE-712).
 *
 * WAS HIER SCHIEFGING: das Band ist hochkant (1290×1734), und der Storyboard-
 * `imageView` steht auf `scaleAspectFill`. Auf einem quer gehaltenen Telefon
 * schneidet das mittig einen 3,5:1-Streifen aus einem Bild, das seinerseits
 * schon ein Ausschnitt war. Beschnitten wird also ZWEIMAL, und übrig bleibt die
 * helle Fensterwand ZWISCHEN den beiden Personen — beide Köpfe fallen heraus.
 * Donalds Wortlaut am Gerät: „nur weisser Bildschirm quer."
 *
 * WARUM KEINE HELLIGKEITSPRÜFUNG: der naheliegende Test wäre „quer darf nicht
 * heller werden". Er wäre falsch. Gemessen ist der richtige Ausschnitt
 * **185/172/157** und damit HELLER als der kaputte (148/139/134) — weil der
 * kaputte Oberkörper in dunklen Anzügen zeigt und der richtige Gesichter vor
 * einem hellen Fenster. Die Helligkeit misst hier das Gegenteil dessen, was
 * gemeint ist. „Beide Gesichter sind im Bild" ist kein Skalar; das trägt der
 * Augenschein. Hier steht nur die GEOMETRIE, damit sie niemand still verschiebt.
 */
describe("Quer bekommt ein eigenes Fenster, nicht den Mittelstreifen des Hochkantbandes", () => {
  const QUELLE = { breite: 1600, hoehe: 1068 };

  // DIE Regressionsschranke. Wäre `AUSSCHNITT_QUER` dasselbe Fenster wie
  // hochkant, wäre der Fehler zurück — nur an anderer Stelle geschrieben.
  it("ist flacher als das Hochkantfenster", () => {
    expect(AUSSCHNITT_QUER.hoehe).toBeLessThan(AUSSCHNITT.hoehe);
  });

  it("hält das Seitenverhältnis, das der Storyboard-Ausschnitt verlangt", () => {
    expect(BAND_QUER.breite / BAND_QUER.hoehe).toBeCloseTo(3.5, 1);
  });

  // Donalds Entscheidung vom 09.09.: „beide Gesichter, volle Breite". Das Foto
  // ist quer (1600×1068) — was quer fehlt, liegt darin schon vor. Ein Fenster,
  // das Breite wegwirft, wirft genau die Personen weg.
  // Die Zusage ist „wirft keine Breite weg", nicht „trifft die Kante exakt".
  // Exakt zu treffen wäre sogar falsch: ein Fenster ohne Rundungsreserve
  // erzeugt einen durchsichtigen Haarstrich an der Kante (siehe den Kommentar
  // an `AUSSCHNITT_QUER`). Geprüft wird deshalb der Anteil.
  //
  // Mutation: `mitteX` auf 0.40625 setzen (der Hochkantwert) → rot, denn dann
  // sitzt das Fenster links und schneidet die rechte Person an.
  it("nutzt praktisch die volle Breite der Quelle", () => {
    const lage = bildLage(QUELLE, BAND_QUER, AUSSCHNITT_QUER);
    const ueberstandLinks = -lage.x / lage.breite;
    const ueberstandRechts = (lage.x + lage.breite - BAND_QUER.breite) / lage.breite;
    expect(ueberstandLinks).toBeLessThan(0.01);
    expect(ueberstandRechts).toBeLessThan(0.01);
    // Und symmetrisch, sonst sitzt das Fenster nicht auf der Bildmitte.
    expect(Math.abs(ueberstandLinks - ueberstandRechts)).toBeLessThan(0.005);
  });

  it("deckt die Zielfläche vollständig ab", () => {
    const lage = bildLage(QUELLE, BAND_QUER, AUSSCHNITT_QUER);
    expect(lage.x).toBeLessThanOrEqual(0);
    expect(lage.y).toBeLessThanOrEqual(0);
    expect(lage.x + lage.breite).toBeGreaterThanOrEqual(BAND_QUER.breite);
    expect(lage.y + lage.hoehe).toBeGreaterThanOrEqual(BAND_QUER.hoehe);
  });

  // Das Fenster sitzt auf den Gesichtern, nicht einfach oben. Mutation: `oben`
  // auf 0 setzen → rot, und genau dann stünde der Fensterrahmen im Bild statt
  // der Personen.
  it("sitzt auf den Gesichtern, nicht am oberen Rand", () => {
    expect(AUSSCHNITT_QUER.oben).toBeGreaterThan(0.1);
    const unterkante = AUSSCHNITT_QUER.oben + AUSSCHNITT_QUER.hoehe;
    expect(unterkante).toBeLessThan(1);
  });

  it("bleibt beim Tausch des Quellbildes derselbe Bildbereich", () => {
    const klein = bildLage(QUELLE, BAND_QUER, AUSSCHNITT_QUER);
    const gross = bildLage(
      { breite: QUELLE.breite * 2, hoehe: QUELLE.hoehe * 2 },
      BAND_QUER,
      AUSSCHNITT_QUER,
    );
    expect(gross.x).toBeCloseTo(klein.x, 1);
    expect(gross.y).toBeCloseTo(klein.y, 1);
    expect(gross.breite).toBeCloseTo(klein.breite, 1);
  });

  // `bandSvg` muss das Fenster durchreichen. Ohne das entstünde die Querdatei
  // aus dem HOCHKANT-Fenster — also wieder der Fehler, diesmal in einer Datei,
  // die „quer" heisst.
  it("bandSvg nimmt das Querfenster an", () => {
    const svg = bandSvg("foto.png", QUELLE, BAND_QUER, AUSSCHNITT_QUER);
    const hoch = bandSvg("foto.png", QUELLE, BAND_QUER, AUSSCHNITT);
    expect(svg).toContain(`width="${BAND_QUER.breite}"`);
    expect(svg).not.toEqual(hoch);
  });
});

describe("Die Marke kommt aus dem Favicon, nicht aus einer Kopie", () => {
  it("trägt den Stern wörtlich so, wie er im Favicon steht", () => {
    const svg = schriftzugSvg(marke);
    expect(svg).toContain(marke.stern);
  });

  it("folgt einem geänderten Stern, statt ihn abgeschrieben zu haben", () => {
    // Die Gegenprobe zum Test darüber: dort könnte auch eine zweite Kopie im
    // Skript zufällig dasselbe sagen. Hier wird das Favicon verändert — nur
    // wer es wirklich liest, zieht mit.
    const anders = leseMarke(FAVICON.replace(marke.stern, "M1 1 L9 9 Z"));
    const svg = schriftzugSvg(anders);
    expect(anders.stern).toBe("M1 1 L9 9 Z");
    expect(svg).toContain('d="M1 1 L9 9 Z"');
    expect(svg).not.toContain(marke.stern);
  });

  it("zeichnet die Marke in Ink und nicht im Blau des Favicons", () => {
    // Das Favicon ist `#1F53B0` auf durchsichtig — richtig für einen Tab, dem
    // seine Fläche gehört. Hier steht die Marke auf Weiss neben dunkler
    // Schrift und trägt deren Farbe.
    const svg = schriftzugSvg(marke);
    expect(svg).toContain(INK);
    expect(svg).not.toContain("#1F53B0");
  });
});

describe("Der Schriftzug trägt die Worte und die Schriften des Login-Panels", () => {
  it("setzt die Wortmarke in Inter mit Akzentpunkten", () => {
    const svg = schriftzugSvg(marke);
    expect(svg).toContain('font-family="Inter"');
    expect(svg).toContain(`fill="${AKZENT}"`);
    // Klein geschrieben, nie in Versalien (`Logo.tsx`).
    expect(svg).toContain("eff");
    expect(svg).toContain("bee");
    expect(svg).toContain("zee");
    expect(svg).not.toContain("EFF");
  });

  it("setzt den Claim in Fraunces und die Subline in Inter", () => {
    const svg = schriftzugSvg(marke);
    expect(svg).toContain('font-family="Fraunces"');
    for (const zeile of CLAIM) expect(svg).toContain(zeile);
    expect(svg).toContain(SUBLINE);
    expect(svg).toContain(`fill="${GEDAEMPFT}"`);
  });

  it("nimmt dieselben Worte, die auch das Login-Panel zeigt", () => {
    // Die Startfläche darf nicht etwas anderes versprechen als die Seite, auf
    // der man gleich landet.
    expect(LOGIN).toContain(CLAIM.join(" "));
    expect(LOGIN).toContain(SUBLINE);
  });
});

describe("Das Band ist nur das Foto — der Verlauf liegt darüber", () => {
  it("backt keinen Verlauf ins Bild", () => {
    const svg = bandSvg("/pfad/zum/foto.png", { breite: 1600, hoehe: 1067 });
    expect(svg).toContain("<image");
    // Wäre der Verlauf hier eingebacken, würde er beim formatfüllenden
    // Beschneiden mitbeschnitten — quer läge seine Unterkante mitten im
    // Farbverlauf, und die Kante des Fotos wäre sichtbar.
    expect(svg).not.toContain("linearGradient");
  });
});

/**
 * Die Startfläche auf ANDROID (AGE-713).
 *
 * WAS HIER ANDERS IST ALS AUF iOS: seit Android 12 zeichnet die
 * SplashScreen-API die Fläche aus genau zwei Dingen — einer Grundfarbe und
 * einem Symbol. Das Bitmap unter `@drawable/splash`, das Capacitor anlegt, wird
 * NICHT mehr gezeigt. Foto, Verlauf und Schriftzug des iOS-Storyboards haben
 * dort also kein Gegenstück; sie nachzubauen ist nicht „noch nicht gemacht",
 * sondern von der Plattform nicht vorgesehen.
 *
 * Donalds Entscheidung vom 09.09.: weisser Grund, Stern zentriert. Weiss ist
 * dieselbe Farbe wie `GRUND`, auf der auch die Boot-Fläche dahinter sitzt —
 * damit hat der Übergang keine sichtbare Kante.
 */
describe("Die Android-Startfläche kommt aus derselben Marke", () => {
  const marke = leseMarke(readFileSync("public/brand/compass-favicon.svg", "utf8"));

  // Dieselbe Zusage wie für das iOS-Symbol: der Stern wird gelesen, nicht
  // abgeschrieben. Mutation: den Pfad im Favicon ändern → dieser Test folgt ihm,
  // eine Kopie im Skript täte es nicht.
  it("trägt den Stern wörtlich so, wie er im Favicon steht", () => {
    expect(androidSymbolXml(marke)).toContain(marke.stern);
  });

  // Die Farbe steht in `splash.logic.ts` ein zweites Mal, weil `leseMarke` nur
  // Form und Kante liefert. Dieser Test ist der Ersatz für die fehlende
  // Kopplung — ohne ihn wäre genau das die stille Abweichung, vor der der
  // Kommentar im Favicon warnt: der Tab trüge ein anders gefärbtes Logo als
  // die Startfläche. Mutation: einen der beiden Werte ändern → rot.
  it("trägt dieselbe Farbe, die im Favicon steht", () => {
    const imFavicon = /fill="(#[0-9A-Fa-f]{6})"/.exec(
      readFileSync("public/brand/compass-favicon.svg", "utf8"),
    );
    expect(imFavicon, "kein fill am Stern im Favicon").not.toBeNull();
    expect(MARKE_AUF_WEISS.toLowerCase()).toBe(imFavicon![1].toLowerCase());
    expect(androidSymbolXml(marke)).toContain(`android:fillColor="${MARKE_AUF_WEISS}"`);
  });

  it("ist ein Vector Drawable, kein Raster", () => {
    const xml = androidSymbolXml(marke);
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toContain("<vector");
    expect(xml).toContain("android:pathData=");
  });

  // Android zeigt vom Symbolfeld nur den inneren Bereich; der Rest wird
  // beschnitten. Ein Stern, der die volle Fläche füllt, käme mit abgesägten
  // Spitzen heraus — und das sähe wie ein Zeichenfehler aus, nicht wie ein
  // Layoutfehler. Mutation: `inhalt` auf `flaeche` setzen → rot.
  it("lässt den Rand frei, den Android beschneidet", () => {
    expect(ANDROID_SYMBOL.inhalt).toBeLessThan(ANDROID_SYMBOL.flaeche);
    const anteil = ANDROID_SYMBOL.inhalt / ANDROID_SYMBOL.flaeche;
    expect(anteil).toBeLessThanOrEqual(2 / 3);
  });

  it("setzt den Stern mittig in die Fläche", () => {
    const rand = (ANDROID_SYMBOL.flaeche - ANDROID_SYMBOL.inhalt) / 2;
    const xml = androidSymbolXml(marke);
    expect(xml).toContain(`android:translateX="${rand}"`);
    expect(xml).toContain(`android:translateY="${rand}"`);
  });

  // Die Skalierung muss aus der Favicon-Kante kommen. Wäre sie fest verdrahtet,
  // ergäbe ein Favicon mit anderer viewBox ein falsch grosses Symbol — und zwar
  // still, weil ein Vector Drawable nichts meldet.
  it("skaliert aus der Kante des Favicons, nicht aus einer festen Zahl", () => {
    const gross = leseMarke(
      readFileSync("public/brand/compass-favicon.svg", "utf8").replace(
        'viewBox="0 0 48 48"',
        'viewBox="0 0 96 96"',
      ),
    );
    expect(androidSymbolXml(marke)).not.toEqual(androidSymbolXml(gross));
  });
});
