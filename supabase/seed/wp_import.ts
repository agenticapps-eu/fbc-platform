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

import { parse } from "csv-parse/sync";

import type { Datensatzergebnis } from "./wp_bericht";
import {
  type Bestand,
  type Vorabbefund,
  type Zusammenfuehrung,
  bildeAb,
  fuegeZusammen,
  pruefeVorab,
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
  auftrag: { anmeldeadresse: string; zusammenfuehrung: Zusammenfuehrung } | null;
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
      auftrag: { anmeldeadresse, zusammenfuehrung },
    };
  });

  return { art: "lauf", befunde: vorab.befunde, saetze };
}
