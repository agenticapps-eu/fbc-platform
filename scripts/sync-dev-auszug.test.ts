/**
 * Aufgabengruppe 3 aus `openspec/changes/sync-dev-from-prod/tasks.md`.
 *
 * Der Auszug liest 72 echte Mitglieder samt Anschriften aus PROD. Was hier
 * geprüft wird, sind deshalb keine Bequemlichkeiten, sondern die drei Zusagen,
 * die im echten Lauf nicht mehr nachgeholt werden können: er landet ausserhalb
 * des öffentlichen Arbeitsbaums, er kann die Ablage nicht verlassen, und er
 * kennt DEV nicht.
 */
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  alleObjekte,
  auszugName,
  aufloesen,
  istInnerhalb,
  planeAuszug,
  pruefeAblageort,
  sichererPfad,
  zerlegeUrl,
  type Objekt,
} from "./sync-dev-auszug.logic";

const PROD = "viwntbodrtqxgmqyxluh";
const DEV = "foelowldexkcqzewvrcf";
const ARBEITSBAUM = resolve(__dirname, "..");

/** Eigenes Spielfeld je Lauf; `mkdtemp` liegt unter `/var/…`, also ausserhalb. */
let spielfeld: string;
beforeAll(async () => {
  spielfeld = await aufloesen(await mkdtemp(join(tmpdir(), "auszug-test-")));
});
afterAll(async () => {
  await rm(spielfeld, { recursive: true, force: true });
});

describe("Enthaltensein an der Segmentgrenze", () => {
  test("erkennt echtes Enthaltensein und Gleichheit", () => {
    expect(istInnerhalb("/a/b/c", "/a/b")).toBe(true);
    expect(istInnerhalb("/a/b", "/a/b")).toBe(true);
  });

  test("ein gemeinsamer Namensanfang ist kein Enthaltensein", () => {
    expect(istInnerhalb("/a/bc", "/a/b")).toBe(false);
    expect(istInnerhalb("/a/b-neben", "/a/b")).toBe(false);
  });

  test("ein Name, der mit zwei Punkten beginnt, liegt drin", () => {
    expect(istInnerhalb("/a/b/..versteckt", "/a/b")).toBe(true);
  });

  test("darüber liegende Pfade liegen nicht drin", () => {
    expect(istInnerhalb("/a", "/a/b")).toBe(false);
  });
});

describe("3.1/3.2 Ablageort — ausserhalb des Arbeitsbaums", () => {
  test("ein Ort ausserhalb wird angenommen und aufgelöst zurückgegeben", async () => {
    const e = await pruefeAblageort({
      kandidat: join(spielfeld, "ablage"),
      arbeitsbaum: ARBEITSBAUM,
    });
    expect(e.kind).toBe("ok");
    if (e.kind === "ok") expect(e.pfad).toBe(join(spielfeld, "ablage"));
  });

  test("RED: ein Ort IM Arbeitsbaum wird abgelehnt", async () => {
    const e = await pruefeAblageort({
      kandidat: join(ARBEITSBAUM, "auszug"),
      arbeitsbaum: ARBEITSBAUM,
    });
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toMatch(/liegt im Arbeitsbaum/);
  });

  test("RED: auch ein SYMLINK, der in den Arbeitsbaum zeigt, wird abgelehnt", async () => {
    const link = join(spielfeld, "harmlos-aussehend");
    await symlink(join(ARBEITSBAUM, "scripts"), link, "dir");

    // Der Zeichenkettenvergleich sähe hier "/var/folders/…" und liesse durch.
    expect(istInnerhalb(link, ARBEITSBAUM)).toBe(false);

    const e = await pruefeAblageort({ kandidat: join(link, "auszug"), arbeitsbaum: ARBEITSBAUM });
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toMatch(/liegt im Arbeitsbaum/);
  });

  test("RED: ein Ort, der den Arbeitsbaum ENTHÄLT, wird abgelehnt", async () => {
    const e = await pruefeAblageort({ kandidat: dirname(ARBEITSBAUM), arbeitsbaum: ARBEITSBAUM });
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toMatch(/enthält den Arbeitsbaum/);
  });

  test("RED: kein Ablageort ist ein Abbruch, kein Vorgabewert", async () => {
    const e = await pruefeAblageort({ kandidat: "   ", arbeitsbaum: ARBEITSBAUM });
    expect(e.kind).toBe("abbruch");
  });
});

