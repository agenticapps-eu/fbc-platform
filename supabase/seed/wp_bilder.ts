/**
 * Die Bildstrecke des WordPress-Imports (AGE-534, Gruppe 6).
 *
 * Ein eigener, für sich wiederholbarer Abschnitt: er holt die Bilder von der
 * alten Seite in eine Zwischenablage ausserhalb des Arbeitsbaums. Zwei Gründe,
 * beide aus dem Plan-Review — Netzwerkarbeit gegen einen fremden Server darf
 * einen Datenimport nicht in einen Halb-Zustand bringen, und die Zwischenablage
 * ist die einzige Gegenmassnahme, die noch wirkt, wenn die alte Seite
 * abgeschaltet ist.
 *
 * ── ES SIND ZWEI BILDER ─────────────────────────────────────────────────────
 * `profile_photo` ist der Avatar, `cover_photo` das Headerbild der
 * Profilansicht. Die Mengen sind NICHT deckungsgleich (gemessen 15.08.: 57 und
 * 53 von 70), ein fehlendes Headerbild darf das Profilbild also nicht
 * mitnehmen. Entschieden am 15.08. von Donald, nachdem der erste Entwurf dieser
 * Gruppe nur den Avatar kannte.
 *
 * ── DER WERT AUS DER QUELLE TRÄGT NUR DIE ENDUNG ────────────────────────────
 * Über die echten 70 Datensätze hat jede der beiden Spalten genau DREI
 * verschiedene Werte, alle 15–18 Zeichen, keiner mit Pfad oder `http`. Der Pfad
 * entsteht aus `source_user_id`. Mit HEAD-Anfragen gegen drei Kennungen belegt
 * (15.08.): beide Bildarten antworten mit 200 und dem erwarteten Bildtyp.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import sharp from "sharp";

/**
 * Die alte Seite. Sie steht hier und nicht in der Umgebung: sie ist keine
 * Zugangsinformation, sondern ein Teil der Aufgabenstellung — und ein Tippfehler
 * darin fiele in einer Umgebungsvariablen erst beim Lauf auf.
 */
export const BILDQUELLE = "https://fairbusinessworld.de";

/** Der Ordner, unter dem Ultimate Member die Dateien je Konto ablegt. */
const UPLOADS = "wp-content/uploads/ultimatemember";

export type Bildart = "profil" | "cover";

export type Bildauftrag = {
  kennung: string;
  art: Bildart;
  /** Der bereinigte Dateiname — ohne Grössensuffix, mit der Endung der Quelle. */
  datei: string;
  url: string;
  /** Wohin in der Zwischenablage; ausserhalb des Arbeitsbaums. */
  ablage: string;
};

/** Die Spalte, aus der die Kennung und damit die Bild-URL entsteht. */
const KENNUNGSSPALTE = "source_user_id";

/** Die beiden Quellspalten und die Bildart, die sie tragen. */
const SPALTEN: ReadonlyArray<readonly [Bildart, string]> = [
  ["profil", "profile_photo"],
  ["cover", "cover_photo"],
];

/**
 * Genau die Spalten, ohne die `bildauftraege` nichts findet — hier abgeleitet
 * und nicht danebengeschrieben, damit die Prüfung nicht von der Verwendung
 * abdriften kann.
 *
 * WARUM NICHT `pruefeKopfzeile` (Befund MEDIUM, codex, 16.08.). Die prüft alle
 * 28 Quellfelder. Der Bildabruf braucht drei davon, läuft für sich und ist der
 * zeitkritische Teil: fällt die alte Seite ab, sind die Bilder weg. Ihn wegen
 * einer fehlenden `Telefonnummer` anzuhalten, verlöre genau das, was er retten
 * soll.
 */
export const BILDSPALTEN: readonly string[] = [KENNUNGSSPALTE, ...SPALTEN.map(([, s]) => s)];

/**
 * Welche der drei Spalten fehlen. Leer heisst: der Abruf kann etwas finden.
 *
 * Ohne diese Prüfung meldete ein umbenannter Export erfolgreich „0 Bilder" —
 * mit Ausgang 0, also wie ein geglückter Lauf. Nach Abschaltung der alten Seite
 * ist dieser Irrtum nicht mehr behebbar.
 */
export function fehlendeBildspalten(spalten: readonly string[]): string[] {
  const vorhanden = new Set(spalten.map((s) => s.trim()));
  return BILDSPALTEN.filter((s) => !vorhanden.has(s));
}

