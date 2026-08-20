/**
 * Aufgabengruppe 4 des Spiegels DEV ← PROD (AGE-576): Ersetzen.
 *
 * Reine Funktionen. Die Orchestrierung steht im Werkzeug daneben, weil sie
 * ohne eine echte Datenbank nichts belegt — geprüft wird sie durch den
 * vollständigen Probelauf gegen den lokalen Stack (5.1), nicht durch Attrappen.
 *
 * VIER SÄTZE, DIE DIE FORM ERKLÄREN.
 *
 * 1. **Der Auszug wird vollständig geprüft, BEVOR DEV geleert wird.** Ein
 *    unvollständiger Auszug plus ein geleertes DEV ist der einzige Zustand,
 *    aus dem es keinen Rückweg gibt. `manifest.json` ist dabei das
 *    Vollständigkeitszeichen: der Auszug schreibt es als letztes.
 *
 * 2. **Der Schalter wird nachgelesen, nicht angenommen.** Über den Pooler
 *    verschluckt Supavisor jede Startup-Option lautlos (Decision 2b) — wer
 *    `session_replication_role` setzt und nicht nachsieht, schreibt im
 *    schlimmsten Fall mit lebenden Triggern und merkt nichts.
 *
 * 3. **Die Buckets werden über die Storage-API geleert, nicht per SQL.** Der
 *    Trigger `protect_delete` verbietet die direkte Löschung mit einer
 *    Begründung, die stimmt: sie hinterliesse das Blob im S3. Im replica-Modus
 *    schwiege er — deshalb liegt das Leeren der Ablage bewusst **ausserhalb**
 *    der replica-Sitzung.
 *
 * 4. **Abweichungen werden benannt, nicht gezählt.** „DEV hat andere
 *    Zeilenzahlen als PROD" ist mit dem deklarierten DEV-Bestand (§3a)
 *    unvereinbar und damit als Abnahme unbrauchbar. Verglichen wird gegen das
 *    Manifest **des Auszugs**, und der DEV-eigene Zuschlag steht als erwartete
 *    Abweichung daneben.
 */

import { SQL_DATEIEN, type SqlDatei } from "./sync-dev-auszug.logic";

/** Die Dateien, ohne die ein Ablageverzeichnis kein Auszug ist. */
export const PFLICHTDATEIEN = ["manifest.json", "auth.sql", "public.sql"] as const;

export type Abbruch = { kind: "abbruch"; grund: string };

export type Manifest = {
  quelle: string;
  erzeugt?: string;
  snapshot: string;
  tabellen: Record<string, { zeilen: number; hash: string }>;
  buckets: string[];
  objekte: {
    bucket: string;
    name: string;
    groesse: number;
    sha256: string;
    mimetype: string | null;
  }[];
  /**
   * Grösse und sha256 der beiden SQL-Dateien. **Nicht optional**, obwohl
   * Auszüge von vor dem Diff-Review (6.3) das Feld nicht tragen: ein fehlendes
   * Feld zu tolerieren liesse die Lücke für genau die Auszüge offen, die sie
   * haben. Ein alter Auszug wird abgewiesen und muss neu gezogen werden.
   */
  dateien: Record<SqlDatei, { groesse: number; sha256: string }>;
};


/**
 * Prüft, dass ein Verzeichnis ein **vollständiger** Auszug ist und aus der
 * erwarteten Quelle stammt. `manifest.json` fehlt genau dann, wenn der
 * erzeugende Lauf abgebrochen ist — es wird als letztes geschrieben.
 */
export function pruefeAuszug(input: {
  vorhandeneDateien: string[];
  manifest: Manifest | null;
  erwarteteQuelle: string;
}): { kind: "ok"; manifest: Manifest } | Abbruch {
  const fehlend = PFLICHTDATEIEN.filter((d) => !input.vorhandeneDateien.includes(d));
  if (fehlend.length > 0) {
    return {
      kind: "abbruch",
      grund: `Kein vollständiger Auszug — es fehlt: ${fehlend.join(", ")}. "manifest.json" wird als letztes geschrieben; fehlt es, ist der erzeugende Lauf abgebrochen.`,
    };
  }
  if (!input.manifest) return { kind: "abbruch", grund: "manifest.json ist nicht lesbar." };
  if (input.manifest.quelle !== input.erwarteteQuelle) {
    return {
      kind: "abbruch",
      grund: `Der Auszug stammt aus ${input.manifest.quelle}, erwartet ist ${input.erwarteteQuelle}.`,
    };
  }
  if (!input.manifest.snapshot) {
    return {
      kind: "abbruch",
      grund: "Dem Manifest fehlt der Snapshot — es beschreibt keinen Stand.",
    };
  }
  return { kind: "ok", manifest: input.manifest };
}

