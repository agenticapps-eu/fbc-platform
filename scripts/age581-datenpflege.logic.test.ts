import { describe, expect, it } from "vitest";

import {
  adresseWeichtAb,
  findeDoppelbelegung,
  ordneZu,
  paidUntilAus,
  type Konto,
} from "./age581-datenpflege.logic";

/**
 * Der Rechenkern der Datenpflege aus AGE-581 Abschnitt 12.
 *
 * Die Zusagen hier sind nicht dekorativ: beide Regeln schreiben am Ende in die
 * PRODUKTIONSDATENBANK, und beide scheitern LEISE. Ein falsch gerechnetes
 * `paid_until` sieht aus wie ein Datum; eine falsche Zuordnung schreibt einen
 * gültigen Wert an die falsche Person. Keiner der beiden Fehler wirft.
 */
const STICHTAG = "2026-08-23";

describe("paidUntilAus", () => {
  it("nimmt das nächste Vorkommen nach dem Stichtag und zieht einen Tag ab", () => {
    // Jahrestag im September: das Vorkommen 2026 liegt noch vor uns.
    expect(paidUntilAus("15.09.2023", STICHTAG)).toEqual({ art: "datum", wert: "2026-09-14" });
  });

  it("springt ins Folgejahr, wenn das Vorkommen dieses Jahres schon vorbei ist", () => {
    expect(paidUntilAus("10.03.2024", STICHTAG)).toEqual({ art: "datum", wert: "2027-03-09" });
  });

  it("zählt den Stichtag selbst als bereits erneuert", () => {
    // Am 23.08. wird neu bezahlt — bezahlt ist also bis zum 22.08. des Folgejahrs,
    // nicht bis gestern. Die Grenze ist `<=`, nicht `<`.
    expect(paidUntilAus("23.08.2022", STICHTAG)).toEqual({ art: "datum", wert: "2027-08-22" });
  });

  it("hängt NICHT am Ausführungstag", () => {
    // Dieselbe Zeile, ein Jahr später gerechnet, ergibt ein anderes Datum. Genau
    // deshalb steht der Stichtag fest im Aufrufer und nicht in `Date.now()`.
    const a = paidUntilAus("15.09.2023", "2026-08-23");
    const b = paidUntilAus("15.09.2023", "2027-08-23");
    expect(a).not.toEqual(b);
    expect(b).toEqual({ art: "datum", wert: "2027-09-14" });
  });

  it('lässt „Ohne" leer, statt ein Jahr zu erfinden', () => {
    expect(paidUntilAus("Ohne", STICHTAG)).toEqual({ art: "ohne" });
    expect(paidUntilAus("  ", STICHTAG)).toEqual({ art: "ohne" });
  });

  it("meldet den 29.02. als unlesbar — unabhängig vom Jahr des Stichtags", () => {
    // Date.UTC(2026, 1, 29) ergibt klaglos den 01.03.2026. Ein erfundenes Datum
    // ist schlimmer als ein gemeldetes Loch. Und die Antwort darf nicht daran
    // hängen, ob das Jahr des Stichtags zufällig ein Schaltjahr ist:
    for (const stichtag of ["2026-08-23", "2027-08-23", "2028-01-01"])
      expect(paidUntilAus("29.02.2024", stichtag)).toEqual({ art: "unlesbar", roh: "29.02.2024" });
  });

  it("meldet den 31.04. als unlesbar, statt still auf den 01.05. zu rollen", () => {
    expect(paidUntilAus("31.04.2024", STICHTAG)).toEqual({ art: "unlesbar", roh: "31.04.2024" });
  });

  it("meldet unlesbare Schreibweisen, statt sie zu verwerfen", () => {
    expect(paidUntilAus("1.9.2023", STICHTAG)).toEqual({ art: "unlesbar", roh: "1.9.2023" });
  });
});

