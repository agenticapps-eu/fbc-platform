/**
 * AGE-642 D1 — spielt das Gerät nach.
 *
 * Der Kern dieser Datei ist EIN Test: was `bildeBuendel` erzeugt, wird hier mit
 * dem ÖFFENTLICHEN Schlüssel geöffnet, genau in der Reihenfolge, in der das
 * Plugin es tut (`CapgoUpdater.java:851-856`). Geht das durch, ist belegt, dass
 * ein Gerät das Bündel installieren könnte — und zwar ohne Gerät.
 *
 * Ein Test, der nur Längen zählt, wäre hier wertlos: 512 Zeichen Hex sind auch
 * dann 512 Zeichen, wenn der falsche Puffer verschlüsselt wurde. Deshalb steht
 * neben jeder Längen-Zusage eine, die den Wert wirklich benutzt.
 */
import { execFileSync } from "node:child_process";
import { constants, createDecipheriv, createHash, publicDecrypt } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHECKSUM_ZEICHEN,
  IV_ZEICHEN,
  SESSION_KEY_ZEICHEN,
  bildeBuendel,
  buendelUrl,
  fassung,
  objektname,
  zippeVerzeichnis,
} from "./ota-buendel.logic";

/** Ein Wegwerf-Paar je Länge. PKCS#1 (`-traditional`), wie das Plugin es fordert. */
function schluesselpaar(bits: number): { privat: string; oeffentlich: string } {
  const privat = execFileSync("openssl", ["genrsa", "-traditional", String(bits)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const oeffentlich = execFileSync("openssl", ["rsa", "-RSAPublicKey_out"], {
    input: privat,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  });
  return { privat, oeffentlich };
}

const PAAR = schluesselpaar(2048);

/**
 * Ein `dist/` im Kleinen: die Datei, auf die es ankommt, eine daneben, und eine
 * Sourcemap, die NICHT mitkommen darf.
 */
function baueDist(): string {
  const dir = mkdtempSync(join(tmpdir(), "ota-dist-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>t</title>");
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
  writeFileSync(join(dir, "assets", "app.js.map"), '{"version":3}');
  return dir;
}

/**
 * Ein ECHTES Zip, nicht ein Puffer, der mit `PK` anfaengt. Der Unterschied ist
 * der Befund aus dem Fremd-Review: ein Rundlauf ueber irgendeinen Puffer belegt
 * die Krypto und sagt NICHTS darueber, ob am Ende ein Archiv herauskommt, das
 * ein Geraet auspacken kann.
 */
const DIST = baueDist();
const ZIP = zippeVerzeichnis(DIST);

/** Listet die Eintraege eines Zips. Ueber eine Datei — `unzip` kann kein stdin. */
function eintraegeVon(zip: Buffer): string[] {
  const datei = join(mkdtempSync(join(tmpdir(), "ota-auf-")), "b.zip");
  writeFileSync(datei, zip);
  return execFileSync("unzip", ["-Z1", datei], { encoding: "utf8" })
    .split("\n")
    .filter((z) => z !== "");
}

function oeffne(chiffrat: Buffer): Buffer {
  return publicDecrypt(
    { key: PAAR.oeffentlich, padding: constants.RSA_PKCS1_PADDING },
    chiffrat,
  );
}

describe("bildeBuendel — der Rundlauf, den das Gerät geht", () => {
  it("ein Gerät kann das Bündel entschlüsseln und die Prüfsumme bestätigen", () => {
    const b = bildeBuendel(ZIP, PAAR.privat);

    // Schritt 1 des Geräts: sessionKey aufteilen, AES-Schlüssel RSA-öffnen.
    const [ivB64, schluesselB64] = b.sessionKey.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const aesKey = oeffne(Buffer.from(schluesselB64, "base64"));
    expect(iv).toHaveLength(16);
    expect(aesKey).toHaveLength(16);

    // Schritt 1b: die Datei entschlüsseln. Muss das Zip zurückgeben.
    const decipher = createDecipheriv("aes-128-cbc", aesKey, iv);
    const klartext = Buffer.concat([decipher.update(b.chiffrat), decipher.final()]);
    expect(klartext.equals(ZIP)).toBe(true);

    // Schritt 2 + 3: SHA-256 des ENTSCHLÜSSELTEN Zips gegen die geöffnete
    // Prüfsumme. Das Gerät vergleicht Kleinbuchstaben-Hex.
    const gerechnet = createHash("sha256").update(klartext).digest("hex");
    expect(oeffne(Buffer.from(b.checksum, "hex")).toString("hex")).toBe(gerechnet);

    // Und dann das, was die Krypto allein nicht belegt: das Entschluesselte ist
    // ein Archiv, das sich auspacken laesst, `index.html` liegt an der Wurzel,
    // und keine Sourcemap ist mitgekommen.
    const eintraege = eintraegeVon(klartext);
    expect(eintraege).toContain("index.html");
    expect(eintraege.filter((z) => z.endsWith(".map"))).toHaveLength(0);
    expect(eintraege).toContain("assets/app.js");
  });

  it("die Prüfsumme gilt dem KLARTEXT, nicht dem Chiffrat", () => {
    const b = bildeBuendel(ZIP, PAAR.privat);
    const geoeffnet = oeffne(Buffer.from(b.checksum, "hex")).toString("hex");

    expect(geoeffnet).toBe(createHash("sha256").update(ZIP).digest("hex"));
    // Die Gegenprobe: über das Chiffrat gerechnet käme etwas anderes heraus.
    // Ohne sie wäre die Zusage darüber auch dann grün, wenn beide gleich wären.
    expect(geoeffnet).not.toBe(createHash("sha256").update(b.chiffrat).digest("hex"));
  });

  it("jeder Lauf nimmt einen neuen Schlüssel UND ein neues IV", () => {
    // Beide Hälften einzeln. Ein Vergleich nur über den ganzen `sessionKey`
    // wäre auch dann grün, wenn nur eine der beiden erneuert würde (Befund
    // Fremd-Review, LOW).
    //
    // Dass der Schlüssel-Vergleich trägt, liegt am Padding: PKCS#1 Typ 1 ist
    // DETERMINISTISCH (Füllbytes sind 0xFF). Zwei verschiedene Chiffrate
    // bedeuten hier also zwei verschiedene AES-Schlüssel — bei einem
    // zufälligen Padding wäre dieser Schluss falsch.
    const a = bildeBuendel(ZIP, PAAR.privat);
    const c = bildeBuendel(ZIP, PAAR.privat);
    const [ivA, keyA] = a.sessionKey.split(":");
    const [ivC, keyC] = c.sessionKey.split(":");
    expect(ivA).not.toBe(ivC);
    expect(keyA).not.toBe(keyC);
    expect(a.chiffrat.equals(c.chiffrat)).toBe(false);
  });

  it("hält die drei Längen ein, die das Manifest zusagt", () => {
    const b = bildeBuendel(ZIP, PAAR.privat);
    const [ivB64, schluesselB64] = b.sessionKey.split(":");
    expect(b.checksum).toHaveLength(CHECKSUM_ZEICHEN);
    expect(ivB64).toHaveLength(IV_ZEICHEN);
    expect(schluesselB64).toHaveLength(SESSION_KEY_ZEICHEN);
    expect(b.checksum).toMatch(/^[0-9a-f]+$/);
  });

  it("weist einen 4096-Bit-Schlüssel ab, statt ihn ins Manifest zu lassen", () => {
    // Der Fall, der am 31.08. bis in Infisical durchkam. Auf dem Gerät wäre er
    // still gescheitert; hier fällt der Job.
    const zuGross = schluesselpaar(4096);
    expect(() => bildeBuendel(ZIP, zuGross.privat)).toThrow(/2048|256 Byte/);
  });
});

describe("Fassung, Objektname und URL", () => {
  it("hängt zwölf Stellen des SHA an die Semver", () => {
    expect(fassung("1.4.0", "8fbc49bdeadbeefcafe")).toBe("1.4.0+8fbc49bdeadb");
  });

  it("kommt mit einem bereits gekürzten SHA zurecht", () => {
    expect(fassung("0.0.0", "8fbc49b")).toBe("0.0.0+8fbc49b");
  });

  it("der Objektname trägt den INHALT, nicht nur die Fassung", () => {
    // Das ist die Zusage, die drei Befunde des Fremd-Reviews erledigt: ein
    // zweiter Lauf desselben Commits überschreibt keine liegende Datei, weil er
    // ein anderes Chiffrat erzeugt und damit einen anderen Namen bekommt.
    const eins = objektname("0.0.0+aaaaaaaaaaaa", Buffer.from("chiffrat eins"));
    const zwei = objektname("0.0.0+aaaaaaaaaaaa", Buffer.from("chiffrat zwei"));
    expect(eins).not.toBe(zwei);
    expect(eins.startsWith("0.0.0+aaaaaaaaaaaa-")).toBe(true);
    expect(eins.endsWith(".bin")).toBe(true);
  });

  it("derselbe Inhalt ergibt denselben Namen — sonst wäre upsert sinnlos", () => {
    const a = objektname("0.0.0+aaaaaaaaaaaa", Buffer.from("gleich"));
    const b = objektname("0.0.0+aaaaaaaaaaaa", Buffer.from("gleich"));
    expect(a).toBe(b);
  });

  it("die URL zeigt auf den Bucket ota-buendel", () => {
    expect(buendelUrl("https://abc.supabase.co", "x.bin")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/ota-buendel/x.bin",
    );
  });

  it("ein Schrägstrich am Ende der Projekt-URL erzeugt keinen doppelten", () => {
    expect(buendelUrl("https://abc.supabase.co/", "x.bin")).not.toContain("//storage");
  });
});

describe("zippeVerzeichnis", () => {
  it("legt index.html an die Wurzel und lässt Sourcemaps draussen", () => {
    // Ueber eine Datei, nicht ueber stdin: `unzip -Z1 -` kennt kein stdin und
    // gibt statt eines Fehlers seine Hilfe aus — der Test waere dann gruen oder
    // rot aus dem falschen Grund.
    expect(eintraegeVon(ZIP)).toEqual(
      expect.arrayContaining(["index.html", "assets/app.js"]),
    );
    expect(eintraegeVon(ZIP).filter((z) => z.endsWith(".map"))).toHaveLength(0);
  });
});
