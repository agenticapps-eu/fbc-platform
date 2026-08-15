/**
 * Der Lauf des WordPress-Imports (AGE-534, Gruppe 5).
 *
 *   pnpm tsx supabase/seed/wp_import.ts <quelldatei> [--ziel=…] [--schreiben]
 *
 * Hier steht der gemeinsame Weg beider Betriebsarten: Datei einlesen,
 * Vorabprüfung, Abbildung, Merge-Regel, Klassifikation. Die Bausteine liegen in
 * `wp_import.lib.ts` (Wächter, Abbildung, Merge) und `wp_bericht.ts` (Bericht) —
 * dieses Modul setzt sie zusammen und entscheidet nichts, was dort schon
 * entschieden ist.
 *
 * ── WARUM DER BESTAND ALS FUNKTION HEREINKOMMT ──────────────────────────────
 * `verarbeite` fasst keine Datenbank an. Der Trockenlauf und der schreibende
 * Lauf müssen dieselbe Klassifikation ergeben (Aufgabe 5.2); das ist nur zu
 * halten, wenn die Logik von den wirkenden Adaptern getrennt ist und nicht
 * selbst weiss, ob gerade geschrieben wird.
 *
 * Der Leser ist SYNCHRON, und das ist Absicht: er liest aus einem Verzeichnis,
 * das der Aufrufer VOR dem Lauf in einer Abfrage gefüllt hat — so wie
 * `pruefeVorab` die Bestandsadressen schon fertig bekommt. Ein asynchroner Leser
 * hiesse 70 Rundreisen und einen Bestand, der sich mitten im Lauf ändern kann.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";
import pg from "pg";

import { type Berichtskopf, type Datensatzergebnis, baueBericht, stdoutZeile } from "./wp_bericht";
import { normalisiereAdresse, normalisiereKennung } from "./wp_felder";
import type { Anweisung } from "./wp_schreiben";
import {
  type Bestand,
  type Vorabbefund,
  type ZielName,
  type Zusammenfuehrung,
  ablageorte,
  bildeAb,
  fuegeZusammen,
  leseAufruf,
  pruefeQuellPfad,
  pruefeVorab,
  pruefeZiel,
  schreibeBericht,
} from "./wp_import.lib";

/** Die gelesene Quelle: die Kopfzeile und die Datensätze darunter. */
export type Quelle = { spalten: string[]; zeilen: Record<string, string>[] };

/**
 * Liest den Dateiinhalt nach RFC 4180 — die Freitextfelder tragen Kommas und
 * Zeilenumbrüche, ein Trennen an `,` und `\n` zerlegte sie.
 *
 * DAS BOM WIRD ABGESCHNITTEN, nicht nur beim Prüfen geduldet. Die echte Datei
 * beginnt damit, und es klebt am Namen der ersten Spalte. `pruefeKopfzeile`
 * trimmt und meldete deshalb nichts — der Zugriff `row["<erstes Feld>"]` ginge
 * aber ins Leere, und das Feld sähe still leer aus statt zu fehlen.
 *
 * KEIN `relax_quotes`, KEIN `relax_column_count`. Beides nähme einer verrutschten
 * Spalte den Lärm: ab da stünde jeder Wert im falschen Feld, und der Import
 * schriebe Anschriften in Telefonnummern. Ein Abbruch ist hier das mildere
 * Ergebnis. (Die Probe `probe-c10-abbildung.ts` führt `relax_quotes` — sie zählt
 * nur, der Import schreibt.)
 *
 * Die Kopfzeile wird über die `columns`-Funktion mitgenommen, weil `columns:
 * true` sie sonst nur in den Datensätzen zurückgäbe: eine Datei ohne Datensatz
 * hätte gar keine Spalten, und die Vorabprüfung könnte einen falsch gezogenen
 * Export nicht als solchen melden.
 */
