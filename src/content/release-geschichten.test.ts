import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { findeMarkup, findePersonenbezug } from "../lib/release-geschichten-pruefung";
import type { ReleaseGeschichte } from "../types/release";
import { RELEASE_EINTRAEGE } from "./release-entries.generated";
import { RELEASE_GESCHICHTEN } from "./release-geschichten";

/**
 * Die kuratierte Quelle des öffentlichen Blogs (AGE-705).
 *
 * Geprüft wird die AUSGELIEFERTE Datei, nicht eine Attrappe. Sie ist von Hand
 * gepflegt — anders als `release-entries.generated.ts`, die bei jedem Build
 * überschrieben wird —, und genau deshalb kann nur ein Test an ihr halten, was
 * bei einer erzeugten Datei der Erzeuger erzwingt.
 *
 * Der Slug ist die Verbindung zum Archiveintrag, aus dem eine Geschichte
 * entstand. Er wird in Block 2 zu einem Dateinamen; dass er das gefahrlos
 * kann, ist hier zugesichert und nicht dort angenommen.
 */

const ARCHIV_SLUGS = new Set(RELEASE_EINTRAEGE.map((e) => e.slug));

/** Eine unverdorbene Beispiel-Geschichte, aus der die verdorbenen entstehen. */
function beispiel(text: string): ReleaseGeschichte {
  return {
    slug: "2026-09-07-events-vorlagen-und-serientermine",
    datum: "2026-09-07",
    titel: "Eine Terminreihe aus einer Vorlage anlegen",
    text,
    bild: {
      src: "/bilder/event-vorlagen.png",
      alt: "Der Reiter Vorlagen unter Events mit drei Terminreihen",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  };
}

describe("release-geschichten — die kuratierte Quelle", () => {
  it("trägt mindestens eine Geschichte", () => {
    // Ohne diese Zusage wären alle folgenden über einer leeren Liste grün.
    expect(RELEASE_GESCHICHTEN.length).toBeGreaterThan(0);
  });

  it("gibt jeder Geschichte Slug, Datum, Titel, Klartext und Freigabe-Merker", () => {
    for (const g of RELEASE_GESCHICHTEN) {
      expect(g.slug, `Slug fehlt bei „${g.titel}“`).toBeTruthy();
      // `JJJJ-MM-TT` — die Übersicht sortiert danach. Eine freie Schreibweise
      // sortierte falsch, statt zu scheitern.
      expect(g.datum, `Datum von ${g.slug}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(g.titel.trim(), `Titel von ${g.slug}`).not.toBe("");
      expect(g.text.trim(), `Text von ${g.slug}`).not.toBe("");
      expect(typeof g.freigegeben, `Freigabe von ${g.slug}`).toBe("boolean");
    }
  });

  it("vergibt jeden Slug höchstens einmal", () => {
    // Zwei Geschichten unter einem Slug wären zwei Seiten unter einem Pfad —
    // die zweite überschriebe die erste lautlos.
    const slugs = RELEASE_GESCHICHTEN.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("zeigt mit jedem Slug auf einen existierenden Archiv-Eintrag", () => {
    // Der Archiveintrag ist der Anlass, aus dem die Geschichte entstand. Ein
    // Slug ohne Eintrag heisst: die Verbindung ist verrutscht — meist ein
    // Tippfehler beim Abschreiben des Verzeichnisnamens.
    for (const g of RELEASE_GESCHICHTEN) {
      expect(ARCHIV_SLUGS.has(g.slug), `kein Archiv-Eintrag zu ${g.slug}`).toBe(true);
    }
  });

  it("hält jeden Slug als sicheren Pfadbestandteil", () => {
    // Er wird in Block 2 zu einem Dateinamen. Ein Pfadbestandteil, der
    // ungeprüft aus Daten entsteht, ist die Stelle, an der man später nicht
    // mehr nachsehen will.
    for (const g of RELEASE_GESCHICHTEN) {
      expect(g.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("Klartext-Wächter — Auszeichnungszeichen fallen auf", () => {
  // Gegen absichtlich VERDORBENE Beispiel-Geschichten, nicht gegen die echten:
  // ein Wächter, der nur an heilen Daten grün ist, belegt nichts.
  it("rötet eine Markdown-Betonung", () => {
    expect(findeMarkup(beispiel("Das ist **wichtig** für dich.").text)).toBe("**wichtig**");
  });

  it("rötet ein HTML-Element", () => {
    expect(findeMarkup(beispiel("Das ist <b>wichtig</b> für dich.").text)).toBe("<b>");
  });

  it("rötet einen Markdown-Link", () => {
    expect(findeMarkup(beispiel("Mehr dazu [im Verzeichnis](/mitglieder).").text)).toBe(
      "[im Verzeichnis](/mitglieder)",
    );
  });

  it("rötet Backtick-Auszeichnung", () => {
    // Der realistische Weg hinein ist Abschreiben aus dem Archiveintrag — dort
    // stehen Tabellen- und Spaltennamen durchgehend in Backticks.
    expect(findeMarkup(beispiel("Die Tabelle `events` hält die Termine.").text)).toBe("`events`");
  });

  it("lässt gewöhnlichen deutschen Klartext durch", () => {
    // Gedankenstriche, deutsche Anführungszeichen, Umlaute und Ziffern sind
    // keine Auszeichnung. Ein Wächter, der sie rötet, wäre unbenutzbar.
    expect(
      findeMarkup(
        'Die Vorlagen liegen unter Events im Reiter „Vorlagen“ — höchstens 52 Termine je Erzeugung; 1. Termin inklusive. Ein Anteil von 30 % ist "in Ordnung".',
      ),
    ).toBeNull();
  });

  it("lässt jede echte Geschichte unberührt", () => {
    for (const g of RELEASE_GESCHICHTEN) {
      expect(findeMarkup(g.text), `Markup im Text von ${g.slug}`).toBeNull();
      // Der Titel ist derselbe Einsetzpunkt: ein Sternchenpaar wäre dort
      // genauso sichtbar wie im Rumpf.
      expect(findeMarkup(g.titel), `Markup im Titel von ${g.slug}`).toBeNull();
    }
  });
});

describe("PII-Wächter — ein Netz, keine Zusage", () => {
  // Das Repository ist ÖFFENTLICH: ein solcher Text ist mit dem COMMIT
  // offengelegt, nicht erst mit dem Deploy. Der Wächter fängt die Gestalten,
  // die eine Gestalt haben — einen Klarnamen erkennt er NICHT, und genau
  // deshalb steht der Durchgang von Hand (Aufgabe 4.4) daneben und nicht
  // dahinter.
  it("rötet eine E-Mail-Adresse", () => {
    expect(findePersonenbezug(beispiel("Schreib an bernd.wiegand@beispiel.de.").text)).toBe(
      "bernd.wiegand@beispiel.de",
    );
  });

  it("rötet eine Telefonnummer", () => {
    expect(findePersonenbezug(beispiel("Ruf an unter 0170 1234567.").text)).toBe("0170 1234567");
  });

  it("rötet eine Telefonnummer mit Ländervorwahl", () => {
    expect(findePersonenbezug(beispiel("Erreichbar unter +49 30 1234567.").text)).toBe(
      "+49 30 1234567",
    );
  });

  it("rötet eine Anschrift", () => {
    expect(findePersonenbezug(beispiel("Der Stammtisch tagt in der Beispielstraße 12.").text)).toBe(
      "Beispielstraße 12",
    );
  });

  it("rötet Postleitzahl und Ort", () => {
    expect(findePersonenbezug(beispiel("Das Treffen ist in 70173 Stuttgart.").text)).toBe(
      "70173 Stuttgart",
    );
  });

  it("lässt Zahlen aus gewöhnlichem Klartext durch", () => {
    // Höchstgrenzen, Aufzählungen, Datumsangaben und Prozente stehen überall in
    // diesen Texten. Ein Wächter, der sie für Rufnummern hält, wird abgeschaltet
    // und schützt dann gar nichts mehr.
    expect(
      findePersonenbezug(
        "Höchstens 52 Termine je Erzeugung, Tag 1 bis 31, ab dem 07.09.2026, rund 30 % der Plätze.",
      ),
    ).toBeNull();
  });

  it("hält eine Datumsangabe und eine Uhrzeitspanne für keine Rufnummer", () => {
    // Beide sehen aus wie eine: mehrere Zifferngruppen, durch einen Bindestrich
    // getrennt. Nur die ZIFFERNZAHL trennt sie von einer Rufnummer — ohne diese
    // Schwelle wäre der Wächter genau hier ein Fehlalarm, und eine ISO-Datums-
    // angabe steht in diesen Texten regelmäßig.
    expect(findePersonenbezug("Der Termin am 2026-09-07 läuft von 18-20 Uhr.")).toBeNull();
  });

  it("lässt jede echte Geschichte unberührt", () => {
    for (const g of RELEASE_GESCHICHTEN) {
      expect(findePersonenbezug(g.text), `Personenbezug im Text von ${g.slug}`).toBeNull();
      expect(findePersonenbezug(g.titel), `Personenbezug im Titel von ${g.slug}`).toBeNull();
    }
  });
});

describe("Bilder — jede Geschichte zeigt ihre Fläche", () => {
  // Die Datei ist von Hand gepflegt, also ist der Test die einzige Stelle, die
  // „das Bild gibt es wirklich“ halten kann. Ein Typ belegt nur, dass eine
  // Zeichenkette dasteht; dass sie auf eine Datei zeigt, belegt er nicht.
  // Über den Projektpfad, nicht über `import.meta.url`: im jsdom-Transform ist
  // der keine `file:`-Adresse — dieselbe Falle wie in `anon-flaeche.test.tsx`.
  const BILDER = resolve(process.cwd(), "blog/bilder");

  it("gibt jeder Geschichte ein Bild mit Alternativtext und Massen", () => {
    for (const g of RELEASE_GESCHICHTEN) {
      expect(g.bild.alt.trim(), `Alternativtext von ${g.slug}`).not.toBe("");
      // Breite und Höhe sind Pflicht, nicht Zierde: ohne sie kennt der Browser
      // das Seitenverhältnis erst, wenn das Bild da ist, und schiebt den Text
      // darunter genau in dem Moment nach unten, in dem jemand ihn liest.
      expect(g.bild.width, `Breite von ${g.slug}`).toBeGreaterThan(0);
      expect(g.bild.height, `Höhe von ${g.slug}`).toBeGreaterThan(0);
    }
  });

  it("zeigt mit jedem Bild auf eine Datei, die es gibt", () => {
    for (const g of RELEASE_GESCHICHTEN) {
      expect(g.bild.src, `Bildpfad von ${g.slug}`).toMatch(/^\/bilder\/[a-z0-9-]+\.png$/);
      const datei = join(BILDER, g.bild.src.slice("/bilder/".length));
      expect(existsSync(datei), `keine Datei zu ${g.slug}: ${g.bild.src}`).toBe(true);
    }
  });

  it("verwendet kein Bild zweimal", () => {
    // Zwei Geschichten unter einem Bild heisst: eine von beiden zeigt die
    // falsche Fläche. Beim Aufnehmen ist genau das schon passiert — aufgefallen
    // erst beim Hash-Vergleich der 23 Dateien.
    const pfade = RELEASE_GESCHICHTEN.map((g) => g.bild.src);
    expect(new Set(pfade).size).toBe(pfade.length);
  });

  it("lässt den Alternativtext etwas anderes sein als den Dateinamen", () => {
    // Sonst wäre die Zusage oben mit `alt: "glocke.png"` erfüllt, und
    // Vorlesesoftware bekäme einen Dateinamen vorgelesen.
    for (const g of RELEASE_GESCHICHTEN) {
      expect(g.bild.alt, `Alternativtext von ${g.slug}`).not.toContain(".png");
      expect(g.bild.alt.length, `Alternativtext von ${g.slug}`).toBeGreaterThan(20);
    }
  });
});
