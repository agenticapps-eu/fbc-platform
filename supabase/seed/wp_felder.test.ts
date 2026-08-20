import { describe, expect, it } from "vitest";

import {
  datumParsen,
  htmlEntfernen,
  markdownMarkerEntfernen,
  normalisiereAdresse,
  normalisiereKennung,
  ortParsen,
  phpArray,
  telefonParsen,
} from "./wp_felder";

describe("phpArray", () => {
  it("liest ein flaches String-Array", () => {
    expect(phpArray('a:2:{i:0;s:8:"WhatsApp";i:1;s:8:"Telegram";}')).toEqual([
      "WhatsApp",
      "Telegram",
    ]);
  });

  it("unterscheidet das leere Array vom leeren Feld", () => {
    // Beides ergibt eine leere Liste, aber `a:0:{}` steht in 6 der 49 befüllten
    // WhatsApp-Felder — „befüllt" und „hat Inhalt" sind nicht dasselbe.
    expect(phpArray("a:0:{}")).toEqual([]);
    expect(phpArray("")).toEqual([]);
    expect(phpArray("   ")).toEqual([]);
  });

  it("nimmt Klartext als einzigen Eintrag", () => {
    expect(phpArray("Signal")).toEqual(["Signal"]);
  });

  it("überliest leere Einträge im Array", () => {
    expect(phpArray('a:2:{i:0;s:0:"";i:1;s:6:"Signal";}')).toEqual(["Signal"]);
  });

  it("kommt mit Zeilenumbrüchen im Wert zurecht", () => {
    expect(phpArray('a:1:{i:0;s:5:"a\nb";}')).toEqual(["a\nb"]);
  });

  it("glaubt der angegebenen Länge, nicht dem Inhalt", () => {
    // Widersprüchlich: die Kopfzahl sagt „leer", der Rumpf trägt einen Wert.
    // Ohne den frühen Ausstieg gewönne der Rumpf — dann entschiede bei kaputten
    // Daten der Zufall, welche der beiden Angaben zählt.
    expect(phpArray('a:0:{i:0;s:5:"hallo";}')).toEqual([]);
  });
});

describe("ortParsen", () => {
  it("trennt PLZ und Ort", () => {
    expect(ortParsen("70173 Stuttgart")).toEqual({
      plz: "70173",
      ort: "Stuttgart",
      land: "DE",
      guete: "ok",
    });
  });

  it("versteht ein führendes Länderkürzel", () => {
    expect(ortParsen("D-70173 Stuttgart")).toEqual({
      plz: "70173",
      ort: "Stuttgart",
      land: "DE",
      guete: "ok",
    });
  });

  it("erkennt ein ausgeschriebenes Land und nimmt es aus dem Ortsnamen", () => {
    // Fällt in JavaScript auf die Nase, wenn man `\b` vor „Ö" benutzt: Umlaute
    // sind dort keine Wortzeichen, die Grenze greift also nicht.
    expect(ortParsen("1010 Wien, Österreich")).toEqual({
      plz: "1010",
      ort: "Wien",
      land: "AT",
      guete: "ok",
    });
  });

  it("hält ein einzelnes d im Ortsnamen nicht für eine Landesangabe", () => {
    // Nur ausgeschriebene Länder werden gesucht. Sonst risse „v. d." aus
    // „Bad Homburg v. d. Höhe" ein Wort heraus, und der Ortsname im Profil
    // wäre ein anderer als der eingetragene.
    expect(ortParsen("61348 Bad Homburg v. d. Höhe").ort).toBe("Bad Homburg v. d. Höhe");
  });

  it("meldet die Güteklassen einzeln", () => {
    expect(ortParsen("70173").guete).toBe("nur_plz");
    expect(ortParsen("Stuttgart").guete).toBe("nur_ort");
    expect(ortParsen("").guete).toBe("leer");
    expect(ortParsen("   ").guete).toBe("leer");
  });

  it("füllt einen fehlenden Ort NICHT aus der Regionalgruppe auf", () => {
    // Abweichung von der Python-Vorlage, bewusst: `ort_27_28` ist die
    // Regionalgruppe, nicht der Wohnort (Abbildungsmatrix). Ein aufgefüllter
    // Wohnort sähe sicher aus und wäre geraten.
    const ergebnis = ortParsen("70173");
    expect(ergebnis.ort).toBe("");
    expect(ergebnis.guete).toBe("nur_plz");
  });

  it("entfernt Markup und geschützte Leerzeichen", () => {
    expect(ortParsen("<p>70173 Stuttgart</p>")).toEqual({
      plz: "70173",
      ort: "Stuttgart",
      land: "DE",
      guete: "ok",
    });
  });

  it("räumt Satzzeichen am Rand des Ortsnamens weg", () => {
    expect(ortParsen("70173 Stuttgart,").ort).toBe("Stuttgart");
    expect(ortParsen("Stuttgart / 70173").ort).toBe("Stuttgart");
  });

  it("setzt DE als Vorgabe, wenn kein Land dasteht", () => {
    expect(ortParsen("Stuttgart").land).toBe("DE");
  });

  it("gibt bei leerem Feld kein Land vor", () => {
    // Ein leeres Feld ist keine Angabe „Deutschland". Sonst stünde bei 20
    // Mitgliedern ein Land, das niemand eingetragen hat.
    expect(ortParsen("").land).toBe("");
  });
});

