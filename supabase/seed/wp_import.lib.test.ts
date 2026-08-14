import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  QUELLFELDER,
  ablageorte,
  bildeAb,
  leseAufruf,
  pruefeKopfzeile,
  pruefeQuellPfad,
  pruefeZiel,
  schreibeBericht,
  titelAus,
} from "./wp_import.lib";

const DEV_REF = "foelowldexkcqzewvrcf";
const PROD_REF = "viwntbodrtqxgmqyxluh";

/** Derselbe Host für beide Projekte — genau das ist der Punkt (siehe unten). */
const POOLER = "aws-1-eu-central-1.pooler.supabase.com:5432";
const DEV_URL = `postgresql://postgres.${DEV_REF}:pw@${POOLER}/postgres`;
const PROD_URL = `postgresql://postgres.${PROD_REF}:pw@${POOLER}/postgres`;
const LOKAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const REFS = { devRef: DEV_REF, prodRef: PROD_REF };

describe("pruefeZiel", () => {
  it("erkennt DEV an der Kennung im Benutzernamen", () => {
    expect(pruefeZiel({ dbUrl: DEV_URL, erwartetesZiel: "dev", ...REFS })).toEqual({
      kind: "ok",
      ziel: "dev",
      ref: DEV_REF,
    });
  });

  it("bricht ab, wenn die Verbindung auf PROD zeigt, aber DEV genannt wurde", () => {
    const ergebnis = pruefeZiel({ dbUrl: PROD_URL, erwartetesZiel: "dev", ...REFS });

    expect(ergebnis.kind).toBe("abbruch");
    if (ergebnis.kind !== "abbruch") return;
    expect(ergebnis.grund).toContain(PROD_REF);
    expect(ergebnis.grund).not.toContain("pw");
  });

  it("unterscheidet die Projekte, obwohl der Host derselbe ist", () => {
    // Die Voraussetzung des Befunds aus dem Plan-Review, hier festgehalten:
    // ein Wächter, der den Host vergleicht, sähe zwischen diesen beiden
    // Verbindungen keinen Unterschied.
    expect(new URL(DEV_URL).host).toBe(new URL(PROD_URL).host);

    expect(pruefeZiel({ dbUrl: DEV_URL, erwartetesZiel: "dev", ...REFS }).kind).toBe("ok");
    expect(pruefeZiel({ dbUrl: PROD_URL, erwartetesZiel: "dev", ...REFS }).kind).toBe("abbruch");
  });

  it("erkennt den lokalen Stack an seiner Adresse, nicht an einer Kennung", () => {
    expect(pruefeZiel({ dbUrl: LOKAL_URL, erwartetesZiel: "lokal", ...REFS })).toEqual({
      kind: "ok",
      ziel: "lokal",
      ref: null,
    });
  });

  it("bricht ab, wenn lokal verbunden wird, aber DEV genannt wurde", () => {
    expect(pruefeZiel({ dbUrl: LOKAL_URL, erwartetesZiel: "dev", ...REFS }).kind).toBe("abbruch");
  });

  it("lässt den Weg nach PROD offen, wenn PROD genannt wurde", () => {
    expect(pruefeZiel({ dbUrl: PROD_URL, erwartetesZiel: "prod", ...REFS })).toEqual({
      kind: "ok",
      ziel: "prod",
      ref: PROD_REF,
    });
  });

  it("lässt die Kennung über die Adresse entscheiden", () => {
    // Ein Tunnel auf 127.0.0.1 mit einem Projekt-Benutzernamen ist nicht der
    // lokale Stack. Wo eine Kennung steht, zählt sie.
    const tunnel = `postgresql://postgres.${PROD_REF}:pw@127.0.0.1:5432/postgres`;

    expect(pruefeZiel({ dbUrl: tunnel, erwartetesZiel: "lokal", ...REFS }).kind).toBe("abbruch");
    expect(pruefeZiel({ dbUrl: tunnel, erwartetesZiel: "prod", ...REFS }).kind).toBe("ok");
  });

  it("bricht bei einem fremden Projekt ab, statt es einem Ziel zuzuordnen", () => {
    const fremd = `postgresql://postgres.abcdefghijklmnopqrst:pw@${POOLER}/postgres`;

    expect(pruefeZiel({ dbUrl: fremd, erwartetesZiel: "dev", ...REFS }).kind).toBe("abbruch");
    expect(pruefeZiel({ dbUrl: fremd, erwartetesZiel: "prod", ...REFS }).kind).toBe("abbruch");
  });

  it("bricht bei einer fremden Adresse ohne Kennung ab", () => {
    const fremd = "postgresql://postgres:pw@db.example.com:5432/postgres";

    expect(pruefeZiel({ dbUrl: fremd, erwartetesZiel: "lokal", ...REFS }).kind).toBe("abbruch");
  });

  it("hält ein fremdes Projekt hinter einem lokalen Tunnel nicht für den lokalen Stack", () => {
    // Die Adresse zählt nur, wo gar keine Kennung steht. Sonst genügte ein
    // Tunnel auf 127.0.0.1, um an dem Wächter vorbeizukommen.
    const fremd = "postgresql://postgres.abcdefghijklmnopqrst:pw@127.0.0.1:5432/postgres";

    expect(pruefeZiel({ dbUrl: fremd, erwartetesZiel: "lokal", ...REFS }).kind).toBe("abbruch");
  });

  it("bricht ohne Verbindungs-URL ab", () => {
    expect(pruefeZiel({ dbUrl: undefined, erwartetesZiel: "lokal", ...REFS }).kind).toBe("abbruch");
    expect(pruefeZiel({ dbUrl: "", erwartetesZiel: "lokal", ...REFS }).kind).toBe("abbruch");
  });

  it("bricht ab, wenn ein Sollwert kein Projekt-Ref ist", () => {
    const ergebnis = pruefeZiel({
      dbUrl: DEV_URL,
      erwartetesZiel: "dev",
      devRef: "",
      prodRef: PROD_REF,
    });

    expect(ergebnis.kind).toBe("abbruch");
    if (ergebnis.kind !== "abbruch") return;
    // Der Grund muss die Ref-Datei nennen. Ohne diese Zusicherung prüft der
    // Test nichts: ein leerer Sollwert bricht auch ohne die Sollwert-Prüfung
    // ab — dann aber mit „weder DEV noch PROD", was auf die Verbindung zeigt
    // statt auf die Datei, in der der Fehler steht.
    expect(ergebnis.grund).toContain("dev-project-ref.txt");
  });

  it("bricht ab, wenn beide Sollwerte dasselbe Projekt nennen", () => {
    const ergebnis = pruefeZiel({
      dbUrl: DEV_URL,
      erwartetesZiel: "dev",
      devRef: DEV_REF,
      prodRef: DEV_REF,
    });

    expect(ergebnis.kind).toBe("abbruch");
    if (ergebnis.kind !== "abbruch") return;
    expect(ergebnis.grund).toContain("dasselbe Projekt");
  });
});

