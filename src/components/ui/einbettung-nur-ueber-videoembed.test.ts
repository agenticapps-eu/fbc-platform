import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Die Einwilligung vor dem Drittanbieter-Aufruf hängt an EINER Komponente
 * (AGE-618, Nachlauf zu AGE-611).
 *
 * `VideoEmbed.tsx` holt kein Video, bevor jemand geklickt hat. Die ganze Zusage
 * in der Datenschutzerklärung steht und fällt damit, dass **niemand daran vorbei
 * einbettet**. Am 26.08. war das belegt — genau ein `<iframe>` im ganzen
 * Quelltext, und zwar dort. Aber ein `grep` von Hand ist eine Momentaufnahme:
 * wer in einem halben Jahr `<iframe src={youtubeUrl}>` schreibt, fällt
 * niemandem auf, und die Datenschutzerklärung behauptet dann etwas, das nicht
 * mehr stimmt. Dieser Test macht aus der Momentaufnahme eine Dauerkontrolle.
 *
 * ── WELCHE HOSTS GEZÄHLT WERDEN, UND WARUM NICHT ALLE ────────────────────────
 *
 * Der Vorgang verlangte ursprünglich, KEINE Anbieter-Domäne ausserhalb von drei
 * Dateien zuzulassen — auch `youtube.com` und `vimeo.com`. **Gemessen ist das
 * nicht haltbar und wäre gegen den Bestand sofort rot:** `AcademyPage.tsx` führt
 * drei `https://www.youtube.com/watch?v=…` als Daten, und die laufen durch
 * `<VideoEmbed url={lesson.url} />`. Das ist nicht der Fehler, das ist der
 * gewollte Weg. Ein Verbot dort verböte genau das, was der Entwurf will.
 *
 * Die Grenze liegt deshalb woanders, und schärfer:
 *
 *   QUELL-URLs sind Daten.      `youtube.com/watch`, `youtu.be/…`, `vimeo.com/…`
 *                               Eine solche Zeichenkette löst nichts aus; sie ist
 *                               die Eingabe ins Tor. Überall erlaubt.
 *
 *   ASSET-HOSTS sind Anfragen.  `youtube-nocookie.com`, `player.vimeo.com`,
 *                               `img.youtube.com`, `ytimg.com`, `vimeocdn.com`,
 *                               `vumbnail.com`
 *                               Steht so ein Host im Code, will jemand von dort
 *                               etwas HOLEN — ein Einbettungsziel oder ein
 *                               Vorschaubild. Genau das ist der Aufruf, den die
 *                               Einwilligung schützen soll.
 *
 * ── WAS DIESER TEST NICHT KANN ───────────────────────────────────────────────
 *
 * - **Er misst keinen Netzwerkverkehr.** Er liest Quelltext. Ein Aufruf, der
 *   zur Laufzeit aus einer Variablen zusammengesetzt wird
 *   (`"https://" + host + "/embed/"`), läuft durch. Das ist der benannte Preis
 *   dieses Zuschnitts, nicht ein Versehen.
 * - **Er sieht Testdateien nicht an.** Sie stehen nicht im ausgelieferten
 *   Bündel und können deshalb keinen Aufruf beim Mitglied auslösen. Ein Dutzend
 *   von ihnen führt Anbieter-URLs als Fixture; sie mitzuprüfen hiesse, eine
 *   Ausnahmeliste zu pflegen, die nichts schützt.
 * - **Er kennt nur die Asset-Hosts oben.** Ein weiterer Anbieter braucht
 *   eine Zeile in `ASSET_HOSTS`. Ohne sie liefe er durch — die Liste ist eine
 *   Positivliste der bekannten Gefahr, keine Erkennung von Fremdursprüngen
 *   allgemein. Letzteres ist ausdrücklich ein eigener Vorgang (AGE-618,
 *   „Nicht in diesem Vorgang"); `design-system` führt dafür bereits zwei
 *   Anforderungen zu Schriften und Bildern.
 * - **`ohneKommentare` hat einen bekannten Randfall.** Ein `//` in einer
 *   Zeichenkette, dem kein `:` vorangeht (`"proto://user@host//pfad"`), wird als
 *   Kommentarbeginn gelesen und der Rest der Zeile verworfen. Einen Verstoß
 *   könnte das nur verdecken, wenn ein Asset-Host HINTER einem solchen zweiten
 *   `//` stünde — bei `https://`-URLs schützt der Doppelpunkt ihn. Benannt statt
 *   wegkonstruiert: die Regex dafür robust zu machen hiesse, einen Parser zu
 *   bauen. Befund aus dem Diff-Review (gemini, LOW).
 * - **`public/_headers` prüft er nicht.** Dort stünde eine CSP, die einen Host
 *   ERLAUBT — das ist eine andere Aussage als ein Aufruf und gehört zum eigenen
 *   Vorgang für Fremdursprünge.
 */

/** Die Dateien, die einbetten DÜRFEN. Namentlich — nie ein Verzeichnis. */
const RAHMEN_ERLAUBT = ["src/components/ui/VideoEmbed.tsx"];

/**
 * Die Dateien, die einen Asset-Host nennen dürfen. Ebenfalls namentlich.
 *
 * Ein Verzeichnis (`src/content/legal/`) stünde hier bequemer und wäre die
 * Schwachstelle: es deckte irgendwann mehr ab, als es soll. Wer eine Datei
 * hinzufügt, trifft eine Entscheidung und sieht diese Zeile dabei an.
 */
const HOST_ERLAUBT = [
  // Hier entstehen die Einbettungs-URLs. Die einzige Stelle, die einen
  // Asset-Host wirklich schreiben muss.
  "src/lib/video-url.ts",
  // Die Datenschutzerklärung NENNT den Host in Prosa („die datensparsame
  // Variante youtube-nocookie.com"). Das ist eine Aussage über einen Aufruf,
  // nicht der Aufruf.
  "src/content/legal/datenschutz.ts",
];

/**
 * `VideoEmbed.tsx` steht ABSICHTLICH NICHT in der Liste, obwohl es die
 * einbettende Komponente ist. Nachgemessen: nach der Kommentar-Entfernung nennt
 * es keinen einzigen Asset-Host — es bekommt die fertige URL von `video-url.ts`.
 * Ein Eintrag hier wäre ein toter Freibrief gewesen und hätte ausgerechnet der
 * einbettenden Komponente erlaubt, künftig `img.youtube.com` fest zu
 * verdrahten. Eine Ausnahme, die niemand braucht, gehört nicht in eine
 * Ausnahmeliste.
 */

/** Hosts, von denen etwas GEHOLT würde. Quell-URLs stehen bewusst nicht drin. */
const ASSET_HOSTS = [
  "youtube-nocookie.com",
  "player.vimeo.com",
  "img.youtube.com",
  // Bewusst die BASISDOMÄNE, nicht `i.ytimg.com`: die Anbieter liefern Assets
  // über wechselnde Subdomänen aus (`i.`, `s.`, `i9.` …). Eine Liste einzelner
  // Subdomänen wäre am Tag ihrer Niederschrift schon unvollständig. Befund aus
  // dem Diff-Review (gemini, LOW).
  "ytimg.com",
  "vimeocdn.com",
  "vumbnail.com",
];

/**
 * Kommentare weg, BEVOR geprüft wird — und das ist hier keine Kosmetik.
 *
 * `VideoEmbed.tsx` erklärt in seinem Kopf, warum es KEIN Vorschaubild von
 * `img.youtube.com` holt, und `MemberDashboard.tsx` erklärt dasselbe noch
 * einmal. Beide nennen den Hostnamen dabei wörtlich. Ein Wächter auf dem
 * Rohtext schlüge dort an, obwohl nichts geholt wird — und umgekehrt könnte ein
 * Treffer im Kommentar eine echte Verwendung in derselben Datei verdecken.
 *
 * Dieselbe Bauart wie in `schmale-geraete.test.ts`; bewusst dort wie hier lokal,
 * damit keine Testdatei von einer anderen abhängt.
 */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Einbettende Elemente.
 *
 * Das `[\s>/]` hinter dem Namen verhindert, dass `<objectSomething` mitfängt.
 *
 * Das `i`-Flag ist Absicht und hat eine Nebenwirkung, die ebenfalls Absicht ist:
 * in JSX ist Grossschreibung eine KOMPONENTE, `<Iframe />` also kein HTML-Rahmen
 * — dieser Wächter schlägt trotzdem an. Genau diese Form wäre der naheliegende
 * Weg, an ihm vorbeizukommen, und ein Bauteil, das `Iframe` heisst, gehört
 * angesehen. In `.css` und `.html`, wo Grossschreibung nichts bedeutet, ist das
 * Flag ohnehin nötig. Befund aus dem Diff-Review (gemini, LOW).
 */
export function rahmenVerstoesse(quelle: string): string[] {
  return [...ohneKommentare(quelle).matchAll(/<(iframe|embed|object)[\s>/]/gi)].map((m) =>
    m[1].toLowerCase(),
  );
}

/** Asset-Hosts, die im Code stehen. Der Punkt wird maskiert — sonst passt er auf alles. */
export function hostVerstoesse(quelle: string): string[] {
  const sauber = ohneKommentare(quelle);
  return ASSET_HOSTS.filter((host) => sauber.includes(host));
}

/**
 * Alle ausgelieferten Quelldateien. Testdateien bleiben draussen, siehe Kopf.
 *
 * `.css` ist dabei, und das ist ein Befund aus dem Diff-Review (gemini, MEDIUM):
 * eine erste Fassung sah nur `.ts`/`.tsx` an. Ein
 * `background-image: url("https://i.ytimg.com/...")` löst denselben Aufruf aus
 * wie ein `<img>` und wäre unbemerkt geblieben. Nachgemessen: `src/` enthält
 * genau eine `.css`-Datei — die Lücke war schmal, aber echt.
 */
const GEPRUEFTE_ENDUNGEN = /\.(tsx?|css)$/;

function quelldateien(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) quelldateien(pfad, acc);
    else if (GEPRUEFTE_ENDUNGEN.test(pfad) && !/\.test\.tsx?$/.test(pfad)) acc.push(pfad);
  }
  return acc;
}

