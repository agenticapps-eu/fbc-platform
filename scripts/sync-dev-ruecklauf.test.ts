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
  planeLeeren,
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
});

describe("5.3 Abnahme: Abweichungen werden benannt, nicht gezählt", () => {
  const zuschlag = { "public.staff_roles": 2, "public.tier_assignments": 5 };

  test("ein sauberer Spiegel plus deklariertem Zuschlag ist grün", () => {
    const e = vergleicheManifest({
      soll: manifest(),
      istTabellen: {
        "auth.users": 72,
        "auth.identities": 72,
        "public.profiles": 72,
        "public.staff_roles": 4, // 2 aus PROD + 2 deklariert
        "public.posts": 11,
        "public.tier_assignments": 5, // nur DEV
      },
      zuschlag,
    });
    expect(e.unerwartet).toEqual([]);
    expect(e.deklariert.map((d) => d.was)).toEqual([
      "public.staff_roles",
      "public.tier_assignments",
    ]);
  });

  test("RED: eine Tabelle MIT Zuschlag, deren Zahl trotzdem nicht aufgeht, ist ein Fehler", () => {
    // Der Zuschlag wird eingerechnet, nicht als Entschuldigung verbucht.
    const e = vergleicheManifest({
      soll: manifest(),
      istTabellen: { ...volleZahlen(), "public.staff_roles": 9 },
      zuschlag,
    });
    expect(e.unerwartet).toEqual([
      { was: "public.staff_roles", ausAuszug: 2, zuschlag: 2, ist: 9 },
    ]);
  });

  test("RED: eine fehlende Tabelle fällt auf, auch wenn sie im Ist gar nicht vorkommt", () => {
    const ist = volleZahlen();
    delete ist["public.posts"];
    const e = vergleicheManifest({ soll: manifest(), istTabellen: ist, zuschlag });
    expect(e.unerwartet.map((u) => u.was)).toEqual(["public.posts"]);
    expect(e.unerwartet[0].ist).toBe(0);
  });

  test("RED: eine Tabelle, die es NUR im Ist gibt, fällt ebenfalls auf", () => {
    const e = vergleicheManifest({
      soll: manifest(),
      istTabellen: { ...volleZahlen(), "public.demo_welt": 41 },
      zuschlag,
    });
    expect(e.unerwartet.map((u) => u.was)).toEqual(["public.demo_welt"]);
  });

  function volleZahlen(): Record<string, number> {
    return {
      "auth.users": 72,
      "auth.identities": 72,
      "public.profiles": 72,
      "public.staff_roles": 4,
      "public.posts": 11,
      "public.tier_assignments": 5,
    };
  }
});
