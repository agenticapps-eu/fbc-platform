/**
 * Der Stempel über Startfläche und App-Symbole (AGE-714).
 *
 * ══ WAS ER BEWACHT ═════════════════════════════════════════════════════════
 * `pnpm splash` und `pnpm app:icons` erzeugen Bilder aus Quellen im Repo. Bis
 * hierhin prüfte **nichts**, ob die eingecheckten Ergebnisse noch zu diesen
 * Quellen passen. Die Zusage „eine Änderung an der Quelle erreicht die
 * Startfläche" war von Hand gehalten, nicht erzwungen — sie hält, bis jemand
 * das Foto oder die Marke ändert und das Neuerzeugen vergisst. Der Fehler ist
 * dann still: die App zeigt weiter das alte Bild, kein Test wird rot, und
 * auffallen kann es erst am Gerät.
 *
 * Dass die Marke im selben Vorhaben einmal gewechselt hat (AGE-642 B6: Ring
 * raus, vier Nebenstrahlen dazu), macht das nicht theoretisch.
 *
 * ══ WARUM EIN STEMPEL UND NICHT „NEU ERZEUGEN UND VERGLEICHEN" ═════════════
 * Der naheliegende Wächter wäre `pnpm splash --check`: neu erzeugen, gegen die
 * eingecheckten Dateien diffen. Er scheitert an zwei Dingen, und das zweite
 * wiegt schwerer als das erste.
 *
 *  1. **`sips` gibt es nur auf macOS.** Die Erzeugung braucht ausserdem
 *     `rsvg-convert`, `cwebp`, `fc-match` und `woff2_decompress`. Auf einem
 *     Linux-Runner wäre der Wächter entweder rot oder eine Attrappe.
 *  2. **Neu erzeugen ist nur so verlässlich wie die Gleichheit der
 *     Werkzeugversionen.** Eine andere librsvg- oder JPEG-Fassung liefert
 *     andere Bytes bei gleicher Eingabe. Der Wächter wäre dann rot aus einem
 *     Grund, der mit dem bewachten Fehler nichts zu tun hat — und ein Wächter,
 *     der aus Fremdgründen rot wird, wird abgeschaltet.
 *
 * Der Stempel umgeht beides: er rechnet nur SHA-256 und braucht kein einziges
 * Bildwerkzeug. Er läuft damit auf jedem Runner und bei jeder Werkzeugfassung.
 *
 * ══ WAS ER BELEGT UND WAS NICHT ════════════════════════════════════════════
 * Er hält **Eingaben und Ergebnisse zusammen**, beide mit Prüfsumme:
 *
 *   - Quelle geändert, nicht neu erzeugt  → Eingabe-Prüfsumme weicht ab → rot
 *   - Ergebnis von Hand geändert          → Ergebnis-Prüfsumme weicht ab → rot
 *   - beides ordentlich neu erzeugt       → Stempel ist mitgeschrieben → grün
 *
 * Was er NICHT belegt: dass die Ergebnisse aus genau diesen Eingaben *folgen*.
 * Wer den Stempel schreibt, ohne zu erzeugen, kommt durch. Das ist bewusst in
 * Kauf genommen — `pnpm splash` und `pnpm app:icons` schreiben ihn im selben
 * Lauf, eine Umgehung wäre also Absicht und kein Versehen. Ein Wächter gegen
 * Absicht ist etwas anderes als einer gegen Vergesslichkeit, und gebaut ist
 * hier der zweite.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { ZIELE } from "./app-icons.logic";

/** Die Quellen, aus denen beide Erzeuger schöpfen. */
export const EINGABEN = [
  "public/brand/compass-favicon.svg",
  "public/images/hero-mitglieder.webp",
  "public/fonts/inter-latin.woff2",
  "public/fonts/fraunces-latin.woff2",
] as const;

/**
 * Die erzeugten Dateien — ausdrücklich aufgezählt, nicht über ein Muster
 * gesucht.
 *
 * Ein Muster überginge eine Datei, die jemand versehentlich gelöscht hat: sie
 * fehlte in beiden Läufen gleichermassen, und der Vergleich bliebe grün. Eine
 * Liste meldet sie.
 *
 * Die Symbolpfade kommen aus `ZIELE`, damit eine neue Dichte nicht an zwei
 * Stellen nachgetragen werden muss.
 */