const konto = (p: Partial<Konto> & { id: string }): Konto => ({
  name: null,
  login_email: null,
  kontakt_email: null,
  paid_until: null,
  payment_type: null,
  activated_at: null,
  disabled_at: null,
  deleted_at: null,
  ...p,
});

const zeile = (vorname: string, nachname: string, email: string) => ({
  kategorie: "rechnung",
  vorname,
  nachname,
  jahrestag: "Ohne",
  email,
});

describe("ordneZu", () => {
  it("trifft über die Anmeldeadresse und meldet das auch so", () => {
    const k = konto({ id: "a", name: "Anna Beispiel", login_email: "Anna@Beispiel.test" });
    const [z] = ordneZu([zeile("Anna", "Beispiel", "anna@beispiel.test")], [k]);
    expect(z.wie).toBe("email");
    expect(z.treffer.map((t) => t.id)).toEqual(["a"]);
  });

  it("trifft auch über die Kontaktadresse", () => {
    const k = konto({
      id: "a",
      name: "Anna Beispiel",
      login_email: "alt@beispiel.test",
      kontakt_email: "anna@beispiel.test",
    });
    expect(ordneZu([zeile("Anna", "Beispiel", "anna@beispiel.test")], [k])[0].wie).toBe("email");
  });

  it("trifft über den Namen, wenn die Adresse abweicht — und kennzeichnet das", () => {
    // Das ist der Fall, aus dem 12.4 entsteht: die Zuordnung ist eindeutig,
    // aber die Anmeldeadresse ist eine andere. Ginge er als „email" durch,
    // fiele die Adressangleichung lautlos aus.
    const k = konto({ id: "a", name: "Anna Beispiel", login_email: "tippfehlerr@beispiel.test" });
    const [z] = ordneZu([zeile("Anna", "Beispiel", "anna@beispiel.test")], [k]);
    expect(z.wie).toBe("name");
    expect(z.treffer).toHaveLength(1);
  });

  it("trifft einen Doppelnamen über den Nachnamen und den ersten Vornamen", () => {
    const k = konto({ id: "a", name: "Anna Maria Beispiel", login_email: "x@beispiel.test" });
    const [z] = ordneZu([zeile("Anna", "Beispiel", "anna@beispiel.test")], [k]);
    expect(z.wie).toBe("name~");
    expect(z.treffer).toHaveLength(1);
  });

  it("meldet Mehrdeutigkeit, statt den ersten Treffer zu nehmen", () => {
    // Zwei Konten auf dieselbe Adresse: hier DARF kein Wert geschrieben werden.
    const konten = [
      konto({ id: "a", name: "Anna Beispiel", login_email: "team@firma.test" }),
      konto({ id: "b", name: "Bodo Beispiel", kontakt_email: "team@firma.test" }),
    ];
    expect(ordneZu([zeile("Anna", "Beispiel", "team@firma.test")], konten)[0].treffer).toHaveLength(
      2,
    );
  });

  it("meldet eine Zeile ohne Konto", () => {
    const [z] = ordneZu(
      [zeile("Cleo", "Ohnekonto", "cleo@beispiel.test")],
      [konto({ id: "a", name: "Anna Beispiel" })],
    );
    expect(z.wie).toBe("-");
    expect(z.treffer).toHaveLength(0);
  });

  it("nummeriert die Zeilen ab 1, damit der Beleg ohne Namen zeigen kann, welche gemeint ist", () => {
    const zs = ordneZu([zeile("A", "Eins", "a@t.test"), zeile("B", "Zwei", "b@t.test")], []);
    expect(zs.map((z) => z.nummer)).toEqual([1, 2]);
  });
});