describe("Die Kommentar-Entfernung", () => {
  it("nimmt Kommentare weg und lässt Code stehen", () => {
    expect(ohneKommentare("// img.youtube.com waere hier falsch\nconst a = 1;")).not.toContain(
      "img.youtube.com",
    );
    expect(ohneKommentare("/** Block mit vumbnail.com */\nconst b = 2;")).not.toContain(
      "vumbnail.com",
    );
    // Und sie darf echten Code nicht wegfressen — auch nicht mit „//" in einer URL.
    expect(ohneKommentare('const u = "https://player.vimeo.com/video/1"; // Hinweis')).toContain(
      "player.vimeo.com",
    );
  });
});

describe("Verbiegungsprobe — die Prüfung erkennt Erfundenes", () => {
  /**
   * Ein Wächter, der nur die beim Schreiben bekannten Zeilen findet, ist grün
   * und prüft nichts: er wurde ja an ihnen entlanggebaut. Diese Fälle sind
   * erfunden und decken die Ränder ab.
   */
  it("findet einbettende Elemente in allen drei Schreibweisen", () => {
    expect(rahmenVerstoesse('<iframe src="x" />')).toEqual(["iframe"]);
    expect(rahmenVerstoesse("<iframe\n  src={u}\n/>")).toEqual(["iframe"]);
    expect(rahmenVerstoesse('<embed src="x">')).toEqual(["embed"]);
    expect(rahmenVerstoesse("<object data={d}>")).toEqual(["object"]);
  });

  it("fängt auch die grossgeschriebene Umgehung und CSS-Formen", () => {
    // In JSX wäre `<Iframe />` eine Komponente, kein HTML-Rahmen — und genau
    // deshalb der naheliegende Weg, an diesem Wächter vorbeizukommen.
    expect(rahmenVerstoesse("<Iframe src={u} />")).toEqual(["iframe"]);
    expect(rahmenVerstoesse("<IFRAME SRC=\"x\">")).toEqual(["iframe"]);
    // Und ein Hintergrundbild aus CSS löst denselben Aufruf aus wie ein <img>.
    expect(hostVerstoesse('.v { background-image: url("https://i.ytimg.com/vi/a/0.jpg"); }')).toEqual(
      ["ytimg.com"],
    );
    // Eine wechselnde Subdomäne desselben Anbieters fällt mit.
    expect(hostVerstoesse('src="https://s.ytimg.com/x.js"')).toEqual(["ytimg.com"]);
  });

  it("lässt harmlose Ähnlichkeiten in Ruhe", () => {
    // Ein Bezeichner, der zufällig so anfängt, ist kein Rahmen.
    expect(rahmenVerstoesse("const objectKeys = 1;")).toEqual([]);
    expect(rahmenVerstoesse("<ObjectCard />")).toEqual([]);
    // Und ein Kommentar allein löst nichts aus — das ist Falle 1 aus AGE-618.
    expect(rahmenVerstoesse("// hier stand mal ein <iframe>")).toEqual([]);
  });

  it("findet Asset-Hosts, aber keine Quell-URLs", () => {
    expect(hostVerstoesse('const u = "https://www.youtube-nocookie.com/embed/a";')).toEqual([
      "youtube-nocookie.com",
    ]);
    expect(hostVerstoesse('<img src="https://img.youtube.com/vi/a/0.jpg" />')).toEqual([
      "img.youtube.com",
    ]);
    // Quell-URLs sind Daten und laufen durch das Tor — kein Verstoß.
    expect(hostVerstoesse('url: "https://www.youtube.com/watch?v=a"')).toEqual([]);
    expect(hostVerstoesse('url: "https://youtu.be/a"')).toEqual([]);
    expect(hostVerstoesse('url: "https://vimeo.com/76979871"')).toEqual([]);
  });
});