/**
 * Die Endungen, die die Quelle führt (gemessen: jpg, png, jpeg). Eine feste
 * Liste und nicht „alles, was nach Endung aussieht": der Wert kommt aus einer
 * fremden Datei und wird zu einem Dateinamen auf dieser Platte.
 */
const ENDUNGEN = new Set([".jpg", ".jpeg", ".png"]);

/** Eine Kennung ist ein Bezeichner, kein Pfad — sie wird ein Verzeichnisname. */
const KENNUNG_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Schreibt unter einem Zwischennamen und benennt erst danach um (Befund MEDIUM,
 * codex, 16.08.).
 *
 * Beide Schritte dieses Abschnitts prüfen später nur, OB die Zieldatei da ist —
 * `existsSync` in `holeBild` und in `wandleBild`. Wird der Prozess mitten im
 * Schreiben abgebrochen, liegt unter dem Endnamen eine halbe Datei, und beide
 * Prüfungen halten sie für fertig. Sie ginge dann in den Bucket, und weil der
 * Objektname fest gewählt ist, wäre sie dort nicht mehr zu ersetzen.
 *
 * `renameSync` ist innerhalb desselben Dateisystems unteilbar — und
 * Zwischenname und Ziel liegen im selben Verzeichnis, also immer auf demselben.
 */
/** Lässt sich die Datei als Bild lesen und hat sie Maße? Sonst ist sie halb. */
async function istLesbaresBild(pfad: string): Promise<boolean> {
  try {
    const { width, height } = await sharp(pfad).metadata();
    return Boolean(width && height);
  } catch {
    return false;
  }
}

function schreibeFertig(ziel: string, inhalt: Buffer): void {
  const zwischen = `${ziel}.halb`;
  writeFileSync(zwischen, inhalt);
  renameSync(zwischen, ziel);
}

/**
 * Schneidet das Grössensuffix ab, das WordPress an seine Ableitungen hängt
 * (`profile_photo-190x190.jpg`). Die Datei OHNE Suffix ist das Original; die
 * 190×190-Fassung verschenkt 96 % der Bildinformation.
 *
 * Die Quelle nennt heute den nackten Namen, der Schnitt greift also nie — er
 * steht hier für den neu gezogenen Export: träfe er den Ableitungsnamen, würde
 * die Verkleinerung importiert, ohne dass irgendetwas auffiele.
 */
function ohneGroessensuffix(datei: string): string {
  const endung = extname(datei);
  return `${basename(datei, endung).replace(/-\d+x\d+$/, "")}${endung}`;
}

/**
 * Was zu einem Datensatz zu holen ist — keines, eines oder beide Bilder. Rein:
 * kein Netz, keine Datei, kein Zugriff.
 *
 * ── WARUM HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
 * Der Dateiname stammt aus der Quelldatei und geht in ZWEI Richtungen: in eine
 * URL und in einen Pfad auf dieser Platte. Ein `../` darin schriebe ausserhalb
 * der Zwischenablage; eine unbekannte Endung holte eine Datei, die kein Bild
 * ist. Beides ist mit dem heutigen Export unmöglich (gemessen: drei Werte, kein
 * Pfad) — aber die Quelle wird vor dem Go-Live neu gezogen, und dann prüft das
 * hier, was niemand mehr nachmisst.
 *
 * Ein abgewiesener Wert ergibt KEINEN Auftrag und ist damit ein fehlendes Bild
 * wie jedes andere: der Datensatz läuft weiter, der Bericht nennt es (6.4).
 */
export function bildauftraege(input: {
  row: Record<string, string>;
  basis: string;
  zwischenablage: string;
}): Bildauftrag[] {
  const kennung = (input.row[KENNUNGSSPALTE] ?? "").trim();
  if (!KENNUNG_PATTERN.test(kennung)) return [];

  const auftraege: Bildauftrag[] = [];

  for (const [art, spalte] of SPALTEN) {
    const roh = (input.row[spalte] ?? "").trim();
    // KEIN eigener Zweig für den leeren Wert: die Endungsprüfung unten weist ihn
    // ohnehin ab (`extname("")` ist `""`). Die Mutations-Gegenprobe hat ihn als
    // gleichwertig ausgewiesen — dritter toter Zweig dieser Art in diesem
    // Change, und wie die beiden anderen ersatzlos weg.
    //
    // `basename` schneidet jeden Pfadanteil ab. Verglichen wird trotzdem gegen
    // den Rohwert: ein Name, der einen Pfad TRUG, ist nicht der Name, den die
    // alte Seite führt — ihn stillschweigend zurechtzustutzen hiesse, eine
    // falsche URL anzufragen und den Befund zu verschlucken.
    if (basename(roh) !== roh) continue;
    if (!ENDUNGEN.has(extname(roh).toLowerCase())) continue;

    const datei = ohneGroessensuffix(roh);
    auftraege.push({
      kennung,
      art,
      datei,
      url: `${input.basis}/${UPLOADS}/${kennung}/${datei}`,
      ablage: join(input.zwischenablage, kennung, datei),
    });
  }

  return auftraege;
}

