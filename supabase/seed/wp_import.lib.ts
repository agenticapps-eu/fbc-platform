/**
 * Wächter, Aufrufform und Ablageorte für den WordPress-Import (AGE-534).
 *
 * Reine Funktionen bis auf `schreibeBericht` — kein `pg`, kein Netz, keine
 * CSV-Datei. Der Aufrufer ist `supabase/seed/wp_import.ts`.
 *
 * DER WÄCHTER PRÜFT DIE KENNUNG, NICHT DEN HOST. Die erste Fassung dieses
 * Changes verglich den Host der Verbindung. Der Plan-Review vom 14.08. hat das
 * gekippt und ich habe es nachgemessen: der Session-Pooler liegt unter
 * `aws-1-eu-central-1.pooler.supabase.com` — **regionsweit derselbe Host für
 * jedes Projekt** (`demo_seed.lib.ts:10`). Die Projektkennung steckt im
 * Benutzernamen, `postgres.<ref>`. Ein Host-Vergleich wäre gegen PROD grün
 * gewesen. Der Test „unterscheidet die Projekte, obwohl der Host derselbe ist"
 * hält beides fest.
 *
 * DER LOKALE STACK TRÄGT KEINE KENNUNG. Er wird an seiner Adresse erkannt; die
 * Rolle heisst dort ebenfalls `postgres` und taugt nicht zur Unterscheidung.
 * Steht dagegen eine Kennung im Benutzernamen, entscheidet sie — ein Tunnel auf
 * 127.0.0.1 ist nicht der lokale Stack.
 *
 * PROD BLEIBT IM WÖRTERBUCH. Dieser Change läuft nicht gegen PROD (Non-Goal),
 * aber ein Verbot hier hiesse, am Go-Live-Tag Code zu ändern, um den Lauf
 * überhaupt zu ermöglichen. Der Riegel ist die ausdrückliche Nennung des Ziels,
 * nicht dessen Abwesenheit.
 */

import { chmodSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { extractProjectRef } from "../../scripts/db-push-prod.logic";
// Der kanonische Video-Erkenner der Anwendung. Nicht nachgebaut: Anzeige und
// `sanitizeVideos` filtern über genau diese Funktion — ein zweiter Erkenner
// hiesse, dass der Import etwas ablegt, das die Oberfläche danach verwirft.
// Das Modul ist bewusst seiteneffektfrei und aus Node ladbar (siehe sein Kopf).
import { parseVideoUrl } from "../../src/lib/video-url";
import {
  type Datum,
  type Ort,
  datumParsen,
  htmlEntfernen,
  normalisiereAdresse,
  normalisiereKennung,
  ortParsen,
  telefonParsen,
} from "./wp_felder";

/** Ein Supabase-Projekt-Ref sind genau 20 Kleinbuchstaben. */
const REF_PATTERN = /^[a-z]{20}$/;

/** Adressen, unter denen der lokale Supabase-Stack erreichbar ist. */
const LOKALE_ADRESSEN = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export type ZielName = "lokal" | "dev" | "prod";

const ZIELE: readonly ZielName[] = ["lokal", "dev", "prod"];

export type Zielpruefung =
  { kind: "ok"; ziel: ZielName; ref: string | null } | { kind: "abbruch"; grund: string };

/**
 * Hält die Verbindung, gegen die gearbeitet werden soll, gegen das Ziel, das der
 * Aufrufer genannt hat. Die Meldungen führen nie die URL — sie trägt das
 * Passwort.
 */
export function pruefeZiel(input: {
  dbUrl: string | undefined;
  erwartetesZiel: ZielName;
  devRef: string;
  prodRef: string;
}): Zielpruefung {
  const { dbUrl, erwartetesZiel, devRef, prodRef } = input;

  if (!dbUrl || dbUrl.trim() === "") {
    return { kind: "abbruch", grund: "Die Verbindungs-URL ist nicht gesetzt." };
  }

  // Ein Sollwert, der kein Ref ist, darf nicht als Vergleichsmassstab
  // durchgehen: sonst hiesse ein leerer Dateiinhalt stillschweigend „passt nie"
  // und der Abbruch nennte den falschen Grund.
  for (const [name, ref] of [
    ["scripts/dev-project-ref.txt", devRef],
    ["scripts/prod-project-ref.txt", prodRef],
  ] as const) {
    if (!REF_PATTERN.test(ref)) {
      return { kind: "abbruch", grund: `Sollwert in ${name} ist kein Projekt-Ref: "${ref}".` };
    }
  }

  if (devRef === prodRef) {
    return {
      kind: "abbruch",
      grund: `Beide Ref-Dateien nennen dasselbe Projekt ("${devRef}"). So sind die Umgebungen nicht unterscheidbar.`,
    };
  }

  const ref = extractProjectRef(dbUrl.trim());
  const tatsaechlich = bestimmeZiel(dbUrl.trim(), ref, devRef, prodRef);

  if (!tatsaechlich) {
    return {
      kind: "abbruch",
      grund: ref
        ? `Die Verbindung zeigt auf das Projekt "${ref}" — weder DEV ("${devRef}") noch PROD ("${prodRef}").`
        : "Die Verbindung trägt keine Projektkennung und zeigt nicht auf den lokalen Stack.",
    };
  }

  if (tatsaechlich !== erwartetesZiel) {
    return {
      kind: "abbruch",
      grund:
        `Genannt war "${erwartetesZiel}", die Verbindung zeigt aber auf "${tatsaechlich}"` +
        `${ref ? ` (${ref})` : ""}.`,
    };
  }

  return { kind: "ok", ziel: tatsaechlich, ref };
}

/** Die Kennung entscheidet; nur wo keine steht, zählt die Adresse. */
function bestimmeZiel(
  dbUrl: string,
  ref: string | null,
  devRef: string,
  prodRef: string,
): ZielName | null {
  if (ref === devRef) return "dev";
  if (ref === prodRef) return "prod";
  if (ref) return null;

  let host: string;
  try {
    host = new URL(dbUrl).hostname;
  } catch {
    return null;
  }

  return LOKALE_ADRESSEN.has(host) ? "lokal" : null;
}

export type Aufruf =
  | { kind: "lauf"; quelle: string; schreiben: boolean; ziel: ZielName }
  | { kind: "abbruch"; grund: string };

const BENUTZUNG =
  "Aufruf: tsx supabase/seed/wp_import.ts <quelldatei> [--ziel=lokal|dev|prod] [--schreiben]\n" +
  "  Die Quelldatei muss ausserhalb des Arbeitsbaums liegen.\n" +
  "  Ohne --schreiben laeuft ein Trockenlauf; ohne --ziel gegen den lokalen Stack.";

/**
 * Liest `process.argv.slice(2)`. Nichts wird durchgereicht: ein unbekanntes
 * Argument ist ein Abbruchgrund, kein Rauschen.
 */
export function leseAufruf(argv: string[]): Aufruf {
  const quellen: string[] = [];
  let schreiben = false;
  let ziel: ZielName | null = null;

  for (const arg of argv) {
    if (arg === "--schreiben") {
      schreiben = true;
      continue;
    }
    if (arg.startsWith("--ziel=")) {
      const genannt = arg.slice("--ziel=".length);
      if (!(ZIELE as readonly string[]).includes(genannt)) {
        return {
          kind: "abbruch",
          grund: `Unbekanntes Ziel "${genannt}". Erwartet: ${ZIELE.join(" | ")}.\n${BENUTZUNG}`,
        };
      }
      ziel = genannt as ZielName;
      continue;
    }
    if (arg.startsWith("-")) {
      return { kind: "abbruch", grund: `Unbekanntes Argument "${arg}".\n${BENUTZUNG}` };
    }
    quellen.push(arg);
  }

  if (quellen.length === 0) {
    return { kind: "abbruch", grund: `Keine Quelldatei angegeben.\n${BENUTZUNG}` };
  }
  if (quellen.length > 1) {
    return {
      kind: "abbruch",
      grund: `Mehr als eine Quelldatei angegeben: ${quellen.join(" ")}.\n${BENUTZUNG}`,
    };
  }

  // Ein Schalter, der nur „schreiben" sagt, ist gegen das falsche Ziel genauso
  // willig wie gegen das richtige.
  if (schreiben && ziel === null) {
    return {
      kind: "abbruch",
      grund: `Der Schreibmodus verlangt die ausdrueckliche Nennung des Ziels (--ziel=...).\n${BENUTZUNG}`,
    };
  }

  return { kind: "lauf", quelle: quellen[0], schreiben, ziel: ziel ?? "lokal" };
}

export type Pfadpruefung = { kind: "ok"; pfad: string } | { kind: "abbruch"; grund: string };

/**
 * Löst den Pfad absolut auf und lehnt ihn ab, wenn er im Arbeitsbaum liegt.
 * Ignorieren genügt nicht: eine ignorierte Datei ist vorhanden, nur unsichtbar,
 * und die nächste Änderung an den Ignorierregeln legt sie frei.
 *
 * Verglichen wird über `relative`, nicht über `startsWith`: ein Nachbar namens
 * `fbc-platform-daten` liegt neben dem Arbeitsbaum, nicht darin.
 */
export function pruefeQuellPfad(input: {
  pfad: string;
  cwd: string;
  repoWurzel: string;
}): Pfadpruefung {
  const aufgeloest = resolve(input.cwd, input.pfad);
  const dazu = relative(input.repoWurzel, aufgeloest);

  // Der Arbeitsbaum selbst ergibt `""` und fällt unter dieselbe Bedingung — ein
  // eigener Zweig dafür wäre toter Code, was die Mutations-Gegenprobe am 14.08.
  // gezeigt hat.
  if (!dazu.startsWith("..") && !isAbsolute(dazu)) {
    return {
      kind: "abbruch",
      grund:
        `"${aufgeloest}" liegt im Arbeitsbaum. Quelle und Bericht tragen Personendaten, ` +
        "und das Repository ist oeffentlich — beides gehoert ausserhalb.",
    };
  }

  return { kind: "ok", pfad: aufgeloest };
}

/**
 * Die 26 lebenden Quellfelder, nach der Abbildungsmatrix im Design gruppiert.
 *
 * WARUM EINE FESTE LISTE UND NICHT `Object.entries(row)`. Die Datei trägt 140
 * Spalten. Der Rest ist WordPress-Innenleben (`wp_*`, `aioseo_*`,
 * `session_tokens`), Reste gelöschter Formularfelder (`Homepage_16_19` …) und
 * `user_pass`. Über alle Spalten zu laufen, zöge tote Daten mit — und den
 * Passwort-Hash gleich hinterher.
 *
 * DIE ZIELE HIER SIND DIE KORRIGIERTEN. Die erste Fassung der Matrix legte die
 * Anschrift auf `profiles`, `biete`/`suche` auf nicht existierende Spalten und
 * die Interessen in die Spalte, die nur die Suche speist. Nachgelesen am
 * Zielschema, siehe Design, „Nachtrag 14.08.: sieben Ziele stimmten nicht".
 */
export const QUELLFELDER: readonly string[] = [
  // Schlüssel
  "user_email", // Anmeldeadresse
  "source_user_id", // → profile_legacy.legacy_source_id

  // → profiles
  "first_name",
  "last_name", // → name, zusammengesetzt
  "beruf", // → headline
  "infos", // → short_bio
  "infos_15", // → short_bio, angehängt
  "infos_16", // → member_since
  "ort_27_28", // → region (Regionalgruppe, NICHT der Wohnort)
  "Homepage", // → website; profile_contacts.website ist seit dem 11.06. gedroppt
  "praesi_kurz",
  "praesei_lang", // → videos
  "linkedin",
  "facebook",
  "instagram",
  "youtube",
  "twitter", // → socials

  // → profile_contacts (die Anschrift liegt hier, nicht auf profiles: dort wäre
  // sie für jedes eingeloggte Konto lesbar)
  "E-Mail", // → email (Kontaktadresse, nicht die Anmeldeadresse)
  "Telefonnummer", // → phone
  "Strasse", // → street
  "ort", // → postal_code + city, ein Feld → zwei
  "ort_27", // → state

  // → profile_legacy
  "Mitgliedschaft", // → legacy_tier, roh

  // → offers / needs / profile_interests
  "biete", // → offers
  "suche", // → needs
  "infos_28", // → profile_interests, theme = null

  // → Bildstrecke (Gruppe 6). NICHT Teil der Abbildung: `bildeAb` fasst sie
  // nicht an, geholt werden die Dateien in einem eigenen Abschnitt. Unter dem
  // Wächter stehen sie trotzdem — ein Export, der sie anders benennt, liefe
  // sonst still bildlos durch, und die Bilder liegen nur auf der alten Seite.
  //
  // Der Wert trägt jeweils NUR die Endung (gemessen 15.08.: drei verschiedene
  // Werte über 70 Datensätze, kein Pfad, kein `http`); der Pfad entsteht aus
  // `source_user_id`.
  "profile_photo", // → avatars / profiles.avatar_url
  "cover_photo", // → covers / profiles.cover_url
];

export type Kopfpruefung = { kind: "ok" } | { kind: "abbruch"; grund: string };

/**
 * Hält die Kopfzeile der Quelle gegen die erwarteten Felder. Unbekannte Spalten
 * sind kein Grund — die Datei ist voll davon. Ein fehlendes erwartetes Feld
 * bricht ab: es hiesse, dass der Export anders gezogen wurde als der vom 13.08.,
 * und ein stillschweigend leeres Ziel fiele erst im Profil auf.
 *
 * Gemeldet werden ALLE fehlenden auf einmal. Beim ersten auszusteigen machte aus
 * einem neu gezogenen Export eine Kette von Einzelläufen.
 */
export function pruefeKopfzeile(spalten: readonly string[]): Kopfpruefung {
  // `trim` und nicht ein gezielter Schnitt auf U+FEFF: das BOM zählt in
  // JavaScript als WhiteSpace, `trim` erledigt es also mit — und nimmt
  // Leerzeichen gleich mit, ohne eine Zeile mehr zu kosten. Die
  // Mutations-Gegenprobe hat beide Fassungen als gleichwertig ausgewiesen.
  //
  // Warum es überhaupt nötig ist: das BOM klebt am Namen der ERSTEN Spalte
  // (nachgemessen: die echte Datei beginnt damit). Heute folgenlos, weil dort
  // `user_login` steht — stünde nach einem neu gezogenen Export ein erwartetes
  // Feld an erster Stelle, meldete der Wächter es als fehlend, und der Grund
  // zeigte auf die falsche Ursache.
  const vorhanden = new Set(spalten.map((s) => s.trim()));
  const fehlend = QUELLFELDER.filter((feld) => !vorhanden.has(feld));

  if (fehlend.length > 0) {
    return {
      kind: "abbruch",
      grund:
        `Die Kopfzeile der Quelle fuehrt ${fehlend.length} erwartete Feld(er) nicht: ` +
        `${fehlend.join(", ")}. Wurde der Export anders gezogen?`,
    };
  }

  return { kind: "ok" };
}

/**
 * Was die Vorabprüfung gefunden hat. Die Werte stehen hier im Klartext — der
 * Befund speist den BERICHT, und der liegt mit `0600` ausserhalb des
 * Arbeitsbaums. Für `stdout` gibt es eine eigene, kurze Darstellung
 * (`stdoutZeile` in `wp_bericht.ts`); hier hineingegriffen wird nicht.
 *
 * `zeile` zählt DATENSÄTZE, nicht Dateizeilen: Freitextfelder tragen
 * Zeilenumbrüche, ein Datensatz erstreckt sich also über mehrere Zeilen der
 * Datei. Der erste Datensatz ist die 1.
 */
export type Vorabbefund =
  | { art: "kopfzeile"; grund: string }
  | { art: "dublette_kennung"; wert: string; zeilen: number[] }
  | { art: "dublette_adresse"; wert: string; zeilen: number[] }
  | { art: "adresse_ungueltig"; zeile: number; kennung: string | null; wert: string }
  | { art: "kollision_bestand"; zeile: number; kennung: string | null; wert: string };

export type Vorabergebnis = {
  /** Blockiert dieser Befundstand den Lauf, der geprüft wurde? */
  abbruch: boolean;
  befunde: Vorabbefund[];
  /** Datensätze, die der schreibende Abschnitt auslassen MUSS. */
  ausgeschlossen: number[];
};

/**
 * Dieselbe Regel, nach der die Anmeldemaske eine Adresse annimmt
 * (`z.string().email()`, `src/pages/LoginPage.tsx:11`) — grob nachgezogen, weil
 * der Seed-Lauf ohne Zod auskommt: ein Zeichen vor dem `@`, ein Punkt danach,
 * kein Leerraum. Strenger zu prüfen als die Anwendung hiesse, Menschen
 * auszuschliessen, die sich anmelden könnten; lockerer hiesse, Konten
 * anzulegen, in die niemand hineinkommt.
 */
const ADRESSE_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Prüft die GANZE Datei, bevor der erste Schreibvorgang stattfindet. Rein: kein
 * Zugriff, keine Wirkung, die Eingabe wird nicht angefasst.
 *
 * WARUM VORAB UND NICHT JE DATENSATZ. Der geforderte Abbruch bei einer Dublette
 * „ohne jeden Schreibvorgang" ist mit Transaktionen je Datensatz nicht zu
 * halten — eine spät erkannte Dublette fände die früheren Datensätze bereits
 * geschrieben.
 *
 * WAS BLOCKIERT UND WAS NICHT — die drei Fälle sind verschieden schwer:
 *
 *   * **Kopfzeile**: bricht IMMER ab, auch den Trockenlauf. Fehlt eine Spalte,
 *     wurde der Export anders gezogen; jeder Befund danach spräche über Felder,
 *     die unter dem falschen Namen gelesen wurden.
 *   * **Dublette und Kollision**: brechen nur den SCHREIBENDEN Lauf ab. Der
 *     Trockenlauf soll gerade das vollständige Bild liefern — er hört nicht beim
 *     ersten Problem auf, er berichtet es.
 *   * **Unbrauchbare Adresse**: bricht NICHTS ab. Ohne Adresse gibt es kein
 *     Anmeldekonto, aber das ist der Fehler dieses einen Datensatzes; die
 *     übrigen 69 laufen (Aufgabe 7.5). Er landet auf der Ausschlussliste.
 *
 * Die Kollision landet ZUSÄTZLICH auf der Ausschlussliste, in beiden
 * Betriebsarten. Der Abbruch allein wäre eine einzige Sperre vor einem Fall, der
 * teuer ist: ein bestehendes Konto automatisch auf `impact` zu heben hiesse,
 * dass eine Selbstregistrierung unter einer bekannten Mitgliedsadresse die
 * höchste Stufe geschenkt bekommt.
 */
export function pruefeVorab(input: {
  spalten: readonly string[];
  zeilen: readonly Record<string, string>[];
  /** Normalisierte Adressen bestehender Konten OHNE `legacy_source_id`. */
  bestandsadressenOhneKennung: readonly string[];
  schreibend: boolean;
}): Vorabergebnis {
  const kopf = pruefeKopfzeile(input.spalten);
  if (kopf.kind === "abbruch") {
    return {
      abbruch: true,
      befunde: [{ art: "kopfzeile", grund: kopf.grund }],
      ausgeschlossen: [],
    };
  }

  const befunde: Vorabbefund[] = [];
  const ausgeschlossen = new Set<number>();

  const bestand = new Set(
    input.bestandsadressenOhneKennung.map((a) => normalisiereAdresse(a)).filter(Boolean),
  );

  // Leere Werte werden NICHT gesammelt: der Unique-Index läuft über
  // `nullif(btrim(legacy_source_id), '')`, dort kollidieren zwei fehlende
  // Kennungen ebenfalls nicht. Eine strengere Vorabprüfung hielte einen Lauf
  // auf, den die Datenbank durchliesse.
  const nachKennung = new Map<string, number[]>();
  const nachAdresse = new Map<string, number[]>();

  input.zeilen.forEach((row, i) => {
    const nummer = i + 1;
    const kennung = normalisiereKennung(row["source_user_id"] ?? "");
    const adresse = normalisiereAdresse(row["user_email"] ?? "");

    if (kennung) nachKennung.set(kennung, [...(nachKennung.get(kennung) ?? []), nummer]);
    if (adresse) nachAdresse.set(adresse, [...(nachAdresse.get(adresse) ?? []), nummer]);

    if (adresse === null || !ADRESSE_PATTERN.test(adresse)) {
      befunde.push({ art: "adresse_ungueltig", zeile: nummer, kennung, wert: adresse ?? "" });
      ausgeschlossen.add(nummer);
      return;
    }

    if (bestand.has(adresse)) {
      befunde.push({ art: "kollision_bestand", zeile: nummer, kennung, wert: adresse });
      ausgeschlossen.add(nummer);
    }
  });

  for (const [wert, zeilen] of nachKennung) {
    if (zeilen.length > 1) befunde.push({ art: "dublette_kennung", wert, zeilen });
  }
  for (const [wert, zeilen] of nachAdresse) {
    if (zeilen.length > 1) befunde.push({ art: "dublette_adresse", wert, zeilen });
  }

  const blockierend = befunde.some(
    (b) =>
      b.art === "dublette_kennung" || b.art === "dublette_adresse" || b.art === "kollision_bestand",
  );

  return {
    abbruch: input.schreibend && blockierend,
    befunde,
    ausgeschlossen: [...ausgeschlossen].sort((a, b) => a - b),
  };
}

/**
 * Was aus einer Quellzeile wird — die sechs Ziele plus, was der Bericht braucht.
 *
 * `profil`, `kontakt` und `legacy` sind je eine Zeile; `offers`, `needs` und
 * `interessen` sind Listen, weil die Zieltabellen mehrere Zeilen je Profil
 * tragen (aus dieser Quelle wird es je höchstens eine).
 *
 * `herkunft` geht NICHT in die Datenbank. Sie trägt, was beim Abbilden verloren
 * geht: der Auffüllgrad des Beitrittsdatums und die Güte der Ortsangabe. Ohne
 * sie sähe „2021-04-01" im Profil wie ein tagesgenaues Datum aus, obwohl in der
 * Quelle „April 2021" stand.
 */
export type Zielsatz = {
  anmeldeadresse: string | null;
  profil: {
    name: string | null;
    headline: string | null;
    short_bio: string | null;
    region: string | null;
    website: string | null;
    member_since: string | null;
    socials: Record<string, string>;
    videos: string[];
  };
  kontakt: {
    email: string | null;
    phone: string | null;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  legacy: { legacy_source_id: string | null; legacy_tier: string | null };
  offers: { title: string; description: string }[];
  needs: { title: string; description: string }[];
  interessen: { label: string; theme: null }[];
  herkunft: { beitritt: Datum | null; ort: Ort };
};

/** Die fünf Netzwerke der Quelle. `xing` kennt nur das Zielformular. */
const NETZWERKE = ["linkedin", "facebook", "instagram", "youtube", "twitter"] as const;

/**
 * Die Leerwertregel an einer Stelle: Markup raus, Rand beschneiden, und ein
 * Feld, von dem nichts übrig bleibt, ist `null` — nicht `''`. Ein `''` im
 * Profil sähe aus wie eine bewusste Eingabe des Mitglieds.
 *
 * `htmlEntfernen` läuft über JEDES Textfeld, nicht nur über die vier, in denen
 * am 13.08. Markup gemessen wurde. Die Messung gilt für den Export von damals;
 * die Quelle wird vor dem Go-Live neu gezogen, und dann stünde `&nbsp;` im
 * Profil, weil ein Feld nicht auf der Liste stand.
 */
function wert(roh: string | undefined): string | null {
  const s = htmlEntfernen(roh ?? "").trim();
  return s === "" ? null : s;
}

/** Wie lang ein abgeleiteter Titel höchstens werden darf. */
const TITEL_GRENZE = 80;

/**
 * `offers.title` und `needs.title` sind `not null`, die Quelle liefert aber
 * Fließtext ohne Titel (Median 99 Zeichen, max 1050). Der Titel wird deshalb
 * abgeleitet: erste nicht-leere Zeile, an der Wortgrenze gekürzt.
 *
 * Bei den 26 einzeiligen Werten ist das Ergebnis der Text selbst, bei den
 * langen ein Anriss. Das ist eine Notlösung mit Ansage — der Volltext steht
 * vollständig in `description`, es geht nichts verloren.
 */
export function titelAus(text: string): string {
  const zeile =
    text
      .split("\n")
      .map((z) => z.trim())
      .find((z) => z !== "") ?? "";
  if (zeile.length <= TITEL_GRENZE) return zeile;

  const schnitt = zeile.slice(0, TITEL_GRENZE);
  const luecke = schnitt.lastIndexOf(" ");
  return `${(luecke > 0 ? schnitt.slice(0, luecke) : schnitt).trimEnd()}…`;
}

/**
 * Bildet eine Quellzeile auf die sechs Ziele ab. Rein — keine Datenbank, kein
 * Netz; der Aufrufer entscheidet, was damit geschieht.
 *
 * Gelesen wird ausschliesslich über die Namen aus `QUELLFELDER`. `user_pass`
 * steht dort nicht und wird deshalb nie berührt.
 */
export function bildeAb(row: Record<string, string>): Zielsatz {
  const ort = ortParsen(row["ort"] ?? "");
  const beitritt = datumParsen(htmlEntfernen(row["infos_16"] ?? ""));

  // `praesi_kurz`/`praesei_lang` heissen „Präsentation", nicht „Video": ein
  // Teil der Mitglieder hat dort einen Link hinterlegt, ein anderer einen Text
  // (gemessen 14.08.: 2 gegen 3). Entschieden wird deshalb pro Wert.
  const praesentation = [row["praesi_kurz"], row["praesei_lang"]]
    .map((v) => (v ?? "").trim())
    .filter((v) => v !== "");
  const videos = praesentation.filter((v) => parseVideoUrl(v) !== null);
  const praesiText = praesentation.filter((v) => parseVideoUrl(v) === null);

  const name = [wert(row["first_name"]), wert(row["last_name"])].filter(Boolean).join(" ");
  const bioTeile = [wert(row["infos"]), wert(row["infos_15"]), ...praesiText.map(wert)].filter(
    Boolean,
  );

  const socials: Record<string, string> = {};
  for (const netz of NETZWERKE) {
    const v = wert(row[netz]);
    if (v) socials[netz] = v;
  }

  const biete = wert(row["biete"]);
  const suche = wert(row["suche"]);
  const interesse = wert(row["infos_28"]);

  return {
    anmeldeadresse: normalisiereAdresse(row["user_email"] ?? ""),
    profil: {
      name: name === "" ? null : name,
      headline: wert(row["beruf"]),
      short_bio: bioTeile.length > 0 ? bioTeile.join("\n\n") : null,
      region: wert(row["ort_27_28"]),
      website: wert(row["Homepage"]),
      member_since: beitritt?.datum ?? null,
      socials,
      videos,
    },
    kontakt: {
      email: wert(row["E-Mail"]),
      phone: wert(telefonParsen(row["Telefonnummer"] ?? "")),
      street: wert(row["Strasse"]),
      postal_code: ort.plz === "" ? null : ort.plz,
      city: ort.ort === "" ? null : ort.ort,
      state: wert(row["ort_27"]),
      // Die Vorgabe „DE" kommt aus `ortParsen` und gilt nur, wo überhaupt eine
      // Ortsangabe stand. Sie auf eine leere Anschrift zu setzen, wäre eine
      // Behauptung über einen Menschen, zu dem nichts vorliegt.
      country: ort.land === "" ? null : ort.land,
    },
    legacy: {
      legacy_source_id: normalisiereKennung(row["source_user_id"] ?? ""),
      legacy_tier: wert(row["Mitgliedschaft"]),
    },
    offers: biete ? [{ title: titelAus(biete), description: biete }] : [],
    needs: suche ? [{ title: titelAus(suche), description: suche }] : [],
    interessen: interesse ? [{ label: interesse, theme: null }] : [],
    herkunft: { beitritt, ort },
  };
}

/**
 * Was im Ziel schon steht. Bewusst NICHT der ganze Zielsatz: `member_since`,
 * `legacy_tier`, `paid_until` und `legacy_price` stehen hier nicht, weil die
 * Merge-Regel ihren Bestandswert gar nicht liest — sonst führe der Aufrufer
 * Daten heran, auf die es nicht ankommt.
 *
 * `offers`, `needs` und `interessen` sind Zählwerte: die Regel fragt nur, ob das
 * Ziel überhaupt eine Zeile trägt. Gezählt werden dabei die Zeilen des
 * Freitext-Editors — die Chips des Kategorie-Wählers (`source = 'chip'`,
 * `20260804200000`) sind anderer Inhalt, und ein Mitglied mit drei Kategorien
 * hat trotzdem kein „Ich biete" geschrieben.
 */
export type Bestand = {
  /** `profiles.id` — das Ziel der Transaktion aus 7.1. */
  uid: string;
  /**
   * Trägt dieses Profil bereits die Kennung dieses Imports? Der Unterschied
   * zwischen „hier stand noch nie etwas" und „hier hat jemand aufgeräumt".
   */
  bereitsImportiert: boolean;
  profil: {
    name: string | null;
    headline: string | null;
    short_bio: string | null;
    region: string | null;
    website: string | null;
    socials: Record<string, string>;
    videos: string[];
  };
  kontakt: {
    email: string | null;
    phone: string | null;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  offers: number;
  needs: number;
  interessen: number;
};

/**
 * Was geschrieben werden soll — und nur das. Ein Feld, das hier fehlt, wird
 * nicht angefasst; der Aufrufer baut sein UPDATE aus den vorhandenen Schlüsseln.
 *
 * `uebersprungen` trägt die Felder, für die die Quelle einen Wert hatte, der
 * nicht geschrieben wurde. Ohne diese Liste verschwiegen die Läufe genau das,
 * was ein Mensch nachtragen müsste (Aufgabe 4.4).
 */
export type Zusammenfuehrung = {
  profil: Partial<Zielsatz["profil"]>;
  kontakt: Partial<Zielsatz["kontakt"]>;
  legacy: { legacy_source_id?: string; legacy_tier?: string };
  offers: Zielsatz["offers"];
  needs: Zielsatz["needs"];
  interessen: Zielsatz["interessen"];
  uebersprungen: string[];
};

/** Die Felder, die dem Mitglied gehören — sie werden nur in leere Ziele geschrieben. */
const MITGLIEDSFELDER = {
  profil: ["name", "headline", "short_bio", "region", "website"],
  kontakt: ["email", "phone", "street", "postal_code", "city", "state", "country"],
} as const;

const leer = (v: string | null): boolean => (v ?? "").trim() === "";

/**
 * Hält den Zielsatz gegen den Bestand und gibt zurück, was geschrieben werden
 * darf. Rein — kein Zugriff, keine Wirkung.
 *
 * ── DER WIDERSPRUCH IN DER REGEL, UND WIE ER AUFGELÖST IST ──────────────────
 * Das Design sagt beides: „ein zweiter Lauf schreibt ein Profilfeld nur, wenn
 * das Ziel leer ist" UND „was ein Mitglied selbst eingetragen oder GELÖSCHT hat,
 * bleibt". Ein gelöschtes Feld ist leer — nach der ersten Hälfte füllte der
 * nächste Lauf es wieder, und die Löschung hielte nie länger als bis zum
 * nächsten Import. Aufgabe 3.7 verlangt genau dafür einen Test.
 *
 * Aufgelöst wird es am PROFIL, nicht am Feld: es gibt kein Merkmal, das ein
 * einzelnes leeres Feld als „nie befüllt" oder „geleert" ausweist, wohl aber
 * eines am Profil — ob dieser Import dort schon einmal geschrieben hat
 * (`profile_legacy` trägt die Kennung). Danach:
 *
 *   * Profil noch nicht importiert (neu, oder ein Bestandskonto, das über die
 *     Adresse zugeordnet wurde) → leere Felder werden gefüllt. Die Lücken
 *     stammen nicht von uns, und „ergänzen" ist der Zweck des Laufs.
 *   * Profil bereits importiert → die Mitgliedsfelder bleiben unangetastet.
 *     Was dort leer ist, war entweder in der Quelle leer (dann ist nichts zu
 *     tun) oder ist geleert worden (dann ist es eine Entscheidung).
 *
 * Der Preis: bringt ein neu gezogener Export einen Wert für ein Feld, das beim
 * ersten Lauf leer war, wird er nicht mehr geschrieben. Deshalb steht dieser
 * Fall in `uebersprungen` und damit im Bericht — nachtragbar von Hand, statt
 * still gegen eine Löschung entschieden.
 *
 * ── VERWALTUNGSFELDER: IMMER, ABER NICHT MIT LEEREN HÄNDEN ──────────────────
 * `member_since` und `legacy_tier` gehören der Verwaltung und überschreiben
 * auch einen belegten Bestandswert. Ein fehlender QUELLwert schreibt trotzdem
 * nichts: 66 der 70 Datensätze führen keine Mitgliedschaft, und ein `null`
 * darüber räumte weg, was von Hand nachgetragen wurde.
 *
 * `paid_until` und `legacy_price` kommen in dieser Funktion nicht vor. Die
 * Quelle führt sie nicht (sie stehen in Detlevs Zahlungsständen, Aufgabe 3.5),
 * und auf `paid_until` heisst `null` ausdrücklich „unbekannt", nicht
 * „unbefristet" — ein Lauf, der sie mitschriebe, nähme den Bestandsschutz weg.
 *
 * `activated_at` und die Anmeldeadresse stehen aus demselben Grund nicht im
 * Ergebnis: die Adresse dient dem Wiedererkennen des Kontos, nicht dem
 * Schreiben, und die Freischaltung ist keine Angabe aus WordPress.
 */
export function fuegeZusammen(ziel: Zielsatz, bestand: Bestand | null): Zusammenfuehrung {
  const uebersprungen: string[] = [];
  const profil: Partial<Zielsatz["profil"]> = {};
  const kontakt: Partial<Zielsatz["kontakt"]> = {};

  // Ein Bestand, in dem dieser Import schon geschrieben hat, gibt nichts mehr
  // her: dann ist jede Lücke das Ergebnis einer Entscheidung.
  //
  // KEIN eigener Zweig für `bestand === null`. Er stand hier und die
  // Mutations-Gegenprobe hat ihn als gleichwertig ausgewiesen: ohne Bestand
  // ruft jede Stelle unten mit dem Ersatzwert für „leer" auf, `zielIstLeer` ist
  // dann ohnehin wahr. Ein Zweig, den keine Mutation rot bekommt, ist toter
  // Code — derselbe Befund wie an `pruefeQuellPfad`.
  const darfSchreiben = (zielIstLeer: boolean): boolean =>
    !(bestand?.bereitsImportiert ?? false) && zielIstLeer;
  const darfFuellen = (bestandswert: string | null): boolean => darfSchreiben(leer(bestandswert));

  for (const feld of MITGLIEDSFELDER.profil) {
    const wert = ziel.profil[feld];
    if (wert === null) continue;
    if (darfFuellen(bestand?.profil[feld] ?? null)) profil[feld] = wert;
    else uebersprungen.push(`profiles.${feld}`);
  }

  for (const feld of MITGLIEDSFELDER.kontakt) {
    const wert = ziel.kontakt[feld];
    if (wert === null) continue;
    if (darfFuellen(bestand?.kontakt[feld] ?? null)) kontakt[feld] = wert;
    else uebersprungen.push(`profile_contacts.${feld}`);
  }

  // `socials` wird pro Schlüssel zusammengeführt, nicht als Feld: die Quelle
  // kennt fünf Netzwerke, das Formular sechs, und ein Mitglied mit einem
  // eingetragenen Xing-Profil verlöre sonst entweder das Xing oder die anderen
  // fünf. Zurückgegeben wird das VOLLSTÄNDIGE Objekt — die Spalte ist jsonb und
  // wird beim Schreiben als Ganzes ersetzt.
  const socialsNeu = { ...(bestand?.profil.socials ?? {}) };
  let socialsGeaendert = false;
  for (const [netz, adresse] of Object.entries(ziel.profil.socials)) {
    if (darfFuellen(socialsNeu[netz] ?? null)) {
      socialsNeu[netz] = adresse;
      socialsGeaendert = true;
    } else {
      uebersprungen.push(`profiles.socials.${netz}`);
    }
  }
  if (socialsGeaendert) profil.socials = socialsNeu;

  // `videos` dagegen als Feld und nicht je Eintrag: die Liste ist die
  // Präsentation des Mitglieds in seiner Reihenfolge, und Anhängen legte bei
  // jedem Lauf dasselbe Video ein zweites Mal ab.
  if (ziel.profil.videos.length > 0) {
    if (darfSchreiben((bestand?.profil.videos.length ?? 0) === 0))
      profil.videos = ziel.profil.videos;
    else uebersprungen.push("profiles.videos");
  }

  if (ziel.profil.member_since !== null) profil.member_since = ziel.profil.member_since;

  // Beide Verwaltungsfelder gleich behandelt, und beide nur, wenn die Quelle sie
  // führt. Die Kennung stand hier als Pflichtfeld — `null` eingeschlossen — und
  // wurde damit über `do update set` in eine bestehende Zeile geschrieben: ein
  // Datensatz ohne `source_user_id` löschte die Kennung des Profils, dem er über
  // die Adresse zugeordnet wurde. Beim nächsten Lauf wäre `bereitsImportiert`
  // dadurch `false` und die Merge-Regel füllte die Löschungen des Mitglieds
  // wieder auf — genau das, wogegen der Abschnitt oben geschrieben ist.
  const legacy: Zusammenfuehrung["legacy"] = {};
  if (ziel.legacy.legacy_source_id !== null) legacy.legacy_source_id = ziel.legacy.legacy_source_id;
  if (ziel.legacy.legacy_tier !== null) legacy.legacy_tier = ziel.legacy.legacy_tier;

  const liste = <T>(zeilen: T[], vorhanden: number, name: string): T[] => {
    if (zeilen.length === 0) return [];
    if (darfSchreiben(vorhanden === 0)) return zeilen;
    uebersprungen.push(name);
    return [];
  };

  return {
    profil,
    kontakt,
    legacy,
    offers: liste(ziel.offers, bestand?.offers ?? 0, "offers"),
    needs: liste(ziel.needs, bestand?.needs ?? 0, "needs"),
    interessen: liste(ziel.interessen, bestand?.interessen ?? 0, "profile_interests"),
    uebersprungen,
  };
}

export type Ablageorte = { verzeichnis: string; bericht: string; zwischenablage: string };

/**
 * Bericht und Bilder-Zwischenablage liegen neben der Quelle. Damit sind sie
 * ausserhalb des Arbeitsbaums, sobald es die Quelle ist — geprüft wird das an
 * der Quelle, hier nicht ein zweites Mal.
 *
 * Die Zwischenablage ist bewusst nicht zeitgestempelt: sie soll über Läufe
 * hinweg bestehen bleiben, sonst schützt sie nicht gegen das Abschalten der
 * alten Seite.
 */
export function ablageorte(input: { quellPfad: string; zeitstempel: string }): Ablageorte {
  const verzeichnis = dirname(input.quellPfad);
  const stempel = input.zeitstempel.replace(/[^0-9A-Za-z]/g, "-");

  return {
    verzeichnis,
    bericht: join(verzeichnis, `wp-import-bericht-${stempel}.md`),
    zwischenablage: join(verzeichnis, "wp-import-bilder"),
  };
}

/**
 * Schreibt den Bericht und setzt die Rechte anschliessend hart. Der `mode` von
 * `writeFileSync` wirkt nur beim Anlegen — über einer vorhandenen 0644-Datei
 * bliebe der Bericht sonst weltlesbar.
 *
 * Beides, nicht nur `chmod`: der `mode` schliesst das Fenster zwischen Anlegen
 * und `chmod`, in dem die Personendaten schon dastehen. Kein Test sieht dieses
 * Fenster — deshalb steht der Grund hier.
 */
export function schreibeBericht(pfad: string, inhalt: string): void {
  writeFileSync(pfad, inhalt, { mode: 0o600 });
  chmodSync(pfad, 0o600);
}
