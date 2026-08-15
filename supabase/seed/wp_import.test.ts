import { describe, expect, it, vi } from "vitest";

import { type Bestand, QUELLFELDER } from "./wp_import.lib";
import {
  type Bestandsdaten,
  type Bestandszeile,
  type Datensatzlauf,
  type Quelle,
  baueBestandsdaten,
  baueLauf,
  bestandsleser,
  leseDatensaetze,
  schreibeDatensaetze,
  verarbeite,
} from "./wp_import";

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
    uid: "uid-bestand",
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

/** Eine Zwischenablage, in der nichts liegt — dann gibt es keine Bilder. */
const KEINE_BILDER = "/ausserhalb/gibt-es-nicht";

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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.klasse).toBe("aktualisiert");
  });

  it("reicht die Kennung des bestehenden Kontos an den Auftrag durch", () => {
    // Ohne sie hat die Transaktion (7.1) kein Ziel: `profiles.id` und
    // `profile_id` sind genau diese Kennung, und ein bestehendes Konto legt
    // niemand ein zweites Mal an, um sie zu erfahren.
    const lauf = verarbeite({
      quelle: quelle([zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: () => bestand({ uid: "uid-1" }),
      schreibend: false,
      zwischenablage: KEINE_BILDER,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].auftrag?.uid).toBe("uid-1");
  });

  it("lässt die Kennung offen, wo das Konto erst noch entsteht", () => {
    // Sie entsteht in der Admin-Schnittstelle, nicht hier — `verarbeite` fasst
    // nichts an, was wirkt.
    const lauf = verarbeite({
      quelle: quelle([zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: false,
      zwischenablage: KEINE_BILDER,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].auftrag?.uid).toBeNull();
  });

  it("fragt den Bestand mit normalisierter Kennung und Adresse", () => {
    const leser = vi.fn(KEIN_BESTAND);

    verarbeite({
      quelle: quelle([zeile({ user_email: "  Anna@Example.ORG ", source_user_id: " 318 " })]),
      bestandsadressenOhneKennung: [],
      bestand: leser,
      schreibend: false,
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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
      zwischenablage: KEINE_BILDER,
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

// ── 5.2: der gemeinsame Pfad ────────────────────────────────────────────────

function bestandsdaten(werte: Partial<Bestandsdaten> = {}): Bestandsdaten {
  return {
    adressenOhneKennung: [],
    nachKennung: new Map(),
    nachAdresse: new Map(),
    ...werte,
  };
}

/** Eine Zeile, wie `BESTANDSABFRAGE` sie liefert — leer, sofern nicht überschrieben. */
function zeileAusDb(werte: Partial<Bestandszeile> = {}): Bestandszeile {
  return {
    uid: "uid-bestand",
    kennung: null,
    adresse: "anna@example.org",
    tier: "basic",
    activated_at: null,
    name: null,
    headline: null,
    short_bio: null,
    region: null,
    website: null,
    socials: null,
    videos: null,
    kontakt_email: null,
    phone: null,
    street: null,
    postal_code: null,
    city: null,
    state: null,
    country: null,
    offers: "0",
    needs: "0",
    interessen: "0",
    ...werte,
  };
}

/** Eine Quelldatei aus Zeilenobjekten — die Kopfzeile sind die 26 Quellfelder. */
function csv(zeilen: Record<string, string>[]): string {
  const feld = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    QUELLFELDER.join(","),
    ...zeilen.map((z) => QUELLFELDER.map((f) => feld(z[f] ?? "")).join(",")),
  ].join("\n");
}

const ZWEI_DATENSAETZE = csv([
  zeile({ user_email: "anna@example.org", source_user_id: "318" }),
  zeile({ user_email: "bert@example.org", source_user_id: "319", first_name: "Bert" }),
]);

describe("bestandsleser", () => {
  it("findet über die Kennung", () => {
    const eintrag = bestand();
    const leser = bestandsleser(bestandsdaten({ nachKennung: new Map([["318", eintrag]]) }));

    expect(leser({ kennung: "318", adresse: "anna@example.org" })).toBe(eintrag);
  });

  it("findet ein Konto ohne Kennung über die Adresse", () => {
    // Der Fall aus der Anforderung: ein früherer Lauf brach ab, nachdem er das
    // Anmeldekonto angelegt, aber die Kennung noch nicht geschrieben hatte.
    const eintrag = bestand();
    const leser = bestandsleser(
      bestandsdaten({ nachAdresse: new Map([["anna@example.org", eintrag]]) }),
    );

    expect(leser({ kennung: "318", adresse: "anna@example.org" })).toBe(eintrag);
  });

  it("lässt die Kennung vor der Adresse gelten", () => {
    // Sonst entschiede die Adresse über ein Profil, das seine Kennung schon
    // trägt — und die Merge-Regel läse den falschen `bereitsImportiert`-Stand.
    const ueberKennung = bestand({ bereitsImportiert: true });
    const ueberAdresse = bestand({ bereitsImportiert: false });
    const leser = bestandsleser(
      bestandsdaten({
        nachKennung: new Map([["318", ueberKennung]]),
        nachAdresse: new Map([["anna@example.org", ueberAdresse]]),
      }),
    );

    expect(leser({ kennung: "318", adresse: "anna@example.org" })).toBe(ueberKennung);
  });

  it("gibt null zurück, wo nichts steht", () => {
    expect(bestandsleser(bestandsdaten())({ kennung: "318", adresse: "a@ex.org" })).toBeNull();
  });
});

describe("baueLauf — beide Betriebsarten, ein Weg", () => {
  const rahmen = {
    inhalt: ZWEI_DATENSAETZE,
    ziel: "lokal",
    quelle: "/ausserhalb/wp-export.csv",
    zeitpunkt: "2026-08-15T08:00:00.000Z",
    zwischenablage: KEINE_BILDER,
  };

  it("klassifiziert im schreibenden Lauf genau wie im Trockenlauf", () => {
    // Die Kernaussage von 5.2: ein Trockenlauf, der einen anderen Weg nimmt,
    // sagt nichts über den echten aus.
    const daten = bestandsdaten({ nachKennung: new Map([["319", bestand()]]) });

    const trocken = baueLauf({ ...rahmen, bestandsdaten: daten, schreibend: false });
    const schreibend = baueLauf({ ...rahmen, bestandsdaten: daten, schreibend: true });

    if (trocken.lauf.art !== "lauf" || schreibend.lauf.art !== "lauf") {
      throw new Error("Lauf erwartet");
    }
    expect(trocken.lauf.saetze.map((s) => s.ergebnis.klasse)).toEqual(["angelegt", "aktualisiert"]);
    expect(schreibend.lauf.saetze.map((s) => s.ergebnis)).toEqual(
      trocken.lauf.saetze.map((s) => s.ergebnis),
    );
  });

  it("berechnet auch im Trockenlauf, was geschrieben würde", () => {
    const { lauf } = baueLauf({ ...rahmen, bestandsdaten: bestandsdaten(), schreibend: false });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].auftrag?.zusammenfuehrung.profil.name).toBe("Anna Berg");
  });

  it("nennt die Betriebsart im Bericht", () => {
    const trocken = baueLauf({ ...rahmen, bestandsdaten: bestandsdaten(), schreibend: false });
    const schreibend = baueLauf({ ...rahmen, bestandsdaten: bestandsdaten(), schreibend: true });

    expect(trocken.bericht).toContain("Trockenlauf");
    expect(schreibend.bericht).toContain("Schreibender Lauf");
  });

  it("hält Name und Adresse aus der Konsolenausgabe heraus", () => {
    // 4.7 am zusammengesetzten Lauf, nicht nur an `stdoutZeile`: hier entsteht
    // die Ausgabe wirklich.
    const { konsole } = baueLauf({ ...rahmen, bestandsdaten: bestandsdaten(), schreibend: false });

    expect(konsole).toHaveLength(2);
    expect(konsole.join("\n")).not.toMatch(/Anna|Berg|example\.org/);
    expect(konsole[0]).toContain("318");
  });

  it("vermerkt die fehlenden Lieferungen, statt auf sie zu warten", () => {
    const { bericht } = baueLauf({ ...rahmen, bestandsdaten: bestandsdaten(), schreibend: false });

    expect(bericht).toContain("Zahlungsstände");
    expect(bericht).toContain("Ausgetretenen-Liste");
  });

  it("erzeugt beim Vorab-Abbruch den eigenen Berichtstyp und keine Datensatzzeile", () => {
    const { lauf, bericht, konsole } = baueLauf({
      ...rahmen,
      inhalt: csv([zeile(), zeile()]),
      bestandsdaten: bestandsdaten(),
      schreibend: true,
      zwischenablage: KEINE_BILDER,
    });

    expect(lauf.art).toBe("vorab-abbruch");
    expect(bericht).toContain("Vorab-Abbruch");
    expect(konsole).toEqual([]);
  });
});

describe("baueLauf — die Verdrahtung, die keine Einzelprüfung sieht", () => {
  const rahmen = {
    inhalt: ZWEI_DATENSAETZE,
    ziel: "lokal",
    quelle: "/ausserhalb/wp-export.csv",
    zeitpunkt: "2026-08-15T08:00:00.000Z",
    zwischenablage: KEINE_BILDER,
  };

  it("reicht die Bestandsadressen bis in die Vorabprüfung durch", () => {
    // Die sicherheitsrelevante Leitung (4.2): ginge sie verloren, bliebe die
    // Kollision mit einem Bestandskonto im zusammengesetzten Lauf unbemerkt —
    // und ein Selbstregistrierer bekäme `impact` geschenkt.
    const { lauf, bericht } = baueLauf({
      ...rahmen,
      bestandsdaten: bestandsdaten({ adressenOhneKennung: ["anna@example.org"] }),
      schreibend: false,
      zwischenablage: KEINE_BILDER,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.klasse).toBe("uebersprungen");
    expect(bericht).toContain("Kollision mit Bestandskonto");
  });

  it("ergänzt ein Konto ohne Kennung, statt es ein zweites Mal anzulegen", () => {
    // 7.2, und zwar als DURCHLEITUNG: die drei Bausteine sind einzeln geprüft,
    // aber nur hier laufen sie so zusammen, wie `main()` sie zusammensetzt —
    // Zeilen der Bestandsabfrage → `baueBestandsdaten` → `baueLauf`.
    //
    // Der Fall ist der Rest eines abgebrochenen Laufs: das Anmeldekonto steht
    // schon (`impact`, nicht freigeschaltet — die Handschrift aus 7.3), die
    // Kennung fehlt, weil die Transaktion danach kippte. Über die Adresse ist
    // das dasselbe Konto. Fiele die Wiedererkennung hier aus, legte der Lauf
    // ein ZWEITES Anmeldekonto zur selben Adresse an, und das ist der
    // unwiderrufliche Teil — ausserhalb jeder Transaktion.
    const { lauf } = baueLauf({
      ...rahmen,
      bestandsdaten: baueBestandsdaten([
        zeileAusDb({ uid: "uid-rest", tier: "impact", activated_at: null }),
      ]),
      schreibend: true,
      zwischenablage: KEINE_BILDER,
    });

    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
    expect(lauf.saetze[0].ergebnis.klasse).toBe("aktualisiert");
    // Das Ziel der Transaktion ist das BESTEHENDE Konto, nicht ein neues.
    expect(lauf.saetze[0].auftrag?.uid).toBe("uid-rest");
    // Der zweite Datensatz teilt die Adresse nicht — er bleibt neu. Sonst
    // bewiese der Test nur, dass alles als „aktualisiert" durchgeht.
    expect(lauf.saetze[1].ergebnis.klasse).toBe("angelegt");
  });

  it("trägt die Ergebnisse in den Bericht, nicht nur in den Rückgabewert", () => {
    const { bericht } = baueLauf({ ...rahmen, bestandsdaten: bestandsdaten(), schreibend: false });

    expect(bericht).toMatch(/\| angelegt \| 2 \|/);
    expect(bericht).toMatch(/\*\*Summe\*\* \| \*\*2\*\*/);
  });
});

describe("baueBestandsdaten", () => {
  it("legt ein Konto mit Kennung unter beide Schlüssel und merkt es als importiert", () => {
    // Der Normalfall nach dem Go-Live: importiert UND inzwischen freigeschaltet.
    const daten = baueBestandsdaten([
      zeileAusDb({
        kennung: "318",
        tier: "impact",
        activated_at: new Date("2026-08-20T00:00:00Z"),
      }),
    ]);

    expect(daten.nachKennung.get("318")?.bereitsImportiert).toBe(true);
    expect(daten.nachAdresse.get("anna@example.org")?.bereitsImportiert).toBe(true);
    expect(daten.adressenOhneKennung).toEqual([]);
  });

  it("trägt die Kennung der Profilzeile unter beiden Schlüsseln mit", () => {
    // Sie ist das Ziel der Transaktion aus 7.1. Die Abfrage holte sie zuerst
    // nicht — aufgefallen erst beim Bauen des schreibenden Teils.
    const daten = baueBestandsdaten([zeileAusDb({ kennung: "318", uid: "uid-1" })]);

    expect(daten.nachKennung.get("318")?.uid).toBe("uid-1");
    expect(daten.nachAdresse.get("anna@example.org")?.uid).toBe("uid-1");
  });

  it("führt ein fremdes Konto ohne Kennung als Kollision", () => {
    const daten = baueBestandsdaten([zeileAusDb({ tier: "basic" })]);

    expect(daten.adressenOhneKennung).toEqual(["anna@example.org"]);
  });

  it("führt den Rest eines abgebrochenen eigenen Laufs NICHT als Kollision", () => {
    // `impact` ohne Freischaltung ist die Handschrift dieses Imports (7.3). Ein
    // solches Konto zu blockieren hiesse, dass ein abgebrochener Lauf jeden
    // weiteren aufhält — es wird ergänzt (Entscheidung Donald, 15.08.).
    const daten = baueBestandsdaten([zeileAusDb({ tier: "impact", activated_at: null })]);

    expect(daten.adressenOhneKennung).toEqual([]);
    expect(daten.nachAdresse.get("anna@example.org")?.bereitsImportiert).toBe(false);
  });

  it("führt ein freigeschaltetes impact-Konto ohne Kennung als Kollision", () => {
    // Freigeschaltet heisst: da benutzt jemand das Konto. Dann ist es keiner
    // unserer Reste, egal welche Stufe es trägt.
    const daten = baueBestandsdaten([
      zeileAusDb({ tier: "impact", activated_at: new Date("2026-08-01T00:00:00Z") }),
    ]);

    expect(daten.adressenOhneKennung).toEqual(["anna@example.org"]);
  });

  it("wandelt die Zählwerte von `count(*)` in Zahlen", () => {
    // `bigint` kommt als Zeichenkette — ungewandelt wäre "0" wahr, und die
    // Merge-Regel hielte jedes Profil für belegt.
    const daten = baueBestandsdaten([zeileAusDb({ offers: "1", needs: "2", interessen: "3" })]);
    const eintrag = daten.nachAdresse.get("anna@example.org");

    expect(eintrag?.offers).toBe(1);
    expect(eintrag?.needs).toBe(2);
    expect(eintrag?.interessen).toBe(3);
  });

  it("macht aus fehlenden socials und videos leere Werte, nicht null", () => {
    const eintrag = baueBestandsdaten([zeileAusDb()]).nachAdresse.get("anna@example.org");

    expect(eintrag?.profil.socials).toEqual({});
    expect(eintrag?.profil.videos).toEqual([]);
  });

  it("reicht das durch, was im Ziel steht — sonst füllte die Merge-Regel es zu", () => {
    // Was hier verloren ginge, sähe für `fuegeZusammen` wie ein leeres Ziel aus:
    // der Import überschriebe die Pflege des Mitglieds, statt sie stehen zu
    // lassen. Deshalb je ein belegtes Feld aus beiden Tabellen.
    const eintrag = baueBestandsdaten([
      zeileAusDb({
        socials: { xing: "https://xing.example/anna" },
        videos: ["https://youtu.be/abc"],
        kontakt_email: "post@example.org",
        phone: "+49 30 123",
        city: "Bad Homburg",
      }),
    ]).nachAdresse.get("anna@example.org");

    expect(eintrag?.profil.socials).toEqual({ xing: "https://xing.example/anna" });
    expect(eintrag?.profil.videos).toEqual(["https://youtu.be/abc"]);
    expect(eintrag?.kontakt.email).toBe("post@example.org");
    expect(eintrag?.kontakt.phone).toBe("+49 30 123");
    expect(eintrag?.kontakt.city).toBe("Bad Homburg");
  });

  it("normalisiert Adresse und Kennung aus der Datenbank", () => {
    const daten = baueBestandsdaten([
      zeileAusDb({ kennung: " 318 ", adresse: "  Anna@Example.ORG " }),
    ]);

    expect(daten.nachKennung.has("318")).toBe(true);
    expect(daten.nachAdresse.has("anna@example.org")).toBe(true);
  });
});

// ── 7.3–7.6: der schreibende Abschnitt ──────────────────────────────────────

/** Ein Abfrager, der mitschreibt, statt zu wirken. */
function fakeClient(werfeBei?: (sql: string) => unknown) {
  const gestellt: { sql: string; werte?: unknown[] }[] = [];
  return {
    gestellt,
    client: {
      query: async (sql: string, werte?: unknown[]) => {
        gestellt.push({ sql, werte });
        const fehler = werfeBei?.(sql);
        if (fehler) throw fehler;
        return {};
      },
    },
  };
}

/** Ein `fetch`, das jede Adresse mitschreibt und ein angelegtes Konto meldet. */
function fakeFetch(uid = "uid-neu") {
  const gerufen: string[] = [];
  const hole = (async (url: string | URL | Request) => {
    gerufen.push(String(url));
    return new Response(JSON.stringify({ id: uid }), { status: 200 });
  }) as unknown as typeof fetch;
  return { gerufen, hole };
}

/**
 * `anzahl` Datensätze aus EINEM Lauf — nicht aus `anzahl` Läufen. Die
 * Datensatznummer ist die Identität im Bericht; einzeln gebaut trüge jeder die
 * Nummer 1, und ein Test über drei fehlgeschlagene Sätze prüfte in Wahrheit
 * einen (beim Schreiben aufgefallen).
 */
function saetzeOhneKonto(anzahl: number): Datensatzlauf[] {
  const lauf = verarbeite({
    quelle: quelle(
      Array.from({ length: anzahl }, (_, i) =>
        zeile({ user_email: `a${i + 1}@example.org`, source_user_id: String(i + 1) }),
      ),
    ),
    bestandsadressenOhneKennung: [],
    bestand: KEIN_BESTAND,
    schreibend: false,
    zwischenablage: KEINE_BILDER,
  });
  if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
  return lauf.saetze;
}

const MITTEL = { basis: "http://127.0.0.1:54321", schluessel: "dienst-schluessel" };

describe("schreibeDatensaetze", () => {
  it("legt das Konto an, setzt die Stufe VOR der Transaktion und schreibt dann", async () => {
    // Die Reihenfolge ist die Invariante aus 7.1/7.3: stünde `tier` innerhalb
    // der Klammer, hinterliesse ein Abbruch ein `basic`-Konto — also keinen
    // erkennbaren Rest, sondern eine Kollision, die jeden weiteren Lauf sperrt.
    const { gestellt, client } = fakeClient();
    const { gerufen, hole } = fakeFetch("uid-neu");

    const { fehler } = await schreibeDatensaetze(saetzeOhneKonto(1), { ...MITTEL, client, hole });

    expect(fehler.size).toBe(0);
    expect(gerufen).toEqual(["http://127.0.0.1:54321/auth/v1/admin/users"]);
    expect(gestellt[0].sql).toMatch(/update public\.profiles set "tier" = 'impact'/);
    expect(gestellt[0].werte).toEqual(["uid-neu"]);
    expect(gestellt[1].sql).toBe("begin");
    expect(gestellt.at(-1)?.sql).toBe("commit");
    // Alles Geschriebene zeigt auf das gerade angelegte Konto.
    expect(gestellt[2].werte?.[0]).toBe("uid-neu");
  });

  it("legt für ein bestehendes Konto keines an und rührt seine Stufe nicht an", async () => {
    // 7.3, andere Seite: stünde `tier` unbedingt im Update, genügte eine
    // Selbstregistrierung unter einer bekannten Adresse für `impact`.
    const { gestellt, client } = fakeClient();
    const { gerufen, hole } = fakeFetch();
    const lauf = verarbeite({
      quelle: quelle([zeile()]),
      bestandsadressenOhneKennung: [],
      bestand: () => bestand({ uid: "uid-alt" }),
      schreibend: false,
      zwischenablage: KEINE_BILDER,
    });
    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");

    await schreibeDatensaetze(lauf.saetze, { ...MITTEL, client, hole });

    expect(gerufen).toEqual([]);
    expect(gestellt.map((g) => g.sql).join(" ")).not.toMatch(/"tier"/);
    expect(gestellt[0].sql).toBe("begin");
  });

  it("löst über 70 Datensätze keinen Versand aus (7.4)", async () => {
    // Der Endpunkt ist `admin/users`, nicht `/invite` und nicht
    // `send-activation`. Geprüft wird die Menge der Adressen, die der Lauf
    // überhaupt anfasst — nicht, dass wir keine Mail sehen.
    const { client } = fakeClient();
    const { gerufen, hole } = fakeFetch();
    const saetze = saetzeOhneKonto(70);

    await schreibeDatensaetze(saetze, { ...MITTEL, client, hole });

    expect(gerufen).toHaveLength(70);
    expect(new Set(gerufen)).toEqual(new Set(["http://127.0.0.1:54321/auth/v1/admin/users"]));
  });

  it("beendet den Lauf nicht, wenn ein Datensatz kippt (7.5)", async () => {
    const { client } = fakeClient((sql) =>
      sql.includes("insert into public.profiles")
        ? Object.assign(new Error("kaputt"), { code: "23502" })
        : null,
    );
    const { hole } = fakeFetch();
    const saetze = saetzeOhneKonto(3);

    const { fehler } = await schreibeDatensaetze(saetze, { ...MITTEL, client, hole });

    // Alle drei kippen an derselben Stelle — entscheidend ist, dass der Lauf
    // alle drei erreicht hat, statt am ersten zu enden.
    expect([...fehler.keys()]).toEqual([1, 2, 3]);
  });

  it("hält den Wert aus der Quelle aus dem Fehlergrund heraus (4.7)", async () => {
    // Postgres zitiert bei verletzter Eindeutigkeit den Wert wörtlich. Der
    // Grund landet in Bericht UND Konsole — dort darf keine Adresse stehen.
    const { client } = fakeClient((sql) =>
      sql.includes("insert into public.profiles")
        ? Object.assign(
            new Error(
              'duplicate key value violates unique constraint "x"\n' +
                "Key (email)=(a1@example.org) already exists.",
            ),
            { code: "23505", constraint: "profiles_pkey", table: "profiles" },
          )
        : null,
    );
    const { hole } = fakeFetch();

    const { fehler } = await schreibeDatensaetze(saetzeOhneKonto(1), { ...MITTEL, client, hole });

    const grund = fehler.get(1) ?? "";
    expect(grund).toContain("23505");
    expect(grund).toContain("profiles_pkey");
    expect(grund).not.toContain("a1@example.org");
    expect(grund).not.toContain("duplicate key");
  });

  it("überspringt die Transaktion, wo das Konto nicht entstand", async () => {
    // Ohne Kennung gibt es kein Ziel — ein Schreibversuch träfe irgendetwas
    // oder nichts. Der Datensatz ist fehlerhaft, der nächste läuft weiter.
    const { gestellt, client } = fakeClient();
    const hole = (async () =>
      new Response(JSON.stringify({ error_code: "email_exists" }), {
        status: 422,
      })) as unknown as typeof fetch;

    const { fehler } = await schreibeDatensaetze(saetzeOhneKonto(1), { ...MITTEL, client, hole });

    expect(fehler.get(1)).toContain("422");
    expect(gestellt).toEqual([]);
  });

  it("schreibt nichts zu einem übersprungenen Datensatz", async () => {
    const { gestellt, client } = fakeClient();
    const { gerufen, hole } = fakeFetch();
    const lauf = verarbeite({
      quelle: quelle([zeile({ user_email: "kein-at-zeichen" })]),
      bestandsadressenOhneKennung: [],
      bestand: KEIN_BESTAND,
      schreibend: false,
      zwischenablage: KEINE_BILDER,
    });
    if (lauf.art !== "lauf") throw new Error("Lauf erwartet");

    await schreibeDatensaetze(lauf.saetze, { ...MITTEL, client, hole });

    expect(gestellt).toEqual([]);
    expect(gerufen).toEqual([]);
  });
});

describe("baueLauf — was beim Schreiben herauskam", () => {
  const rahmen = {
    inhalt: ZWEI_DATENSAETZE,
    ziel: "lokal",
    quelle: "/ausserhalb/wp-export.csv",
    zeitpunkt: "2026-08-15T08:00:00.000Z",
    bestandsdaten: {
      adressenOhneKennung: [],
      nachKennung: new Map(),
      nachAdresse: new Map(),
    } as Bestandsdaten,
    schreibend: true,
    zwischenablage: KEINE_BILDER,
  };

  it("macht aus einem gescheiterten Datensatz ein fehlerhaftes Ergebnis", async () => {
    const { bericht, konsole } = baueLauf({
      ...rahmen,
      ausgaenge: new Map([[1, "Datenbankfehler 23505 (profiles_pkey)"]]),
    });

    expect(konsole[0]).toContain("fehlerhaft");
    expect(konsole[1]).toContain("angelegt");
    expect(bericht).toContain("Datenbankfehler 23505");
    // Die Summe darf den gescheiterten Datensatz nicht als angelegt führen.
    expect(bericht).toMatch(/\| angelegt \| 1 \|/);
    expect(bericht).toMatch(/\| fehlerhaft \| 1 \|/);
  });

  it("lässt den Bericht unverändert, wo nichts fehlschlug", async () => {
    expect(baueLauf({ ...rahmen, ausgaenge: new Map() }).bericht).toBe(baueLauf(rahmen).bericht);
  });
});

describe("Dublette im letzten Datensatz (7.6)", () => {
  it("schreibt gar nichts, auch nicht die gültigen davor", async () => {
    // Der Grund, warum die Vorabprüfung über die GANZE Datei läuft: mit
    // Transaktionen je Datensatz fände eine spät erkannte Dublette die
    // früheren bereits geschrieben.
    const { gestellt, client } = fakeClient();
    const { gerufen, hole } = fakeFetch();
    const { lauf } = baueLauf({
      inhalt: csv([
        zeile({ user_email: "a@example.org", source_user_id: "1" }),
        zeile({ user_email: "b@example.org", source_user_id: "2" }),
        zeile({ user_email: "a@example.org", source_user_id: "3" }),
      ]),
      bestandsdaten: { adressenOhneKennung: [], nachKennung: new Map(), nachAdresse: new Map() },
      schreibend: true,
      ziel: "lokal",
      quelle: "/ausserhalb/wp-export.csv",
      zeitpunkt: "2026-08-15T08:00:00.000Z",
      zwischenablage: KEINE_BILDER,
    });

    expect(lauf.art).toBe("vorab-abbruch");
    if (lauf.art === "lauf") await schreibeDatensaetze(lauf.saetze, { ...MITTEL, client, hole });

    expect(gestellt).toEqual([]);
    expect(gerufen).toEqual([]);
  });
});

// ── 6.3/6.4: die Bilder im schreibenden Abschnitt ───────────────────────────

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Eine Zwischenablage mit echten Dateien darin. Der Inhalt ist beliebig —
 * `ladeBildHoch` prüft nur, DASS die gewandelte Fassung da ist; gewandelt hat
 * sie `wandleBild` (eigene Tests, gegen echte Bilder).
 */
function zwischenablageMit(dateien: Record<string, string[]>): string {
  const ordner = mkdtempSync(join(tmpdir(), "wp-import-bilder-"));
  for (const [kennung, namen] of Object.entries(dateien)) {
    mkdirSync(join(ordner, kennung), { recursive: true });
    for (const name of namen) writeFileSync(join(ordner, kennung, name), "WEBP");
  }
  return ordner;
}

/** Ein Datensatz mit beiden Bildern, Kennung 318. */
function satzMitBildern(zwischenablage: string): Datensatzlauf[] {
  const lauf = verarbeite({
    quelle: quelle([zeile({ profile_photo: "profile_photo.jpg", cover_photo: "cover_photo.png" })]),
    bestandsadressenOhneKennung: [],
    bestand: KEIN_BESTAND,
    schreibend: true,
    zwischenablage,
  });
  if (lauf.art !== "lauf") throw new Error("Lauf erwartet");
  return lauf.saetze;
}

/** Ein `fetch`, das GoTrue und Storage unterschiedlich beantwortet. */
function fakeDienste(storageStatus: Record<string, [number, unknown]> = {}) {
  const gerufen: string[] = [];
  const hole = (async (url: string | URL | Request) => {
    const s = String(url);
    gerufen.push(s);
    if (s.includes("/storage/v1/")) {
      const treffer = Object.entries(storageStatus).find(([teil]) => s.includes(teil));
      const [status, rumpf] = treffer?.[1] ?? [200, { Key: "…" }];
      return new Response(JSON.stringify(rumpf), { status });
    }
    return new Response(JSON.stringify({ id: "uid-neu" }), { status: 200 });
  }) as unknown as typeof fetch;
  return { gerufen, hole };
}

/**
 * Nur die Anweisungen, die eine Bild-URL setzen. NICHT `startsWith("update
 * public.profiles set")` — darunter fiele auch `stufeFuerNeuesKonto`, und der
 * Test zählte die Stufe als Bild mit.
 */
const urlSaetze = (gestellt: { sql: string }[]) =>
  gestellt.filter((g) => /"(avatar|cover)_url" is null/.test(g.sql));

describe("schreibeDatensaetze — die Bilder (6.3)", () => {
  it("lädt beide Bilder hoch und setzt beide URLs in derselben Transaktion", async () => {
    const ablage = zwischenablageMit({ "318": ["profile_photo.webp", "cover_photo.webp"] });
    const { gestellt, client } = fakeClient();
    const { gerufen, hole } = fakeDienste();

    await schreibeDatensaetze(satzMitBildern(ablage), { ...MITTEL, client, hole });

    expect(gerufen.filter((u) => u.includes("/storage/v1/object/avatars/"))).toHaveLength(1);
    expect(gerufen.filter((u) => u.includes("/storage/v1/object/covers/"))).toHaveLength(1);

    const gesetzt = urlSaetze(gestellt);
    expect(gesetzt).toHaveLength(2);
    // In der Klammer, nicht daneben: das Bild gehört zum Datensatz.
    const beginn = gestellt.findIndex((g) => g.sql === "begin");
    const ende = gestellt.findIndex((g) => g.sql === "commit");
    for (const satz of gesetzt) {
      const i = gestellt.indexOf(satz);
      expect(i).toBeGreaterThan(beginn);
      expect(i).toBeLessThan(ende);
    }
  });

  it("lädt zur gewandelten Fassung hoch, nicht zum Original", async () => {
    // Der `covers`-Bucket lässt ausschliesslich `image/webp` zu — ein
    // hochgeladenes .jpg wäre nicht bloss gross, sondern abgewiesen.
    const ablage = zwischenablageMit({ "318": ["profile_photo.jpg", "profile_photo.webp"] });
    const { client } = fakeClient();
    const { hole } = fakeDienste();

    const ergebnis = await schreibeDatensaetze(satzMitBildern(ablage), {
      ...MITTEL,
      client,
      hole,
    });

    expect(ergebnis.bilder.get(1)?.find((b) => b.art === "profil")?.stand).toBe("hochgeladen");
  });

  it("setzt beim zweiten Lauf KEINE URL — das vorhandene Objekt wird übersprungen", async () => {
    const ablage = zwischenablageMit({ "318": ["profile_photo.webp", "cover_photo.webp"] });
    const { gestellt, client } = fakeClient();
    const { hole } = fakeDienste({
      "/storage/v1/": [400, { statusCode: "409", error: "Duplicate" }],
    });

    const ergebnis = await schreibeDatensaetze(satzMitBildern(ablage), {
      ...MITTEL,
      client,
      hole,
    });

    expect(urlSaetze(gestellt)).toHaveLength(0);
    expect(ergebnis.fehler.size).toBe(0);
    expect(ergebnis.bilder.get(1)?.map((b) => b.stand)).toEqual(["vorhanden", "vorhanden"]);
  });

  it("lässt ein fehlendes Headerbild das Profilbild nicht mitnehmen (6.4)", async () => {
    // Die Mengen sind nicht deckungsgleich: 57 Profil-, 53 Headerbilder.
    const ablage = zwischenablageMit({ "318": ["profile_photo.webp"] });
    const { gestellt, client } = fakeClient();
    const { hole } = fakeDienste();

    const ergebnis = await schreibeDatensaetze(satzMitBildern(ablage), {
      ...MITTEL,
      client,
      hole,
    });

    expect(urlSaetze(gestellt)).toHaveLength(1);
    expect(urlSaetze(gestellt)[0].sql).toContain('"avatar_url"');
    expect(ergebnis.bilder.get(1)?.find((b) => b.art === "cover")?.stand).toBe("fehlt");
  });

  it("legt das Mitglied auch dann an, wenn BEIDE Bilder fehlen (6.4)", async () => {
    const ablage = zwischenablageMit({});
    const { gestellt, client } = fakeClient();
    const { hole } = fakeDienste();

    const ergebnis = await schreibeDatensaetze(satzMitBildern(ablage), {
      ...MITTEL,
      client,
      hole,
    });

    expect(ergebnis.fehler.size).toBe(0);
    expect(gestellt.some((g) => g.sql.includes("insert into public.profiles"))).toBe(true);
    expect(urlSaetze(gestellt)).toHaveLength(0);
  });

  it("meldet einen abgewiesenen Upload als Bildbefund, nicht als Datensatzfehler", async () => {
    const ablage = zwischenablageMit({ "318": ["profile_photo.webp", "cover_photo.webp"] });
    const { client } = fakeClient();
    const { hole } = fakeDienste({ "/storage/v1/": [413, { error: "PayloadTooLarge" }] });

    const ergebnis = await schreibeDatensaetze(satzMitBildern(ablage), {
      ...MITTEL,
      client,
      hole,
    });

    expect(ergebnis.fehler.size).toBe(0);
    expect(ergebnis.bilder.get(1)?.every((b) => b.stand === "fehlt")).toBe(true);
  });

  it("lädt kein Bild hoch, wo das Konto nicht entstand", async () => {
    // Ohne Kennung gibt es kein Ziel — ein Objekt unter einer fremden uid wäre
    // schlimmer als keines.
    const ablage = zwischenablageMit({ "318": ["profile_photo.webp"] });
    const { client } = fakeClient();
    const gerufen: string[] = [];
    const hole = (async (url: string | URL | Request) => {
      gerufen.push(String(url));
      return new Response(JSON.stringify({ msg: "kaputt" }), { status: 500 });
    }) as unknown as typeof fetch;

    const ergebnis = await schreibeDatensaetze(satzMitBildern(ablage), {
      ...MITTEL,
      client,
      hole,
    });

    expect(ergebnis.fehler.size).toBe(1);
    expect(gerufen.some((u) => u.includes("/storage/v1/"))).toBe(false);
  });
});