describe("leseAufruf", () => {
  it("endet ohne Quelldatei mit einem Benutzungshinweis", () => {
    const ergebnis = leseAufruf([]);

    expect(ergebnis.kind).toBe("abbruch");
    if (ergebnis.kind !== "abbruch") return;
    expect(ergebnis.grund).toMatch(/wp_import\.ts/);
    expect(ergebnis.grund).toMatch(/--ziel/);
  });

  it("läuft mit Quelldatei allein als Trockenlauf gegen den lokalen Stack", () => {
    expect(leseAufruf(["/aussen/export.csv"])).toEqual({
      kind: "lauf",
      quelle: "/aussen/export.csv",
      schreiben: false,
      ziel: "lokal",
    });
  });

  it("verlangt im Schreibmodus die ausdrückliche Nennung des Ziels", () => {
    const ergebnis = leseAufruf(["/aussen/export.csv", "--schreiben"]);

    expect(ergebnis.kind).toBe("abbruch");
    if (ergebnis.kind !== "abbruch") return;
    expect(ergebnis.grund).toMatch(/--ziel/);
  });

  it("nimmt den Schreibmodus mit genanntem Ziel an", () => {
    expect(leseAufruf(["/aussen/export.csv", "--schreiben", "--ziel=dev"])).toEqual({
      kind: "lauf",
      quelle: "/aussen/export.csv",
      schreiben: true,
      ziel: "dev",
    });
  });

  it("erlaubt den Trockenlauf gegen ein genanntes Ziel", () => {
    expect(leseAufruf(["--ziel=dev", "/aussen/export.csv"])).toEqual({
      kind: "lauf",
      quelle: "/aussen/export.csv",
      schreiben: false,
      ziel: "dev",
    });
  });

  it("weist ein unbekanntes Ziel ab", () => {
    const ergebnis = leseAufruf(["/aussen/export.csv", "--ziel=produktion"]);

    expect(ergebnis.kind).toBe("abbruch");
    if (ergebnis.kind !== "abbruch") return;
    expect(ergebnis.grund).toContain("produktion");
  });

  it("reicht nichts Unbekanntes durch", () => {
    // Die Gründe gehören zur Zusicherung: ohne sie bestünde der Test auch dann,
    // wenn `--force` stillschweigend als zweite Quelldatei durchginge — die
    // Meldung zeigte dann auf die falsche Sache.
    const flagge = leseAufruf(["/aussen/export.csv", "--force"]);
    expect(flagge.kind).toBe("abbruch");
    if (flagge.kind !== "abbruch") return;
    expect(flagge.grund).toContain("Unbekanntes Argument");
    expect(flagge.grund).toContain("--force");

    const zweite = leseAufruf(["/aussen/e.csv", "/aussen/zweite.csv"]);
    expect(zweite.kind).toBe("abbruch");
    if (zweite.kind !== "abbruch") return;
    expect(zweite.grund).toContain("Mehr als eine Quelldatei");
  });
});