export function leseDatensaetze(inhalt: string): Quelle {
  let spalten: string[] = [];

  const zeilen = parse(inhalt, {
    bom: true,
    skip_empty_lines: true,
    columns: (kopf: string[]) => {
      spalten = kopf;
      return kopf;
    },
  }) as Record<string, string>[];

  return { spalten, zeilen };
}

/**
 * Was im Ziel zu diesem Datensatz schon steht — `null`, wenn es ihn dort noch
 * nicht gibt. Nachgeschlagen wird über Kennung UND normalisierte Adresse: ein
 * Konto, dem die Kennung fehlt, weil ein früherer Lauf dazwischen abbrach, ist
 * über die Adresse dasselbe Konto (Anforderung „Ein zweiter Lauf legt keine
 * Dubletten an").
 */
export type Bestandsleser = (schluessel: {
  kennung: string | null;
  adresse: string;
}) => Bestand | null;

export type Datensatzlauf = {
  ergebnis: Datensatzergebnis;
  /** `null` bei einem übersprungenen Datensatz — dort ist nichts zu schreiben. */
  auftrag: {
    anmeldeadresse: string;
    /** `profiles.id`, wo das Konto schon besteht — sonst `null`, es entsteht erst. */
    uid: string | null;
    zusammenfuehrung: Zusammenfuehrung;
  } | null;
};

export type Lauf =
  | { art: "vorab-abbruch"; befunde: Vorabbefund[]; datensaetze: number }
  | { art: "lauf"; befunde: Vorabbefund[]; saetze: Datensatzlauf[] };

/**
 * Der Grund, warum ein Datensatz übersprungen wird — kurz und ohne den Wert.
 * Der Wert steht in der Befundliste des Berichts; ihn hier zu wiederholen,
 * trüge ihn in eine zweite Spalte, ohne etwas zu erklären.
 */
const GRUND: Partial<Record<Vorabbefund["art"], string>> = {
  adresse_ungueltig: "Adresse fehlt oder ist unbrauchbar",
  kollision_bestand: "Adresse gehört bereits einem Bestandskonto ohne Kennung",
};

/**
 * Führt die Datensätze durch Vorabprüfung, Abbildung, Merge-Regel und
 * Klassifikation. Rein: kein Zugriff, keine Wirkung, keine Ausgabe.
 *
 * Ein Vorab-Abbruch endet HIER, ohne einen einzigen Datensatz abzubilden — nicht
 * aus Sparsamkeit, sondern weil bei fehlender Spalte jeder Wert unter dem
 * falschen Namen gelesen würde und jeder Folgebefund über etwas anderes spräche,
 * als er behauptet.
 */
