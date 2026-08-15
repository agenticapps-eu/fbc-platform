import { describe, expect, it } from "vitest";

import { type Berichtsdaten, type Datensatzergebnis, baueBericht, stdoutZeile } from "./wp_bericht";
import { QUELLFELDER, pruefeVorab } from "./wp_import.lib";

/** Alle Quellfelder leer — die Vorabprüfung liest nur zwei davon. */
const LEERE_ZEILE = Object.fromEntries(QUELLFELDER.map((f) => [f, ""]));

const KOPF = {
  modus: "trocken" as const,
  ziel: "lokal",
  quelle: "wp-export-2026-08-14.csv",
  zeitpunkt: "2026-08-14T18:00:00.000Z",
  fehlendeLieferungen: [] as string[],
};

function ergebnis(werte: Partial<Datensatzergebnis> = {}): Datensatzergebnis {
  return {
    zeile: 1,
    kennung: "318",
    name: "Anna Berg",
    adresse: "anna@example.org",
    klasse: "angelegt",
    ...werte,
  };
}

function lauf(werte: Partial<Extract<Berichtsdaten, { art: "lauf" }>> = {}): Berichtsdaten {
  return { art: "lauf", kopf: KOPF, befunde: [], ergebnisse: [ergebnis()], ...werte };
}

describe("baueBericht — Aufbau", () => {
  it("nennt Betriebsart, Ziel, Quelle und Zeitpunkt", () => {
    const text = baueBericht(lauf());

    expect(text).toContain("Trockenlauf");
    expect(text).toContain("lokal");
    expect(text).toContain("wp-export-2026-08-14.csv");
    expect(text).toContain("2026-08-14T18:00:00.000Z");
  });

  it("hält die Klassensumme auf der Zahl der Datensätze", () => {
    const ergebnisse: Datensatzergebnis[] = [
      ergebnis({ zeile: 1, klasse: "angelegt" }),
      ergebnis({ zeile: 2, klasse: "angelegt" }),
      ergebnis({ zeile: 3, klasse: "aktualisiert" }),
      ergebnis({ zeile: 4, klasse: "uebersprungen", grund: "Kollision mit Bestandskonto" }),
      ergebnis({ zeile: 5, klasse: "fehlerhaft", grund: "keine Adresse" }),
    ];

    const text = baueBericht(lauf({ ergebnisse }));

    expect(text).toMatch(/\| angelegt \| 2 \|/);
    expect(text).toMatch(/\| aktualisiert \| 1 \|/);
    expect(text).toMatch(/\| übersprungen \| 1 \|/);
    expect(text).toMatch(/\| fehlerhaft \| 1 \|/);
    expect(text).toMatch(/\| \*\*Summe\*\* \| \*\*5\*\* \|/);
  });

  it("führt jede Klasse auf, auch die mit null Fällen", () => {
    // Eine fehlende Zeile liest sich wie ein vergessener Fall; eine Null ist
    // eine Aussage.
    const text = baueBericht(lauf());

    expect(text).toMatch(/\| fehlerhaft \| 0 \|/);
  });
});

describe("baueBericht — Vorab-Abbruch ist ein eigener Berichtstyp", () => {
  const abbruch: Berichtsdaten = {
    art: "vorab-abbruch",
    kopf: { ...KOPF, modus: "schreibend" },
    datensaetze: 70,
    befunde: [{ art: "dublette_kennung", wert: "318", zeilen: [4, 19] }],
  };

  it("führt keine Datensatzklassen — der schreibende Abschnitt wurde nie erreicht", () => {
    const text = baueBericht(abbruch);

    expect(text).toContain("Vorab-Abbruch");
    expect(text).not.toContain("angelegt");
    expect(text).not.toContain("aktualisiert");
    expect(text).not.toContain("Summe");
  });

  it("nennt die Zahl der gelesenen Datensätze und den Befund", () => {
    const text = baueBericht(abbruch);

    expect(text).toContain("70");
    expect(text).toContain("318");
    expect(text).toContain("4, 19");
  });
});

