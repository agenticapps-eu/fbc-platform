/**
 * Was ein OTA-Bündel ausmacht: Fassung, Chiffrat, Sitzungsschlüssel, Prüfsumme
 * (AGE-642, Phase D1).
 *
 * Hier steht ausschliesslich das Rechnen. Zippen, Hochladen und das Schreiben
 * ins Manifest tut `ota-buendel.ts`. Der Schnitt ist Absicht: jede Zahl unten
 * ist am Quelltext von `@capgo/capacitor-updater@8.51.15` gemessen, und der
 * Test daneben spielt das Gerät nach — er entschlüsselt mit dem ÖFFENTLICHEN
 * Schlüssel, so wie die App es täte.
 *
 * ══ DAS VERFAHREN, IN DER REIHENFOLGE DES GERÄTS ════════════════════════════
 * Das Gerät tut (`CapgoUpdater.java:851-856`):
 *
 *   1. Datei mit AES entschlüsseln  (Schlüssel aus `sessionKey`, RSA-geöffnet)
 *   2. SHA-256 der ENTSCHLÜSSELTEN Datei bilden
 *   3. `checksum` RSA-öffnen und mit dem Ergebnis aus 2 vergleichen
 *
 * Also gilt hier die Gegenrichtung, und die Reihenfolge ist nicht beliebig:
 * die Prüfsumme gehört dem KLARTEXT-Zip. Wer sie über das Chiffrat bildet,
 * liefert eine Zahl, die auf keinem Gerät passt — und der Fehlschlag ist dort
 * still.
 *
 * ══ RSA RÜCKWÄRTS ═══════════════════════════════════════════════════════════
 * Verschlüsselt wird mit dem PRIVATEN Schlüssel, geöffnet mit dem
 * öffentlichen. Das ist keine Verschleierung, sondern die Aussage „das kommt
 * von uns": nur wer den privaten Teil hat, kann etwas erzeugen, das der
 * öffentliche öffnet. Vertraulichkeit entsteht dabei NICHT — der öffentliche
 * Schlüssel steckt in jeder App.
 *
 * ══ WARUM AUSGERECHNET `privateEncrypt` MIT RSA_PKCS1_PADDING ═══════════════
 * Weil das Plugin genau darauf gebaut ist, und zwar wörtlich. `RSA.swift:253`
 * trägt den Kommentar
 *
 *     // For PKCS1 padding from Node.js privateEncrypt, the format is:
 *     // 0x00 || 0x01 || PS || 0x00 || actual data
 *
 * und prüft darunter auf genau dieses Blockformat (Typ 1). Node ist hier also
 * nicht eine von mehreren Möglichkeiten, sondern die Referenz, gegen die die
 * iOS-Seite geschrieben wurde. Wer das später auf PSS oder OAEP „modernisiert",
 * bricht beide Plattformen — und wieder still, weil ein falsch entpacktes
 * Padding nur zu einer nicht passenden Prüfsumme führt.
 *
 * Dieselbe Datei polstert zwei Zeilen darüber hart auf **256 Byte**
 * (`max(0, 256 - resultBytes.count)`). Das ist RSA-2048, ein zweites Mal und
 * an einer ganz anderen Stelle als `CryptoCipher.swift:74`.
 */
