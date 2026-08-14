import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ablageorte,
  leseAufruf,
  pruefeQuellPfad,
  pruefeZiel,
  schreibeBericht,
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
