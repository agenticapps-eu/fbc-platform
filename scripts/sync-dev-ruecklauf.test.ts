/**
 * Aufgabengruppe 4 aus `openspec/changes/sync-dev-from-prod/tasks.md`.
 *
 * Was hier fällt, sind die Zusagen, die **vor** dem Leeren gelten müssen: ein
 * unvollständiger Auszug plus ein geleertes DEV ist der einzige Zustand, aus
 * dem es keinen Rückweg gibt. Der Mechanismus selbst — replica-Schalter,
 * Leeren, Einspielen — wird nicht hier geprüft, sondern im vollständigen
 * Probelauf gegen den lokalen Stack (5.1); eine Attrappe belegte dort nichts.
 */
import { describe, expect, test } from "vitest";

import {
  PFLICHTDATEIEN,
  entferneRestrict,
  authTabellenZumLeeren,
  planeLeeren,
  pruefeSicherungslauf,
  pruefeAuszug,
  vergleicheManifest,
  type Manifest,
} from "./sync-dev-ruecklauf.logic";

const PROD = "viwntbodrtqxgmqyxluh";
const DEV = "foelowldexkcqzewvrcf";

const manifest = (ueber: Partial<Manifest> = {}): Manifest => ({
  quelle: PROD,
  snapshot: "00000017-0000108E-1",
  tabellen: {
    "auth.users": { zeilen: 72, hash: "a" },
    "auth.identities": { zeilen: 72, hash: "b" },
    "public.profiles": { zeilen: 72, hash: "c" },
    "public.staff_roles": { zeilen: 2, hash: "d" },
    "public.posts": { zeilen: 11, hash: "e" },
  },
  buckets: ["avatars"],
  objekte: [],
  ...ueber,
});

describe("4.x Der Auszug wird geprüft, BEVOR DEV geleert wird", () => {
  const alle = [...PFLICHTDATEIEN, "objekte"];

  test("ein vollständiger Auszug aus der richtigen Quelle wird angenommen", () => {
    const e = pruefeAuszug({
      vorhandeneDateien: alle,
      manifest: manifest(),
      erwarteteQuelle: PROD,
    });
    expect(e.kind).toBe("ok");
  });

  test("RED: fehlt manifest.json, ist der erzeugende Lauf abgebrochen", () => {
    const e = pruefeAuszug({
      vorhandeneDateien: ["auth.sql", "public.sql", "objekte"],
      manifest: null,
      erwarteteQuelle: PROD,
    });
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toMatch(/manifest\.json/);
  });

  test.each(["auth.sql", "public.sql"])("RED: ohne %s wird abgebrochen", (fehlt) => {
    const e = pruefeAuszug({
      vorhandeneDateien: alle.filter((d) => d !== fehlt),
      manifest: manifest(),
      erwarteteQuelle: PROD,
    });
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toContain(fehlt);
  });

  test("RED: ein Auszug aus der FALSCHEN Quelle wird abgelehnt", () => {
    // Der gefährlichste Fall: ein Auszug aus DEV, zurück nach DEV gespielt.
    // Er sähe vollständig aus und liesse den Bestand verschwinden.
    const e = pruefeAuszug({
      vorhandeneDateien: alle,
      manifest: manifest({ quelle: DEV }),
      erwarteteQuelle: PROD,
    });
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toContain(DEV);
  });

  test("RED: ein Manifest ohne Snapshot beschreibt keinen Stand", () => {
    const e = pruefeAuszug({
      vorhandeneDateien: alle,
      manifest: manifest({ snapshot: "" }),
      erwarteteQuelle: PROD,
    });
    expect(e.kind).toBe("abbruch");
  });
});

describe("psql-Metabefehle aus dem Auszug", () => {
  const R = "\\restrict aBc123";
  const U = "\\unrestrict aBc123";

  test("entfernt genau die zwei Zeilen und lässt alles andere stehen", () => {
    const e = entferneRestrict([R, "SET x = 1;", "INSERT INTO t VALUES (1);", U].join("\n"));
    expect(e.kind).toBe("ok");
    if (e.kind === "ok") expect(e.sql).toBe("SET x = 1;\nINSERT INTO t VALUES (1);");
  });

  test("ein Auszug ohne die Metabefehle geht unverändert durch", () => {
    const sql = "SET x = 1;\nINSERT INTO t VALUES (1);";
    expect(entferneRestrict(sql)).toEqual({ kind: "ok", sql });
  });

  test("RED: steht der Befehl AUCH in einem Datenwert, wird abgebrochen statt geraten", () => {
    // Eine Biografie darf alles enthalten. Blind zu entfernen risse hier
    // lautlos eine Zeile aus den Daten — die Zeilenzahl stimmte trotzdem.
    const e = entferneRestrict(
      [R, "INSERT INTO t VALUES ('Zeile1", "\\restrict getarnt", "Zeile3');", U].join("\n"),
    );
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toMatch(/Loch in die Daten/);
  });

  test("RED: verschiedene Token werden abgelehnt", () => {
    const e = entferneRestrict([R, "SET x = 1;", "\\unrestrict anderer"].join("\n"));
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toMatch(/verschiedene Token/);
  });

  test("RED: nur die öffnende Klammer ist ein Abbruch", () => {
    expect(entferneRestrict([R, "SET x = 1;"].join("\n")).kind).toBe("abbruch");
  });

  test("RED: verkehrte Reihenfolge wird abgelehnt", () => {
    const e = entferneRestrict([U, "SET x = 1;", R].join("\n"));
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toMatch(/steht vor/);
  });
});