export function verarbeite(input: {
  quelle: Quelle;
  /** Normalisierte Adressen bestehender Konten OHNE `legacy_source_id`. */
  bestandsadressenOhneKennung: readonly string[];
  bestand: Bestandsleser;
  schreibend: boolean;
}): Lauf {
  const vorab = pruefeVorab({
    spalten: input.quelle.spalten,
    zeilen: input.quelle.zeilen,
    bestandsadressenOhneKennung: input.bestandsadressenOhneKennung,
    schreibend: input.schreibend,
  });

  if (vorab.abbruch) {
    return {
      art: "vorab-abbruch",
      befunde: vorab.befunde,
      datensaetze: input.quelle.zeilen.length,
    };
  }

  const ausgeschlossen = new Set(vorab.ausgeschlossen);
  const gruende = new Map<number, string>();
  for (const befund of vorab.befunde) {
    const grund = GRUND[befund.art];
    if (grund && "zeile" in befund) gruende.set(befund.zeile, grund);
  }

  const saetze = input.quelle.zeilen.map((row, i): Datensatzlauf => {
    const nummer = i + 1;
    const ziel = bildeAb(row);
    const gemeinsam = {
      zeile: nummer,
      kennung: ziel.legacy.legacy_source_id,
      name: ziel.profil.name,
      adresse: ziel.anmeldeadresse,
    };

    if (ausgeschlossen.has(nummer)) {
      return {
        ergebnis: { ...gemeinsam, klasse: "uebersprungen", grund: gruende.get(nummer) },
        auftrag: null,
      };
    }

    // Belegt, nicht angenommen: die Vorabprüfung schliesst JEDEN Datensatz ohne
    // brauchbare Adresse aus (4.1), er ist oben also schon abgebogen. Ein
    // zweiter Riegel hier wäre ein Zweig, den keine Eingabe erreicht.
    const anmeldeadresse = ziel.anmeldeadresse as string;

    const vorhanden = input.bestand({
      kennung: ziel.legacy.legacy_source_id,
      adresse: anmeldeadresse,
    });
    const zusammenfuehrung = fuegeZusammen(ziel, vorhanden);

    return {
      ergebnis: {
        ...gemeinsam,
        klasse: vorhanden ? "aktualisiert" : "angelegt",
        ...(zusammenfuehrung.uebersprungen.length > 0
          ? { uebersprungeneFelder: zusammenfuehrung.uebersprungen }
          : {}),
        ...(ziel.herkunft.beitritt ? { beitritt: ziel.herkunft.beitritt } : {}),
      },
      auftrag: { anmeldeadresse, uid: vorhanden?.uid ?? null, zusammenfuehrung },
    };
  });

  return { art: "lauf", befunde: vorab.befunde, saetze };
}

// ── Der Bestand: eine Abfrage vor dem Lauf, danach nur noch Nachschlagen ─────

/**
 * Was im Ziel steht, aus EINER Abfrage. Derselbe Eintrag steht unter beiden
 * Schlüsseln, unter denen ein Datensatz wiedererkannt werden kann.
 */
export type Bestandsdaten = {
  /** Normalisierte Adressen bestehender Konten OHNE `legacy_source_id` (4.2). */
  adressenOhneKennung: string[];
  nachKennung: Map<string, Bestand>;
  nachAdresse: Map<string, Bestand>;
};

/**
 * Die Kennung schlägt die Adresse. Umgekehrt entschiede die Adresse über ein
 * Profil, das seine Kennung schon trägt — und die Merge-Regel läse den falschen
 * `bereitsImportiert`-Stand, also die Frage, ob eine Lücke im Profil eine
 * Entscheidung des Mitglieds ist.
 *
 * Die Adresse bleibt trotzdem der zweite Weg: ein Konto, dessen Kennung ein
 * abgebrochener Lauf nicht mehr geschrieben hat, ist über sie dasselbe Konto.
 */
export function bestandsleser(daten: Bestandsdaten): Bestandsleser {
  return ({ kennung, adresse }) =>
    (kennung ? daten.nachKennung.get(kennung) : undefined) ??
    daten.nachAdresse.get(adresse) ??
    null;
}

/**
 * Was Detlev noch nicht geliefert hat (Stand 14.08.). Es blockiert nichts —
 * entschieden am 14.08.: die Listen kommen, und die erste Zielumgebung ist DEV.
 * Der Bericht führt die betroffenen Konten stattdessen einzeln auf.
 *
 * „Zahlungsstände" steht hier wörtlich: `wp_bericht.ts` hängt den Abschnitt
 * `paid_until` an genau diese Zeichenkette.
 */
const FEHLENDE_LIEFERUNGEN = ["Zahlungsstände", "Ausgetretenen-Liste"];

/**
 * Der gemeinsame Weg beider Betriebsarten, von der gelesenen Datei bis zum
 * fertigen Bericht. Was der schreibende Lauf mehr tut, tut er DANACH — hier
 * unterscheidet ihn nur die Beschriftung und die Strenge der Vorabprüfung, und
 * beide entscheidet nicht dieser Code, sondern `pruefeVorab`.
 *
 * Rein: liest keine Datei, schreibt keine, spricht mit keiner Datenbank.
 */