describe("adresseWeichtAb", () => {
  it("ignoriert Groß-/Kleinschreibung und Rand-Leerzeichen", () => {
    expect(adresseWeichtAb(" Anna@Beispiel.test ", "anna@beispiel.test")).toBe(false);
  });

  it("meldet einen fehlenden Buchstaben", () => {
    expect(adresseWeichtAb("anna@beispiel.test", "annaa@beispiel.test")).toBe(true);
  });

  it("meldet eine fehlende Anmeldeadresse als Abweichung", () => {
    expect(adresseWeichtAb("anna@beispiel.test", null)).toBe(true);
  });
});

describe("feste Zuordnung", () => {
  const cleo = konto({ id: "cleo", name: "Cleo Rechnungsfrau", login_email: "info@firma.test" });
  const bodo = konto({ id: "bodo", name: "Bodo Beispielpartner", login_email: "info@eigene.test" });

  it("schlägt den Adresstreffer, wenn die Zeile die Adresse einer ANDEREN Person trägt", () => {
    // Ohne feste Zuordnung trifft diese Zeile Cleos Konto — richtig gerechnet,
    // falsche Person.
    const ohne = ordneZu([zeile("Bodo", "Beispielpartner", "info@firma.test")], [cleo, bodo]);
    expect(ohne[0].treffer.map((t) => t.id)).toEqual(["cleo"]);

    const mit = ordneZu(
      [{ ...zeile("Bodo", "Beispielpartner", "info@firma.test"), kontoEmail: "info@eigene.test" }],
      [cleo, bodo],
    );
    expect(mit[0].wie).toBe("fest");
    expect(mit[0].treffer.map((t) => t.id)).toEqual(["bodo"]);
  });

  it("findet KEIN Konto, wenn die feste Zuordnung ins Leere zeigt — statt still zurückzufallen", () => {
    // Ein Tippfehler in der Zuordnung darf nicht dazu führen, dass wieder der
    // Adresstreffer greift; sonst wirkt die Korrektur, bis sie es nicht mehr tut.
    const z = ordneZu(
      [
        {
          ...zeile("Bodo", "Beispielpartner", "info@firma.test"),
          kontoEmail: "tippfehler@eigene.test",
        },
      ],
      [cleo, bodo],
    );
    expect(z[0].wie).toBe("-");
    expect(z[0].treffer).toHaveLength(0);
  });
});

describe("findeDoppelbelegung", () => {
  const cleo = konto({ id: "cleo", name: "Cleo Rechnungsfrau", login_email: "info@firma.test" });
  const bodo = konto({ id: "bodo", name: "Bodo Beispielpartner", login_email: "info@eigene.test" });

  it("meldet zwei Zeilen, die dasselbe Konto treffen", () => {
    const zs = ordneZu(
      [
        zeile("Bodo", "Beispielpartner", "info@firma.test"),
        zeile("Cleo", "Rechnungsfrau", "info@firma.test"),
      ],
      [cleo, bodo],
    );
    expect(findeDoppelbelegung(zs)).toEqual([{ kontoId: "cleo", nummern: [1, 2] }]);
  });

  it("schweigt, sobald die feste Zuordnung die Zeilen trennt", () => {
    const zs = ordneZu(
      [
        { ...zeile("Bodo", "Beispielpartner", "info@firma.test"), kontoEmail: "info@eigene.test" },
        zeile("Cleo", "Rechnungsfrau", "info@firma.test"),
      ],
      [cleo, bodo],
    );
    expect(findeDoppelbelegung(zs)).toEqual([]);
  });

  it("zählt eine mehrdeutige Zeile nicht als Doppelbelegung", () => {
    // Zwei Konten für EINE Zeile ist der andere Fehler; er hat seine eigene Meldung.
    const zwei = [
      konto({ id: "a", name: "Anna Beispiel", login_email: "team@firma.test" }),
      konto({ id: "b", name: "Bodo Beispiel", kontakt_email: "team@firma.test" }),
    ];
    expect(
      findeDoppelbelegung(ordneZu([zeile("Anna", "Beispiel", "team@firma.test")], zwei)),
    ).toEqual([]);
  });
});