describe("4.2/4.3 Leeren", () => {
  test("public zuerst, auth zuletzt — richtig herum auch ohne den Schalter", () => {
    const plan = planeLeeren(["profiles", "posts"], ["auth.identities", "auth.users"]);
    expect(plan).toEqual([
      'delete from public."profiles"',
      'delete from public."posts"',
      'delete from auth."identities"',
      'delete from auth."users"',
    ]);
  });

  test("kein truncate — es risse per cascade Tabellen mit, die nicht in der Liste standen", () => {
    for (const zeile of planeLeeren(["profiles"], ["auth.users"])) {
      expect(zeile).not.toMatch(/truncate/i);
      expect(zeile).not.toMatch(/cascade/i);
    }
  });

  test("Namen werden zitiert", () => {
    expect(planeLeeren(["user"], [])[0]).toBe('delete from public."user"');
  });

  test("RED: eine leere Tabellenliste ist kein Zustand, sondern ein Fehler", () => {
    expect(() => planeLeeren([], ["auth.users"])).toThrow(/kein Zustand/);
  });

  /**
   * Der DEV-Lauf vom 2026-08-20 ist an genau dieser Stelle abgebrochen. Geleert
   * wurden `auth.users` und `auth.identities` — eine Liste mit zwei Eintraegen.
   * Zurueck blieben 13 `sessions`, 81 `refresh_tokens`, 13 `mfa_amr_claims` und
   * ein `one_time_token` der alten DEV-Konten.
   *
   * Alle diese Fremdschluessel sind `ON DELETE CASCADE`. Getragen haetten sie
   * trotzdem nicht: `session_replication_role = replica` legt die
   * Cascade-Trigger mit still. Wer im replica-Modus loescht, loescht **nur**,
   * was er benennt — und deshalb darf hier keine Namensliste stehen.
   */
  test("RED: auth wird per Regel geleert, nicht per Namensliste", () => {
    const vorhanden = [
      "audit_log_entries",
      "identities",
      "mfa_amr_claims",
      "one_time_tokens",
      "refresh_tokens",
      "schema_migrations",
      "sessions",
      "users",
    ];
    const plan = authTabellenZumLeeren(vorhanden);
    // Was GoTrue morgen dazustellt, ist mit drin, ohne dass jemand es nachtraegt.
    for (const t of vorhanden) {
      if (t === "schema_migrations") continue;
      expect(plan).toContain(`auth.${t}`);
    }
  });

  test("RED: schema_migrations bleibt stehen — das ist GoTrues eigene Historie", () => {
    expect(authTabellenZumLeeren(["schema_migrations", "users"])).toEqual(["auth.users"]);
  });

  test("users kommt zuletzt, damit die Reihenfolge auch ohne den Schalter traegt", () => {
    const plan = authTabellenZumLeeren(["users", "sessions", "identities"]);
    expect(plan[plan.length - 1]).toBe("auth.users");
    expect(plan.indexOf("auth.identities")).toBeLessThan(plan.indexOf("auth.users"));
  });

  test("RED: ohne auth.users ist die Liste nicht die, die gemeint war", () => {
    expect(() => authTabellenZumLeeren(["sessions"])).toThrow(/auth\.users/);
  });
});

