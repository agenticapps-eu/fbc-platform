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

/** Die Dateien, ohne die ein Ablageverzeichnis kein Auszug ist. */
export const PFLICHTDATEIEN = ["manifest.json", "auth.sql", "public.sql"] as const;

export type Abbruch = { kind: "abbruch"; grund: string };

export type Manifest = {
  quelle: string;
  snapshot: string;
  tabellen: Record<string, { zeilen: number; hash: string }>;
  buckets: string[];
  objekte: { bucket: string; name: string; groesse: number; sha256: string }[];
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

export type Abweichung = { was: string; ausAuszug: number; zuschlag: number; ist: number };

/**
 * Vergleicht den Ist-Stand gegen das Manifest des Auszugs — **nicht** gegen
 * „PROD jetzt". PROD bewegt sich beim Lesen: gemessen am 2026-08-20 wichen
 * zwei Tabellen im Zeilenhash ab, während die Zeilenzahl gleich blieb.
 *
 * `zuschlag` ist der deklarierte DEV-eigene Bestand (§3a). Er wird in den
 * Sollwert **eingerechnet**, nicht als Entschuldigung verbucht: eine Tabelle
 * mit Zuschlag, deren Zahl trotzdem nicht aufgeht, ist genauso ein Fehler wie
 * jede andere. Was `deklariert` zurückgibt, ist deshalb kein Befund, sondern
 * die Liste der Stellen, an denen DEV **absichtlich** von PROD abweicht — sie
 * gehört in die Abnahme, damit niemand sie später für einen Fehler hält.
 */
export function vergleicheManifest(input: {
  soll: Manifest;
  istTabellen: Record<string, number>;
  zuschlag: Record<string, number>;
}): { unerwartet: Abweichung[]; deklariert: Abweichung[] } {
  const unerwartet: Abweichung[] = [];
  const deklariert: Abweichung[] = [];

  const namen = new Set([
    ...Object.keys(input.soll.tabellen),
    ...Object.keys(input.istTabellen),
    ...Object.keys(input.zuschlag),
  ]);
  for (const was of [...namen].sort()) {
    const ausAuszug = input.soll.tabellen[was]?.zeilen ?? 0;
    const zuschlag = input.zuschlag[was] ?? 0;
    const ist = input.istTabellen[was] ?? 0;
    const eintrag = { was, ausAuszug, zuschlag, ist };
    if (ist !== ausAuszug + zuschlag) unerwartet.push(eintrag);
    else if (zuschlag !== 0) deklariert.push(eintrag);
  }
  return { unerwartet, deklariert };
}