/**
 * `auth.sql` und `public.sql` byteweise gegen das Manifest — der Befund aus
 * dem Diff-Review (6.3, HIGH).
 *
 * Bis hierher wurden die 125 Objekte byteweise geprüft und die beiden SQL-
 * Dateien nur auf **Anwesenheit**. Gelöscht wird davor. Eine nachträglich
 * gekürzte `public.sql` passierte die Vorprüfung, und der Rücklauf spielte eine
 * gültige Teilmenge in ein bereits geleertes Ziel — der einzige Zustand ohne
 * Rückweg.
 *
 * Der häufigste Fall, ein abgebrochener Auszug, war schon abgedeckt:
 * `manifest.json` wird als letztes geschrieben. Was fehlte, ist die
 * nachträgliche Beschädigung — und die Asymmetrie zu den Objekten war durch
 * nichts zu rechtfertigen.
 */
export function pruefeSqlDateien(
  manifest: Manifest,
  ist: Record<SqlDatei, { groesse: number; sha256: string }>,
): { kind: "ok" } | Abbruch {
  if (!manifest.dateien) {
    return {
      kind: "abbruch",
      grund:
        "Das Manifest führt keine Prüfsummen für auth.sql und public.sql — der Auszug ist älter als 6.3. " +
        "Bitte den Auszug erneut ziehen; ein Auszug ohne diese Zusage wird nicht eingespielt.",
    };
  }
  for (const datei of SQL_DATEIEN) {
    const soll = manifest.dateien[datei];
    if (!soll) {
      return { kind: "abbruch", grund: `Das Manifest führt ${datei} nicht.` };
    }
    const hat = ist[datei];
    if (hat.groesse !== soll.groesse || hat.sha256 !== soll.sha256) {
      return {
        kind: "abbruch",
        grund:
          `${datei} weicht vom Manifest ab: ${hat.groesse} B / ${hat.sha256.slice(0, 12)}… ` +
          `statt ${soll.groesse} B / ${soll.sha256.slice(0, 12)}….`,
      };
    }
  }
  return { kind: "ok" };
}

/**
 * Die Bucket-Liste des Auszugs gegen die des Ziels — der zweite Befund aus 6.3.
 *
 * Geleert wurde bisher, was auf dem **Ziel** stand; `manifest.buckets` wurde
 * nirgends gelesen. Fehlte auf dem Ziel ein Bucket, den die Quelle hat,
 * scheiterte der erste Upload — **nach** dem Löschen. Ein zusätzlicher Bucket
 * auf dem Ziel überlebte unbemerkt und widersprach der Zusage "das Ziel trägt
 * den Bestand des Auszugs".
 *
 * Abgebrochen wird in **beide** Richtungen. Das ist dieselbe Regel wie beim
 * Migrations-Drift: "remote-nur" ist genauso eine Abweichung wie "lokal-nur",
 * und ein Gate, das nur eine Richtung sieht, ist die Hälfte eines Gates.
 */
export function vergleicheBuckets(soll: string[], ist: string[]): { kind: "ok" } | Abbruch {
  const fehlend = soll.filter((b) => !ist.includes(b));
  const zusaetzlich = ist.filter((b) => !soll.includes(b));
  if (fehlend.length === 0 && zusaetzlich.length === 0) return { kind: "ok" };
  return {
    kind: "abbruch",
    grund:
      `Die Buckets des Ziels weichen vom Auszug ab — auf dem Ziel fehlt: ` +
      `${fehlend.join(", ") || "nichts"}; zusätzlich auf dem Ziel: ` +
      `${zusaetzlich.join(", ") || "nichts"}. Buckets kommen aus Migrationen; ` +
      `weichen sie ab, ist das Schema auseinandergelaufen und nicht der Auszug schuld.`,
  };
}