describe("pruefeQuellPfad", () => {
  const repoWurzel = "/Users/x/Sourcecode/factiv/fbc-platform";

  it("nimmt einen Pfad außerhalb des Arbeitsbaums an", () => {
    expect(
      pruefeQuellPfad({ pfad: "/Users/x/Documents/export.csv", cwd: repoWurzel, repoWurzel }),
    ).toEqual({ kind: "ok", pfad: "/Users/x/Documents/export.csv" });
  });

  it("lehnt einen Pfad innerhalb des Arbeitsbaums ab", () => {
    const ergebnis = pruefeQuellPfad({
      pfad: `${repoWurzel}/daten/export.csv`,
      cwd: repoWurzel,
      repoWurzel,
    });

    expect(ergebnis.kind).toBe("abbruch");
    if (ergebnis.kind !== "abbruch") return;
    expect(ergebnis.grund).toMatch(/Arbeitsbaum/);
  });

  it("lehnt auch einen relativen Pfad ab, der im Arbeitsbaum landet", () => {
    expect(pruefeQuellPfad({ pfad: "export.csv", cwd: repoWurzel, repoWurzel }).kind).toBe(
      "abbruch",
    );
    expect(
      pruefeQuellPfad({ pfad: "../fbc-platform/export.csv", cwd: repoWurzel, repoWurzel }).kind,
    ).toBe("abbruch");
  });

  it("löst einen relativen Pfad außerhalb des Arbeitsbaums absolut auf", () => {
    expect(pruefeQuellPfad({ pfad: "../export.csv", cwd: repoWurzel, repoWurzel })).toEqual({
      kind: "ok",
      pfad: "/Users/x/Sourcecode/factiv/export.csv",
    });
  });

  it("verwechselt ein Nachbarverzeichnis nicht mit dem Arbeitsbaum", () => {
    // Ein Namensvergleich mit `startsWith` verböte diesen Pfad — er liegt aber
    // daneben, nicht darin.
    expect(
      pruefeQuellPfad({
        pfad: `${repoWurzel}-daten/export.csv`,
        cwd: repoWurzel,
        repoWurzel,
      }).kind,
    ).toBe("ok");
  });

  it("lehnt den Arbeitsbaum selbst ab", () => {
    expect(pruefeQuellPfad({ pfad: repoWurzel, cwd: repoWurzel, repoWurzel }).kind).toBe("abbruch");
  });
});