describe("baueBericht — die fehlenden Lieferungen", () => {
  it("vermerkt das Fehlen, ohne den Lauf zu einem Fehlschlag zu erklären", () => {
    // Entscheidung Donald 14.08.: die Listen blockieren nichts, die erste
    // Zielumgebung ist dev. Der Bericht ist die Gegenmaßnahme, nicht ein Riegel.
    const text = baueBericht(
      lauf({ kopf: { ...KOPF, fehlendeLieferungen: ["Ausgetretene", "Zahlungsstände"] } }),
    );

    expect(text).toContain("Ausgetretene");
    expect(text).toContain("Zahlungsstände");
    expect(text).toMatch(/\| \*\*Summe\*\* \| \*\*1\*\* \|/);
  });

  it("führt bei fehlenden Zahlungsständen jeden betroffenen Datensatz einzeln auf", () => {
    // Aufgabe 4.4: „gezielt abarbeiten" heisst, dass nach der Lieferung jede
    // Zeile wiederzufinden ist — eine Summe („70 ohne paid_until") liesse sich
    // nicht abarbeiten.
    const text = baueBericht(
      lauf({
        kopf: { ...KOPF, fehlendeLieferungen: ["Zahlungsstände"] },
        ergebnisse: [
          ergebnis({ zeile: 1, kennung: "318", name: "Anna Berg" }),
          ergebnis({ zeile: 2, kennung: "412", name: "Bert Stein", klasse: "aktualisiert" }),
          ergebnis({ zeile: 3, kennung: "500", name: "Cem Yıldız", klasse: "fehlerhaft" }),
        ],
      }),
    );

    // Gezielt im richtigen Abschnitt gesucht: ein fehlerhafter Datensatz steht
    // sehr wohl im Bericht, nur nicht auf DIESER Liste.
    const abschnitt = text.split("### Offene Zahlungsstände")[1] ?? "";

    expect(abschnitt).toContain("318");
    expect(abschnitt).toContain("412");
    // Er wurde nicht angelegt — es gibt keine Zeile, an der ein Zahlungsstand hinge.
    expect(abschnitt).not.toContain("500");
  });

  it("lässt den Abschnitt weg, wenn alles geliefert wurde", () => {
    expect(baueBericht(lauf())).not.toContain("Fehlende Lieferungen");
  });

  it("hält BEIDE Betriebsarten nicht auf — die Vorabprüfung kennt die Listen nicht", () => {
    // Aufgabe 4.3, und der Test greift absichtlich über den Bericht hinaus:
    // „vermerkt das Fehlen" allein liesse offen, ob der Lauf trotzdem läuft.
    // Die Vorabprüfung bekommt die Listen gar nicht erst als Eingabe — sie kann
    // also nicht an ihnen hängen bleiben.
    const zeilen = [{ ...LEERE_ZEILE, source_user_id: "1", user_email: "a@example.org" }];

    for (const schreibend of [false, true]) {
      const ergebnis = pruefeVorab({
        spalten: QUELLFELDER,
        zeilen,
        bestandsadressenOhneKennung: [],
        schreibend,
      });

      expect(ergebnis.abbruch).toBe(false);
    }

    const text = baueBericht(
      lauf({
        kopf: { ...KOPF, modus: "schreibend", fehlendeLieferungen: ["Ausgetretene"] },
      }),
    );

    expect(text).toContain("Fehlende Lieferungen");
    expect(text).toContain("Ausgetretene");
  });
});

