/**
 * Aufgabengruppe 3 des Spiegels DEV ← PROD (AGE-576): Auszug, Manifest, Ablage.
 *
 * Reine Funktionen plus die drei, die den Pfad wirklich auflösen müssen. Sie
 * stehen getrennt vom Werkzeug, weil sich hier die Zusagen messen lassen, die
 * sonst erst im echten Lauf fielen — und dieser Lauf liest 72 echte Mitglieder
 * mitsamt Anschriften aus PROD.
 *
 * VIER SÄTZE, DIE DIE FORM ERKLÄREN.
 *
 * 1. **Der Ablageort wird aufgelöst, nicht verglichen.** Ein Zeichenkettentest
 *    gegen den Arbeitsbaum geht an einem Symlink vorbei, und auf APFS
 *    zusätzlich an der Groß-/Kleinschreibung: `/users/donald/…` und
 *    `/Users/donald/…` sind derselbe Ort, aber nicht dieselbe Zeichenkette.
 *    `realpath` beseitigt beides in einem Schritt — deshalb wird jeder
 *    Vergleich erst nach `aufloesen()` geführt.
 *
 * 2. **Der Plan trägt kein Geheimnis.** Das Passwort geht über `PGPASSWORD`
 *    zum Prozess, nie über `argv`, wo es in `ps` stünde. Der Nebeneffekt ist
 *    die Zusage aus 3.5: weil der Plan vollständig und geheimnisfrei ist,
 *    lässt sich ausserhalb eines Laufs prüfen, dass in ihm **kein einziger
 *    Wert auf DEV zeigt** — der Auszug kann gegen DEV gar nichts absetzen,
 *    weil er DEV nicht kennt.
 *
 * 3. **Objektnamen sind Fremddaten.** `storage.objects.name` trägt Pfadanteile
 *    und ist vom Hochladenden bestimmt. Ein Name mit `../` schriebe sonst
 *    neben die Ablage — geprüft wird deshalb zweimal: am Namen (Segmente) und
 *    am Ergebnis (Enthaltensein).
 *
 * 4. **Ein Auszug ist eine Momentaufnahme oder er ist wertlos.** Manifest und
 *    Auszug entstehen im selben exportierten Snapshot (`--snapshot`). Ohne das
 *    beschriebe das Manifest einen anderen Stand als die Datei, und ein
 *    Abgleich in Gruppe 5 könnte nicht mehr unterscheiden, ob der Rücklauf
 *    fehlerhaft war oder PROD sich zwischendurch bewegt hat.
 */

import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** Ein Supabase-Projekt-Ref sind genau 20 Kleinbuchstaben. */
const REF = /^[a-z]{20}$/;

export type Abbruch = { kind: "abbruch"; grund: string };

/**
 * Enthaltensein mit Segmentgrenze. `startsWith` allein wäre falsch:
 * `/a/bc` liegt nicht in `/a/b`, und `/a/b/..x` liegt sehr wohl in `/a/b`.
 * Beide Pfade müssen bereits aufgelöst sein.
 */