describe("5.6 Der Sicherungsschalter", () => {
  /**
   * Ohne ihn darf der Auszug nicht „Sicherung" heissen: 4.13 nimmt den Konten
   * absichtlich die Anmeldefähigkeit, und aus einem Bestand, in den sich
   * niemand anmelden kann, lässt sich PROD nicht wieder aufbauen.
   *
   * Er ist zugleich der gefährlichste Schalter im Skript. Produktions-Hashes
   * auf DEV wären genau das, was die Entscheidung „keine Anonymisierung" durch
   * neutralisierte Hashes ausgeglichen hat. Deshalb ist er gegen DEV nicht
   * bloss unerwünscht, sondern **abgelehnt** — und zwar bevor gelöscht wird.
   */
  test("RED: gegen DEV wird der Schalter abgelehnt", () => {
    const w = pruefeSicherungslauf({ zielArt: "dev", sicherung: true });
    expect(w.kind).toBe("abbruch");
    if (w.kind === "abbruch") expect(w.grund).toMatch(/dev/i);
  });

  test("gegen den lokalen Stack ist er erlaubt — dort fällt der Beleg", () => {
    expect(pruefeSicherungslauf({ zielArt: "lokal", sicherung: true })).toEqual({
      kind: "frei",
      neutralisieren: false,
      devBestand: false,
    });
  });

  test("ohne Schalter wird neutralisiert und der DEV-Bestand hergestellt", () => {
    for (const zielArt of ["lokal", "dev"] as const) {
      expect(pruefeSicherungslauf({ zielArt, sicherung: false })).toEqual({
        kind: "frei",
        neutralisieren: true,
        devBestand: true,
      });
    }
  });

  /**
   * Der Schalter lässt **beides** aus, nicht nur 4.13. Ein Sicherungslauf, der
   * fünf Stufen umschreibt und eine `matching_manager`-Zeile dazustellt, stellt
   * nicht den Bestand des Manifests her, sondern einen DEV-Bestand mit echten
   * Hashes — die schlechteste der drei möglichen Fassungen.
   */
  test("RED: im Sicherungslauf entfällt auch der deklarierte DEV-Bestand", () => {
    const w = pruefeSicherungslauf({ zielArt: "lokal", sicherung: true });
    expect(w.kind === "frei" && w.devBestand).toBe(false);
  });
});

describe("5.3 Abnahme: Abweichungen werden benannt, nicht gezählt", () => {
  const deklaration = {
    zusatzZeilen: { "public.staff_roles": 1 },
    hashWeichtAb: ["public.profiles", "auth.users"],
  };
  /** Sauberer Spiegel plus deklariertem Bestand. */
  const sauber = (): Record<string, { zeilen: number; hash: string }> => ({
    "auth.users": { zeilen: 72, hash: "NEU-neutralisiert" },
    "auth.identities": { zeilen: 72, hash: "b" },
    "public.profiles": { zeilen: 72, hash: "NEU-fuenf-tiers" },
    "public.staff_roles": { zeilen: 3, hash: "NEU-matching-manager" },
    "public.posts": { zeilen: 11, hash: "e" },
  });

  test("der saubere Fall ist grün und benennt die drei gewollten Abweichungen", () => {
    const e = vergleicheManifest({ soll: manifest(), ist: sauber(), deklaration });
    expect(e.unerwartet).toEqual([]);
    expect(e.deklariert.map((d) => d.was)).toEqual([
      "auth.users",
      "public.profiles",
      "public.staff_roles",
    ]);
  });

  test("RED: eine Tabelle MIT Zuschlag, deren Zahl trotzdem nicht aufgeht, ist ein Fehler", () => {
    const ist = sauber();
    ist["public.staff_roles"] = { zeilen: 9, hash: "x" };
    const e = vergleicheManifest({ soll: manifest(), ist, deklaration });
    expect(e.unerwartet).toEqual([
      { was: "public.staff_roles", grund: "zeilen", soll: "3", ist: "9" },
    ]);
  });

  test("RED: gleiche ZEILENZAHL bei anderem Inhalt fällt auf — sonst prüfte die Abnahme nichts", () => {
    // Der Fall, den eine reine Zählung nie sieht: `tier` ist eine Spalte, die
    // Neutralisierung der Hashes auch. Wer nur zählt, hält alles für sauber.
    const ist = sauber();
    ist["public.posts"] = { zeilen: 11, hash: "VERAENDERT" };
    const e = vergleicheManifest({ soll: manifest(), ist, deklaration });
    expect(e.unerwartet).toEqual([
      { was: "public.posts", grund: "hash", soll: "e", ist: "VERAENDERT" },
    ]);
  });

  test("RED: eine fehlende Tabelle fällt auf, auch wenn sie im Ist gar nicht vorkommt", () => {
    const ist = sauber();
    delete ist["public.posts"];
    const e = vergleicheManifest({ soll: manifest(), ist, deklaration });
    expect(e.unerwartet).toEqual([{ was: "public.posts", grund: "zeilen", soll: "11", ist: "0" }]);
  });

  test("RED: eine Tabelle, die es NUR im Ist gibt, fällt ebenfalls auf", () => {
    const ist = sauber();
    ist["public.demo_welt"] = { zeilen: 41, hash: "z" };
    const e = vergleicheManifest({ soll: manifest(), ist, deklaration });
    expect(e.unerwartet.map((u) => u.was)).toEqual(["public.demo_welt"]);
  });

  test("RED: eine deklarierte Hash-Abweichung entschuldigt NICHT die Nachbartabelle", () => {
    const ist = sauber();
    ist["auth.identities"] = { zeilen: 72, hash: "VERAENDERT" };
    const e = vergleicheManifest({ soll: manifest(), ist, deklaration });
    expect(e.unerwartet.map((u) => u.was)).toEqual(["auth.identities"]);
  });
});