describe("Der Bestand", () => {
  const dateien = quelldateien("src");

  /**
   * POSITIVKONTROLLE — der Wächter belegt, dass er tatsächlich gesucht hat.
   *
   * Falle 2 aus AGE-618: in AGE-497 war ein Quelltext-Test grün, weil sein
   * `catch` auch den Status 2 von `grep` schluckte — „nichts gefunden" und
   * „Suche fehlgeschlagen" sahen gleich aus. Ohne diese Zusage wäre eine leere
   * Dateiliste von einem sauberen Bestand nicht zu unterscheiden, und der ganze
   * Test wäre grün, ohne je etwas gelesen zu haben.
   */
  it("hat überhaupt Dateien gelesen und findet darin das Erwartete", () => {
    expect(dateien.length).toBeGreaterThan(100);
    // Die eine Datei, die einbetten darf, TUT es auch — sonst prüfen wir eine
    // Zusage über eine Komponente, die es so nicht mehr gibt.
    expect(rahmenVerstoesse(readFileSync(RAHMEN_ERLAUBT[0], "utf8"))).toContain("iframe");
    // Und die Einbettungsziele stehen dort, wo sie hingehören.
    expect(hostVerstoesse(readFileSync("src/lib/video-url.ts", "utf8"))).toEqual(
      expect.arrayContaining(["youtube-nocookie.com", "player.vimeo.com"]),
    );
  });

  it("bettet nirgends ausser in VideoEmbed.tsx ein", () => {
    const gefunden = dateien
      .filter((pfad) => !RAHMEN_ERLAUBT.includes(pfad))
      .map((pfad) => ({ pfad, treffer: rahmenVerstoesse(readFileSync(pfad, "utf8")) }))
      .filter((x) => x.treffer.length > 0)
      .map((x) => `${x.pfad}: <${x.treffer.join(">, <")}>`);
    expect(gefunden).toEqual([]);
  });

  it("nennt Asset-Hosts nur in den namentlich erlaubten Dateien", () => {
    const gefunden = dateien
      .filter((pfad) => !HOST_ERLAUBT.includes(pfad))
      .map((pfad) => ({ pfad, treffer: hostVerstoesse(readFileSync(pfad, "utf8")) }))
      .filter((x) => x.treffer.length > 0)
      .map((x) => `${x.pfad}: ${x.treffer.join(", ")}`);
    expect(gefunden).toEqual([]);
  });

  /**
   * `index.html` steht ausserhalb von `src/` und wird deshalb eigens geprüft.
   * Ein `preconnect` verrät die IP-Adresse, BEVOR irgendjemand geklickt hat —
   * es wäre derselbe Verstoß wie ein Rahmen, nur früher.
   */
  it("baut in index.html keine Verbindung zu den Anbietern vor", () => {
    const html = readFileSync("index.html", "utf8");
    const zeilen = html
      .split("\n")
      .filter((z) => /preconnect|dns-prefetch/i.test(z));
    expect(zeilen).toEqual([]);
    // Und dieselben zwei Regeln wie für `src/` — die Datei liegt nur ausserhalb,
    // sie ist deshalb nicht harmloser.
    expect(rahmenVerstoesse(html)).toEqual([]);
    expect(hostVerstoesse(html)).toEqual([]);
  });
});
