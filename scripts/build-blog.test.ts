import { describe, expect, it } from "vitest";

import type { ReleaseAusgabe, ReleaseGeschichte, TutorialEtappe } from "../src/types/release";
import { erzeugeSeiten, markeMitThemen } from "./build-blog";

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
  it("erzeugt beide Übersichten, die 404-Seite, je Ausgabe und je Kapitel eine", () => {
    expect(
      erzeugeSeiten(STANDARD)
        .map((s) => s.pfad)
        .sort(),
    ).toEqual([
      "404.html",
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

  it("zeigt auf der Ausgabeseite ihre Geschichten mit Bild und VOLLEM Text", () => {
    const s = seite(erzeugeSeiten(STANDARD), "ausgabe-2026-08-08.html");
    const titel = [...s.querySelectorAll("main article h3")].map((h) => h.textContent);
    expect(titel).toEqual(["Die zweite", "Die dritte"]);
    expect(s.querySelector("main article img")?.getAttribute("src")).toBe("/bilder/ein-bild.png");
    const texte = [...s.querySelectorAll("main article p")].map((p) => p.textContent);
    expect(texte).toContain("Einstieg zwei.");
  });

  it("verweist von der Ausgabe NICHT auf einzelne Kapitelseiten", () => {
    // Ein Blogeintrag pro Woche: von der Übersicht einmal „Weiterlesen“,
    // danach steht alles auf dieser Seite. Ein Verweis je Geschichte wäre die
    // dritte Ebene, die genau das wieder aufbräche — der Weg zurück zur
    // Übersicht ist der einzige, den die Ausgabe anbietet.
    const s = seite(erzeugeSeiten(STANDARD), "ausgabe-2026-08-08.html");
    const ziele = [...s.querySelectorAll("main a")].map((a) => a.getAttribute("href"));
    expect(ziele).not.toContain("/zweite.html");
    expect(ziele).not.toContain("/dritte.html");
  });
});

describe("build-blog — der Weg zurueck in die Anwendung", () => {
  it("führt von JEDER Seite in die Anwendung", () => {
    // Auf jeder Seite, weil die Leiste auf jeder Seite steht. Faende sich der
    // Verweis nur auf der Übersicht, endete jeder Leseweg in einer Sackgasse.
    for (const seite of erzeugeSeiten(STANDARD)) {
      expect(seite.html, seite.pfad).toContain('href="https://app.effbeezee.com/"');
    }
  });

  it("setzt ihn von den beiden Flächen ab", () => {
    // Blog und Tutorial sind zwei Ordnungen desselben Ortes; die Anwendung ist
    // ein anderer. Als dritter Reiter läse er sich wie eine dritte Fläche.
    const s = seite(erzeugeSeiten(STANDARD), "index.html");
    const reiter = [...s.querySelectorAll("aside nav a")].map((a) => a.getAttribute("href"));
    expect(reiter).toEqual(["/tutorial.html", "/index.html"]);
  });
});

describe("build-blog — eine unbekannte Adresse", () => {
  it("liefert eine 404-Seite mit, auch wenn nichts freigegeben ist", () => {
    // Cloudflare Pages fällt ohne diese Datei auf den Index zurück, mit
    // Status 200 — gemessen am 10.09. Dann antwortet JEDE Adresse, und die
    // Zusage „kein Entwurf ist erreichbar“ wird unprüfbar.
    const leer = {
      geschichten: DREI.map((g) => ({ ...g, freigegeben: false })),
      ausgaben: AUSGABEN,
      etappen: ETAPPEN,
    };
    expect(erzeugeSeiten(leer).map((s) => s.pfad)).toContain("404.html");
  });

  it("führt von der 404-Seite zurück zur Übersicht", () => {
    const s = seite(erzeugeSeiten(STANDARD), "404.html");
    const ziele = [...s.querySelectorAll("main a")].map((a) => a.getAttribute("href"));
    expect(ziele).toContain("/index.html");
  });
});

describe("build-blog — die Adresse trägt kein Datum", () => {
  /**
   * Der Slug ist der Schlüssel zum Archiveintrag und trägt dessen Datum. Als
   * Adresse widerspräche das der Ausgabe, in der die Geschichte steht.
   *
   * Die Fixtures oben benutzen datumsfreie Slugs — dort ist die Ableitung
   * wirkungslos und belegt nichts. Hier steht sie deshalb mit echtem Präfix.
   */
  const DATIERT = {
    geschichten: [
      geschichte({
        slug: "2026-08-26-password-reset-flow",
        titel: "Passwort vergessen",
        text: "So kommst du zurück.",
      }),
    ],
    ausgaben: [ausgabe({ geschichten: ["2026-08-26-password-reset-flow"] })],
    etappen: [etappe({ kapitel: ["2026-08-26-password-reset-flow"] })],
  };

  it("legt die Kapitelseite unter den Pfad OHNE Datum", () => {
    expect(erzeugeSeiten(DATIERT).map((s) => s.pfad)).toContain("password-reset-flow.html");
    expect(erzeugeSeiten(DATIERT).map((s) => s.pfad)).not.toContain(
      "2026-08-26-password-reset-flow.html",
    );
  });

  it("verweist auch aus dem Tutorial ohne Datum", () => {
    const s = seite(erzeugeSeiten(DATIERT), "tutorial.html");
    const ziele = [...s.querySelectorAll("main a")].map((a) => a.getAttribute("href"));
    expect(ziele).toContain("/password-reset-flow.html");
    expect(ziele.some((z) => z?.includes("2026-08-26"))).toBe(false);
  });

  it("wirft, wenn zwei Slugs sich nur im Datum unterscheiden", () => {
    // Sonst überschriebe die zweite Seite die erste lautlos.
    const zwei = {
      ...DATIERT,
      geschichten: [
        ...DATIERT.geschichten,
        geschichte({ slug: "2026-09-02-password-reset-flow", titel: "Noch einmal" }),
      ],
    };
    expect(() => erzeugeSeiten(zwei)).toThrow(/denselben Pfad/);
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
    expect(seite(seiten, "erste.html").querySelector("main .weiter a")?.getAttribute("href")).toBe(
      "/dritte.html",
    );
  });

  it("gibt der Kapitelseite den Kopfbereich ihrer Etappe", () => {
    const s = seite(erzeugeSeiten(STANDARD), "dritte.html");
    expect(s.querySelector("header.hero img")?.getAttribute("src")).toBe(
      "/bilder/hero-events.webp",
    );
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
      "404.html",
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

describe("build-blog — die Marke traegt beide Themen", () => {
  const QUELLE =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">\n  <path d="M24 2 Z" fill="#1F53B0" />\n</svg>';

  it("ersetzt die feste Farbe durch eine Klasse und legt die Regel dazu", () => {
    const svg = markeMitThemen(QUELLE);

    expect(svg).not.toContain('fill="#1F53B0"');
    expect(svg).toContain('class="strahl"');
    // Hell wie in der Anwendung, dunkel weiss wie `text-on-chrome-active`.
    expect(svg).toContain(".strahl{fill:#1F53B0}");
    expect(svg).toContain("prefers-color-scheme: dark");
    expect(svg).toContain(".strahl{fill:#ffffff}");
  });

  it("wirft, wenn die Quelldatei die erwartete Farbe nicht genau einmal traegt", () => {
    // DIE eigentliche Zusage. Ohne sie liefert eine umbenannte oder umgefaerbte
    // Quelldatei still eine Marke aus, die auf dunklem Chrome verschwindet —
    // und zwar erst beim Leser. Beide Richtungen, denn zwei Treffer waeren
    // genauso ein Formwechsel wie keiner.
    expect(() => markeMitThemen('<svg><path d="M0 0" fill="#123456" /></svg>')).toThrow(
      /erwartet 1x/,
    );
    expect(() =>
      markeMitThemen('<svg><path fill="#1F53B0" /><path fill="#1F53B0" /></svg>'),
    ).toThrow(/erwartet 1x/);
  });
});