export function baueLauf(input: {
  inhalt: string;
  bestandsdaten: Bestandsdaten;
  schreibend: boolean;
  ziel: string;
  quelle: string;
  zeitpunkt: string;
}): { lauf: Lauf; bericht: string; konsole: string[] } {
  const lauf = verarbeite({
    quelle: leseDatensaetze(input.inhalt),
    bestandsadressenOhneKennung: input.bestandsdaten.adressenOhneKennung,
    bestand: bestandsleser(input.bestandsdaten),
    schreibend: input.schreibend,
  });

  const kopf: Berichtskopf = {
    modus: input.schreibend ? "schreibend" : "trocken",
    ziel: input.ziel,
    quelle: input.quelle,
    zeitpunkt: input.zeitpunkt,
    fehlendeLieferungen: [...FEHLENDE_LIEFERUNGEN],
  };

  if (lauf.art === "vorab-abbruch") {
    return {
      lauf,
      bericht: baueBericht({
        art: "vorab-abbruch",
        kopf,
        datensaetze: lauf.datensaetze,
        befunde: lauf.befunde,
      }),
      konsole: [],
    };
  }

  return {
    lauf,
    bericht: baueBericht({
      art: "lauf",
      kopf,
      befunde: lauf.befunde,
      ergebnisse: lauf.saetze.map((s) => s.ergebnis),
    }),
    konsole: lauf.saetze.map((s) => stdoutZeile(s.ergebnis)),
  };
}

// ── Ab hier wirkt es: Datenbank, Dateien, Konsole ───────────────────────────

const REPO_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOKALE_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const CA_PFAD = "scripts/supabase-root-2021-ca.crt";

/**
 * Die eine Abfrage, aus der der ganze Bestand kommt. `left join`, weil ein
 * Profil ohne Kontaktzeile und ohne Legacy-Zeile trotzdem dasselbe Konto ist.
 *
 * `offers` und `needs` zählen NUR die Zeilen des Freitext-Editors: die Chips des
 * Kategorie-Wählers (`source = 'chip'`) sind anderer Inhalt, und ein Mitglied
 * mit drei Kategorien hat trotzdem kein „Ich biete" geschrieben.
 */
export const BESTANDSABFRAGE = `
  select
    p.id                                                               as uid,
    pl.legacy_source_id                                                as kennung,
    u.email                                                            as adresse,
    p.tier, p.activated_at,
    p.name, p.headline, p.short_bio, p.region, p.website,
    coalesce(p.socials, '{}'::jsonb)                                   as socials,
    coalesce(p.videos, '{}'::text[])                                   as videos,
    c.email as kontakt_email, c.phone, c.street, c.postal_code, c.city, c.state, c.country,
    (select count(*) from public.offers o
       where o.profile_id = p.id and o.source = 'editor')              as offers,
    (select count(*) from public.needs n
       where n.profile_id = p.id and n.source = 'editor')              as needs,
    (select count(*) from public.profile_interests i
       where i.profile_id = p.id)                                      as interessen
  from public.profiles p
  join auth.users u                on u.id = p.id
  left join public.profile_contacts c on c.profile_id = p.id
  left join public.profile_legacy pl  on pl.profile_id = p.id
`;

export type Bestandszeile = {
  uid: string;
  kennung: string | null;
  adresse: string | null;
  tier: string | null;
  activated_at: Date | null;
  name: string | null;
  headline: string | null;
  short_bio: string | null;
  region: string | null;
  website: string | null;
  socials: Record<string, string> | null;
  videos: string[] | null;
  kontakt_email: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  offers: string;
  needs: string;
  interessen: string;
};