describe("ablageorte", () => {
  const quelle = "/Users/x/Documents/fbc/user-export.csv";

  it("legt Bericht und Zwischenablage neben die Quelle", () => {
    const orte = ablageorte({ quellPfad: quelle, zeitstempel: "2026-08-14T15:53:00.000Z" });

    expect(orte.verzeichnis).toBe("/Users/x/Documents/fbc");
    expect(orte.bericht.startsWith("/Users/x/Documents/fbc/")).toBe(true);
    expect(orte.zwischenablage.startsWith("/Users/x/Documents/fbc/")).toBe(true);
    expect(orte.bericht).not.toBe(quelle);
  });

  it("trägt den Zeitstempel im Berichtsnamen, ohne Sonderzeichen im Dateinamen", () => {
    const orte = ablageorte({ quellPfad: quelle, zeitstempel: "2026-08-14T15:53:00.000Z" });

    expect(orte.bericht).toContain("2026-08-14");
    expect(orte.bericht.split("/").pop()).not.toContain(":");
    expect(orte.bericht.endsWith(".md")).toBe(true);
  });

  it("hält die Zwischenablage über Läufe hinweg an derselben Stelle", () => {
    // Ihr Zweck ist, das Abschalten der alten Seite zu überleben. Ein
    // Zeitstempel im Verzeichnisnamen machte jeden Lauf zu einem leeren Anfang.
    const erster = ablageorte({ quellPfad: quelle, zeitstempel: "2026-08-14T15:53:00.000Z" });
    const zweiter = ablageorte({ quellPfad: quelle, zeitstempel: "2026-08-20T09:12:00.000Z" });

    expect(zweiter.zwischenablage).toBe(erster.zwischenablage);
    expect(zweiter.bericht).not.toBe(erster.bericht);
  });

  it("liegt außerhalb des Arbeitsbaums, wenn die Quelle es tut", () => {
    const repoWurzel = "/Users/x/Sourcecode/factiv/fbc-platform";
    const orte = ablageorte({ quellPfad: quelle, zeitstempel: "2026-08-14T15:53:00.000Z" });

    for (const pfad of [orte.bericht, orte.zwischenablage]) {
      expect(pruefeQuellPfad({ pfad, cwd: repoWurzel, repoWurzel }).kind).toBe("ok");
    }
  });
});

describe("schreibeBericht", () => {
  it("schreibt mit Rechten 0600", () => {
    const ziel = join(mkdtempSync(join(tmpdir(), "wp-import-")), "bericht.md");

    schreibeBericht(ziel, "# Bericht\n");

    expect(statSync(ziel).mode & 0o777).toBe(0o600);
    expect(readFileSync(ziel, "utf8")).toBe("# Bericht\n");
  });

  it("zieht die Rechte einer bereits vorhandenen Datei nach", () => {
    // Der `mode` von `writeFileSync` wirkt nur beim Anlegen. Ein zweiter Lauf
    // über eine 0644-Datei ließe die Personendaten sonst weltlesbar liegen.
    const ziel = join(mkdtempSync(join(tmpdir(), "wp-import-")), "bericht.md");
    writeFileSync(ziel, "alt", { mode: 0o644 });

    schreibeBericht(ziel, "neu");

    expect(statSync(ziel).mode & 0o777).toBe(0o600);
    expect(readFileSync(ziel, "utf8")).toBe("neu");
  });
});

/**
 * Die 26 Namen stehen hier WÖRTLICH und nicht aus `QUELLFELDER` abgeleitet.
 * Sonst prüfte der Test die Liste gegen sich selbst: eine gestrichene Zeile
 * bliebe grün. Die Namen sind am 14.08. gegen die Kopfzeile der echten Quelle
 * gehalten — alle 26 vorhanden.
 */
const ERWARTETE_26 = [
  "E-Mail",
  "Homepage",
  "Mitgliedschaft",
  "Strasse",
  "Telefonnummer",
  "beruf",
  "biete",
  "facebook",
  "first_name",
  "infos",
  "infos_15",
  "infos_16",
  "infos_28",
  "instagram",
  "last_name",
  "linkedin",
  "ort",
  "ort_27",
  "ort_27_28",
  "praesei_lang",
  "praesi_kurz",
  "source_user_id",
  "suche",
  "twitter",
  "user_email",
  "youtube",
];

