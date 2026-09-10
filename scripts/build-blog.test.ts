import { describe, expect, it } from "vitest";

import type { ReleaseAusgabe, ReleaseGeschichte, TutorialEtappe } from "../src/types/release";
import { erzeugeSeiten } from "./build-blog";

/**
 * Der Blog-Erzeuger (AGE-705, Blöcke 2 und 8).
 *
 * Geprüft wird am ERGEBNIS und nicht an der Absicht: die Seiten werden geparst
 * wie ein Browser sie parst. Eine Suche nach Zeichenfolgen sagt nichts darüber,
 * welche Elemente daraus tatsächlich entstehen — genau das ist der Unterschied,
 * an dem der Wächter in 2.4 hängt.
 *
 * Der Blog hat ZWEI Flächen: die Ausgaben (nach Wochen) und das Tutorial (ein
 * Weg durch die Anwendung). Beide zeigen auf dieselben Kapitelseiten. Die
 * Fixtures hier bauen deshalb immer alle drei Listen — eine Geschichte ohne
 * Etappe wäre eine Seite ohne Kopfbereich, und der Erzeuger wirft dafür.
 */

function geschichte(teil: Partial<ReleaseGeschichte>): ReleaseGeschichte {
  return {
    slug: "eine-geschichte",
    datum: "2026-09-07",
    titel: "Ein Titel",
    text: "Ein Absatz.",
    bild: {
      src: "/bilder/ein-bild.png",
      alt: "Was auf dem Bild zu sehen ist",
      width: 800,
      height: 500,
    },
    freigegeben: true,
    ...teil,
  };
}

function ausgabe(teil: Partial<ReleaseAusgabe>): ReleaseAusgabe {
  return {
    datum: "2026-08-01",
    titel: "Eine Ausgabe",
    einleitung: "Die Einleitung.",
    geschichten: ["eine-geschichte"],
    ...teil,
  };
}

function etappe(teil: Partial<TutorialEtappe>): TutorialEtappe {
  return {
    titel: "Eine Etappe",
    einleitung: "Worum es hier geht.",
    motiv: "hero-start.webp",
    kapitel: ["eine-geschichte"],
    ...teil,
  };
}

/** Drei Geschichten, zwei Ausgaben, zwei Etappen — die Standardlage. */
const DREI: ReleaseGeschichte[] = [
  geschichte({ slug: "erste", titel: "Die erste", text: "Einstieg eins.\n\nMehr dazu." }),
  geschichte({ slug: "zweite", titel: "Die zweite", text: "Einstieg zwei." }),
  geschichte({ slug: "dritte", titel: "Die dritte", text: "Einstieg drei." }),
];

const AUSGABEN: ReleaseAusgabe[] = [
  ausgabe({
    datum: "2026-08-01",
    titel: "Die ältere Ausgabe",
    einleitung: "Erster Absatz der älteren.\n\nZweiter Absatz der älteren.",
    geschichten: ["erste"],
  }),
  ausgabe({
    datum: "2026-08-08",
    titel: "Die jüngere Ausgabe",
    einleitung: "Erster Absatz der jüngeren.",
    geschichten: ["zweite", "dritte"],
  }),
];

const ETAPPEN: TutorialEtappe[] = [
  etappe({ titel: "Ankommen", motiv: "hero-start.webp", kapitel: ["erste", "zweite"] }),
  etappe({ titel: "Weitergehen", motiv: "hero-events.webp", kapitel: ["dritte"] }),
];

const STANDARD = { geschichten: DREI, ausgaben: AUSGABEN, etappen: ETAPPEN };