/**
 * Macht aus den Zeilen der Abfrage das Verzeichnis, in dem der Lauf nachschlägt.
 * Rein — damit die Regel unten prüfbar ist, ohne eine Datenbank zu brauchen.
 *
 * ── WELCHES KONTO OHNE KENNUNG IST EINE KOLLISION? ──────────────────────────
 * Der Plan verlangte zweierlei vom selben Bestand: ein Konto ohne Kennung, das
 * zu einer Quelladresse passt, soll den Schreiblauf BLOCKIEREN (4.2) — und ein
 * Konto, dessen Kennung ein abgebrochener Lauf schuldig blieb, soll ERGÄNZT
 * werden. Im Bestand sehen beide gleich aus.
 *
 * Unterschieden wird an der Handschrift dieses Imports (Entscheidung Donald,
 * 15.08.): er legt Konten mit `impact` an und schaltet sie nicht frei (7.3),
 * eine Selbstregistrierung dagegen ist `basic`. Nur ein `impact`-Konto OHNE
 * Freischaltung gilt als eigener Rest und wird ergänzt; jedes andere bleibt
 * Kollision. Ist es bereits freigeschaltet, benutzt es jemand — dann ist es
 * keiner unserer Reste, egal welche Stufe es trägt.
 *
 * Der Restrisiko-Fall, der damit falsch läge: ein von Hand angelegtes, noch
 * nicht freigeschaltetes `impact`-Konto. Es würde ergänzt statt blockiert — es
 * trüge aber ohnehin schon die höchste Stufe, die Sorge aus 4.2 (eine Stufe
 * verschenken) greift dort nicht.
 */
export function baueBestandsdaten(zeilen: readonly Bestandszeile[]): Bestandsdaten {
  const daten: Bestandsdaten = {
    adressenOhneKennung: [],
    nachKennung: new Map(),
    nachAdresse: new Map(),
  };

  for (const z of zeilen) {
    const kennung = normalisiereKennung(z.kennung ?? "");
    const adresse = normalisiereAdresse(z.adresse ?? "");
    const eigenerRest = z.tier === "impact" && z.activated_at === null;

    const eintrag: Bestand = {
      uid: z.uid,
      bereitsImportiert: kennung !== null,
      profil: {
        name: z.name,
        headline: z.headline,
        short_bio: z.short_bio,
        region: z.region,
        website: z.website,
        socials: z.socials ?? {},
        videos: z.videos ?? [],
      },
      kontakt: {
        email: z.kontakt_email,
        phone: z.phone,
        street: z.street,
        postal_code: z.postal_code,
        city: z.city,
        state: z.state,
        country: z.country,
      },
      // `count(*)` kommt als Zeichenkette (bigint) — ungewandelt wäre "0" wahr.
      offers: Number(z.offers),
      needs: Number(z.needs),
      interessen: Number(z.interessen),
    };

    if (kennung) daten.nachKennung.set(kennung, eintrag);
    if (adresse) {
      daten.nachAdresse.set(adresse, eintrag);
      if (!kennung && !eigenerRest) daten.adressenOhneKennung.push(adresse);
    }
  }

  return daten;
}

/**
 * Ein Datensatz, ganz oder gar nicht (7.1). Bricht eine der Anweisungen ab,
 * bleibt keine halbe Person zurück — ein Profil ohne Kontaktzeile sähe im
 * Verzeichnis aus wie ein gepflegtes.
 *
 * Das Anmeldekonto liegt AUSSERHALB dieser Klammer und kann es nicht anders:
 * es entsteht in der Admin-Schnittstelle, nicht in dieser Verbindung. Deshalb
 * erkennt der Lauf einen Datensatz über zwei Schlüssel wieder (Kennung und
 * normalisierte Adresse) — ein Konto ohne Kennung ist der Rest eines Abbruchs
 * genau hier.
 */