describe("QUELLFELDER", () => {
  it("führt genau die 26 lebenden Quellfelder der Abbildungsmatrix", () => {
    expect([...QUELLFELDER].sort()).toEqual(ERWARTETE_26);
  });

  it("nennt kein Feld doppelt", () => {
    expect(new Set(QUELLFELDER).size).toBe(QUELLFELDER.length);
  });
});

describe("pruefeKopfzeile", () => {
  it("nimmt eine Kopfzeile an, die alle erwarteten Felder trägt", () => {
    expect(pruefeKopfzeile(ERWARTETE_26)).toEqual({ kind: "ok" });
  });

  it("ignoriert unbekannte Spalten, statt an ihnen abzubrechen", () => {
    // Die echte Datei trägt 140 Spalten: 26 lebende, der Rest ist WordPress-
    // Innenleben (`wp_*`, `aioseo_*`, `session_tokens`) und Reste gelöschter
    // Formularfelder. Ein Wächter, der daran abbricht, wäre nie grün.
    const mitBallast = [...ERWARTETE_26, "wp_capabilities", "aioseo_twitter_url", "user_pass"];

    expect(pruefeKopfzeile(mitBallast)).toEqual({ kind: "ok" });
  });

  it("bricht ab, wenn ein erwartetes Feld fehlt, und nennt es", () => {
    const ohneOrt = ERWARTETE_26.filter((f) => f !== "ort");

    const ergebnis = pruefeKopfzeile(ohneOrt);

    expect(ergebnis.kind).toBe("abbruch");
    expect(ergebnis.kind === "abbruch" && ergebnis.grund).toContain("ort");
  });

  it("nennt ALLE fehlenden Felder, nicht nur das erste", () => {
    // Ein Wächter, der beim ersten Fund aussteigt, macht aus einem neu gezogenen
    // Export eine Kette von Einzelläufen — jeder deckt genau ein Feld auf.
    const ergebnis = pruefeKopfzeile(
      ERWARTETE_26.filter((f) => f !== "biete" && f !== "suche" && f !== "beruf"),
    );

    expect(ergebnis.kind).toBe("abbruch");
    const grund = ergebnis.kind === "abbruch" ? ergebnis.grund : "";
    for (const fehlend of ["beruf", "biete", "suche"]) {
      expect(grund).toContain(fehlend);
    }
  });

  it("lässt sich vom BOM der ersten Spalte nicht täuschen", () => {
    // Nachgemessen: die echte Datei beginnt mit U+FEFF, die erste Spalte heisst
    // damit "\uFEFFuser_login". Heute folgenlos, weil `user_login` nicht
    // abgebildet wird — steht aber ein erwartetes Feld nach einem neuen Export
    // an erster Stelle, meldete der Wächter es sonst als fehlend, obwohl es da
    // ist. Der Abbruchgrund zeigte dann auf die falsche Ursache.
    const mitBom = ERWARTETE_26.map((f, i) => (i === 0 ? `\uFEFF${f}` : f));

    expect(pruefeKopfzeile(mitBom)).toEqual({ kind: "ok" });
  });

  it("bricht bei leerer Kopfzeile ab", () => {
    expect(pruefeKopfzeile([]).kind).toBe("abbruch");
  });
});

/** Eine Zeile mit allen 26 Feldern leer; die Fälle setzen nur, was sie prüfen. */
function zeile(werte: Record<string, string> = {}): Record<string, string> {
  const leer = Object.fromEntries(QUELLFELDER.map((f) => [f, ""]));
  return { ...leer, ...werte };
}

describe("titelAus", () => {
  it("nimmt kurzen einzeiligen Text unverändert", () => {
    expect(titelAus("Beratung für Familienunternehmen")).toBe("Beratung für Familienunternehmen");
  });

  it("nimmt die erste nicht-leere Zeile", () => {
    expect(titelAus("\n\nErste Zeile\nZweite Zeile")).toBe("Erste Zeile");
  });

  it("kürzt an der Wortgrenze und markiert die Kürzung", () => {
    const lang =
      "Wir begleiten mittelständische Unternehmen bei der Nachfolge und der Übergabe an die nächste Generation";

    const titel = titelAus(lang);

    expect(titel.length).toBeLessThanOrEqual(81);
    expect(titel.endsWith("…")).toBe(true);
    // An der Wortgrenze, nicht mitten im Wort.
    expect(lang.startsWith(titel.slice(0, -1))).toBe(true);
    expect(titel).not.toMatch(/ …$/);
  });

  it("schneidet hart, wenn vor der Grenze kein Leerzeichen steht", () => {
    const titel = titelAus("A".repeat(200));

    expect(titel.length).toBeLessThanOrEqual(81);
    expect(titel.endsWith("…")).toBe(true);
  });
});

