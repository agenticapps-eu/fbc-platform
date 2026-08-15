import { describe, expect, it, vi } from "vitest";

import { type Bestand, QUELLFELDER } from "./wp_import.lib";
import { type Quelle, leseDatensaetze, verarbeite } from "./wp_import";

/** Eine Quellzeile mit allen erwarteten Feldern — leer, sofern nicht überschrieben. */
function zeile(werte: Record<string, string> = {}): Record<string, string> {
  return {
    ...Object.fromEntries(QUELLFELDER.map((f) => [f, ""])),
    user_email: "anna@example.org",
    source_user_id: "318",
    first_name: "Anna",
    last_name: "Berg",
    ...werte,
  };
}

function quelle(zeilen: Record<string, string>[]): Quelle {
  return { spalten: [...QUELLFELDER], zeilen };
}

function bestand(werte: Partial<Bestand> = {}): Bestand {
  return {
    bereitsImportiert: false,
    profil: {
      name: null,
      headline: null,
      short_bio: null,
      region: null,
      website: null,
      socials: {},
      videos: [],
    },
    kontakt: {
      email: null,
      phone: null,
      street: null,
      postal_code: null,
      city: null,
      state: null,
      country: null,
    },
    offers: 0,
    needs: 0,
    interessen: 0,
    ...werte,
  };
}

/** Der Regelfall: nichts im Ziel, jeder Datensatz ist neu. */
const KEIN_BESTAND = () => null;

describe("leseDatensaetze", () => {
  it("löst das BOM vom Namen der ersten Spalte", () => {
    // Die echte Datei beginnt mit einem BOM. Bliebe es am Namen kleben, ginge
    // jeder Zugriff `row["user_email"]` ins Leere — und zwar still: die
    // Kopfzeilenprüfung trimmt, sie fiele also nicht auf.
    const gelesen = leseDatensaetze("﻿user_email,beruf\r\nanna@example.org,Bäckerin\r\n");

    expect(gelesen.spalten[0]).toBe("user_email");
    expect(gelesen.zeilen[0]["user_email"]).toBe("anna@example.org");
  });

  it("hält ein Komma im Freitextfeld in einem Feld zusammen", () => {
    const gelesen = leseDatensaetze('user_email,biete\nanna@example.org,"Beratung, Coaching"\n');

    expect(gelesen.zeilen).toHaveLength(1);
    expect(gelesen.zeilen[0]["biete"]).toBe("Beratung, Coaching");
  });

  it("zählt Datensätze und nicht Dateizeilen", () => {
    // Vier Zeilen in der Datei, zwei Datensätze: der erste Freitext trägt einen
    // Umbruch. Die Datensatznummer im Bericht hängt daran.
    const gelesen = leseDatensaetze(
      'user_email,biete\nanna@example.org,"erste Zeile\nzweite Zeile"\nbert@example.org,kurz\n',
    );

    expect(gelesen.zeilen).toHaveLength(2);
    expect(gelesen.zeilen[0]["biete"]).toBe("erste Zeile\nzweite Zeile");
    expect(gelesen.zeilen[1]["user_email"]).toBe("bert@example.org");
  });

  it("gibt die Kopfzeile auch dann zurück, wenn kein Datensatz folgt", () => {
    // Sonst könnte die Vorabprüfung eine leere Datei nicht als „falsch gezogener
    // Export" melden — sie sähe gar keine Spalten.
    const gelesen = leseDatensaetze("user_email,beruf\n");

    expect(gelesen.spalten).toEqual(["user_email", "beruf"]);
    expect(gelesen.zeilen).toEqual([]);
  });

  it("bricht bei einem Datensatz mit zu wenigen Feldern ab", () => {
    // Laut statt still: eine verrutschte Spalte hiesse, dass jeder Wert danach
    // im falschen Feld landet.
    expect(() => leseDatensaetze("user_email,beruf\nanna@example.org\n")).toThrow();
  });

  it("bricht bei unpaaren Anführungszeichen ab, statt sie zu dulden", () => {
    // Die Probe `probe-c10-abbildung.ts` liest mit `relax_quotes` — sie zählt
    // nur. Der Import schreibt, und ein geduldetes Anführungszeichen verschiebt
    // die Feldgrenzen still.
    expect(() =>
      leseDatensaetze('user_email,biete\nanna@example.org,"Beratung" und mehr\n'),
    ).toThrow();
  });

  it("übergeht eine Leerzeile zwischen zwei Datensätzen", () => {
    const gelesen = leseDatensaetze(
      "user_email,beruf\nanna@example.org,Bäckerin\n\nbert@example.org,Koch\n",
    );

    expect(gelesen.zeilen).toHaveLength(2);
  });
});

