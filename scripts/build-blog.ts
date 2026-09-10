#!/usr/bin/env tsx
/**
 * Erzeugt den öffentlichen Release-Blog (AGE-705).
 *
 * **Zwei Flächen, eine Quelle.** Die Geschichten stehen in
 * `release-geschichten.ts`; wie sie gelesen werden, entscheiden zwei
 * redaktionelle Listen daneben: `release-ausgaben.ts` gliedert sie nach Wochen
 * (der Blog), `release-tutorial.ts` legt einen Weg durch die Anwendung
 * (das Tutorial). Dieselbe Kapitelseite bedient beide.
 *
 * **Kein React, kein Bundler, kein Skript im Ergebnis.** Das ist nicht
 * Sparsamkeit, sondern die Umsetzung der Zusage „die öffentliche Seite kann
 * keine Mitgliederdaten lesen": wo kein Supabase-Client im Bündel liegt und
 * überhaupt kein Skript ausgeliefert wird, gibt es nichts, was jemand später
 * versehentlich verdrahtet. Als Sorgfaltsregel wäre das wertlos, als
 * Baueigenschaft ist es belastbar.
 *
 * Dass es dabei bleibt, prüft nicht dieser Erzeuger, sondern
 * `blog-artefakt-waechter.ts` — am erzeugten Artefakt und nicht an der Absicht.
 *
 * Kein Verweis nach aussen, auch keine Schrift: der Stil steht inline, die
 * Schriftfamilien sind die des Systems, und jedes Bild wird mitkopiert.
 *
 * Aufruf: `pnpm blog:build`.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { RELEASE_AUSGABEN } from "../src/content/release-ausgaben";
import { RELEASE_GESCHICHTEN } from "../src/content/release-geschichten";
import { RELEASE_TUTORIAL } from "../src/content/release-tutorial";
import type {
  ReleaseAusgabe,
  ReleaseBild,
  ReleaseGeschichte,
  TutorialEtappe,
} from "../src/types/release";

export interface BlogSeite {
  /** Dateiname relativ zum Ausgabeordner, z. B. `index.html`. */
  pfad: string;
  html: string;
}

/** Alles, woraus der Blog entsteht — als ein Argument, damit nichts fehlt. */
export interface BlogEingabe {
  geschichten: ReleaseGeschichte[];
  ausgaben: ReleaseAusgabe[];
  etappen: TutorialEtappe[];
}

const ZIEL = "dist-blog";
const TITEL = "Neu im Fair Business Club";
const MARKE = "eff.bee.zee";
const BLOG_MOTIV = "hero-see.webp";
const TUTORIAL_MOTIV = "hero-compass.webp";

/** Derselbe Ausdruck wie im Test der Quelle — hier, weil daraus ein Pfad wird. */
const SLUG = /^[a-z0-9-]+$/;

/** Das Datumspräfix, das jeder Archiv-Slug trägt: `2026-08-26-passwort-…`. */
const DATUMSPRAEFIX = /^\d{4}-\d{2}-\d{2}-/;

/**
 * Der öffentliche Pfadbestandteil einer Geschichte — der Slug OHNE sein Datum.
 *
 * Der Slug ist der Schlüssel zum Archiveintrag und trägt dessen Datum. Als
 * Adresse widerspräche das der Ausgabe, in der die Geschichte steht:
 * `/2026-08-26-…` in der Woche vom 1. August. Das Ausgabedatum ist das
 * einzige Datum, das die Leserschaft sehen soll, also verschwindet dieses
 * hier — der Slug selbst bleibt unangetastet, sonst risse die Verbindung
 * zum Archiv.
 */
export function pfadVon(g: { slug: string }): string {
  return g.slug.replace(DATUMSPRAEFIX, "");
}

/**
 * Auch aus dem Bildpfad wird ein Pfad — ein Ziel, in das kopiert wird.
 * Dieselbe Überlegung wie beim Slug, eine Zeile später eingesetzt.
 */