/**
 * `delete` und nicht `truncate`: `truncate` einer Tabelle, auf die ein
 * Fremdschlüssel zeigt, verlangt `cascade` oder alle Tabellen in **einem**
 * Befehl — und `cascade` reisst dann Tabellen mit, die nicht in der Liste
 * standen. Im replica-Modus schweigen die RI-Trigger ohnehin, also kostet
 * `delete` nichts ausser Zeit, und es gibt bei 857 Zeilen nichts zu sparen.
 *
 * `auth` zuletzt: die Reihenfolge ist im replica-Modus zwar gleichgültig, aber
 * ein Leeren, das auch ohne den Schalter richtig herum liefe, ist ein Fehler
 * weniger, wenn der Schalter einmal nicht greift.
 */
/**
 * 5.6 — der Sicherungsschalter, und die einzige Stelle, die über ihn
 * entscheidet.
 *
 * **Warum es ihn gibt.** Ohne ihn darf der Auszug nicht „Sicherung" heissen:
 * 4.13 ersetzt jeden Passwort-Hash durch einen Zufallswert, und aus einem
 * Bestand, in den sich niemand anmelden kann, lässt sich PROD nicht wieder
 * aufbauen. Der Rückweg ist erst dann gegangen, wenn er die Konten auch
 * **anmeldefähig** herstellt.
 *
 * **Warum er zwei Dinge auslässt, nicht eines.** 4.13 ist das offensichtliche;
 * der deklarierte DEV-Bestand aus 4.9/4.10 ist das leicht übersehene. Ein
 * Sicherungslauf, der fünf Stufen umschreibt und eine `matching_manager`-Zeile
 * dazustellt, ergibt nicht den Bestand des Manifests, sondern einen
 * DEV-Bestand mit echten Hashes — die schlechteste der drei möglichen
 * Fassungen. Messbar wird der Unterschied an der Abnahme: mit dem Schalter
 * muss sie **null** Abweichungen melden, nicht zwei.
 *
 * **Warum er gegen DEV nicht bloss unerwünscht, sondern abgelehnt ist.** Für
 * den Spiegel ist entschieden worden, die Daten *nicht* zu anonymisieren; der
 * Ausgleich dafür sind genau zwei Dinge, und neutralisierte Hashes sind eines
 * davon. Produktions-Hashes auf DEV nähmen diesen Ausgleich zurück, ohne dass
 * es jemandem auffiele — DEV sähe hinterher aus wie immer.
 *
 * Ein Warnhinweis reicht dafür nicht. Der Schalter kommt aus einer
 * Befehlszeile, die man kopiert, und die gefährliche Fassung unterscheidet
 * sich von der harmlosen um ein einziges Wort.
 *
 * Der lokale Stack bleibt offen: dort fällt der Beleg für 5.6, und dort ist ein
 * Fehlgriff folgenlos.
 */
export function pruefeSicherungslauf(input: {
  zielArt: "lokal" | "dev";
  sicherung: boolean;
}):
  | { kind: "frei"; neutralisieren: boolean; devBestand: boolean }
  | { kind: "abbruch"; grund: string } {
  if (input.sicherung && input.zielArt === "dev") {
    return {
      kind: "abbruch",
      grund:
        "--sicherung ist gegen dev abgelehnt. Der Schalter gehört zur " +
        "Sicherungs-Rolle (PROD-Wiederaufbau); auf DEV nähme er den Ausgleich " +
        "zurück, der die fehlende Anonymisierung trägt.",
    };
  }
  return { kind: "frei", neutralisieren: !input.sicherung, devBestand: !input.sicherung };
}