describe("baueBericht — nachtragbare Fälle", () => {
  it("führt jedes nicht geschriebene Feld einzeln auf", () => {
    const text = baueBericht(
      lauf({
        ergebnisse: [
          ergebnis({
            klasse: "aktualisiert",
            uebersprungeneFelder: ["profiles.headline", "profile_contacts.phone"],
          }),
        ],
      }),
    );

    expect(text).toContain("profiles.headline");
    expect(text).toContain("profile_contacts.phone");
  });

  it("führt ein aufgefülltes Beitrittsdatum mit der Rohangabe", () => {
    // Der Bericht ist der EINZIGE Ort, an dem die Rohangabe erhalten bleibt —
    // `2021-04-01` sieht danach tagesgenau aus, obwohl „April 2021" dastand.
    const text = baueBericht(
      lauf({
        ergebnisse: [
          ergebnis({ beitritt: { datum: "2021-04-01", grad: "monat", roh: "April 2021" } }),
        ],
      }),
    );

    expect(text).toContain("2021-04-01");
    expect(text).toContain("April 2021");
  });

  it("führt ein tagesgenaues Beitrittsdatum NICHT als aufgefüllt", () => {
    const text = baueBericht(
      lauf({
        ergebnisse: [
          ergebnis({ beitritt: { datum: "2019-03-17", grad: "tag", roh: "17.03.2019" } }),
        ],
      }),
    );

    expect(text).not.toContain("Aufgefüllte Beitrittsdaten");
  });

  it("führt fehlerhafte Datensätze mit Grund", () => {
    const text = baueBericht(
      lauf({ ergebnisse: [ergebnis({ klasse: "fehlerhaft", grund: "keine gültige Adresse" })] }),
    );

    expect(text).toContain("keine gültige Adresse");
  });

  it("führt auch übersprungene Datensätze einzeln mit Grund", () => {
    // Gefunden in der Sichtprobe, nicht von einem Test: der Übersprungene stand
    // nur als Zahl in der Klassentabelle, sein Grund allenfalls indirekt über
    // einen Vorabbefund. Hinter jedem steht ein Mensch, über den zu entscheiden ist.
    const text = baueBericht(
      lauf({
        ergebnisse: [
          ergebnis({ zeile: 52, klasse: "uebersprungen", grund: "Kollision mit Bestandskonto" }),
        ],
      }),
    );

    expect(text).toMatch(/\| 52 \|.*\| übersprungen \| Kollision mit Bestandskonto \|/);
  });

  it("bringt einen senkrechten Strich im Namen nicht in die Tabellenspalte", () => {
    const text = baueBericht(
      lauf({
        ergebnisse: [
          ergebnis({ name: "Anna | Berg", klasse: "fehlerhaft", grund: "keine Adresse" }),
        ],
      }),
    );

    expect(text).toContain("Anna \\| Berg");
  });
});

describe("stdoutZeile — was auf der Konsole erscheinen darf", () => {
  it("führt Datensatznummer, Kennung und Klasse", () => {
    expect(stdoutZeile(ergebnis({ zeile: 12, kennung: "318" }))).toBe(
      "Datensatz 12 · 318 · angelegt",
    );
  });

  it("führt weder Namen noch Adresse", () => {
    // Sonst stehen die Personendaten von 70 Menschen in der Shell-History und
    // in jedem CI-Log, das den Lauf mitschneidet.
    const zeile = stdoutZeile(
      ergebnis({
        name: "Anna Berg",
        adresse: "anna@example.org",
        grund: "Anna Berg hat keine PLZ",
      }),
    );

    expect(zeile).not.toContain("Anna");
    expect(zeile).not.toContain("example.org");
  });

  it("nennt eine fehlende Kennung als solche, statt sie wegzulassen", () => {
    expect(stdoutZeile(ergebnis({ zeile: 7, kennung: null, klasse: "fehlerhaft" }))).toBe(
      "Datensatz 7 · ohne Kennung · fehlerhaft",
    );
  });
});