describe("datumParsen", () => {
  const faelle: Array<[string, string, "tag" | "monat" | "jahr"]> = [
    ["22.07.2020", "2020-07-22", "tag"],
    [".17.03.2019", "2019-03-17", "tag"],
    ["<p>01.09.2021</p>", "2021-09-01", "tag"],
    ["06.2025", "2025-06-01", "monat"],
    ["09/2023", "2023-09-01", "monat"],
    ["9/2020", "2020-09-01", "monat"],
    ["2019-09", "2019-09-01", "monat"],
    ["April 2021", "2021-04-01", "monat"],
    ["Oktober 2022", "2022-10-01", "monat"],
    ["Februar 2024", "2024-02-01", "monat"],
    ["2018", "2018-01-01", "jahr"],
  ];

  it.each(faelle)("liest %s als %s (%s)", (roh, datum, grad) => {
    expect(datumParsen(roh)).toEqual({ datum, grad, roh });
  });

  it("liest auch den Monat mit Umlaut", () => {
    // Der einzige. Mit `[A-Za-z]+` statt `\p{L}+` fiele er lautlos durch und
    // stünde als „nicht lesbar" im Bericht.
    expect(datumParsen("März 2020")).toEqual({
      datum: "2020-03-01",
      grad: "monat",
      roh: "März 2020",
    });
    expect(datumParsen("Maerz 2020")?.datum).toBe("2020-03-01");
  });

  it("hält die Rohangabe fest", () => {
    // Sie ist sonst nirgends erhalten: `legacy_tier` trägt die Mitgliedsstufe,
    // nicht das Datum. Der Bericht ist der einzige Ort.
    expect(datumParsen("April 2021")?.roh).toBe("April 2021");
  });

  it("liefert null, wo nichts zu lesen ist", () => {
    expect(datumParsen("")).toBeNull();
    expect(datumParsen("   ")).toBeNull();
    expect(datumParsen("seit Anfang an")).toBeNull();
    expect(datumParsen("<p></p>")).toBeNull();
  });

  it("weist einen unmöglichen Tag ab, statt ihn umzurechnen", () => {
    // `new Date(2020, 1, 31)` ergäbe stillschweigend den 2. März.
    expect(datumParsen("31.02.2020")).toBeNull();
    expect(datumParsen("32.01.2020")).toBeNull();
    expect(datumParsen("13.13.2020")).toBeNull();
  });

  it("liest keine zweistelligen Jahreszahlen", () => {
    // Kein einziger Datensatz trägt eine, und „22.07.20" wäre zwischen 1920 und
    // 2020 nicht zu entscheiden. Lieber im Bericht als falsch im Profil.
    expect(datumParsen("22.07.20")).toBeNull();
  });

  it("arbeitet ohne Date-Objekt, damit keine Zeitzone einen Tag verschiebt", () => {
    // Ein `new Date("2020-07-22")` steht auf UTC-Mitternacht; lokal formatiert
    // wird daraus westlich von Greenwich der 21.
    expect(datumParsen("01.01.2020")?.datum).toBe("2020-01-01");
    expect(datumParsen("31.12.2019")?.datum).toBe("2019-12-31");
  });
});

describe("telefonParsen", () => {
  it("entfernt das führende Apostroph des Exporters", () => {
    // 17 der 52 befüllten Nummern tragen es — Excel-Schutz, kein Bestandteil
    // der Nummer.
    expect(telefonParsen("'+49 170 1234567")).toBe("+49 170 1234567");
  });

  it("fasst Leerraum zusammen und schneidet die Ränder ab", () => {
    expect(telefonParsen("  +49   170    1234567  ")).toBe("+49 170 1234567");
  });

  it("liefert bei leerer Angabe den leeren String", () => {
    expect(telefonParsen("")).toBe("");
    expect(telefonParsen("   ")).toBe("");
    expect(telefonParsen("'")).toBe("");
  });
});

