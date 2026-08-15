import { describe, expect, it } from "vitest";

import { NEUES_KONTO, schreibsatz } from "./wp_schreiben";

describe("schreibsatz", () => {
  it("schreibt nur die Felder, die im Auftrag stehen", () => {
    // Ein Feld, das die Merge-Regel stehen liess, darf nicht als `null` im
    // Statement auftauchen — das räumte weg, was ein Mitglied gepflegt hat.
    const satz = schreibsatz({
      tabelle: "public.profiles",
      schluessel: { spalte: "id", wert: "uid-1" },
      felder: { name: "Anna Berg", headline: "Bäckerin" },
    });

    expect(satz?.sql).toContain('"name"');
    expect(satz?.sql).toContain('"headline"');
    expect(satz?.sql).not.toContain('"short_bio"');
    expect(satz?.sql).not.toContain('"region"');
  });

  it("setzt die Werte als Parameter ein, nicht in den Text", () => {
    // Die Werte kommen aus einer fremden CSV. Ein Name mit einem Apostroph
    // reicht, um ein zusammengesetztes Statement zu zerlegen.
    const satz = schreibsatz({
      tabelle: "public.profiles",
      schluessel: { spalte: "id", wert: "uid-1" },
      felder: { name: "O'Brien'); drop table profiles; --" },
    });

    expect(satz?.sql).not.toContain("O'Brien");
    expect(satz?.sql).not.toContain("drop table");
    expect(satz?.werte).toEqual(["uid-1", "O'Brien'); drop table profiles; --"]);
  });

  it("nennt jede Spalte mit ihrer Nummer, in der Reihenfolge der Werte", () => {
    const satz = schreibsatz({
      tabelle: "public.profile_contacts",
      schluessel: { spalte: "profile_id", wert: "uid-1" },
      felder: { email: "a@ex.org", phone: "+49 30", city: "Bad Homburg" },
    });

    expect(satz?.sql).toContain("values ($1, $2, $3, $4)");
    expect(satz?.werte).toEqual(["uid-1", "a@ex.org", "+49 30", "Bad Homburg"]);
  });

  it("gibt nichts zurück, wo nichts zu schreiben ist", () => {
    // Ein leeres `set` ist ein Syntaxfehler — und ein Statement, das nichts tut,
    // hätte im Bericht als Schreibvorgang gezählt.
    expect(
      schreibsatz({
        tabelle: "public.profiles",
        schluessel: { spalte: "id", wert: "uid-1" },
        felder: {},
      }),
    ).toBeNull();
  });

  it("aktualisiert beim zweiten Lauf, statt an der Zeile zu scheitern", () => {
    const satz = schreibsatz({
      tabelle: "public.profile_legacy",
      schluessel: { spalte: "profile_id", wert: "uid-1" },
      felder: { legacy_source_id: "318" },
    });

    expect(satz?.sql).toContain('on conflict ("profile_id") do update set');
    expect(satz?.sql).toContain('"legacy_source_id" = excluded."legacy_source_id"');
  });

  it("weist eine Spalte ab, die nicht aus der Abbildung stammt", () => {
    // Die Spaltennamen dürfen NIE aus der Quelldatei kommen: sie gehen
    // unparametrisiert in den Text. Die Liste ist fest, und was nicht darauf
    // steht, ist ein Fehler im Code — kein Wert, den man durchreicht.
    expect(() =>
      schreibsatz({
        tabelle: "public.profiles",
        schluessel: { spalte: "id", wert: "uid-1" },
        felder: { "tier\" = 'impact', \"name": "böse" },
      }),
    ).toThrow(/Unbekannte Spalte/);
  });
});

describe("NEUES_KONTO — was nur beim Anlegen gilt", () => {
  it("gibt einem neuen Konto impact und keine Freischaltung", () => {
    expect(NEUES_KONTO).toEqual({ tier: "impact", activated_at: null });
  });

  it("hebt ein bestehendes Konto NICHT auf impact", () => {
    // Der Kern von 4.2/7.3: `tier` steht in den Einfügespalten, aber NICHT im
    // `do update set`. Sonst genügte eine Selbstregistrierung unter einer
    // bekannten Mitgliedsadresse, um die höchste Stufe geschenkt zu bekommen.
    const satz = schreibsatz({
      tabelle: "public.profiles",
      schluessel: { spalte: "id", wert: "uid-1" },
      felder: { name: "Anna Berg" },
      nurBeimAnlegen: NEUES_KONTO,
    });

    expect(satz?.sql).toContain('"tier"');
    expect(satz?.sql).not.toContain('"tier" = excluded');
    expect(satz?.sql).not.toContain('"activated_at" = excluded');
    expect(satz?.werte).toEqual(["uid-1", "Anna Berg", "impact", null]);
  });
});