/**
 * Bildarten, für die die Quelle einen Wert FÜHRT, den `bildauftraege` aber
 * verworfen hat — Pfadanteil, unbekannte Endung, unbrauchbare Kennung.
 *
 * Ohne diese Funktion verschwindet ein solcher Wert spurlos (Befund HIGH-2 aus
 * dem Code-Review): die Prüfung weist ab, indem sie KEINEN Auftrag erzeugt, und
 * ohne Auftrag gibt es keinen Befund. Bei einem vor dem Go-Live neu gezogenen
 * Export, der die Bilder anders benennt, fiele damit der ganze Abschnitt
 * „Bilder" aus dem Bericht — kein Zähler, keine Null, keine Tabelle. Der Lauf
 * sähe normal aus, und 70 Profile hätten kein Bild. Genau das Szenario, für das
 * die Prüfung überhaupt geschrieben wurde.
 *
 * Ein LEERER Wert ist kein Befund: 13 der 70 Mitglieder führen kein Profilbild,
 * das ist der Normalfall und keine Auffälligkeit.
 */
export function verworfeneBildwerte(input: {
  row: Record<string, string>;
  auftraege: readonly Bildauftrag[];
}): Bildart[] {
  const erzeugt = new Set(input.auftraege.map((a) => a.art));

  return SPALTEN.filter(
    ([art, spalte]) => (input.row[spalte] ?? "").trim() !== "" && !erzeugt.has(art),
  ).map(([art]) => art);
}

/** Wie ein Auftrag ausgegangen ist. `fehlt` beendet nie einen Lauf (6.4). */
export type Holergebnis = {
  auftrag: Bildauftrag;
  stand: "geholt" | "vorhanden" | "fehlt";
  grund?: string;
};

/** Nur echte Bildtypen. Eine Fehlerseite mit Status 200 ist kein Bild. */
const BILDTYPEN = ["image/jpeg", "image/png", "image/webp"];

/**
 * Holt ein Bild in die Zwischenablage. Der einzige Ort in dieser Datei, der
 * wirkt — Netz und Platte.
 *
 * DREI DINGE, DIE EIN LAUF NICHT BEENDEN DÜRFEN: ein fehlendes Bild (404), eine
 * Antwort, die kein Bild ist, und ein Netzfehler. Alle drei ergeben einen
 * Befund; 70 Datensätze an einem 404 scheitern zu lassen, hiesse, dass ein
 * einziges gelöschtes Bild die ganze Übernahme aufhält.
 *
 * WAS SCHON DA IST, WIRD NICHT NOCH EINMAL GEHOLT. Der Abschnitt ist
 * wiederholbar, und die alte Seite ein zweites Mal um 140 Dateien zu bitten,
 * wäre nicht nur unnötig — der zweite Lauf darf auch nicht an dem scheitern, was
 * der erste angelegt hat.
 *
 * `fetch` kommt als Parameter herein, damit die drei Fälle prüfbar sind, ohne
 * einen fremden Server dafür zu behelligen. Es ist die Plattformfunktion, nicht
 * eigener Code — hier wird nichts gegen einen Nachbau geprüft.
 */