describe("verarbeite — Vorabprüfung", () => {
  it("meldet den Vorab-Abbruch und fasst keinen Datensatz an", () => {
    const leser = vi.fn(KEIN_BESTAND);

    const lauf = verarbeite({
      quelle: { spalten: ["user_email"], zeilen: [zeile(), zeile()] },
      bestandsadressenOhneKennung: [],
      bestand: leser,
      schreibend: false,
    });

    expect(lauf.art).toBe("vorab-abbruch");
    if (lauf.art !== "vorab-abbruch") return;
    expect(lauf.datensaetze).toBe(2);
    expect(lauf.befunde[0]?.art).toBe("kopfzeile");
    expect(leser).not.toHaveBeenCalled();
  });

  it("läuft im Trockenlauf trotz Dublette durch", () => {
    // Der Trockenlauf soll das vollständige Bild liefern (4.1) — er hört nicht
    // beim ersten Problem auf.
    const lauf = verarbeite({
      quelle: quelle([zeile(), zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: false,
    });

    expect(lauf.art).toBe("lauf");
  });

  it("reicht die Befunde an den Bericht weiter, auch wenn der Lauf durchläuft", () => {
    // Ohne das wäre der Trockenlauf still über genau die Fälle, für die es ihn
    // gibt: die Dublette stünde nirgends, weil sie ihn nicht aufhält.
    const lauf = verarbeite({
      quelle: quelle([zeile(), zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.befunde.map((b) => b.art)).toContain("dublette_adresse");
  });

  it("bricht denselben Bestand im schreibenden Lauf ab", () => {
    // Die Betriebsart wird durchgereicht und nicht hier entschieden: dieselbe
    // Eingabe, die oben durchläuft, blockiert den schreibenden Lauf (4.1).
    const lauf = verarbeite({
      quelle: quelle([zeile(), zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: true,
    });

    expect(lauf.art).toBe("vorab-abbruch");
  });
});

describe("verarbeite — Klassifikation", () => {
  it("klassifiziert einen unbekannten Datensatz als angelegt", () => {
    const lauf = verarbeite({
      quelle: quelle([zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.klasse).toBe("angelegt");
    expect(lauf.saetze[0].auftrag?.zusammenfuehrung.legacy.legacy_source_id).toBe("318");
    expect(lauf.saetze[0].auftrag?.anmeldeadresse).toBe("anna@example.org");
  });

  it("klassifiziert einen bekannten Datensatz als aktualisiert", () => {
    const lauf = verarbeite({
      quelle: quelle([zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: () => bestand(),
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.klasse).toBe("aktualisiert");
  });

  it("fragt den Bestand mit normalisierter Kennung und Adresse", () => {
    const leser = vi.fn(KEIN_BESTAND);

    verarbeite({
      quelle: quelle([zeile({ user_email: "  Anna@Example.ORG ", source_user_id: " 318 " })]),
      bestandsadressenOhneKennung: [],
      bestand: leser,
      schreibend: false,
    });

    expect(leser).toHaveBeenCalledWith({ kennung: "318", adresse: "anna@example.org" });
  });

  it("überspringt einen Datensatz mit unbrauchbarer Adresse, ohne den Bestand zu fragen", () => {
    const leser = vi.fn(KEIN_BESTAND);

    const lauf = verarbeite({
      quelle: quelle([zeile({ user_email: "kein-at-zeichen" }), zeile({ user_email: "b@ex.org" })]),
      bestandsadressenOhneKennung: [],
      bestand: leser,
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.klasse).toBe("uebersprungen");
    expect(lauf.saetze[0].ergebnis.grund).toMatch(/Adresse/);
    expect(lauf.saetze[0].auftrag).toBeNull();
    // Nur der zweite Datensatz wird nachgeschlagen.
    expect(leser).toHaveBeenCalledTimes(1);
  });

  it("überspringt eine Kollision mit einem Bestandskonto mit eigenem Grund", () => {
    const lauf = verarbeite({
      quelle: quelle([zeile()]),
      bestandsadressenOhneKennung: ["ANNA@example.org"],
      bestand: KEIN_BESTAND,
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.klasse).toBe("uebersprungen");
    expect(lauf.saetze[0].ergebnis.grund).toMatch(/Bestandskonto/);
    expect(lauf.saetze[0].auftrag).toBeNull();
  });

  it("gibt zu jedem Datensatz genau ein Ergebnis, auch zu den übersprungenen", () => {
    const lauf = verarbeite({
      quelle: quelle([
        zeile({ user_email: "a@ex.org" }),
        zeile({ user_email: "kaputt" }),
        zeile({ user_email: "c@ex.org" }),
      ]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze).toHaveLength(3);
    expect(lauf.saetze.map((s) => s.ergebnis.zeile)).toEqual([1, 2, 3]);
  });
});

describe("verarbeite — was der Bericht braucht", () => {
  it("reicht die stehengelassenen Felder aus der Merge-Regel durch", () => {
    const lauf = verarbeite({
      quelle: quelle([zeile({ beruf: "Bäckerin" })]),
      bestandsadressenOhneKennung: [],
      bestand: () => bestand({ bereitsImportiert: true }),
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.uebersprungeneFelder).toContain("profiles.headline");
  });

  it("reicht Rohangabe und Auffüllgrad des Beitrittsdatums durch", () => {
    const lauf = verarbeite({
      quelle: quelle([zeile({ infos_16: "April 2021" })]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.beitritt).toEqual({
      datum: "2021-04-01",
      grad: "monat",
      roh: "April 2021",
    });
  });

  it("führt Kennung, Name und Adresse für den Bericht mit", () => {
    const lauf = verarbeite({
      quelle: quelle([zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: false,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis).toMatchObject({
      zeile: 1,
      kennung: "318",
      name: "Anna Berg",
      adresse: "anna@example.org",
    });
  });
});