import { execFileSync } from "node:child_process";
import { constants, createCipheriv, createHash, privateEncrypt, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 16 Byte. AES/CBC, also ist die Länge des IV die Blockgrösse und nicht
 * wählbar (`CryptoCipher.java:151`, iOS `AES.swift`).
 */
const IV_BYTES = 16;

/**
 * 16 Byte — AES-128.
 *
 * Beide Plattformen reichen die GEMESSENE Länge an ihre Krypto-Schicht durch
 * (`new SecretKeySpec(sessionKey, 0, sessionKey.length, "AES")`;
 * `keyLength = aes128Key.count`), nehmen also auch 24 oder 32. Gewählt sind
 * trotzdem 16: es ist die Länge, die das Plugin durchgängig benennt
 * (`AES128Key`, `aes128Key`), also die Länge, die seine eigene Werkzeugkette
 * erzeugt und die damit erprobt ist. Ein längerer Schlüssel brächte hier auch
 * nichts — die Verschlüsselung trägt Echtheit, nicht Vertraulichkeit.
 */
const AES_BYTES = 16;

/** SHA-256, roh. Das Gerät hext selbst auf (`CryptoCipher.java:266`). */
const DIGEST_BYTES = 32;

/**
 * Die zwei Längen, die das Manifest zusagt. Sie folgen beide aus RSA-2048:
 * 256 Byte Chiffrat sind 512 Hex- bzw. 344 Base64-Zeichen. Ein
 * 4096-Bit-Schlüssel ergäbe 1024 bzw. 684 und wird vom Plugin abgewiesen
 * (`CryptoCipher.java:254`, `CryptoCipher.swift:74`) — hier fällt er schon auf.
 */
export const CHECKSUM_ZEICHEN = 512;
export const SESSION_KEY_ZEICHEN = 344;
/** 16 Byte IV in Base64. Dieselbe Zahl steht als Bedingung an der Spalte. */
export const IV_ZEICHEN = 24;

export interface Buendel {
  /** Was in den Bucket geht. AES-Chiffrat, kein Zip. */
  chiffrat: Buffer;
  /** `<iv>:<sessionKey>`, beides Base64. */
  sessionKey: string;
  /** RSA-Chiffrat der 32 rohen Digest-Bytes, als Kleinbuchstaben-Hex. */
  checksum: string;
}

/**
 * `<Semver aus package.json>+<kurzer SHA>`, z. B. `1.4.0+8fbc49bdeadb`.
 *
 * **Zwölf** Stellen des SHA, nicht die sieben von `git rev-parse --short`.
 * Sieben sind 28 Bit; bei tausend Auslieferungen liegt die Wahrscheinlichkeit
 * einer Kollision schon bei rund 0,2 % — und eine Kollision hiesse, dass zwei
 * verschiedene Commits dieselbe Manifest-Zeile überschreiben (Befund
 * Fremd-Review, LOW). Zwölf Stellen sind 48 Bit und kosten nichts. Die
 * Bedingung an der Spalte lässt 7 bis 40 zu.
 */
export function fassung(semver: string, sha: string): string {
  return `${semver}+${sha.slice(0, 12)}`;
}

/**
 * Der Name des Objekts im Bucket — **inhaltsadressiert**, nicht nur nach Fassung.
 *
 * ══ WARUM DER INHALT IM NAMEN STEHT ═════════════════════════════════════════
 * Der naheliegende Name wäre `<version>.bin`. Er war die erste Fassung, und ein
 * Fremd-Review hat drei Wege gezeigt, auf denen er Geräte lahmlegt — alle drei
 * beim **erneuten Lauf desselben Commits**, und der ist häufig: `deploy.yml`
 * trägt `cancel-in-progress: true`, ein Lauf kann also mitten im Schritt enden.
 *
 * Ein zweiter Lauf erzeugt ein ANDERES Chiffrat, weil der AES-Schlüssel je Lauf
 * zufällig ist. Mit festem Namen hiesse das:
 *
 *  1. Der Upload überschreibt die Datei, die Manifest-Zeile trägt aber noch die
 *     alte `checksum` und den alten `sessionKey`. Bricht der Lauf dazwischen ab,
 *     bleibt genau dieser Zustand stehen — dauerhaft. Kein Gerät kann das
 *     Bündel dann öffnen, und keines sagt warum.
 *  2. Zwei Läufe könnten ihre Uploads und Manifest-Zeilen verschränken.
 *  3. Ein Zwischenspeicher (Storage, CDN, Gerät) lieferte unter derselben URL
 *     das alte Chiffrat zu den neuen Kryptowerten aus.
 *
 * Steht der Inhalt im Namen, gibt es keinen dieser Wege: jeder Lauf schreibt
 * eine EIGENE Datei, und die Manifest-Zeile wechselt in EINEM Schritt von der
 * einen auf die andere. Beide sind in sich stimmig, egal wann ein Lauf endet.
 *
 * **Der Preis, benannt:** ein abgebrochener Lauf hinterlässt eine verwaiste
 * Datei im Bucket. Sie ist ein paar Megabyte gross, für niemanden erreichbar
 * (keine Manifest-Zeile zeigt darauf) und schadet nicht. Ein Aufräumen dafür zu
 * bauen wäre mehr Mechanik als der Fehler wert.
 */
export function objektname(version: string, chiffrat: Buffer): string {
  const inhalt = createHash("sha256").update(chiffrat).digest("hex").slice(0, 16);
  return `${version}-${inhalt}.bin`;
}

/** Die öffentliche URL. Muss auf `ota-buendel` zeigen — die Spalte prüft es. */
export function buendelUrl(supabaseUrl: string, objekt: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/ota-buendel/${objekt}`;
}

/**
 * Zippt ein Verzeichnis mit `index.html` an der Wurzel und ohne Sourcemaps.
 *
 * Steht hier und nicht im Läufer, damit ein Test das Ergebnis wirklich AUFMACHEN
 * kann (Befund Fremd-Review, MEDIUM: ein Rundlauf über einen Puffer, der kein
 * Zip ist, belegt die Krypto und nicht das Archiv).
 *
 * `zip` statt eines npm-Moduls: eine neue Abhängigkeit erschiene in jedem
 * `pnpm install` und in jedem CI-Lauf, und die Sperrdateien sind die eine
 * Stelle, an der wir uns mit den Dependabot-PRs ins Gehege kommen. `zip` liegt
 * auf `ubuntu-latest` und auf macOS. Gezippt wird AUS dem Verzeichnis heraus,
 * damit `index.html` an der Wurzel steht und nicht unter `dist/`.
 */
export function zippeVerzeichnis(verzeichnis: string): Buffer {
  const ziel = join(mkdtempSync(join(tmpdir(), "ota-")), "buendel.zip");
  execFileSync("zip", ["-r", "-q", "-X", ziel, ".", "-x", "*.map"], { cwd: verzeichnis });
  return readFileSync(ziel);
}

/**
 * Bildet aus dem Klartext-Zip alles, was das Manifest und der Bucket brauchen.
 *
 * Wirft, wenn der private Schlüssel nicht 2048 Bit hat — das ist die Prüfung,
 * die am 31.08. gefehlt hat und einen 4096-Bit-Schlüssel bis in Infisical
 * durchgehen liess. Sie steht hier und nicht nur an der Datenbank, weil ein
 * Fehlschlag im Job billiger ist als einer im Manifest.
 */
export function bildeBuendel(zip: Buffer, privatschluesselPem: string): Buendel {
  const digest = createHash("sha256").update(zip).digest();
  if (digest.length !== DIGEST_BYTES) {
    throw new Error(`SHA-256 lieferte ${digest.length} statt ${DIGEST_BYTES} Byte`);
  }

  const aesKey = randomBytes(AES_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-128-cbc", aesKey, iv);
  const chiffrat = Buffer.concat([cipher.update(zip), cipher.final()]);

  const rsa = (klartext: Buffer): Buffer =>
    privateEncrypt(
      { key: privatschluesselPem, padding: constants.RSA_PKCS1_PADDING },
      klartext,
    );

  const checksum = rsa(digest).toString("hex");
  const sessionKey = `${iv.toString("base64")}:${rsa(aesKey).toString("base64")}`;

  // Die Längen sind die Zusage, nicht eine Vermutung über sie. Ein Schlüssel
  // falscher Grösse fällt hier — mit einer Meldung, die sagt was zu tun ist —
  // statt später auf einem Gerät, das dazu schweigt. Geprüft wird jede Hälfte
  // für sich, damit die Meldung sagt, WELCHE nicht stimmt.
  const [ivTeil, schluesselTeil] = sessionKey.split(":");
  const abweichungen = [
    checksum.length !== CHECKSUM_ZEICHEN
      ? `checksum ${checksum.length} statt ${CHECKSUM_ZEICHEN}`
      : null,
    ivTeil.length !== IV_ZEICHEN ? `IV ${ivTeil.length} statt ${IV_ZEICHEN}` : null,
    schluesselTeil.length !== SESSION_KEY_ZEICHEN
      ? `sessionKey ${schluesselTeil.length} statt ${SESSION_KEY_ZEICHEN}`
      : null,
  ].filter((z): z is string => z !== null);

  if (abweichungen.length > 0) {
    throw new Error(
      `Buendel hat die falschen Laengen (${abweichungen.join(", ")}). ` +
        `Haeufigste Ursache: der private RSA-Schluessel hat nicht 2048 Bit. ` +
        `Das Plugin verlangt genau 256 Byte Chiffrat — CryptoCipher.java:254, ` +
        `CryptoCipher.swift:74.`,
    );
  }

  return { chiffrat, sessionKey, checksum };
}