/**
 * Welche `auth`-Tabellen vor dem Rücklauf zu leeren sind — **als Regel, nicht
 * als Liste**.
 *
 * Der DEV-Lauf vom 2026-08-20 ist an dieser Stelle abgebrochen: geleert wurden
 * `auth.users` und `auth.identities`, stehen blieben 13 `sessions`,
 * 81 `refresh_tokens`, 13 `mfa_amr_claims` und ein `one_time_token` der alten
 * DEV-Konten. Die 4.1b-Prüfung hat sie als verwaist gemeldet — richtig.
 *
 * Dass alle diese Fremdschlüssel `ON DELETE CASCADE` tragen, half nicht:
 * `session_replication_role = replica` legt die Cascade-Trigger mit still.
 * **Im replica-Modus verschwindet nur, was man benennt.** Eine Namensliste ist
 * hier deshalb nicht bloss unvollständig, sondern die falsche Bauform — GoTrue
 * stellt Tabellen dazu (`oauth_consents`, `webauthn_*` sind neu), und keine
 * davon fände je den Weg in eine von Hand gepflegte Liste.
 *
 * `schema_migrations` ist ausgenommen: das ist GoTrues eigene Historie, sie
 * gehört zur laufenden Fassung des Dienstes und nicht zum Bestand.
 */
export function authTabellenZumLeeren(vorhandene: string[]): string[] {
  const ohneHistorie = vorhandene.filter((t) => t !== "schema_migrations");
  if (!ohneHistorie.includes("users")) {
    throw new Error(
      "auth.users fehlt in der Tabellenliste — gegen einen leeren auth-Bestand wird nicht geleert.",
    );
  }
  // `users` zuletzt: die Reihenfolge trägt damit auch dann, wenn der
  // replica-Schalter einmal nicht greift, statt sich darauf zu verlassen.
  return [...ohneHistorie.filter((t) => t !== "users").sort(), "users"].map((t) => `auth.${t}`);
}

export function planeLeeren(publicTabellen: string[], authTabellen: string[]): string[] {
  if (publicTabellen.length === 0) throw new Error("Keine public-Tabellen — das ist kein Zustand.");
  const zitiert = (voll: string) => {
    const [schema, name] = voll.includes(".") ? voll.split(".") : ["public", voll];
    return `${schema}."${name}"`;
  };
  return [
    ...publicTabellen.map((t) => `delete from ${zitiert(`public.${t}`)}`),
    ...authTabellen.map((t) => `delete from ${zitiert(t)}`),
  ];
}

/**
 * `pg_dump` 18 klammert seine Ausgabe in zwei **psql-Metabefehle**:
 * `\restrict <token>` am Anfang, `\unrestrict <token>` am Ende. Sie
 * verhindern, dass ein Metabefehl, den jemand in einen Objektnamen geschrieben
 * hat, in psql zur Ausführung kommt. `--no-restrict` gibt es in 18.4 nicht,
 * nur `--restrict-key`.
 *
 * Für uns sind es **Syntaxfehler**: der Rücklauf geht durch `node-pg`, das
 * keine Metabefehle kennt (und deshalb auch nicht angreifbar ist). Also raus —
 * aber **token-genau und je genau einmal**, statt per Musterzeile:
 *
 * Eine Zeile `\restrict …` kann auch **in einem Datenwert** stehen; eine
 * Biografie darf alles enthalten. Würde blind jede passende Zeile entfernt,
 * risse das lautlos ein Loch in die Daten — die Sorte Schaden, die kein Test
 * findet, weil die Zeilenzahl stimmt. Der Token ist je Auszug zufällig: wer
 * ihn in einem Datenwert trifft, hat ihn geraten.
 *
 * Die Datei selbst bleibt unverändert und damit für `psql` weiter sicher.
 */
export function entferneRestrict(sql: string): { kind: "ok"; sql: string } | Abbruch {
  const zeilen = sql.split("\n");
  const treffer = (praefix: string) =>
    zeilen.reduce<number[]>((a, z, i) => (z.startsWith(praefix) ? [...a, i] : a), []);

  const auf = treffer("\\restrict ");
  const zu = treffer("\\unrestrict ");
  if (auf.length === 0 && zu.length === 0) return { kind: "ok", sql };
  if (auf.length !== 1 || zu.length !== 1) {
    return {
      kind: "abbruch",
      grund: `Erwartet je genau ein \\restrict/\\unrestrict, gefunden ${auf.length}/${zu.length}. Blind zu entfernen risse ein Loch in die Daten.`,
    };
  }
  const token = zeilen[auf[0]].slice("\\restrict ".length).trim();
  if (!token || zeilen[zu[0]].slice("\\unrestrict ".length).trim() !== token) {
    return { kind: "abbruch", grund: "\\restrict und \\unrestrict tragen verschiedene Token." };
  }
  if (auf[0] > zu[0]) return { kind: "abbruch", grund: "\\unrestrict steht vor \\restrict." };

  return {
    kind: "ok",
    sql: zeilen.filter((_, i) => i !== auf[0] && i !== zu[0]).join("\n"),
  };
}