describe("bildeAb — profiles", () => {
  it("setzt den Namen aus Vor- und Nachname zusammen", () => {
    expect(bildeAb(zeile({ first_name: "Anna", last_name: "Berg" })).profil.name).toBe("Anna Berg");
  });

  it("kommt mit nur einem der beiden Namensteile aus", () => {
    expect(bildeAb(zeile({ first_name: "Anna" })).profil.name).toBe("Anna");
    expect(bildeAb(zeile({ last_name: "Berg" })).profil.name).toBe("Berg");
  });

  it("schreibt null statt einer leeren Zeichenkette", () => {
    // Die Leerwertregel: ein Feld aus lauter Leerzeichen zählt als nicht
    // vorhanden. Ein '' im Profil sähe aus wie eine bewusste Eingabe.
    const satz = bildeAb(zeile({ first_name: "   ", beruf: "  ", Strasse: " " }));

    expect(satz.profil.name).toBeNull();
    expect(satz.profil.headline).toBeNull();
    expect(satz.kontakt.street).toBeNull();
  });

  it("führt beruf als headline", () => {
    expect(bildeAb(zeile({ beruf: "Steuerberaterin" })).profil.headline).toBe("Steuerberaterin");
  });

  it("hängt infos_15 an infos an und entfernt dabei das Markup", () => {
    const satz = bildeAb(
      zeile({ infos: "<p>Erster Teil</p>", infos_15: "Zweiter&nbsp;Teil" }),
    );

    expect(satz.profil.short_bio).toBe("Erster Teil\n\nZweiter Teil");
  });

  it("führt ort_27_28 als region und NICHT als Wohnort", () => {
    const satz = bildeAb(zeile({ ort_27_28: "Rhein-Main", ort: "70173 Stuttgart" }));

    expect(satz.profil.region).toBe("Rhein-Main");
    expect(satz.kontakt.city).toBe("Stuttgart");
  });

  it("führt Homepage als profiles.website — profile_contacts.website gibt es nicht mehr", () => {
    const satz = bildeAb(zeile({ Homepage: "https://example.org" }));

    expect(satz.profil.website).toBe("https://example.org");
    expect(satz.kontakt).not.toHaveProperty("website");
  });

  it("leitet member_since aus infos_16 ab und hält die Rohangabe fest", () => {
    const satz = bildeAb(zeile({ infos_16: "April 2021" }));

    expect(satz.profil.member_since).toBe("2021-04-01");
    // Der Auffüllgrad gehört in den Bericht: „2021-04-01" sieht genauer aus,
    // als die Angabe war.
    expect(satz.herkunft.beitritt).toMatchObject({ grad: "monat", roh: "April 2021" });
  });
});

describe("bildeAb — socials und videos", () => {
  it("führt alle fünf Netzwerke zusammen und lässt leere weg", () => {
    const satz = bildeAb(
      zeile({ linkedin: "https://linkedin.com/in/a", facebook: "https://fb.com/b", youtube: "" }),
    );

    expect(satz.profil.socials).toEqual({
      linkedin: "https://linkedin.com/in/a",
      facebook: "https://fb.com/b",
    });
  });

  it("trennt Präsentations-Videos von Präsentations-Text", () => {
    // Gemessen: praesi_kurz/praesei_lang sind KEINE Video-Felder. 2 Menschen
    // haben dort YouTube-Links, 3 haben Fließtext.
    const satz = bildeAb(
      zeile({
        infos: "Über mich",
        praesi_kurz: "https://www.youtube.com/watch?v=abc123",
        praesei_lang: "Ich begleite Unternehmen bei der Nachfolge.",
      }),
    );

    expect(satz.profil.videos).toEqual(["https://www.youtube.com/watch?v=abc123"]);
    expect(satz.profil.short_bio).toBe("Über mich\n\nIch begleite Unternehmen bei der Nachfolge.");
  });

  it("legt nicht abspielbare Werte NICHT in videos ab", () => {
    // Anzeige und sanitizeVideos filtern über parseVideoUrl — dort abgelegt
    // wäre der Text importiert und trotzdem unsichtbar.
    const satz = bildeAb(zeile({ praesi_kurz: "Branded Content für Mittelständler" }));

    expect(satz.profil.videos).toEqual([]);
    expect(satz.profil.short_bio).toBe("Branded Content für Mittelständler");
  });
});