const BILDPFAD = /^\/bilder\/[a-z0-9-]+\.(png|webp)$/;

/** Die Aufnahmen liegen hier, NICHT unter `public/` — das ist das Bündel der App. */
const BILDER_QUELLE = "blog/bilder";

/** Die Motive der Kopfbereiche sind die der Anwendung (`CREDITS.md` daneben). */
const MOTIV_QUELLE = "public/images";

/** Die Textspalte in Pixeln (40rem). Breitere Bilder treten aus ihr heraus. */
const SPALTE = 640;

const MONATE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Maskiert einen Wert für Text UND Attribut.
 *
 * Ein Aufruf je Einsetzpunkt, ausnahmslos: Titel, Text, Datum, Slug und
 * Alternativtext. Eine Maskierung, die nur den Rumpf trifft, ist keine — der
 * Titel wird an zwei Stellen eingesetzt und ist genauso ein Einsetzpunkt.
 */
function maskiere(wert: string): string {
  return wert
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `2026-09-07` → `7. September 2026`. */
function datumLang(iso: string): string {
  const [jahr, monat, tag] = iso.split("-");
  return `${Number(tag)}. ${MONATE[Number(monat) - 1]} ${jahr}`;
}

function teile(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Klartext zu Absätzen: die Leerzeile ist sein einziges Gliederungsmittel. */
function absaetze(text: string, einzug = "      "): string {
  return teile(text)
    .map((t) => `${einzug}<p>${maskiere(t)}</p>`)
    .join("\n");
}

/**
 * Der Anriss ist der ERSTE ABSATZ und kein eigenes Feld.
 *
 * Ein zweites Textfeld wäre eine zweite Pflegestelle für denselben Gedanken,
 * und die beiden liefen auseinander, sobald einer geändert wird. Die Texte sind
 * dafür gebaut: jeder beginnt mit einem Einstieg, der für sich steht.
 */
function anriss(text: string): string {
  return teile(text)[0] ?? "";
}

/**
 * `alt` ist der einzige Einsetzpunkt, der in ein ATTRIBUT geht — ein
 * Anführungszeichen darin bräche das Element auf. Breite und Höhe sind Zahlen
 * aus dem Modell und gehen denselben Weg, weil eine Ausnahme die Regel wäre,
 * die beim nächsten Feld vergessen wird.
 */
function bildMarkup(bild: ReleaseBild, spaeterLaden: boolean): string {
  const lazy = spaeterLaden ? ' loading="lazy"' : "";
  // Nur was breiter ist als die Textspalte, tritt aus ihr heraus. Die Klasse
  // entsteht hier und nicht im Stil, weil CSS die eigene Breite eines Bildes
  // nicht abfragen kann — und ohne die Trennung verlöre ein 180 px breiter
  // Ausschnitt seine Mitte an die negativen Ränder.
  const breit = bild.width > SPALTE ? ' class="breit"' : "";
  return `<img src="${maskiere(bild.src)}" alt="${maskiere(bild.alt)}" width="${bild.width}" height="${bild.height}"${breit}${lazy} />`;
}

/**
 * Der Kopfbereich, wie ihn die Anwendung über ihren Seiten trägt.
 *
 * Das Motiv steht als **Bild-Element** und nicht als Hintergrund aus dem Stil:
 * der Artefakt-Wächter liest Elemente und Attribute, und eine Adresse, die nur
 * im Stil steht, entzöge sich ihm. `alt=""` ist richtig und keine Nachlässigkeit
 * — das Motiv ist Schmuck, der Titel daneben trägt die Aussage.
 */
function kopfbereich(motiv: string, titel: string, unterzeile: string): string {
  return `    <header class="hero">
      <img src="/bilder/${maskiere(motiv)}" alt="" width="1600" height="1067" />
      <h1>${maskiere(titel)}</h1>
      <p>${maskiere(unterzeile)}</p>
    </header>`;
}

/** Die Adresse der Anwendung — der einzige Verweis des Blogs nach draussen. */
const APP = "https://app.effbeezee.com/";

/**
 * Die Navigation, auf jeder Seite dieselbe, mit der aktuellen Fläche ausgezeichnet.
 *
 * Der Verweis in die Anwendung steht **abgesetzt** unter den beiden Flächen und
 * nicht als dritter Reiter daneben: Blog und Tutorial sind zwei Ordnungen
 * desselben Ortes, die Anwendung ist ein anderer Ort. Als gleichrangiger
 * Reiter läse er sich wie eine dritte Fläche dieser Seite.
 *
 * Er ist der einzige Verweis des Blogs auf eine fremde Herkunft und deshalb im
 * Artefakt-Wächter namentlich zugelassen.
 */
function navigation(aktiv: "blog" | "tutorial"): string {
  const marke = (fuer: "blog" | "tutorial") => (fuer === aktiv ? ' class="aktiv"' : "");
  return `    <aside>
      <p class="marke">${maskiere(MARKE)}</p>
      <nav>
        <a href="/tutorial.html"${marke("tutorial")}>Tutorial</a>
        <a href="/index.html"${marke("blog")}>Blog</a>
      </nav>
      <p class="zurapp"><a href="${APP}">Zur App anmelden</a></p>
    </aside>`;
}

const STIL = `
    :root {
      color-scheme: light dark;
      --canvas: #ffffff;
      --soft: #f6f8fb;
      --ink: #1e2a3a;
      --ink-stark: #0c2043;
      --gedaempft: #626f85;
      --linie: #e2e8f0;
      --akzent: #1f53b0;
      --schleier: 0.32;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --canvas: #081527;
        --soft: #0c2043;
        --ink: #dce9fa;
        --ink-stark: #ffffff;
        /* NICHT derselbe Ton wie --akzent: im Dunklen lasen sich Datum und
           Fusszeile sonst wie Verweise. Gesehen, nicht gerechnet. */
        --gedaempft: #93a7c4;
        --linie: #123061;
        --akzent: #8eb5ec;
        /* Dieselben Motive sind auf dunklem Grund heller — gemessen an der
           Lesbarkeit der Überschrift darüber, nicht geschätzt. */
        --schleier: 0.24;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--canvas);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 1.0625rem;
      line-height: 1.65;
      display: grid;
      grid-template-columns: 15rem minmax(0, 1fr);
      /* Die drei Zeilen stehen EXPLIZIT da, und das ist keine Zierde: ohne sie
         gibt es keine Linie -1, die Zeilenangabe der Leiste fällt auf eine
         einzige Zeile zusammen, und ihre Bildschirmhöhe zieht die erste Zeile
         mit — der Kopfbereich daneben wurde dadurch 830 px hoch. */
      grid-template-rows: auto 1fr auto;
    }
    aside {
      grid-column: 1;
      grid-row: 1 / -1;
      position: sticky;
      top: 0;
      align-self: start;
      height: 100vh;
      padding: 1.5rem 1.25rem;
      border-right: 1px solid var(--linie);
      background: var(--soft);
    }
    .marke {
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--ink-stark);
      margin: 0 0 1.75rem;
    }
    aside nav { display: flex; flex-direction: column; gap: 0.25rem; }
    aside nav a {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      text-decoration: none;
      color: var(--ink);
      font-weight: 600;
    }
    aside nav a:hover { background: var(--canvas); }
    aside nav a.aktiv { background: var(--canvas); color: var(--akzent); }
    /* Abgesetzt von den beiden Flaechen — die Anwendung ist ein anderer Ort. */
    .zurapp {
      margin: 1.5rem 0 0;
      padding-top: 1.25rem;
      border-top: 1px solid var(--linie);
    }
    .zurapp a {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      text-decoration: none;
      font-weight: 600;
      color: var(--akzent);
    }
    .zurapp a:hover { background: var(--canvas); }
    header, main, footer {
      grid-column: 2;
      width: 100%;
      max-width: 52rem;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    header.hero {
      position: relative;
      overflow: hidden;
      margin: 1.5rem auto 2.5rem;
      padding: 2.25rem 2rem;
      min-height: 11rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-radius: 0.75rem;
      background: var(--soft);
    }
    /* Das Motiv liegt unter dem Text und nicht hinter ihm: eine Deckkraft statt
       eines Verlaufs, weil ein Verlauf über zwei Themes zwei Verläufe wären.
       (Keine Backticks in diesem Block — er steht in einem Template-Literal.) */
    header.hero img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: var(--schleier);
      margin: 0;
      border: 0;
      border-radius: 0;
    }
    header.hero h1, header.hero p { position: relative; margin: 0; }
    header.hero h1 { font-size: 2rem; }
    header.hero p { color: var(--ink-stark); margin-top: 0.35rem; }
    main { max-width: 40rem; }
    h1, h2, h3 {
      font-family: Georgia, "Times New Roman", serif;
      color: var(--ink-stark);
      line-height: 1.25;
    }
    h1 { font-size: 1.875rem; margin: 0 0 0.5rem; }
    h2 {
      font-size: 1.375rem;
      margin: 3rem 0 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--linie);
    }
    main > h2:first-child { margin-top: 0; }
    p { margin: 0 0 1.15rem; }
    a { color: var(--akzent); }
    nav a { text-decoration: none; font-size: 0.9375rem; }
    nav a:hover { text-decoration: underline; }
    time { color: var(--gedaempft); font-size: 0.9375rem; }
    main > time { display: block; margin-bottom: 1.75rem; }
    main > nav { display: block; margin-bottom: 1.5rem; }
    /* Die Aufnahmen sind sehr verschieden gross — von einem 180 px breiten
       Ausschnitt bis zum ganzen Fenster. Deshalb nur eine Obergrenze und keine
       Streckung: ein hochskalierter Ausschnitt wäre unscharf, und unscharf sieht
       aus wie ein Fehler. Der weiche Grund darunter fasst die kleinen ein. */
    img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 0 auto 1rem;
      border: 1px solid var(--linie);
      border-radius: 0.5rem;
      background: var(--soft);
    }
    main > img { margin-bottom: 1.75rem; }
    /* Wo Platz ist, tritt das Bild aus der Textspalte heraus. Ein Fenster-
       Screenshot auf 40rem ist eine Briefmarke — man sieht, DASS da etwas ist,
       und nicht, WAS. Der Ausbruch ist genau so breit wie die Reserve. */
    @media (min-width: 76rem) {
      main img.breit { max-width: 52rem; margin-left: -6rem; margin-right: -6rem; }
    }
    article {
      margin: 0 0 2rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--linie);
    }
    article:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }
    /* Im Anriss ist das Bild ein Blickfang und nicht der Beleg — deshalb
       gedeckelt und von oben beschnitten. Auf der Kapitelseite steht es
       vollständig; dort ist es der Gegenstand. */
    article img { max-height: 15rem; object-fit: cover; object-position: top; }
    article h3 { font-size: 1.1875rem; margin: 0 0 0.35rem; }
    article h3 a { color: var(--ink-stark); text-decoration: none; }
    article h3 a:hover { text-decoration: underline; }
    article time { display: block; margin-bottom: 0.75rem; }
    article p { margin: 0 0 0.75rem; }
    article p:last-child { margin-bottom: 0; font-weight: 600; }
    .etappe { margin: 0 0 1.25rem; color: var(--gedaempft); }
    .weiter {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--linie);
      font-weight: 600;
    }
    footer {
      margin: 3.5rem auto 0;
      padding-top: 1.5rem;
      padding-bottom: 3rem;
      border-top: 1px solid var(--linie);
      color: var(--gedaempft);
      font-size: 0.9375rem;
    }
    /* Schmal: aus der Spalte wird eine Zeile über dem Inhalt. Ohne JavaScript
       gibt es keine Schublade, und eine Schublade ohne Schalter wäre keine. */
    @media (max-width: 57.99rem) {
      body { display: block; }
      aside {
        position: static;
        height: auto;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding: 0.75rem 1.25rem;
        border-right: 0;
        border-bottom: 1px solid var(--linie);
      }
      .marke { margin: 0; }
      .zurapp { margin: 0 0 0 auto; padding-top: 0; border-top: 0; }
      aside nav { flex-direction: row; gap: 0.25rem; }
      header, main, footer { padding: 0 1.25rem; }
      header.hero { margin: 1rem auto 2rem; padding: 1.5rem 1.25rem; min-height: 8rem; }
      header.hero h1 { font-size: 1.5rem; }
    }
`;

function rahmen(titel: string, aktiv: "blog" | "tutorial", rumpf: string): string {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${maskiere(titel)}</title>
    <style>${STIL}    </style>
  </head>
  <body>
${navigation(aktiv)}
${rumpf}
    <footer>
      <p>Fair Business Club</p>
    </footer>
  </body>
</html>
`;
}

/**
 * Ein Anriss-Block — nur noch für die TUTORIAL-Übersicht.
 *
 * Die Blog-Ausgabe zeigt seit dem 10.09. die vollen Texte (`kapitelAbschnitt`);
 * das Tutorial bleibt eine Wegbeschreibung und verweist weiter auf die
 * einzelnen Kapitelseiten.
 */
function anrissArtikel(g: ReleaseGeschichte): string {
  const ziel = `/${maskiere(pfadVon(g))}.html`;
  // Zwei Wege in dieselbe Geschichte, und das ist Absicht: der Titel für den,
  // der den Gegenstand kennt, „Weiterlesen“ für den, den der Anriss geholt hat.
  return `        <article>
          <h3><a href="${ziel}">${maskiere(g.titel)}</a></h3>
          <p>${maskiere(anriss(g.text))}</p>
          <p><a href="${ziel}">Weiterlesen</a></p>
        </article>`;
}

/**
 * Die Seite für eine Adresse, die es nicht gibt.
 *
 * Ohne sie liefert Cloudflare Pages bei jeder unbekannten Adresse die
 * Startseite — mit Status **200**. Gemessen am 10.09.: `/gibt-es-nicht.html`
 * und `/2026-08-26-password-reset-flow.html` gaben beide 200 und den Index.
 *
 * Das ist nicht nur unsauber, es macht eine Zusage unprüfbar: dass keine
 * nicht freigegebene Geschichte erreichbar ist, lässt sich an einer Fläche,
 * auf der JEDE Adresse antwortet, nicht mehr feststellen.
 */
function nichtGefunden(): string {
  return `${kopfbereich(BLOG_MOTIV, "Diese Seite gibt es nicht", "Vielleicht ist sie umgezogen.")}
    <main>
      <p>Unter dieser Adresse liegt nichts. Möglicherweise stimmt der Verweis nicht, über den du hergekommen bist.</p>
      <p><a href="/index.html">Zur Übersicht der Ausgaben</a></p>
    </main>`;
}

/** Die Blog-Übersicht: Ausgaben, jüngste zuerst. */
function blogUebersicht(
  ausgaben: { ausgabe: ReleaseAusgabe; geschichten: ReleaseGeschichte[] }[],
): string {
  const punkte = ausgaben
    .map(({ ausgabe: a, geschichten }) => {
      const ziel = `/ausgabe-${maskiere(a.datum)}.html`;
      // Das Bild der ERSTEN Geschichte steht für die Ausgabe. Eine Ausgabe hat
      // kein eigenes Bild und soll auch keins bekommen: das wäre ein weiteres
      // Feld, das gepflegt werden muss, für eine Fläche, die ohnehin zeigt,
      // worum es geht.
      const bild = geschichten[0] ? `\n          ${bildMarkup(geschichten[0].bild, true)}` : "";
      return `        <article>${bild}
          <h3><a href="${ziel}">${maskiere(a.titel)}</a></h3>
          <time datetime="${maskiere(a.datum)}">${maskiere(datumLang(a.datum))}</time>
          <p>${maskiere(anriss(a.einleitung))}</p>
          <p><a href="${ziel}">Weiterlesen</a></p>
        </article>`;
    })
    .join("\n");

  return `${kopfbereich(BLOG_MOTIV, TITEL, "Was in welcher Woche dazugekommen ist.")}
    <main>
${punkte || "      <p>Hier erscheinen die Ausgaben, sobald die erste freigegeben ist.</p>"}
    </main>`;
}

/**
 * Ein Themenabschnitt INNERHALB der Ausgabe — Bild, Titel, voller Text.
 *
 * Kein Anriss und kein „Weiterlesen“: eine Ausgabe ist **ein** Blogeintrag,
 * und wer ihn öffnet, hat sich für die Details der Woche entschieden. Der
 * Anriss gehört auf die Übersicht, wo man noch wählt, nicht hierher, wo man
 * schon gewählt hat.
 */
function kapitelAbschnitt(g: ReleaseGeschichte): string {
  return `        <article>
          ${bildMarkup(g.bild, true)}
          <h3>${maskiere(g.titel)}</h3>
${absaetze(g.text, "          ")}
        </article>`;
}

/**
 * Eine Ausgabe: der Überblick, dann die Details — auf DERSELBEN Seite.
 *
 * Bis zum 10.09. standen hier Anrisse mit je einem „Weiterlesen“ auf eine
 * eigene Kapitelseite. Wer die Woche lesen wollte, klickte vier Mal und las
 * auf vier Seiten. Ein Blogeintrag pro Woche heisst: einmal Weiterlesen von
 * der Übersicht, danach steht alles hier.
 *
 * Die Kapitelseiten bleiben — das **Tutorial** führt Etappe für Etappe durch
 * sie hindurch, und dort ist eine Seite je Schritt genau richtig.
 */
function ausgabeSeite(a: ReleaseAusgabe, geschichten: ReleaseGeschichte[]): string {
  return `    <header>
      <nav><a href="/index.html">← Alle Ausgaben</a></nav>
    </header>
    <main>
      <h1>${maskiere(a.titel)}</h1>
      <time datetime="${maskiere(a.datum)}">${maskiere(datumLang(a.datum))}</time>
${absaetze(a.einleitung)}
      <h2>Was dazugekommen ist</h2>
${geschichten.map(kapitelAbschnitt).join("\n")}
    </main>`;
}

/** Das Tutorial: der Weg, Etappe für Etappe. */
function tutorialUebersicht(
  etappen: TutorialEtappe[],
  nachSlug: Map<string, ReleaseGeschichte>,
): string {
  const abschnitte = etappen
    .map((e) => {
      const kapitel = e.kapitel.map((s) => nachSlug.get(s)).filter((g) => g !== undefined);
      // Eine Etappe, deren Kapitel alle noch Entwürfe sind, erscheint gar nicht
      // erst — sonst stünde eine Überschrift über einer leeren Strecke und
      // verriete, dass es dort etwas gibt.
      if (kapitel.length === 0) return "";
      return `      <h2>${maskiere(e.titel)}</h2>
      <p class="etappe">${maskiere(e.einleitung)}</p>
${kapitel.map(anrissArtikel).join("\n")}`;
    })
    .filter(Boolean);

  return `${kopfbereich(TUTORIAL_MOTIV, "So funktioniert der Club", "Ein Weg durch die Anwendung, vom Ankommen bis zum Einrichten.")}
    <main>
${abschnitte.join("\n") || "      <p>Der Weg entsteht, sobald das erste Kapitel freigegeben ist.</p>"}
    </main>`;
}

/** Eine Kapitelseite — sie bedient beide Flächen. */
function kapitelSeite(
  g: ReleaseGeschichte,
  etappe: TutorialEtappe,
  naechste: ReleaseGeschichte | undefined,
): string {
  const weiter = naechste
    ? `      <p class="weiter"><a href="/${maskiere(pfadVon(naechste))}.html">Weiter: ${maskiere(naechste.titel)}</a></p>`
    : "";
  return `${kopfbereich(etappe.motiv, g.titel, etappe.titel)}
    <main>
      <nav><a href="/tutorial.html">← Zum Tutorial</a></nav>
      ${bildMarkup(g.bild, false)}
${absaetze(g.text)}
${weiter}
    </main>`;
}

/**
 * Die Bilddateien, die ausgeliefert werden — die der FREIGEGEBENEN Geschichten
 * und die Motive der Kopfbereiche.
 *
 * Ohne die Auswahl läge das Bild eines Entwurfs unter einer erratbaren Adresse:
 * die Trennung „liegt im Repository“ von „ist veröffentlicht“ gälte dann für den
 * Text, aber nicht für das Bild daneben.
 */
export function bilderZumAusliefern(geschichten: ReleaseGeschichte[]): string[] {
  return geschichten
    .filter((g) => g.freigegeben)
    .map((g) => g.bild.src.slice("/bilder/".length));
}

/** Die Motive: die der Etappen plus die beiden Flächen-Motive. */
export function motiveZumAusliefern(etappen: TutorialEtappe[]): string[] {
  return [...new Set([BLOG_MOTIV, TUTORIAL_MOTIV, ...etappen.map((e) => e.motiv)])];
}

export function erzeugeSeiten({ geschichten, ausgaben, etappen }: BlogEingabe): BlogSeite[] {
  for (const g of geschichten) {
    // VOR dem Schreiben, nicht danach. Der Slug kommt aus einem
    // Verzeichnisnamen im Repository und ist damit nicht feindlich — aber er
    // wird zu einem Pfad, und ein Pfadbestandteil, der ungeprüft aus Daten
    // entsteht, ist die Stelle, an der man später nicht mehr nachsehen will.
    if (!SLUG.test(g.slug)) throw new Error(`build-blog: unzulässiger Slug „${g.slug}“`);
    // Aus dem ABGELEITETEN Pfad wird der Dateiname — ein Slug, der nur aus
    // seinem Datum bestünde, ergäbe hier die leere Zeichenkette.
    if (!SLUG.test(pfadVon(g))) {
      throw new Error(`build-blog: „${g.slug}“ ergibt keinen Pfad`);
    }
    // Und derselbe Gedanke fürs Bild: aus dem Pfad wird ein Kopierziel.
    if (!BILDPFAD.test(g.bild.src)) {
      throw new Error(`build-blog: unzulässiger Bildpfad „${g.bild.src}“ bei ${g.slug}`);
    }
  }
  // Zwei Geschichten unter einem Pfad wären zwei Seiten unter einer Adresse —
  // die zweite überschriebe die erste lautlos. Die Slugs sind eindeutig; ihre
  // ABLEITUNGEN sind es nur, solange sich zwei nicht bloss im Datum
  // unterscheiden.
  const pfade = new Map<string, string>();
  for (const g of geschichten) {
    const vorher = pfade.get(pfadVon(g));
    if (vorher !== undefined) {
      throw new Error(`build-blog: „${vorher}“ und „${g.slug}“ ergeben denselben Pfad`);
    }
    pfade.set(pfadVon(g), g.slug);
  }

  for (const a of ausgaben) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.datum)) {
      throw new Error(`build-blog: unzulässiges Ausgabedatum „${a.datum}“`);
    }
  }

  // Nur Freigegebenes wird ausgeliefert. Ohne diese Zeile wäre der Commit die
  // Veröffentlichung, und ein Entwurf ginge vor der redaktionellen Abnahme live.
  const oeffentlich = geschichten.filter((g) => g.freigegeben);
  const nachSlug = new Map(oeffentlich.map((g) => [g.slug, g]));

  // Der Weg durch das Tutorial, ohne die Entwürfe: aus ihm entsteht der
  // „Weiter“-Verweis. Ein übersprungener Entwurf darf den Weg nicht abreissen.
  const weg = etappen.flatMap((e) =>
    e.kapitel.map((slug) => nachSlug.get(slug)).filter((g) => g !== undefined),
  );
  const etappeZu = new Map<string, TutorialEtappe>();
  for (const e of etappen) for (const slug of e.kapitel) etappeZu.set(slug, e);

  const ausgabenAbsteigend = [...ausgaben]
    .map((a) => ({
      ausgabe: a,
      geschichten: a.geschichten.map((s) => nachSlug.get(s)).filter((g) => g !== undefined),
    }))
    // Eine Ausgabe ohne freigegebene Geschichte erscheint gar nicht.
    .filter((a) => a.geschichten.length > 0)
    .sort((x, y) => y.ausgabe.datum.localeCompare(x.ausgabe.datum));

  return [
    {
      pfad: "index.html",
      html: rahmen(TITEL, "blog", blogUebersicht(ausgabenAbsteigend)),
    },
    {
      // Cloudflare Pages liefert genau diesen Namen mit Status 404 aus.
      pfad: "404.html",
      html: rahmen(`Nicht gefunden · ${TITEL}`, "blog", nichtGefunden()),
    },
    {
      pfad: "tutorial.html",
      html: rahmen(
        `So funktioniert der Club · ${TITEL}`,
        "tutorial",
        tutorialUebersicht(etappen, nachSlug),
      ),
    },
    ...ausgabenAbsteigend.map((a) => ({
      pfad: `ausgabe-${a.ausgabe.datum}.html`,
      html: rahmen(
        `${a.ausgabe.titel} · ${TITEL}`,
        "blog",
        ausgabeSeite(a.ausgabe, a.geschichten),
      ),
    })),
    ...weg.map((g, i) => {
      const etappe = etappeZu.get(g.slug);
      if (!etappe) {
        // Der Test der Quelle hält, dass jede Geschichte in genau einer Etappe
        // steht. Hier zu werfen statt eine Seite ohne Kopfbereich zu schreiben,
        // macht aus einem stillen Loch einen lauten Fehlschlag.
        throw new Error(`build-blog: ${g.slug} steht in keiner Tutorial-Etappe`);
      }
      return {
        pfad: `${pfadVon(g)}.html`,
        html: rahmen(
          `${g.titel} · ${TITEL}`,
          "tutorial",
          kapitelSeite(g, etappe, weg[i + 1]),
        ),
      };
    }),
  ];
}

export function schreibeBlog(ziel: string, eingabe: BlogEingabe): BlogSeite[] {
  const seiten = erzeugeSeiten(eingabe);
  mkdirSync(ziel, { recursive: true });
  for (const s of seiten) writeFileSync(join(ziel, s.pfad), s.html);
  // Das Bild wandert in dasselbe Artefakt wie die Seite, die es zeigt. Damit
  // hält die Zusage „nichts von fremder Herkunft“ ohne weitere Absprache: es
  // gibt keine zweite Stelle, von der aus jemand es später ausliefern könnte.
  mkdirSync(join(ziel, "bilder"), { recursive: true });
  for (const datei of bilderZumAusliefern(eingabe.geschichten)) {
    copyFileSync(join(resolve(process.cwd(), BILDER_QUELLE), datei), join(ziel, "bilder", datei));
  }
  for (const datei of motiveZumAusliefern(eingabe.etappen)) {
    copyFileSync(join(resolve(process.cwd(), MOTIV_QUELLE), datei), join(ziel, "bilder", datei));
  }
  return seiten;
}

// Nur ausführen, wenn direkt aufgerufen — sonst schriebe jeder Import Dateien.
if (process.argv[1]?.endsWith("build-blog.ts")) {
  const seiten = schreibeBlog(ZIEL, {
    geschichten: RELEASE_GESCHICHTEN,
    ausgaben: RELEASE_AUSGABEN,
    etappen: RELEASE_TUTORIAL,
  });
  process.stdout.write(`${seiten.length} Seiten → ${ZIEL}/\n`);
}
