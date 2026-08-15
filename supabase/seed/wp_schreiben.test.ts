import { describe, expect, it } from "vitest";

import type { Zusammenfuehrung } from "./wp_import.lib";
import { NEUES_KONTO, legeKontoAn, schreibauftrag, schreibsatz } from "./wp_schreiben";

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

/** Ein Auftrag, wie ihn `fuegeZusammen` liefert — hier nur das Nötige. */
function zusammenfuehrung(teile: Partial<Zusammenfuehrung> = {}): Zusammenfuehrung {
  return {
    profil: { name: "Anna Berg" },
    kontakt: {},
    legacy: { legacy_source_id: "318" },
    offers: [],
    needs: [],
    interessen: [],
    uebersprungen: [],
    ...teile,
  };
}

const sql = (anweisungen: { sql: string }[], tabelle: string) =>
  anweisungen.filter((a) => a.sql.includes(tabelle)).map((a) => a.sql);

describe("schreibauftrag — eine Transaktion je Datensatz", () => {
  it("schreibt profiles, profile_contacts und profile_legacy unter derselben Kennung", () => {
    const anweisungen = schreibauftrag({
      uid: "uid-1",
      neuAngelegt: true,
      zusammenfuehrung: zusammenfuehrung({
        kontakt: { email: "anna@example.org", city: "Bad Homburg" },
      }),
    });

    expect(sql(anweisungen, "public.profiles")).toHaveLength(1);
    expect(sql(anweisungen, "public.profile_contacts")).toHaveLength(1);
    expect(sql(anweisungen, "public.profile_legacy")).toHaveLength(1);
    for (const a of anweisungen) expect(a.werte[0]).toBe("uid-1");
  });

  it("schreibt das Profil vor allem, was daran hängt", () => {
    // Fremdschlüssel: `profile_contacts`, `profile_legacy`, `offers` und die
    // übrigen zeigen alle auf `profiles.id`.
    const anweisungen = schreibauftrag({
      uid: "uid-1",
      neuAngelegt: true,
      zusammenfuehrung: zusammenfuehrung({ offers: [{ title: "Beratung", description: "" }] }),
    });

    expect(anweisungen[0].sql).toContain("public.profiles");
  });

  it("gibt einem frisch angelegten Konto impact — der Trigger legt die Zeile vor uns an", () => {
    // GEMESSEN, nicht angenommen: `on_auth_user_created` legt beim Anlegen über
    // die Admin-Schnittstelle bereits `public.profiles` an, mit `tier = 'basic'`
    // (community_foundation.sql:82, six_level_model.sql:87). Das Upsert trifft
    // deshalb IMMER eine bestehende Zeile — eine reine Einfügespalte käme nie an.
    const anweisungen = schreibauftrag({
      uid: "uid-1",
      neuAngelegt: true,
      zusammenfuehrung: zusammenfuehrung(),
    });

    const profil = sql(anweisungen, "public.profiles")[0];
    expect(profil).toContain('"tier" = excluded."tier"');
    expect(profil).toContain('"activated_at" = excluded."activated_at"');
    expect(anweisungen[0].werte).toContain("impact");
  });

  it("fasst die Stufe eines bestehenden Kontos nicht an", () => {
    // Der Kern von 4.2/7.3: der Import hebt niemanden auf die höchste Stufe, der
    // schon ein Konto hat. Bei „aktualisiert" kommt die Stufe in keiner Form vor.
    const anweisungen = schreibauftrag({
      uid: "uid-1",
      neuAngelegt: false,
      zusammenfuehrung: zusammenfuehrung(),
    });

    for (const a of anweisungen) {
      expect(a.sql).not.toContain('"tier"');
      expect(a.sql).not.toContain('"activated_at"');
      expect(a.werte).not.toContain("impact");
    }
  });

  it("legt Angebote, Gesuche und Interessen als eigene Zeilen an", () => {
    const anweisungen = schreibauftrag({
      uid: "uid-1",
      neuAngelegt: false,
      zusammenfuehrung: zusammenfuehrung({
        offers: [
          { title: "Beratung", description: "seit 1998" },
          { title: "Netzwerk", description: "" },
        ],
        needs: [{ title: "Partner", description: "" }],
        interessen: [{ label: "Nachhaltigkeit", theme: null }],
      }),
    });

    expect(sql(anweisungen, "public.offers")).toHaveLength(2);
    expect(sql(anweisungen, "public.needs")).toHaveLength(1);
    expect(sql(anweisungen, "public.profile_interests")).toHaveLength(1);
    // `source` steht ausdrücklich da: die Bestandsabfrage zählt nur die Zeilen
    // des Freitext-Editors. Käme der Wert aus dem Spalten-Default, hinge die
    // Wiederholbarkeit an einer Voreinstellung, die niemand hier sieht.
    expect(sql(anweisungen, "public.offers")[0]).toContain('"source"');
    expect(anweisungen.at(-1)?.werte).toEqual(["uid-1", "Nachhaltigkeit", null]);
  });

  it("schreibt nichts für eine leere Liste", () => {
    const anweisungen = schreibauftrag({
      uid: "uid-1",
      neuAngelegt: false,
      zusammenfuehrung: zusammenfuehrung(),
    });

    expect(sql(anweisungen, "public.offers")).toHaveLength(0);
    expect(sql(anweisungen, "public.needs")).toHaveLength(0);
    expect(sql(anweisungen, "public.profile_interests")).toHaveLength(0);
  });

  it("lässt eine Tabelle aus, zu der nichts zu schreiben ist", () => {
    // `schreibsatz` gibt dort `null` zurück — das darf nicht als leere Anweisung
    // in der Transaktion landen und im Bericht als Schreibvorgang zählen.
    const anweisungen = schreibauftrag({
      uid: "uid-1",
      neuAngelegt: false,
      zusammenfuehrung: zusammenfuehrung({ profil: {}, kontakt: {} }),
    });

    expect(sql(anweisungen, "public.profiles")).toHaveLength(0);
    expect(sql(anweisungen, "public.profile_contacts")).toHaveLength(0);
    expect(sql(anweisungen, "public.profile_legacy")).toHaveLength(1);
  });
});