describe("bildeAb — profile_contacts", () => {
  it("trennt die Ortsangabe in Postleitzahl und Ort", () => {
    const satz = bildeAb(zeile({ ort: "70173 Stuttgart", Strasse: "Hauptstr. 1", ort_27: "BW" }));

    expect(satz.kontakt).toMatchObject({
      postal_code: "70173",
      city: "Stuttgart",
      street: "Hauptstr. 1",
      state: "BW",
      country: "DE",
    });
  });

  it("hält die Kontaktadresse von der Anmeldeadresse getrennt", () => {
    const satz = bildeAb(zeile({ "E-Mail": "Kontakt@Firma.de", user_email: "Privat@Web.de" }));

    expect(satz.kontakt.email).toBe("Kontakt@Firma.de");
    expect(satz.anmeldeadresse).toBe("privat@web.de");
  });

  it("räumt das führende Apostroph aus der Telefonnummer", () => {
    expect(bildeAb(zeile({ Telefonnummer: "'+49 711 123456" })).kontakt.phone).toBe(
      "+49 711 123456",
    );
  });
});

describe("bildeAb — offers, needs, interessen", () => {
  it("macht aus biete eine offers-Zeile mit Titel und Volltext", () => {
    const text = "Beratung\nIch berate zu allem, was mit Nachfolge zu tun hat.";

    const satz = bildeAb(zeile({ biete: text }));

    expect(satz.offers).toEqual([{ title: "Beratung", description: text }]);
    expect(satz.needs).toEqual([]);
  });

  it("macht aus suche eine needs-Zeile", () => {
    const satz = bildeAb(zeile({ suche: "Kontakte in die Industrie" }));

    expect(satz.needs).toEqual([
      { title: "Kontakte in die Industrie", description: "Kontakte in die Industrie" },
    ]);
  });

  it("gibt offers/needs einen nicht-leeren Titel — die Spalte ist not null", () => {
    const satz = bildeAb(zeile({ biete: "   \n\n  Endlich Text  " }));

    expect(satz.offers[0].title.trim()).not.toBe("");
  });

  it("macht aus infos_28 EINEN Chip ohne Thema", () => {
    const satz = bildeAb(zeile({ infos_28: "Segeln, Bergsteigen und Jazz" }));

    expect(satz.interessen).toEqual([{ label: "Segeln, Bergsteigen und Jazz", theme: null }]);
  });
});

describe("bildeAb — profile_legacy", () => {
  it("führt die Stufe roh und die Kennung als Schlüssel", () => {
    const satz = bildeAb(zeile({ Mitgliedschaft: "  Premium-Mitglied  ", source_user_id: " 318 " }));

    // Roh heisst: nicht normalisiert, nur der Rand beschnitten. Normalisiert
    // wäre die Herkunft weg und der Abgleich mit einer Rechnung unmöglich.
    expect(satz.legacy.legacy_tier).toBe("Premium-Mitglied");
    expect(satz.legacy.legacy_source_id).toBe("318");
  });
});

describe("bildeAb — user_pass", () => {
  it("liest den Passwort-Hash nirgendwo", () => {
    // Aufgabe 3.2: der Wert darf im Ergebnis nicht auftauchen — auch nicht in
    // einem Feld, das ihn versehentlich mitschleppt.
    const geheim = "$P$BxxxxxxxxxxxxxxxxxxxGEHEIM";
    const satz = bildeAb({ ...zeile({ first_name: "Anna" }), user_pass: geheim });

    expect(JSON.stringify(satz)).not.toContain("GEHEIM");
    expect(QUELLFELDER).not.toContain("user_pass");
  });
});
