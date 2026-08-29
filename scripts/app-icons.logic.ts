/**
 * Das App-Symbol für iOS und Android, aus EINER Quelle (AGE-642).
 *
 * ══ WAS HIER DAS PROBLEM WAR ═══════════════════════════════════════════════
 * `npx cap add` legt das Symbol des Frameworks ab, und das blieb bis zum
 * 28.08. auf beiden Plattformen stehen. Auf dem Startbildschirm ist das die
 * einzige Fläche, die jemand sieht, BEVOR die App geöffnet wird — sie sagt
 * dort, die Anwendung sei ein Gerüst.
 *
 * ══ WARUM DIE QUELLE DAS FAVICON IST ═══════════════════════════════════════
 * Die Marke liegt im Repo dreimal: als React-Komponente (`CompassMark.tsx`),
 * als Favicon (`public/brand/compass-favicon.svg`) und in der verbindlichen
 * Vorlage (`docs/design-system.html`). Eine VIERTE Kopie hier hineinzuschreiben
 * hiesse, dass ein Nachziehen der Marke drei Dateien trifft und die vierte
 * still zurückbleibt — und der Unterschied fiele erst auf einem Gerät auf.
 *
 * Gelesen wird deshalb das Favicon, und zwar seine Form selbst, nicht ihre
 * Zahlen abgeschrieben. Bis zum 29.08. war das ausserdem eine Wahl zwischen
 * zwei Fassungen — das Favicon verstärkte den Ring für 16 px. Mit dem Wegfall
 * des Rings (AGE-642) ist dieser Unterschied entfallen: Favicon und
 * Komponente zeigen jetzt dieselbe Form. Das Favicon bleibt trotzdem die Quelle, weil es eine
 * reine SVG-Datei ist und ohne JSX-Zerlegung gelesen werden kann.
 *
 * ══ WARUM DIE FARBEN GETAUSCHT WERDEN ══════════════════════════════════════
 * Das Favicon ist blau auf durchsichtig — richtig für einen Browser-Tab, dem
 * seine eigene Fläche gehört. Ein App-Symbol hat keine Fläche hinter sich; iOS
 * verbietet Durchsichtigkeit sogar. Genommen wird deshalb die zweite
 * dokumentierte Markenpaarung: weiss auf Navy (`docs/design-system.html`,
 * „Invers · Weiß auf Navy #081527"), dieselbe Fläche, auf der die Sidebar in
 * der navy-Variante steht.
 */

/** Navy — `--color-chrome` / `--sidebar-surface` der navy-Variante. */
export const HINTERGRUND = "#081527";
/** Die Marke auf dem Navy. */
export const VORDERGRUND = "#FFFFFF";

/** Kantenlänge der erzeugten SVGs. Nur eine Rechengrösse: gerastert wird über
 *  `rsvg-convert -w`, die Datei selbst ist auflösungsfrei. */
export const KANTE = 100;

/** Anteil der Kante, den die Marke im vollflächigen Symbol einnimmt.
 *  Apples Vorlagen setzen die Bildmarke bei rund 60 %; darüber wirkt sie
 *  gedrängt, darunter verliert sie auf 29 pt an Lesbarkeit. */
export const MARKENANTEIL = 0.62;

/** Androids adaptives Symbol: von 108 Einheiten sind 72 sichtbar (die Maske
 *  schneidet den Rest weg) und nur die inneren 66 sind sicher — jede Maske,
 *  auch die kreisrunde, lässt sie stehen. Der Vordergrund wird deshalb auf
 *  diese 66 gerechnet und nicht auf die 108. */
export const ADAPTIV_KANTE = 108;
export const ADAPTIV_SICHER = 66;

export type Marke = {
  /** Der Stern mit seinen vier Nebenstrahlen, als Pfaddaten — ein `<path>` mit
   *  fünf Teilzügen. */
  stern: string;
  /** Kantenlänge des Koordinatensystems, aus dem er stammt. */
  kante: number;
};

/**
 * Liest den Stern aus dem Favicon.
 *
 * Bewusst streng: fehlt die Form oder die `viewBox`, wird geworfen statt ein
 * halbes Symbol erzeugt. Ein Generator, der bei kaputter Eingabe etwas
 * Plausibles ausgibt, schreibt den Fehler in fünfzehn PNG-Dateien.
 */