export type Abweichung = {
  was: string;
  grund: "zeilen" | "hash";
  soll: string;
  ist: string;
};

/**
 * Der deklarierte DEV-eigene Bestand (§3a) in der Form, in der die Abnahme ihn
 * braucht — und das sind **zwei** Formen, nicht eine:
 *
 * · `zusatzZeilen` für echte Zusatzsätze (`staff_roles`: eine Zeile
 *   `matching_manager`).
 * · `hashWeichtAb` für Tabellen, deren **Zeilenzahl stimmt und deren Inhalt
 *   trotzdem abweicht**. Das ist der Normalfall hier, nicht die Ausnahme:
 *   `tier` ist eine Spalte auf `public.profiles`, die fünf Zuweisungen
 *   erzeugen keine Zeile; und `auth.users` trägt nach 4.13 neutralisierte
 *   Passwort-Hashes. Wer nur Zeilen zählte, hielte beides für sauber — und
 *   sähe umgekehrt jede echte inhaltliche Abweichung nie.
 */
export type Deklaration = {
  zusatzZeilen: Record<string, number>;
  hashWeichtAb: string[];
};

/**
 * Vergleicht den Ist-Stand gegen das Manifest des Auszugs — **nicht** gegen
 * „PROD jetzt". PROD bewegt sich beim Lesen: gemessen am 2026-08-20 wichen
 * zwei Tabellen im Zeilenhash ab, während die Zeilenzahl gleich blieb.
 *
 * Die Deklaration wird **eingerechnet**, nicht als Entschuldigung verbucht:
 * eine Tabelle mit Zuschlag, deren Zahl trotzdem nicht aufgeht, ist genauso ein
 * Fehler wie jede andere. `deklariert` ist deshalb kein Befund, sondern die
 * Liste der Stellen, an denen DEV **absichtlich** von PROD abweicht — sie
 * gehört in die Abnahme, damit niemand sie später für einen Fehler hält.
 */
export function vergleicheManifest(input: {
  soll: Manifest;
  ist: Record<string, { zeilen: number; hash: string }>;
  deklaration: Deklaration;
}): { unerwartet: Abweichung[]; deklariert: Abweichung[] } {
  const unerwartet: Abweichung[] = [];
  const deklariert: Abweichung[] = [];

  const namen = new Set([
    ...Object.keys(input.soll.tabellen),
    ...Object.keys(input.ist),
    ...Object.keys(input.deklaration.zusatzZeilen),
  ]);

  for (const was of [...namen].sort()) {
    const soll = input.soll.tabellen[was];
    const ist = input.ist[was];
    const zusatz = input.deklaration.zusatzZeilen[was] ?? 0;
    const darfAbweichen = input.deklaration.hashWeichtAb.includes(was) || zusatz !== 0;

    const sollZeilen = (soll?.zeilen ?? 0) + zusatz;
    const istZeilen = ist?.zeilen ?? 0;
    if (sollZeilen !== istZeilen) {
      unerwartet.push({
        was,
        grund: "zeilen",
        soll: String(sollZeilen),
        ist: String(istZeilen),
      });
      continue;
    }

    const gleich = soll !== undefined && ist !== undefined && soll.hash === ist.hash;
    if (gleich) continue;

    const eintrag: Abweichung = {
      was,
      grund: "hash",
      soll: soll?.hash ?? "(fehlt)",
      ist: ist?.hash ?? "(fehlt)",
    };
    (darfAbweichen ? deklariert : unerwartet).push(eintrag);
  }
  return { unerwartet, deklariert };
}