describe("legeKontoAn — das Anmeldekonto über die Admin-Schnittstelle", () => {
  const konto = { adresse: "anna@example.org", basis: "http://127.0.0.1:54321", schluessel: "k" };

  /** Ein `fetch`-Ersatz — die Plattformfunktion, nicht unser eigener Code. */
  function antwort(status: number, koerper: unknown) {
    const gesehen: { url?: string; init?: RequestInit } = {};
    const hole = async (url: string | URL | Request, init?: RequestInit) => {
      gesehen.url = String(url);
      gesehen.init = init;
      return new Response(JSON.stringify(koerper), {
        status,
        headers: { "content-type": "application/json" },
      });
    };
    return { hole: hole as unknown as typeof fetch, gesehen };
  }

  it("legt das Konto OHNE Passwort an", async () => {
    // Ein vom Import gesetztes Passwort wäre ein Zugang, den niemand angefordert
    // hat und den niemand kennt — der Weg hinein ist der Aktivierungslauf.
    const { hole, gesehen } = antwort(200, { id: "uid-1" });

    await legeKontoAn(konto, hole);

    expect(gesehen.url).toBe("http://127.0.0.1:54321/auth/v1/admin/users");
    const gesendet = JSON.parse(String(gesehen.init?.body));
    expect(gesendet).not.toHaveProperty("password");
    expect(gesendet.email).toBe("anna@example.org");
  });

  it("gibt die Kennung des angelegten Kontos zurück", async () => {
    const { hole } = antwort(200, { id: "uid-1" });

    expect(await legeKontoAn(konto, hole)).toEqual({ stand: "angelegt", uid: "uid-1" });
  });

  it("meldet einen Fehlschlag, statt zu werfen", async () => {
    // Ein einzelner Datensatz darf den Lauf über 70 nicht beenden (7.5). Der
    // Aufrufer entscheidet — hier wird nur berichtet.
    const { hole } = antwort(422, { msg: "email address already registered" });

    const ergebnis = await legeKontoAn(konto, hole);

    expect(ergebnis.stand).toBe("fehler");
    expect(ergebnis.stand === "fehler" && ergebnis.grund).toContain("422");
  });

  it("trägt die Adresse nicht in die Begründung", async () => {
    // Dieselbe Regel wie in `stdoutZeile` (4.7): kein Personenbezug in einer
    // Ausgabe, die im Terminal und in Protokollen landet.
    const { hole } = antwort(500, { msg: "anna@example.org ist kaputt" });

    const ergebnis = await legeKontoAn(konto, hole);

    expect(ergebnis.stand === "fehler" && ergebnis.grund).not.toContain("@");
  });
});

describe("NEUES_KONTO — was nur beim Anlegen gilt", () => {
  it("gibt einem neuen Konto impact und keine Freischaltung", () => {
    expect(NEUES_KONTO).toEqual({ tier: "impact", activated_at: null });
  });

  it("kommt nur an Konten, die dieser Lauf selbst angelegt hat", () => {
    // Der Kern von 4.2/7.3. Der Riegel sitzt am Aufrufer und NICHT in der Form
    // der Anweisung: eine reine Einfügespalte käme nie an, weil der Trigger
    // `on_auth_user_created` die Profilzeile vor uns anlegt (gemessen, 15.08.).
    // Sonst genügte eine Selbstregistrierung unter einer bekannten
    // Mitgliedsadresse, um die höchste Stufe geschenkt zu bekommen.
    const satz = schreibsatz({
      tabelle: "public.profiles",
      schluessel: { spalte: "id", wert: "uid-1" },
      felder: { name: "Anna Berg", ...NEUES_KONTO },
    });

    expect(satz?.sql).toContain('"tier" = excluded."tier"');
    expect(satz?.werte).toEqual(["uid-1", "Anna Berg", "impact", null]);
  });
});