export function leseMarke(faviconSvg: string): Marke {
  const box = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(faviconSvg);
  if (!box) throw new Error("app-icons: keine viewBox im Favicon gefunden");
  if (box[1] !== box[2]) throw new Error(`app-icons: Favicon ist nicht quadratisch (${box[0]})`);

  // Die Marke ist GENAU EIN Pfad und sonst nichts. Ohne diese Zaehlung gewaenne
  // still der erste Treffer: kaeme im Favicon eine zweite Form dazu, erzeugte
  // dieses Skript weiter das alte Symbol und meldete fuenfzehn Erfolge. Der Ring
  // ist am 29.08. entfallen (AGE-642) — ein <circle> wuerde hier also nicht mehr
  // gezeichnet, und genau deshalb wird er verboten statt uebergangen.
  const kreise = faviconSvg.match(/<circle\b/g) ?? [];
  const pfade = faviconSvg.match(/<path\b/g) ?? [];
  if (kreise.length !== 0)
    throw new Error(`app-icons: kein <circle> erwartet, gefunden: ${kreise.length}`);
  if (pfade.length !== 1)
    throw new Error(`app-icons: genau ein <path> erwartet, gefunden: ${pfade.length}`);

  // Dieses Skript liest KEIN `transform`. Waere der Stern verschoben statt
  // absolut angegeben, waere die Ausgabe falsch platziert — und der Vergleich
  // gegen die Pfaddaten bliebe trotzdem gruen. Also sagen, statt so zu tun.
  if (/<path\b[^>]*\stransform=/.test(faviconSvg))
    throw new Error("app-icons: transform am Stern — dieses Skript liest es nicht");

  const pfad = /<path[^>]*\sd="([^"]+)"/.exec(faviconSvg);
  if (!pfad) throw new Error("app-icons: kein <path> (Stern) im Favicon gefunden");

  return { stern: pfad[1], kante: Number(box[1]) };
}

/** Setzt die Marke mittig auf eine Fläche der Breite `flaeche`, skaliert auf
 *  `zielbreite` Einheiten derselben Fläche. */
function mittig(marke: Marke, flaeche: number, zielbreite: number, farbe: string): string {
  const faktor = zielbreite / marke.kante;
  const versatz = (flaeche - zielbreite) / 2;
  return (
    `<g transform="translate(${runde(versatz)} ${runde(versatz)}) scale(${runde(faktor)})">` +
    `<path d="${marke.stern}" fill="${farbe}"/>` +
    `</g>`
  );
}

/** Drei Nachkommastellen. Ohne das schreibt der Faktor 1.2916666666666667 in
 *  jede Datei und der Diff einer Neuerzeugung liest sich wie eine Änderung. */
function runde(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Das vollflächige Symbol: Navy bis an die Kante, Marke in Weiss.
 *
 * `rund` schneidet zusätzlich einen Kreis aus — das ist Androids
 * `ic_launcher_round.png` für Geräte, die runde Symbole zeichnen. iOS braucht
 * das nicht: dort maskiert das System selbst, und ein vorgerundetes Bild ergäbe
 * eine zweite, sichtbar falsche Rundung.
 */
export function symbolSvg(marke: Marke, opt: { rund?: boolean } = {}): string {
  const flaeche = opt.rund
    ? `<circle cx="${KANTE / 2}" cy="${KANTE / 2}" r="${KANTE / 2}" fill="${HINTERGRUND}"/>`
    : `<rect width="${KANTE}" height="${KANTE}" fill="${HINTERGRUND}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${KANTE} ${KANTE}" ` +
    `width="${KANTE}" height="${KANTE}">` +
    flaeche +
    mittig(marke, KANTE, KANTE * MARKENANTEIL, VORDERGRUND) +
    `</svg>`
  );
}

/**
 * Androids adaptiver Vordergrund: nur die Marke, ohne Fläche.
 *
 * Der Hintergrund ist dort kein Bild, sondern die Farbe
 * `@color/ic_launcher_background` — deshalb steht hier NICHTS ausser der Marke,
 * und deshalb ist diese Datei durchsichtig, obwohl das fertige Symbol es nicht
 * ist. Wer hier eine Fläche mitzeichnet, bekommt sie beim Parallax-Effekt der
 * Startbildschirme als wandernde Kante zu sehen.
 */
export function vordergrundSvg(marke: Marke): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ADAPTIV_KANTE} ${ADAPTIV_KANTE}" ` +
    `width="${ADAPTIV_KANTE}" height="${ADAPTIV_KANTE}">` +
    mittig(marke, ADAPTIV_KANTE, ADAPTIV_SICHER, VORDERGRUND) +
    `</svg>`
  );
}

/** Die Farbdatei, aus der Androids adaptives Symbol seine Fläche nimmt. */
export function hintergrundXml(): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    "<resources>\n" +
    `    <color name="ic_launcher_background">${HINTERGRUND}</color>\n` +
    "</resources>"
  );
}

/** Was wohin, in welcher Kantenlänge. Eine Liste, kein verstreutes Wissen. */
export const ZIELE = {
  /** iOS führt seit Xcode 14 einen einzigen 1024er-Slot; die kleineren Grössen
   *  rechnet das System selbst. `Contents.json` nennt genau diese eine Datei. */
  ios: [{ pfad: "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", px: 1024 }],
  /** Androids Dichten. `ic_launcher` und `ic_launcher_round` sind der Weg für
   *  alles vor Android 8, `ic_launcher_foreground` der für alles danach. */
  android: [
    { dichte: "mdpi", px: 48, adaptivPx: 108 },
    { dichte: "hdpi", px: 72, adaptivPx: 162 },
    { dichte: "xhdpi", px: 96, adaptivPx: 216 },
    { dichte: "xxhdpi", px: 144, adaptivPx: 324 },
    { dichte: "xxxhdpi", px: 192, adaptivPx: 432 },
  ],
} as const;