export async function holeBild(
  auftrag: Bildauftrag,
  hole: (url: string) => Promise<Response> = (url) => fetch(url, { redirect: "follow" }),
): Promise<Holergebnis> {
  if (existsSync(auftrag.ablage)) return { auftrag, stand: "vorhanden" };

  let antwort: Response;
  try {
    antwort = await hole(auftrag.url);
  } catch (e) {
    return { auftrag, stand: "fehlt", grund: `Netzfehler: ${(e as Error).message}` };
  }

  if (!antwort.ok) {
    return { auftrag, stand: "fehlt", grund: `Antwort ${antwort.status}` };
  }

  const typ = (antwort.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!BILDTYPEN.includes(typ)) {
    return { auftrag, stand: "fehlt", grund: `Kein Bild, sondern "${typ}"` };
  }

  mkdirSync(dirname(auftrag.ablage), { recursive: true });
  schreibeFertig(auftrag.ablage, Buffer.from(await antwort.arrayBuffer()));

  return { auftrag, stand: "geholt" };
}

/**
 * Die Obergrenzen der langen Kante, bestätigt von Donald am 15.08.
 *
 * Gemessen an den 110 geholten Dateien: Profilbilder reichen von 1 px bis
 * 1000 px, Headerbilder von 762 px bis 4032 px. Verkleinert wird deshalb nur
 * nach unten — `withoutEnlargement`. Ein Profilbild mit 195 px auf 512 px
 * hochzurechnen, erfände Bildinformation und sähe im Profil schlechter aus als
 * das kleine Original.
 */
export const KANTE = { avatar: 512, cover: 1600 } as const;

/**
 * Unterhalb dieser Kantenlänge ist es kein Bild mehr, sondern ein Rest. Eines
 * der 57 Profilbilder ist 1 × 1 Pixel.
 *
 * Die 32 sind nicht gegriffen, sondern an der Lücke in den Daten gewählt: die
 * gemessene Verteilung springt von 1 px auf 190 px. Dazwischen liegt nichts,
 * was diese Schwelle fälschlich träfe — sie trennt den Defekt vom kleinsten
 * echten Bild und nicht zwei echte Bilder voneinander.
 */
const MINDESTKANTE = 32;

export type Wandlung = {
  stand: "gewandelt" | "vorhanden" | "untauglich";
  grund?: string;
  /** Die Kantenlänge des Ergebnisses — für den Bericht. */
  kante?: number;
};

/**
 * Verkleinert ein geholtes Bild und schreibt es als WebP neben das Original.
 * Der `covers`-Bucket lässt ausschliesslich `image/webp` zu; für den Avatar ist
 * es dieselbe Wandlung, nur mit einer anderen Obergrenze.
 *
 * Unlesbar ist ein Befund, kein Abbruch: dieselbe Regel wie beim Holen — ein
 * einziges kaputtes Bild darf 70 Menschen nicht aufhalten.
 */