describe("baueBericht — was der Lauf anlegen würde", () => {
  it("nennt den Datensatz im Trockenlauf einzeln, mit der Adresse als Schlüssel", () => {
    // Die Anforderung „Der Trockenlauf benennt, was er schreiben würde" verlangt
    // genau das: als „würde angelegt", mit der E-Mail-Adresse. Eine Zahl in der
    // Klassentabelle sagt nicht, WER es ist — und das ist die Frage vor dem
    // echten Lauf.
    const text = baueBericht(lauf({ ergebnisse: [ergebnis({ klasse: "angelegt" })] }));

    expect(text).toContain("würde angelegt");
    expect(text).toContain("anna@example.org");
  });

  it("schreibt im echten Lauf dieselbe Liste in der Vergangenheit", () => {
    const text = baueBericht(
      lauf({
        kopf: { ...KOPF, modus: "schreibend" },
        ergebnisse: [ergebnis({ klasse: "aktualisiert" })],
      }),
    );

    expect(text).toMatch(/\| 318 \| Anna Berg \| anna@example\.org \| aktualisiert \|/);
    expect(text).not.toContain("würde aktualisiert");
  });

  it("führt übersprungene und fehlerhafte Datensätze nicht in dieser Liste", () => {
    // Sie haben ihre eigene Tabelle mit dem Grund; hier stünden sie unter einer
    // Überschrift, die das Gegenteil behauptet.
    const text = baueBericht(
      lauf({
        ergebnisse: [
          ergebnis({ zeile: 1, klasse: "uebersprungen", grund: "Adresse fehlt" }),
          ergebnis({ zeile: 2, klasse: "fehlerhaft", grund: "kaputt" }),
        ],
      }),
    );

    expect(text).not.toContain("würde angelegt");
    expect(text).not.toContain("Was der Lauf anlegen");
  });
});

describe("baueBericht — die Bilder (6.3/6.4)", () => {
  it("führt jedes fehlende Bild einzeln auf, mit Bildart und Grund", () => {
    // Der Bericht ist der EINZIGE Ort, an dem jemand nachlesen kann, welches
    // Bild nachzutragen ist — im Profil sieht ein fehlender Avatar aus wie ein
    // Mitglied, das keinen hochgeladen hat.
    const text = baueBericht(
      lauf({
        ergebnisse: [
          ergebnis({
            bilder: [
              { art: "profil", stand: "hochgeladen" },
              { art: "cover", stand: "fehlt", grund: "Keine gewandelte Fassung" },
            ],
          }),
        ],
      }),
    );

    expect(text).toContain("Headerbild");
    expect(text).toContain("Keine gewandelte Fassung");
  });

  it("zählt hochgeladen, vorhanden und fehlt zusammen", () => {
    const text = baueBericht(
      lauf({
        ergebnisse: [
          ergebnis({ zeile: 1, bilder: [{ art: "profil", stand: "hochgeladen" }] }),
          ergebnis({ zeile: 2, bilder: [{ art: "profil", stand: "vorhanden" }] }),
          ergebnis({ zeile: 3, bilder: [{ art: "cover", stand: "fehlt", grund: "Antwort 413" }] }),
        ],
      }),
    );

    expect(text).toMatch(/hochgeladen.*1/);
    expect(text).toMatch(/schon vorhanden.*1/);
  });

  it("schweigt über Bilder, wo keine im Spiel waren", () => {
    // Der Trockenlauf lädt nichts hoch. Ein Abschnitt mit lauter Nullen
    // behauptete einen Bildlauf, den es nicht gab — dieselbe Regel wie beim
    // Vorab-Abbruch.
    expect(baueBericht(lauf())).not.toContain("Bilder");
  });

  it("führt ein hochgeladenes Bild NICHT als nachzutragen", () => {
    const text = baueBericht(
      lauf({ ergebnisse: [ergebnis({ bilder: [{ art: "profil", stand: "hochgeladen" }] })] }),
    );

    expect(text).not.toContain("Profilbild |");
  });
});