function dom(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function seite(seiten: { pfad: string; html: string }[], pfad: string): Document {
  const treffer = seiten.find((s) => s.pfad === pfad);
  if (!treffer) throw new Error(`keine Seite ${pfad} — vorhanden: ${seiten.map((s) => s.pfad)}`);
  return dom(treffer.html);
}

describe("build-blog — die Seitenmenge", () => {
  it("erzeugt beide Übersichten, je Ausgabe und je Kapitel eine Seite", () => {
    expect(erzeugeSeiten(STANDARD).map((s) => s.pfad).sort()).toEqual([
      "ausgabe-2026-08-01.html",
      "ausgabe-2026-08-08.html",
      "dritte.html",
      "erste.html",
      "index.html",
      "tutorial.html",
      "zweite.html",
    ]);
  });
});

describe("build-blog — der Blog gliedert nach Ausgaben", () => {
  it("stellt die jüngste Ausgabe voran", () => {
    // Nicht thematisch: eine thematische Liste beantwortet „was ist neu" nicht.
    const uebersicht = seite(erzeugeSeiten(STANDARD), "index.html");
    const titel = [...uebersicht.querySelectorAll("main article h3")].map((h) => h.textContent);
    expect(titel).toEqual(["Die jüngere Ausgabe", "Die ältere Ausgabe"]);
  });

  it("reisst mit dem ersten Absatz der Einleitung an", () => {
    const uebersicht = seite(erzeugeSeiten(STANDARD), "index.html");
    const texte = [...uebersicht.querySelectorAll("main article p")].map((p) => p.textContent);
    expect(texte).toContain("Erster Absatz der älteren.");
    expect(texte.join(" ")).not.toContain("Zweiter Absatz der älteren.");
  });

  it("zeigt zu jeder Ausgabe das Bild ihrer ersten Geschichte", () => {
    // Eine Ausgabe hat kein eigenes Bild und soll auch keins bekommen — das
    // wäre ein weiteres Feld, das gepflegt werden muss.
    const artikel = seite(erzeugeSeiten(STANDARD), "index.html").querySelector("main article");
    expect(artikel?.querySelector("img")?.getAttribute("src")).toBe("/bilder/ein-bild.png");
    expect(artikel?.querySelector("img")?.getAttribute("loading")).toBe("lazy");
  });

  it("führt Titel und Weiterlesen an dieselbe Ausgabe", () => {
    const artikel = seite(erzeugeSeiten(STANDARD), "index.html").querySelector("main article");
    const ziele = [...(artikel?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href"));
    expect(ziele.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ziele)).toEqual(new Set(["/ausgabe-2026-08-08.html"]));
  });

  it("zeigt auf der Ausgabeseite ihre Geschichten mit Bild und Verweis", () => {
    const s = seite(erzeugeSeiten(STANDARD), "ausgabe-2026-08-08.html");
    const titel = [...s.querySelectorAll("main article h3")].map((h) => h.textContent);
    expect(titel).toEqual(["Die zweite", "Die dritte"]);
    expect(s.querySelector("main article img")?.getAttribute("src")).toBe("/bilder/ein-bild.png");
    const ziele = [...s.querySelectorAll("main article a")].map((a) => a.getAttribute("href"));
    expect(ziele).toContain("/zweite.html");
  });
});

describe("build-blog — das Tutorial ist ein Weg", () => {
  it("führt die Etappen in ihrer Reihenfolge", () => {
    const s = seite(erzeugeSeiten(STANDARD), "tutorial.html");
    expect([...s.querySelectorAll("main h2")].map((h) => h.textContent)).toEqual([
      "Ankommen",
      "Weitergehen",
    ]);
  });

  it("führt die Kapitel innerhalb der Etappe in ihrer Reihenfolge", () => {
    const s = seite(erzeugeSeiten(STANDARD), "tutorial.html");
    expect([...s.querySelectorAll("main article h3")].map((h) => h.textContent)).toEqual([
      "Die erste",
      "Die zweite",
      "Die dritte",
    ]);
  });

  it("verweist von jedem Kapitel auf das nächste", () => {
    const seiten = erzeugeSeiten(STANDARD);
    const weiter = (pfad: string) =>
      seite(seiten, pfad).querySelector("main .weiter a")?.getAttribute("href");
    expect(weiter("erste.html")).toBe("/zweite.html");
    expect(weiter("zweite.html")).toBe("/dritte.html");
  });

  it("lässt das letzte Kapitel enden", () => {
    // Ohne diese Zusage wäre ein Verweis ins Leere grün — und der Weg hätte
    // kein Ende, sondern einen toten Link.
    const s = seite(erzeugeSeiten(STANDARD), "dritte.html");
    expect(s.querySelector("main .weiter")).toBeNull();
  });

  it("überspringt einen Entwurf, ohne den Weg abzureissen", () => {
    const mitEntwurf = {
      ...STANDARD,
      geschichten: DREI.map((g) => (g.slug === "zweite" ? { ...g, freigegeben: false } : g)),
    };
    const seiten = erzeugeSeiten(mitEntwurf);
    expect(seiten.map((s) => s.pfad)).not.toContain("zweite.html");
    expect(
      seite(seiten, "erste.html").querySelector("main .weiter a")?.getAttribute("href"),
    ).toBe("/dritte.html");
  });

  it("gibt der Kapitelseite den Kopfbereich ihrer Etappe", () => {
    const s = seite(erzeugeSeiten(STANDARD), "dritte.html");
    expect(s.querySelector("header.hero img")?.getAttribute("src")).toBe("/bilder/hero-events.webp");
    expect(s.querySelector("header.hero h1")?.textContent).toBe("Die dritte");
    expect(s.querySelector("header.hero p")?.textContent).toBe("Weitergehen");
  });

  it("lässt eine Etappe weg, deren Kapitel alle Entwürfe sind", () => {
    const nurEntwuerfe = {
      ...STANDARD,
      geschichten: DREI.map((g) => (g.slug === "dritte" ? { ...g, freigegeben: false } : g)),
    };
    const s = seite(erzeugeSeiten(nurEntwuerfe), "tutorial.html");
    expect([...s.querySelectorAll("main h2")].map((h) => h.textContent)).toEqual(["Ankommen"]);
  });
});

describe("build-blog — Navigation und Kopfbereich", () => {
  it("trägt auf jeder Seite beide Flächen", () => {
    for (const s of erzeugeSeiten(STANDARD)) {
      const ziele = [...dom(s.html).querySelectorAll("aside nav a")].map((a) =>
        a.getAttribute("href"),
      );
      expect(ziele, `Navigation auf ${s.pfad}`).toEqual(["/tutorial.html", "/index.html"]);
    }
  });

  it("zeichnet die Fläche aus, auf der man gerade ist", () => {
    const aktiv = (pfad: string) => {
      const s = seite(erzeugeSeiten(STANDARD), pfad);
      return [...s.querySelectorAll("aside nav a.aktiv")].map((a) => a.textContent);
    };
    expect(aktiv("index.html")).toEqual(["Blog"]);
    expect(aktiv("ausgabe-2026-08-08.html")).toEqual(["Blog"]);
    expect(aktiv("tutorial.html")).toEqual(["Tutorial"]);
    expect(aktiv("erste.html")).toEqual(["Tutorial"]);
  });

  it("führt das Motiv der Übersichten als Bild-Element mit eigener Herkunft", () => {
    // Als Bild und NICHT als Hintergrund aus dem Stil: der Wächter liest
    // Elemente und Attribute, eine Adresse im Stil entzöge sich ihm.
    const seiten = erzeugeSeiten(STANDARD);
    expect(seite(seiten, "index.html").querySelector("header.hero img")?.getAttribute("src")).toBe(
      "/bilder/hero-see.webp",
    );
    expect(
      seite(seiten, "tutorial.html").querySelector("header.hero img")?.getAttribute("src"),
    ).toBe("/bilder/hero-compass.webp");
  });
});

describe("build-blog — jedes eingesetzte Feld wird maskiert", () => {
  // Nicht nur der Rumpf: ein Titel ist genauso ein Einsetzpunkt, und er wird an
  // ZWEI Stellen eingesetzt — als Überschrift der Seite und als Linktext in der
  // Übersicht. Eine Maskierung, die nur eine der beiden trifft, ist keine.
  const VERDORBEN = {
    geschichten: [
      geschichte({
        slug: "verdorben",
        titel: 'Titel <script>alert("t")</script>',
        text: 'Text <script>alert("r")</script>',
      }),
    ],
    ausgaben: [
      ausgabe({
        titel: 'Ausgabe <script>alert("a")</script>',
        einleitung: 'Einleitung <script>alert("e")</script>',
        geschichten: ["verdorben"],
      }),
    ],
    etappen: [etappe({ titel: 'Etappe <script>alert("p")</script>', kapitel: ["verdorben"] })],
  };

  it("erzeugt aus keiner Skript-Zeichenfolge ein Skript-Element", () => {
    for (const s of erzeugeSeiten(VERDORBEN)) {
      expect(dom(s.html).querySelectorAll("script"), `Skript in ${s.pfad}`).toHaveLength(0);
    }
  });

  it("zeigt die Zeichenfolge stattdessen als Text", () => {
    // Maskieren heisst nicht wegwerfen. Verschwände der Text, wäre der Test
    // oben auch mit einer Umsetzung grün, die den Titel einfach löscht.
    const einzel = seite(erzeugeSeiten(VERDORBEN), "verdorben.html");
    expect(einzel.querySelector("header.hero h1")?.textContent).toBe(
      'Titel <script>alert("t")</script>',
    );
    expect(einzel.querySelector("main p")?.textContent).toBe('Text <script>alert("r")</script>');
  });

  it("maskiert Ausgabentitel und Etappentitel ebenso", () => {
    const seiten = erzeugeSeiten(VERDORBEN);
    expect(seite(seiten, "index.html").querySelector("main article h3")?.textContent).toBe(
      'Ausgabe <script>alert("a")</script>',
    );
    expect(seite(seiten, "tutorial.html").querySelector("main h2")?.textContent).toBe(
      'Etappe <script>alert("p")</script>',
    );
  });

  it("maskiert auch den Alternativtext", () => {
    // Er ist genauso ein Einsetzpunkt wie Titel und Text — und der einzige, der
    // in ein ATTRIBUT geht: ein Anführungszeichen darin bräche das Element auf.
    const seiten = erzeugeSeiten({
      ...STANDARD,
      geschichten: [
        geschichte({
          slug: "erste",
          bild: { src: "/bilder/x.png", alt: '" onerror="alert(1)', width: 10, height: 10 },
        }),
        DREI[1],
        DREI[2],
      ],
    });
    const bild = seite(seiten, "erste.html").querySelector("main img");
    expect(bild?.getAttribute("onerror")).toBeNull();
    expect(bild?.getAttribute("alt")).toBe('" onerror="alert(1)');
  });

  it("lässt ein Sonderzeichen im Titel ein Zeichen bleiben", () => {
    const seiten = erzeugeSeiten({
      ...STANDARD,
      geschichten: [
        geschichte({ slug: "erste", titel: 'Anmeldung & "Warteliste" > Kapazität' }),
        DREI[1],
        DREI[2],
      ],
    });
    expect(seite(seiten, "erste.html").querySelector("header.hero h1")?.textContent).toBe(
      'Anmeldung & "Warteliste" > Kapazität',
    );
  });

  it("weist einen Slug ab, der einen Pfadwechsel bedeutete", () => {
    // Er wird zu einem Dateinamen. Geprüft wird VOR dem Schreiben — ein
    // Abweisen ist hier richtig und ein Zurechtbiegen wäre falsch.
    for (const slug of ["../ausserhalb", "mit/schraegstrich", "Mit-Grossbuchstabe"]) {
      expect(
        () => erzeugeSeiten({ ...STANDARD, geschichten: [geschichte({ slug })] }),
        slug,
      ).toThrow(/slug/i);
    }
  });

  it("weist einen Bildpfad ab, der einen Pfadwechsel bedeutete", () => {
    for (const src of ["/bilder/../../ausserhalb.png", "https://fremde.example/x.png", "x.png"]) {
      expect(
        () =>
          erzeugeSeiten({
            ...STANDARD,
            geschichten: [geschichte({ bild: { src, alt: "X", width: 1, height: 1 } })],
          }),
        src,
      ).toThrow(/bild/i);
    }
  });
});

describe("build-blog — nur Freigegebenes wird erzeugt", () => {
  // Sonst wäre der Commit die Veröffentlichung, und ein Entwurf ginge vor der
  // redaktionellen Abnahme live. Die Trennung ist der Grund, warum es das Feld
  // `freigegeben` überhaupt gibt.
  const GEMISCHT = {
    geschichten: [
      geschichte({ slug: "frei", titel: "Sichtbar", freigegeben: true }),
      geschichte({ slug: "entwurf", titel: "Noch nicht abgenommen", freigegeben: false }),
    ],
    ausgaben: [
      ausgabe({ datum: "2026-08-01", titel: "Mit Freigabe", geschichten: ["frei"] }),
      ausgabe({ datum: "2026-08-08", titel: "Nur Entwürfe", geschichten: ["entwurf"] }),
    ],
    etappen: [etappe({ kapitel: ["frei", "entwurf"] })],
  };

  it("erzeugt für eine nicht freigegebene Geschichte keine Seite", () => {
    expect(erzeugeSeiten(GEMISCHT).map((s) => s.pfad)).toEqual([
      "index.html",
      "tutorial.html",
      "ausgabe-2026-08-01.html",
      "frei.html",
    ]);
  });

  it("lässt eine Ausgabe weg, deren Geschichten alle Entwürfe sind", () => {
    // Sonst stünde die Überschrift „Nur Entwürfe" über einer leeren Ausgabe —
    // und verriete damit, dass es dort etwas gibt.
    const uebersicht = seite(erzeugeSeiten(GEMISCHT), "index.html");
    const titel = [...uebersicht.querySelectorAll("main article h3")].map((h) => h.textContent);
    expect(titel).toEqual(["Mit Freigabe"]);
  });
});

describe("build-blog — der Ausbruch aus der Textspalte", () => {
  it("kennzeichnet nur das Bild, das breiter ist als die Textspalte", () => {
    // Ohne diese Trennung verlöre ein 180 px breiter Ausschnitt seine Mitte: die
    // negativen Ränder überschreiben `margin: 0 auto`, und er klebte am Rand.
    const seiten = erzeugeSeiten({
      geschichten: [
        geschichte({
          slug: "breit",
          bild: { src: "/bilder/breit.png", alt: "Ein ganzes Fenster", width: 1440, height: 900 },
        }),
        geschichte({
          slug: "schmal",
          bild: { src: "/bilder/schmal.png", alt: "Ein Ausschnitt", width: 180, height: 64 },
        }),
      ],
      ausgaben: [ausgabe({ geschichten: ["breit", "schmal"] })],
      etappen: [etappe({ kapitel: ["breit", "schmal"] })],
    });
    const klassen = [
      ...seite(seiten, "ausgabe-2026-08-01.html").querySelectorAll("main article img"),
    ].map((i) => [i.getAttribute("src"), i.getAttribute("class")]);
    expect(klassen).toEqual([
      ["/bilder/breit.png", "breit"],
      ["/bilder/schmal.png", null],
    ]);
  });
});