export async function fuehreDatensatzAus(
  client: pg.Client,
  anweisungen: readonly Anweisung[],
): Promise<void> {
  await client.query("begin");
  try {
    for (const anweisung of anweisungen) await client.query(anweisung.sql, anweisung.werte);
    await client.query("commit");
  } catch (fehler) {
    // Die Gegenprobe lässt `rollback` → `commit` grün, und das ist ausnahmsweise
    // KEINE Testlücke: eine abgebrochene Transaktion nimmt Postgres auch auf
    // COMMIT zurück — nachgemessen, der Server antwortet darauf wörtlich mit
    // `ROLLBACK`. Kein Test könnte die beiden unterscheiden. Es steht hier
    // trotzdem ausgeschrieben, weil der Leser die Absicht sehen soll und nicht
    // auf eine Eigenheit des Servers vertrauen muss.
    await client.query("rollback");
    throw fehler;
  }
}

async function leseBestand(client: pg.Client): Promise<Bestandsdaten> {
  const { rows } = await client.query<Bestandszeile>(BESTANDSABFRAGE);
  return baueBestandsdaten(rows);
}

function verbindungsUrl(ziel: ZielName): string | undefined {
  if (ziel === "lokal") return LOKALE_DB_URL;
  return ziel === "dev" ? process.env.SUPABASE_DB_URL_DEV : process.env.SUPABASE_DB_URL_PROD;
}

function abbruch(grund: string): never {
  console.error(grund);
  process.exit(1);
}

async function main(): Promise<void> {
  const aufruf = leseAufruf(process.argv.slice(2));
  if (aufruf.kind === "abbruch") abbruch(aufruf.grund);

  const pfad = pruefeQuellPfad({
    pfad: aufruf.quelle,
    cwd: process.cwd(),
    repoWurzel: REPO_WURZEL,
  });
  if (pfad.kind === "abbruch") abbruch(pfad.grund);

  const dbUrl = verbindungsUrl(aufruf.ziel);
  const geprueft = pruefeZiel({
    dbUrl,
    erwartetesZiel: aufruf.ziel,
    devRef: readFileSync(resolve(REPO_WURZEL, "scripts/dev-project-ref.txt"), "utf8").trim(),
    prodRef: readFileSync(resolve(REPO_WURZEL, "scripts/prod-project-ref.txt"), "utf8").trim(),
  });
  if (geprueft.kind === "abbruch") abbruch(geprueft.grund);

  // Der schreibende Teil ist Gruppe 7. Bis dahin bricht dieser Lauf ab, statt
  // einen Bericht zu schreiben, der von Schreibvorgängen spricht, die es nicht
  // gab — ein Bericht, der lügt, ist schlimmer als keiner.
  if (aufruf.schreiben) {
    abbruch("Der schreibende Lauf ist noch nicht gebaut (Gruppe 7). Bis dahin nur Trockenlauf.");
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl:
      aufruf.ziel === "lokal"
        ? false
        : { ca: readFileSync(resolve(REPO_WURZEL, CA_PFAD), "utf8"), rejectUnauthorized: true },
  });
  await client.connect();

  try {
    const zeitpunkt = new Date().toISOString();
    const { lauf, bericht, konsole } = baueLauf({
      inhalt: readFileSync(pfad.pfad, "utf8"),
      bestandsdaten: await leseBestand(client),
      schreibend: aufruf.schreiben,
      ziel: geprueft.ziel,
      quelle: pfad.pfad,
      zeitpunkt,
    });

    for (const zeile of konsole) console.log(zeile);

    const orte = ablageorte({ quellPfad: pfad.pfad, zeitstempel: zeitpunkt });
    schreibeBericht(orte.bericht, bericht);

    console.log(
      lauf.art === "vorab-abbruch"
        ? `Vorab-Abbruch — nichts verarbeitet. Bericht: ${orte.bericht}`
        : `Trockenlauf über ${lauf.saetze.length} Datensätze. Bericht: ${orte.bericht}`,
    );
  } finally {
    await client.end();
  }
}

// Nur als Programm, nicht beim Import aus den Tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