export async function wandleBild(input: {
  quelle: string;
  ziel: string;
  maxKante: number;
}): Promise<Wandlung> {
  // Vorhandensein allein genügt nicht. Die Zwischenablage von vor dem 16.08.
  // entstand ohne Zwischennamen, kann also halbe Dateien tragen — und die sind
  // genau die, die man nicht bemerkt: `existsSync` sagt ja, der Upload geht
  // durch, und im Profil steht ein abgeschnittenes Bild. Ist die Datei
  // unlesbar, wird sie neu gewandelt statt gemeldet: die Quelle liegt daneben,
  // der Fall heilt sich also von selbst.
  if (existsSync(input.ziel) && (await istLesbaresBild(input.ziel))) {
    return { stand: "vorhanden" };
  }

  try {
    const bild = sharp(input.quelle);
    const { width, height } = await bild.metadata();

    if (!width || !height || width < MINDESTKANTE || height < MINDESTKANTE) {
      return {
        stand: "untauglich",
        grund: `Nur ${width ?? "?"}×${height ?? "?"} Pixel — das ist kein Bild mehr.`,
      };
    }

    mkdirSync(dirname(input.ziel), { recursive: true });
    // `toFile` gibt die Maße des Ergebnisses zurück — ein zweiter Durchgang
    // durch `sharp`, nur um sie zu erfahren, wandelte jedes Bild doppelt.
    //
    // Geschrieben wird unter einem Zwischennamen und erst danach umbenannt
    // (Befund MEDIUM, codex, 16.08.): ein Abbruch mitten in `toFile` hinterliesse
    // sonst eine halbe `.webp`, die beim nächsten Lauf als „vorhanden" gilt,
    // hochgeladen wird und wegen des festen Objektnamens nicht mehr zu
    // ersetzen ist.
    const zwischen = `${input.ziel}.halb`;
    const info = await bild
      .resize({
        width: input.maxKante,
        height: input.maxKante,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp()
      .toFile(zwischen);
    renameSync(zwischen, input.ziel);

    return { stand: "gewandelt", kante: Math.max(info.width, info.height) };
  } catch (e) {
    return { stand: "untauglich", grund: `Nicht lesbar: ${(e as Error).message}` };
  }
}

// ── Ablegen im Bucket (Aufgabe 6.3) ─────────────────────────────────────────

/** Wo die gewandelte Fassung neben dem Original liegt. */
export function webpAblage(ablage: string): string {
  return `${ablage.replace(/\.[^.]+$/, "")}.webp`;
}

export const BUCKET: Record<Bildart, "avatars" | "covers"> = {
  profil: "avatars",
  cover: "covers",
};

/**
 * Der Name des Objekts im Bucket — FEST von diesem Import gewählt und NICHT aus
 * dem Dateinamen der Quelle abgeleitet.
 *
 * Darauf steht und fällt die Wiederholbarkeit: das Objekt selbst ist der Merker,
 * dass dieser Import das Bild schon gelegt hat — so wie
 * `profile_legacy.legacy_source_id` es für den Datensatz ist. Ein abgeleiteter
 * Name bände diesen Merker an einen fremden Dateinamen; bringt der vor dem
 * Go-Live neu gezogene Export das Bild unter anderem Namen, legte der zweite
 * Lauf ein ZWEITES Objekt an und überschriebe die URL.
 *
 * Der Editor legt daneben nach `<uid>/<zeitstempel>.webp` ab
 * (`src/lib/profile.ts`) — die beiden Namensräume kreuzen sich nicht.
 */
export const OBJEKTNAME: Record<Bildart, string> = {
  profil: "import-avatar.webp",
  cover: "import-cover.webp",
};

/** Die Spalte, in die die öffentliche URL gehört. */
export const URLSPALTE: Record<Bildart, "avatar_url" | "cover_url"> = {
  profil: "avatar_url",
  cover: "cover_url",
};

/**
 * `vorhanden` trägt die URL MIT, und das ist kein Beiwerk (Befund HIGH-1 aus
 * dem Code-Review).
 *
 * Kippt die Datensatz-Transaktion NACH einem gelungenen Upload — Constraint,
 * Verbindungsabbruch, Strg-C —, liegt das Objekt und die Spalte ist leer. Gäbe
 * `vorhanden` keine URL heraus, schriebe der nächste Lauf den Datensatz sauber
 * und das Bild wäre DAUERHAFT weg, gezählt als „schon vorhanden, übersprungen".
 * Es war der einzige Pfad dieses Abschnitts, der nichts meldet.
 *
 * Der Grund dahinter: das Objekt beweist, dass HOCHGELADEN wurde, nicht dass
 * GESCHRIEBEN wurde. Zweimal schreiben kann daraus nichts — der SQL-Riegel
 * `is null` lässt das UPDATE null Zeilen treffen, wo schon etwas steht.
 */
export type Hochladeergebnis =
  // PFAD, nicht URL (AGE-580). Die absolute URL wird weiter gebraucht — für
  // den HEAD-Check unten — aber nicht mehr gespeichert: sie trüge die
  // Projektkennung in die Spalte, und unter einer neuen zeigte sie ins Leere.
  | { stand: "hochgeladen"; pfad: string }
  | { stand: "vorhanden"; pfad: string }
  | { stand: "fehlt"; grund: string };

/**
 * Legt die gewandelte Fassung im Bucket ab und gibt die öffentliche URL zurück.
 *
 * ── DER ZWEITE LAUF DARF NICHT AN SICH SELBST SCHEITERN ─────────────────────
 * Ohne `x-upsert` weist der Storage-Dienst ein vorhandenes Objekt ab — genau
 * die Semantik, die 6.3 verlangt: übersprungen und berichtet, nicht ersetzt.
 *
 * ABER: er antwortet darauf mit **HTTP 400**, und erst im Rumpf steht
 * `{"statusCode":"409","error":"Duplicate"}` (am lokalen Stack gemessen,
 * 15.08.). Ein Vergleich gegen `status === 409` hielte „schon vorhanden" für
 * einen Fehler und meldete jeden Datensatz des zweiten Laufs als gescheitert.
 * Der Grund kommt deshalb aus dem RUMPF; gegen 409 wird zusätzlich geprüft,
 * weil die Storage-Fassung lokal und in DEV/PROD nicht dieselbe sein muss.
 *
 * ── WAS DEN LAUF NICHT BEENDEN DARF (6.4) ───────────────────────────────────
 * Eine fehlende gewandelte Datei (Kennung 326 ist 1×1 px und hat keine), ein
 * abgewiesener Upload und ein Netzfehler ergeben je einen Befund. Das Mitglied
 * wird trotzdem angelegt — ein fehlendes Bild hält 70 Menschen nicht auf.
 *
 * Der Grund trägt NUR Status und Fehlerwort, nie den Rumpftext: der zitiert den
 * Objektpfad und damit die Kennung des Kontos, und er landet in Bericht UND
 * Konsole (4.7).
 */
export async function ladeBildHoch(
  input: { datei: string; art: Bildart; uid: string; basis: string; schluessel: string },
  hole: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<Hochladeergebnis> {
  // Die Datei wird VOR dem ersten Netzaufruf gelesen. Stand sie im `try` um den
  // POST, käme ein Rechte- oder Lesefehler als „Netzfehler" heraus — und der
  // Bericht riete dann „ein weiterer Lauf klärt es", was bei EACCES auf der
  // Zwischenablage nie stimmt.
  let inhalt: Buffer;
  try {
    inhalt = readFileSync(input.datei);
  } catch (e) {
    const f = e as { code?: string };
    return {
      stand: "fehlt",
      grund:
        f.code === "ENOENT"
          ? "Keine gewandelte Fassung in der Zwischenablage"
          : `Zwischenablage nicht lesbar (${f.code ?? "unbekannt"})`,
    };
  }

  const bucket = BUCKET[input.art];
  const pfad = `${input.uid}/${OBJEKTNAME[input.art]}`;
  const oeffentlich = `${input.basis}/storage/v1/object/public/${bucket}/${pfad}`;

  // ERST FRAGEN, DANN SENDEN — und das ist keine Sparsamkeit, sondern der Fix
  // für einen gemessenen Fehler (15.08., lokaler Stack): schickt man den vollen
  // Rumpf und wird mit `400 Duplicate` abgewiesen, BEVOR der Dienst ihn
  // ausgelesen hat, bleibt die Verbindung mit ungelesenem Rumpf zurück. Über die
  // 110 Anfragen eines Wiederholungslaufs hingen so VIER reproduzierbar je 60
  // Sekunden und endeten in Kongs „The upstream server is timing out" — obwohl
  // ihr Objekt längst lag. Einzeln angefragt antwortete jede in 5 ms.
  //
  // Die Frage ist der schnelle Weg, nicht die Instanz: scheitert sie, entscheidet
  // weiter unten der POST, der ein vorhandenes Objekt ohnehin abweist.
  // Beide Aufrufe mit Zeitgrenze, aus demselben Grund wie in `legeKontoAn` —
  // und hier ist der Hänger sogar BELEGT: ohne sie hält ein einziger hängender
  // Aufruf einen Lauf über 70 Datensätze unbegrenzt an, ohne eine Zeile Ausgabe.
  try {
    const da = await hole(oeffentlich, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    if (da.ok) return { stand: "vorhanden", pfad };
  } catch {
    /* der Upload entscheidet */
  }

  let antwort: Response;
  try {
    antwort = await hole(`${input.basis}/storage/v1/object/${bucket}/${pfad}`, {
      method: "POST",
      // KEIN `x-upsert`. Sein Fehlen IST die Zusicherung aus 6.3 — vorhandenes
      // Objekt wird übersprungen, nicht ersetzt.
      headers: {
        Authorization: `Bearer ${input.schluessel}`,
        "Content-Type": "image/webp",
      },
      body: new Uint8Array(inhalt),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    const f = e as Error;
    return {
      stand: "fehlt",
      grund: `Netzfehler: ${f.name}${f.name === "TimeoutError" ? "" : ` (${(e as { code?: string }).code ?? "—"})`}`,
    };
  }

  if (antwort.ok) return { stand: "hochgeladen", pfad };

  // Der Rumpf entscheidet, nicht der Status — s. oben.
  const rumpf = (await antwort.json().catch(() => ({}))) as { error?: string };
  if (rumpf.error === "Duplicate" || antwort.status === 409) {
    return { stand: "vorhanden", pfad };
  }

  return {
    stand: "fehlt",
    grund: `Antwort ${antwort.status}${rumpf.error ? ` (${rumpf.error})` : ""}`,
  };
}