export function istInnerhalb(kind: string, eltern: string): boolean {
  const rel = relative(eltern, kind);
  if (rel === "") return true;
  if (isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(`..${sep}`);
}

/**
 * `realpath` für einen Pfad, den es noch nicht gibt: löst den längsten
 * vorhandenen Anfang auf und hängt den Rest an. Ohne das scheiterte die
 * Prüfung genau im Normalfall — der Ablageort wird ja erst angelegt —, und
 * ein Symlink im vorhandenen Teil bliebe unbemerkt.
 */
export async function aufloesen(pfad: string): Promise<string> {
  const rest: string[] = [];
  let kopf = resolve(pfad);
  for (;;) {
    try {
      return join(await realpath(kopf), ...rest);
    } catch (fehler) {
      if ((fehler as NodeJS.ErrnoException).code !== "ENOENT") throw fehler;
      const eltern = dirname(kopf);
      if (eltern === kopf) return join(kopf, ...rest); // Wurzel erreicht
      rest.unshift(basename(kopf));
      kopf = eltern;
    }
  }
}

/**
 * Der Ablageort muss ausserhalb des Arbeitsbaums liegen — in **beide**
 * Richtungen. Dass er nicht im Arbeitsbaum liegen darf, ist der Zweck: der
 * Auszug trägt echte Anschriften, und das Repository ist öffentlich. Dass er
 * den Arbeitsbaum auch nicht *enthalten* darf, ist die zweite Hälfte davon:
 * ein Ablageort, unter dem der Arbeitsbaum liegt, nimmt beim Aufräumen den
 * Quelltext mit.
 */
export async function pruefeAblageort(input: {
  kandidat: string;
  arbeitsbaum: string;
}): Promise<{ kind: "ok"; pfad: string } | Abbruch> {
  if (!input.kandidat.trim()) {
    return { kind: "abbruch", grund: "Kein Ablageort angegeben." };
  }
  const pfad = await aufloesen(input.kandidat);
  const baum = await aufloesen(input.arbeitsbaum);

  if (istInnerhalb(pfad, baum)) {
    return {
      kind: "abbruch",
      grund: `Ablageort ${pfad} liegt im Arbeitsbaum (${baum}). Der Auszug trägt echte Mitgliedsdaten, das Repository ist öffentlich.`,
    };
  }
  if (istInnerhalb(baum, pfad)) {
    return {
      kind: "abbruch",
      grund: `Ablageort ${pfad} enthält den Arbeitsbaum (${baum}). Ein Aufräumen der Ablage nähme den Quelltext mit.`,
    };
  }
  return { kind: "ok", pfad };
}

/**
 * Ein Name je Lauf, sekundengenau und mit Kennung der Quelle. Die
 * Nichtüberschreibbarkeit steht nicht hier, sondern im Anlegen: das Verzeichnis
 * wird ohne `recursive` erzeugt und scheitert auf einem vorhandenen. Ein Name,
 * der Eindeutigkeit nur behauptet, ist schwächer als ein Anlegen, das sie
 * erzwingt.
 */
export function auszugName(zeit: Date, prodRef: string): string {
  if (!REF.test(prodRef)) throw new Error(`Keine Projektkennung: "${prodRef}"`);
  const z = zeit
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  return `spiegel-${prodRef}-${z}`;
}

/**
 * Zielpfad für ein Objekt der Ablage. Zweifach geprüft: erst die Segmente des
 * Namens, dann das aufgelöste Ergebnis. Die zweite Prüfung ist nicht
 * überflüssig — sie fängt, was die erste Regel künftig durchliesse.
 */
export function sichererPfad(
  wurzel: string,
  bucket: string,
  objektname: string,
): { kind: "ok"; pfad: string } | Abbruch {
  for (const [was, wert] of [
    ["Bucket", bucket],
    ["Objektname", objektname],
  ] as const) {
    if (!wert) return { kind: "abbruch", grund: `${was} ist leer.` };
    if (wert.includes("\0")) return { kind: "abbruch", grund: `${was} enthält ein Nullzeichen.` };
    if (wert.startsWith("/")) return { kind: "abbruch", grund: `${was} ist absolut: "${wert}".` };
  }
  if (bucket.includes("/")) {
    return { kind: "abbruch", grund: `Bucket "${bucket}" ist kein einzelnes Segment.` };
  }
  for (const segment of [bucket, ...objektname.split("/")]) {
    if (segment === "..") {
      return { kind: "abbruch", grund: `Pfadanteil nach oben in "${bucket}/${objektname}".` };
    }
  }

  const bucketWurzel = resolve(wurzel, bucket);
  const pfad = resolve(bucketWurzel, objektname);
  if (!istInnerhalb(pfad, bucketWurzel)) {
    return { kind: "abbruch", grund: `"${bucket}/${objektname}" verliesse die Ablage (${pfad}).` };
  }
  return { kind: "ok", pfad };
}

export type Verbindung = {
  host: string;
  port: string;
  benutzer: string;
  datenbank: string;
  passwort: string;
};

/**
 * Zerlegt die Verbindungs-URL, damit das Passwort über `PGPASSWORD` gehen kann
 * statt über `argv`. `URL` liefert Benutzer und Passwort prozentkodiert; libpq
 * erwartet sie dekodiert.
 */
export function zerlegeUrl(url: string): Verbindung | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return null;
  if (!u.hostname || !u.username) return null;
  return {
    host: u.hostname,
    port: u.port || "5432",
    benutzer: decodeURIComponent(u.username),
    datenbank: u.pathname.replace(/^\//, "") || "postgres",
    passwort: decodeURIComponent(u.password),
  };
}

export type Befehl = {
  name: string;
  programm: string;
  argumente: string[];
  /** Ohne `PGPASSWORD` — der Plan soll protokollierbar bleiben. */
  umgebung: Record<string, string>;
  ausgabe: string;
};

/**
 * Zwei Auszüge, nicht einer: Gruppe 4 spielt `auth` und `public` in
 * verschiedenen Schritten zurück (Konten zuerst, damit die Fremdschlüssel aus
 * `public.profiles` tragen). Ein gemeinsamer Auszug liesse sich nur mit
 * `pg_restore -l`-Kunstgriffen wieder trennen.
 *
 * Beide tragen denselben `--snapshot`: sie beschreiben damit **einen** Stand,
 * und zwar denselben, den das Manifest zählt.
 */
export function planeAuszug(input: {
  verbindung: Verbindung;
  ziel: string;
  caPfad: string;
  snapshot: string;
  authTabellen: string[];
}): Befehl[] {
  const { verbindung: v, ziel, caPfad, snapshot, authTabellen } = input;

  const umgebung = {
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: caPfad,
    PGCONNECT_TIMEOUT: "30",
  };
  const gemeinsam = [
    `--host=${v.host}`,
    `--port=${v.port}`,
    `--username=${v.benutzer}`,
    `--dbname=${v.datenbank}`,
    "--no-password",
    "--format=custom",
    "--data-only",
    "--no-owner",
    "--no-privileges",
    `--snapshot=${snapshot}`,
  ];

  const auth = join(ziel, "auth.dump");
  const oeffentlich = join(ziel, "public.dump");
  return [
    {
      name: "auth",
      programm: "pg_dump",
      argumente: [...gemeinsam, ...authTabellen.map((t) => `--table=${t}`), `--file=${auth}`],
      umgebung,
      ausgabe: auth,
    },
    {
      name: "public",
      programm: "pg_dump",
      argumente: [...gemeinsam, "--schema=public", `--file=${oeffentlich}`],
      umgebung,
      ausgabe: oeffentlich,
    },
  ];
}

export type Objekt = { bucket_id: string; name: string; groesse: number; etag: string | null };

/**
 * Blättert die Objektliste über alle Seiten — mit Keyset, nicht mit `offset`.
 *
 * Zwei Gründe. Erstens verschiebt `offset` bei einer Einfügung zwischen zwei
 * Seiten den Rest um eins, und genau ein Objekt fiele lautlos aus dem Auszug.
 * Zweitens ist `(bucket_id, name)` der Primärschlüssel-Ersatz, nach dem
 * ohnehin sortiert wird.
 *
 * Die heutigen 125 Objekte sind **kein** Beleg dafür, dass eine Seitengrenze
 * nie erreicht wird — deshalb ist die Seitengröße ein Parameter und wird im
 * Test kleiner als der Bestand gewählt.
 */
export async function alleObjekte(
  seite: (nachBucket: string, nachName: string, limit: number) => Promise<Objekt[]>,
  seitenGroesse: number,
): Promise<Objekt[]> {
  if (seitenGroesse < 1) throw new Error("Seitengröße muss mindestens 1 sein.");
  const alle: Objekt[] = [];
  let bucket = "";
  let name = "";
  for (;;) {
    const seiteRaus = await seite(bucket, name, seitenGroesse);
    if (seiteRaus.length === 0) return alle;
    alle.push(...seiteRaus);
    const letztes = seiteRaus[seiteRaus.length - 1];
    bucket = letztes.bucket_id;
    name = letztes.name;
    if (seiteRaus.length < seitenGroesse) return alle;
  }
}