describe("htmlEntfernen", () => {
  it("entfernt Tags und löst Entitäten auf", () => {
    expect(htmlEntfernen('<p><span class="color_15">Hallo&nbsp;Welt</span></p>')).toBe(
      "Hallo Welt",
    );
    expect(htmlEntfernen("Meyer &amp; Sohn")).toBe("Meyer & Sohn");
  });

  it("löst numerische und hexadezimale Entitäten auf", () => {
    expect(htmlEntfernen("Andr&#233; &#x26; Co")).toBe("André & Co");
  });

  it("rettet die Absätze als Zeilenumbruch", () => {
    expect(htmlEntfernen("<p>Erste</p><p>Zweite</p>")).toBe("Erste\nZweite");
    expect(htmlEntfernen("Erste<br>Zweite")).toBe("Erste\nZweite");
  });

  it("lässt sauberen Text unangetastet", () => {
    expect(htmlEntfernen("Beratung für Mittelstand")).toBe("Beratung für Mittelstand");
  });

  it("liefert bei leerer Angabe den leeren String", () => {
    expect(htmlEntfernen("")).toBe("");
    expect(htmlEntfernen("<p>&nbsp;</p>")).toBe("");
  });
});

describe("normalisieren", () => {
  it("trimmt und case-foldet die Adresse", () => {
    expect(normalisiereAdresse("  Detlev@Example.COM ")).toBe("detlev@example.com");
  });

  it("liefert für eine leere Adresse null", () => {
    expect(normalisiereAdresse("")).toBeNull();
    expect(normalisiereAdresse("   ")).toBeNull();
  });

  it("trimmt die Kennung, ohne ihre Schreibweise anzufassen", () => {
    // Sie ist ein Schlüssel im Altsystem, keine Adresse — case-folden hiesse
    // zwei verschiedene Kennungen zusammenwerfen zu können.
    expect(normalisiereKennung(" 318 ")).toBe("318");
    expect(normalisiereKennung("A1b")).toBe("A1b");
  });

  it("liefert für eine leere Kennung null", () => {
    expect(normalisiereKennung("")).toBeNull();
    expect(normalisiereKennung("  ")).toBeNull();
  });
});

describe("markdownMarkerEntfernen", () => {
  it("nimmt die Sternchen einer Fettauszeichnung weg und lässt den Text stehen", () => {
    // Der gemessene Fall: EINE der 48 importierten Biografien ist in einem
    // Markdown-Editor geschrieben und zeigt die Sternchen sonst wörtlich.
    expect(markdownMarkerEntfernen("**Über uns / Unsere Mission** Wir sind …")).toBe(
      "Über uns / Unsere Mission Wir sind …",
    );
  });

  it("nimmt die Rauten einer Überschrift am Zeilenanfang weg", () => {
    expect(markdownMarkerEntfernen("### **Unsere Leistungen:**\nText")).toBe(
      "Unsere Leistungen:\nText",
    );
  });

  it("lässt eine Raute mitten im Satz stehen", () => {
    // „Platz #1" ist keine Überschrift. Nur der Zeilenanfang zählt, und nur
    // mit folgendem Leerzeichen.
    expect(markdownMarkerEntfernen("Wir sind Platz #1 im Test")).toBe("Wir sind Platz #1 im Test");
  });

  it("lässt einzelne Sternchen unangetastet", () => {
    // Der Grund, warum NUR das Paar `**` behandelt wird: ein einzelner Stern
    // ist in diesen Texten Mathematik oder Fußnote, keine Auszeichnung.
    expect(markdownMarkerEntfernen("Raum 5 * 3 Meter, Preis auf Anfrage*")).toBe(
      "Raum 5 * 3 Meter, Preis auf Anfrage*",
    );
  });

  it("greift nicht über einen Zeilenumbruch hinweg", () => {
    // Zwei Sternchen am Anfang zweier Zeilen sind eine Aufzählung, kein Paar.
    expect(markdownMarkerEntfernen("**Angebot\n**Nachfrage")).toBe("**Angebot\n**Nachfrage");
  });

  it("lässt einen Text ohne Marker unverändert", () => {
    expect(markdownMarkerEntfernen("Ganz normaler Text.")).toBe("Ganz normaler Text.");
  });
});