export const ERGEBNISSE = [
  // Startfläche — iOS
  "ios/App/App/Assets.xcassets/Splash.imageset/Contents.json",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-band.jpg",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-band-quer.jpg",
  "ios/App/App/Assets.xcassets/SplashVerlauf.imageset/Contents.json",
  "ios/App/App/Assets.xcassets/SplashVerlauf.imageset/splash-verlauf.png",
  "ios/App/App/Assets.xcassets/SplashSchriftzug.imageset/Contents.json",
  "ios/App/App/Assets.xcassets/SplashSchriftzug.imageset/splash-schriftzug.png",
  // Startfläche — die lesbaren Zwischenschritte
  "assets/splash-verlauf.svg",
  "assets/splash-schriftzug.svg",
  // Startfläche — Web (Boot-Fläche)
  "public/brand/splash-band.webp",
  "public/brand/splash-band-quer.webp",
  "public/brand/splash-schriftzug.png",
  // Startfläche — Android
  "android/app/src/main/res/drawable/splash_icon.xml",
  "android/app/src/main/res/values/splash.xml",
  // App-Symbole — die lesbaren Zwischenschritte
  "assets/app-icon.svg",
  "assets/app-icon-round.svg",
  "assets/app-icon-foreground.svg",
  // App-Symbole — Android-Fläche
  "android/app/src/main/res/values/ic_launcher_background.xml",
  // App-Symbole — je Plattform
  ...ZIELE.ios.map((z) => z.pfad),
  ...ZIELE.android.flatMap(({ dichte }) => [
    `android/app/src/main/res/mipmap-${dichte}/ic_launcher.png`,
    `android/app/src/main/res/mipmap-${dichte}/ic_launcher_round.png`,
    `android/app/src/main/res/mipmap-${dichte}/ic_launcher_foreground.png`,
  ]),
] as const;

export type Stempel = {
  eingaben: Record<string, string>;
  ergebnisse: Record<string, string>;
};

/**
 * Die zwei Zugriffe aufs Dateisystem, eng typisiert.
 *
 * Absichtlich NICHT `typeof readFileSync`: dessen `PathLike` zwingt jeden
 * Test, seinen Ersatz zu casten, und ein Cast im Test ist die Stelle, an der
 * ein echter Typfehler unbemerkt durchgeht.
 */
export type Leser = (pfad: string) => Buffer | string;
export type Pruefer = (pfad: string) => boolean;

const LIES: Leser = (p) => readFileSync(p);
const DA: Pruefer = (p) => existsSync(p);

/** SHA-256 einer Datei, hexadezimal. Wirft, wenn sie fehlt — siehe oben. */
export function pruefsumme(pfad: string, lies: Leser = LIES): string {
  return createHash("sha256").update(lies(pfad)).digest("hex");
}

/**
 * Rechnet den Stempel über den Arbeitsbaum.
 *
 * Fehlt eine Datei, wird geworfen statt sie zu überspringen: eine fehlende
 * erzeugte Datei ist genau der Zustand, den dieser Wächter melden soll.
 */
export function berechne(
  eingaben: readonly string[] = EINGABEN,
  ergebnisse: readonly string[] = ERGEBNISSE,
  da: Pruefer = DA,
  lies: Leser = LIES,
): Stempel {
  const fehlend = [...eingaben, ...ergebnisse].filter((p) => !da(p));
  if (fehlend.length > 0) {
    throw new Error(
      `stempel: ${fehlend.length} Datei(en) fehlen:\n  ${fehlend.join("\n  ")}\n` +
        "Erst `pnpm splash` und `pnpm app:icons` laufen lassen.",
    );
  }
  const summen = (liste: readonly string[]): Record<string, string> =>
    Object.fromEntries([...liste].sort().map((p) => [p, pruefsumme(p, lies)]));
  return { eingaben: summen(eingaben), ergebnisse: summen(ergebnisse) };
}

/** Der Stempel als Datei — sortiert, damit der Diff lesbar bleibt. */
export function alsJson(stempel: Stempel): string {
  return JSON.stringify(stempel, null, 2) + "\n";
}

/**
 * Vergleicht zwei Stempel und nennt die Abweichungen im Klartext.
 *
 * Getrennt nach Eingaben und Ergebnissen, weil die beiden Fälle
 * unterschiedliche Handgriffe verlangen: eine abweichende EINGABE heisst „neu
 * erzeugen", ein abweichendes ERGEBNIS heisst „jemand hat von Hand geschrieben".
 */
export function abweichungen(erwartet: Stempel, gemessen: Stempel): string[] {
  const raus: string[] = [];
  for (const feld of ["eingaben", "ergebnisse"] as const) {
    const a = erwartet[feld] ?? {};
    const b = gemessen[feld] ?? {};
    for (const pfad of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (a[pfad] === b[pfad]) continue;
      if (!a[pfad]) raus.push(`${feld}: ${pfad} ist neu und steht nicht im Stempel`);
      else if (!b[pfad]) raus.push(`${feld}: ${pfad} steht im Stempel, fehlt aber`);
      else raus.push(`${feld}: ${pfad} weicht ab`);
    }
  }
  return raus;
}