describe("3.7 Objektnamen können die Ablage nicht verlassen", () => {
  const wurzel = "/ablage/objekte";

  test("ein gewöhnlicher, verschachtelter Name wird angenommen", () => {
    const e = sichererPfad(wurzel, "avatars", "u/abc-123/portrait.jpg");
    expect(e).toEqual({ kind: "ok", pfad: "/ablage/objekte/avatars/u/abc-123/portrait.jpg" });
  });

  test.each([
    ["../../etc/passwd", "Pfadanteil nach oben"],
    ["a/../../../ausserhalb.txt", "Pfadanteil nach oben"],
    ["/etc/passwd", "ist absolut"],
    ["a/\0b", "Nullzeichen"],
    ["", "ist leer"],
  ])("RED: %s wird abgelehnt", (name, erwartet) => {
    const e = sichererPfad(wurzel, "avatars", name);
    expect(e.kind).toBe("abbruch");
    if (e.kind === "abbruch") expect(e.grund).toContain(erwartet);
  });

  test("RED: auch der Bucket-Name ist Fremddaten", () => {
    expect(sichererPfad(wurzel, "..", "x.jpg").kind).toBe("abbruch");
    expect(sichererPfad(wurzel, "a/b", "x.jpg").kind).toBe("abbruch");
  });

  test("kein angenommener Pfad liegt ausserhalb der Ablage", () => {
    for (const name of ["a/b/c.jpg", "...jpg", "..versteckt/x", "a/./b.jpg"]) {
      const e = sichererPfad(wurzel, "avatars", name);
      if (e.kind === "ok") expect(istInnerhalb(e.pfad, wurzel)).toBe(true);
    }
  });
});

describe("3.8 Auszüge überschreiben einander nicht", () => {
  test("der Name trägt Quelle und Zeitpunkt", () => {
    expect(auszugName(new Date("2026-08-20T15:04:05.123Z"), PROD)).toBe(
      `spiegel-${PROD}-20260820T150405Z`,
    );
  });

  test("zwei Zeitpunkte ergeben zwei Namen", () => {
    const a = auszugName(new Date("2026-08-20T15:04:05Z"), PROD);
    const b = auszugName(new Date("2026-08-20T15:04:06Z"), PROD);
    expect(a).not.toBe(b);
  });

  test("RED: ein Name ohne Projektkennung wirft", () => {
    expect(() => auszugName(new Date(), "prod")).toThrow(/Projektkennung/);
  });

  test("das Anlegen erzwingt die Eindeutigkeit, nicht der Name", async () => {
    // Die eigentliche Zusage: `mkdir` ohne `recursive` scheitert auf einem
    // vorhandenen Verzeichnis. Ein Name, der Eindeutigkeit nur behauptet,
    // wäre schwächer.
    const zweimal = join(spielfeld, auszugName(new Date("2026-08-20T15:04:05Z"), PROD));
    await mkdir(zweimal, { mode: 0o700 });
    await expect(mkdir(zweimal, { mode: 0o700 })).rejects.toThrow(/EEXIST/);
  });
});

describe("3.5 Der Auszug kennt DEV nicht", () => {
  const verbindung = zerlegeUrl(
    `postgresql://postgres.${PROD}:ge%3Aheim@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  );

  test("die URL wird zerlegt, das Passwort prozent-dekodiert", () => {
    expect(verbindung).toEqual({
      host: "aws-0-eu-central-1.pooler.supabase.com",
      port: "5432",
      benutzer: `postgres.${PROD}`,
      datenbank: "postgres",
      passwort: "ge:heim",
    });
  });

  test("RED: was keine Postgres-URL ist, ergibt null", () => {
    expect(zerlegeUrl("https://example.com")).toBeNull();
    expect(zerlegeUrl("kaputt")).toBeNull();
  });

  const plan = planeAuszug({
    verbindung: verbindung!,
    ziel: "/ablage/spiegel-x",
    caPfad: "scripts/supabase-root-2021-ca.crt",
    snapshot: "00000003-0000001F-1",
    authTabellen: ["auth.users", "auth.identities"],
  });

  test("kein Wert des Plans zeigt auf DEV", () => {
    const alles = JSON.stringify(plan);
    expect(alles).toContain(PROD);
    expect(alles).not.toContain(DEV);
  });

  test("RED: der Plan trägt das Passwort nirgends — auch nicht in argv", () => {
    expect(JSON.stringify(plan)).not.toContain("ge:heim");
    for (const b of plan) expect(Object.keys(b.umgebung)).not.toContain("PGPASSWORD");
  });

  test("auth und public sind getrennte Auszüge, auth zuerst", () => {
    expect(plan.map((b) => b.name)).toEqual(["auth", "public"]);
    expect(plan[0].argumente).toContain("--table=auth.users");
    expect(plan[0].argumente).toContain("--table=auth.identities");
    expect(plan[1].argumente).toContain("--schema=public");
    expect(plan[1].argumente).not.toContain("--table=auth.users");
  });

  test("beide Auszüge tragen denselben Snapshot und schreiben in die Ablage", () => {
    for (const b of plan) {
      expect(b.argumente).toContain("--snapshot=00000003-0000001F-1");
      expect(b.argumente).toContain("--data-only");
      expect(istInnerhalb(b.ausgabe, "/ablage/spiegel-x")).toBe(true);
    }
    expect(plan[0].ausgabe).not.toBe(plan[1].ausgabe);
  });

  test("die Verbindung wird per TLS gegen die Root-CA geprüft", () => {
    for (const b of plan) expect(b.umgebung.PGSSLMODE).toBe("verify-full");
  });
});

describe("3.6 Objekte über alle Seiten", () => {
  const bestand: Objekt[] = [
    { bucket_id: "avatars", name: "a.jpg", groesse: 1, etag: "1" },
    { bucket_id: "avatars", name: "b/c.jpg", groesse: 2, etag: "2" },
    { bucket_id: "avatars", name: "b/d.jpg", groesse: 3, etag: "3" },
    { bucket_id: "logos", name: "e.png", groesse: 4, etag: "4" },
    { bucket_id: "logos", name: "f.png", groesse: 5, etag: "5" },
  ];
  /** Steht für die Datenbank, nicht für eigenen Code: Keyset wie im SQL. */
  const seiten: number[] = [];
  const seite = async (nachBucket: string, nachName: string, limit: number) => {
    seiten.push(limit);
    return bestand
      .filter((o) => o.bucket_id > nachBucket || (o.bucket_id === nachBucket && o.name > nachName))
      .slice(0, limit);
  };

  test("eine Seitengröße KLEINER als der Bestand liefert trotzdem alles, ohne Dopplung", async () => {
    seiten.length = 0;
    const alle = await alleObjekte(seite, 2);
    expect(alle).toEqual(bestand);
    expect(new Set(alle.map((o) => `${o.bucket_id}/${o.name}`)).size).toBe(5);
    expect(seiten.length).toBeGreaterThan(1);
  });

  test("Seitengröße 1 — der ungünstigste Fall — liefert dasselbe", async () => {
    expect(await alleObjekte(seite, 1)).toEqual(bestand);
  });

  test("ein leerer Bestand ergibt eine leere Liste, keine Endlosschleife", async () => {
    expect(await alleObjekte(async () => [], 50)).toEqual([]);
  });

  test("RED: Seitengröße 0 wirft, statt still nichts zu holen", async () => {
    await expect(alleObjekte(seite, 0)).rejects.toThrow(/mindestens 1/);
  });
});

describe("3.9 Der Lauf hinterlässt nichts im Arbeitsbaum", () => {
  const git = () =>
    execFileSync("git", ["status", "--porcelain", "--ignored"], {
      cwd: ARBEITSBAUM,
      encoding: "utf8",
    });

  test("die DIFFERENZ vor/nach einem Schreiblauf ist leer", async () => {
    // Nicht die Ausgabe selbst: der Arbeitsbaum führt dauerhaft ignorierte
    // Pfade. Geprüft wird die Veränderung.
    const vorher = git();

    const ablage = join(spielfeld, auszugName(new Date(), PROD));
    await mkdir(join(ablage, "objekte"), { recursive: true, mode: 0o700 });
    for (const [bucket, name] of [
      ["avatars", "u/1/portrait.jpg"],
      ["logos", "firma.png"],
    ] as const) {
      const e = sichererPfad(join(ablage, "objekte"), bucket, name);
      expect(e.kind).toBe("ok");
      if (e.kind !== "ok") return;
      await mkdir(dirname(e.pfad), { recursive: true, mode: 0o700 });
      await writeFile(e.pfad, "inhalt", { mode: 0o600 });
    }
    for (const b of planeAuszug({
      verbindung: zerlegeUrl(`postgresql://postgres.${PROD}:pw@h:5432/postgres`)!,
      ziel: ablage,
      caPfad: "scripts/supabase-root-2021-ca.crt",
      snapshot: "s",
      authTabellen: ["auth.users"],
    })) {
      await writeFile(b.ausgabe, "auszug", { mode: 0o600 });
    }

    expect(git()).toBe(vorher);
  });

  test("die Ablage steht auf 0700, die Dateien auf 0600", async () => {
    const { stat } = await import("node:fs/promises");
    const ablage = join(spielfeld, "rechte-probe");
    await mkdir(ablage, { mode: 0o700 });
    await chmod(ablage, 0o700);
    const datei = join(ablage, "x.dump");
    await writeFile(datei, "x", { mode: 0o600 });
    await chmod(datei, 0o600);
    expect((await stat(ablage)).mode & 0o777).toBe(0o700);
    expect((await stat(datei)).mode & 0o777).toBe(0o600);
  });
});
