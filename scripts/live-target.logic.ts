/**
 * Welches Supabase-Projekt spricht der Build an, der gleich ausgeliefert wird?
 * (AGE-536)
 *
 * WARUM ES DIESE FRAGE GIBT. `drift-gate` verglich die Migrationshistorie fest
 * verdrahtet gegen `SUPABASE_DB_URL_PROD`. Solange die Anforderung „Bis zum
 * Import trägt allein DEV die Rolle beider Umgebungen" gilt, spricht das
 * ausgelieferte Frontend aber das DEV-Projekt an — das Gate mass also eine
 * Datenbank, die kein Nutzer anfasst, und hielt dabei genau das Frontend
 * zurück, das zur tatsächlich gelesenen Datenbank passt. Am 2026-08-13 standen
 * dadurch neun leere Karten drei Stunden lang live.
 *
 * DIE QUELLE IST DER BUILD, NICHT EINE ZWEITE ANGABE. Gelesen wird das
 * `VITE_SUPABASE_URL` derselben Infisical-Umgebung, mit der `deploy` baut. Eine
 * eigene versionierte Datei („welches Projekt ist gerade live") wäre im Review
 * sichtbarer, aber eine zweite Wahrheit: läuft sie dem Build davon, misst das
 * Gate wieder das falsche Projekt — derselbe Fehler mit mehr Zeremonie.
 *
 * DIE REF-DATEIEN BLEIBEN TROTZDEM IM SPIEL. Der Ref allein sagt nicht, welches
 * Verbindungs-Secret zu nehmen ist. Und ein Ref, der zu keiner der beiden
 * Dateien passt, muss auffallen statt stillschweigend auf PROD zurückzufallen —
 * dieselbe Haltung wie im Gate selbst: bei Nichtwissen nicht durchlassen.
 *
 * Reine Funktionen, kein I/O. Der Aufrufer ist `scripts/live-target.ts`.
 */

export type LiveZiel =
  { kind: "ziel"; umgebung: "dev" | "prod"; ref: string } | { kind: "abbruch"; grund: string };

/** Ein Supabase-Projekt-Ref sind genau 20 Kleinbuchstaben. */
const REF_PATTERN = /^[a-z]{20}$/;

/**
 * Zieht den Projekt-Ref aus der API-URL, die das Frontend anspricht:
 *   https://<ref>.supabase.co
 *
 * Nicht dieselbe Form wie `extractProjectRef` in `db-push-prod.logic.ts` — das
 * liest Postgres-Verbindungs-URLs. Zwei Formen, zwei Funktionen; sie
 * zusammenzulegen hiesse, eine Regex zu bauen, die beides halb kann.
 *
 * BEWUSST ENG. Wird die API je hinter eine Supabase Custom Domain gelegt, passt
 * `VITE_SUPABASE_URL` nicht mehr, und JEDER Deploy auf main blockiert mit „kein
 * Projekt-Ref ableitbar". Das ist die richtige Richtung — laut und geschlossen
 * statt stillschweigend auf ein Projekt geraten —, koppelt aber die Umstellung
 * auf eine Custom Domain an diese Datei. Wer sie vornimmt, muss hier vorbei.
 */
export function extractRefAusApiUrl(apiUrl: string): string | null {
  let host: string;
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    return null;
  }

  const treffer = host.match(/^([a-z]{20})\.supabase\.co$/);
  return treffer ? treffer[1] : null;
}

export function bestimmeLiveZiel(input: {
  apiUrl: string | undefined;
  devRef: string;
  prodRef: string;
}): LiveZiel {
  const { apiUrl, devRef, prodRef } = input;

  if (!apiUrl || apiUrl.trim() === "") {
    return {
      kind: "abbruch",
      grund: "VITE_SUPABASE_URL ist nicht gesetzt. Fehlt der Infisical-Kontext?",
    };
  }

  // Ein Sollwert, der kein Ref ist, darf nicht als Vergleichsmassstab
  // durchgehen: sonst hiesse ein leerer oder vertippter Dateiinhalt
  // stillschweigend „passt nie", und der Abbruch weiter unten nennte den
  // falschen Grund.
  for (const [name, ref] of [
    ["scripts/dev-project-ref.txt", devRef],
    ["scripts/prod-project-ref.txt", prodRef],
  ] as const) {
    if (!REF_PATTERN.test(ref)) {
      return { kind: "abbruch", grund: `Sollwert in ${name} ist kein Projekt-Ref: "${ref}".` };
    }
  }

  // Sind beide Sollwerte gleich, sind die Umgebungen nicht mehr unterscheidbar
  // und das Ergebnis wäre reine Reihenfolge im Code.
  if (devRef === prodRef) {
    return {
      kind: "abbruch",
      grund: `Beide Ref-Dateien nennen dasselbe Projekt ("${devRef}"). Die Umgebungen sind so nicht unterscheidbar.`,
    };
  }

  const ref = extractRefAusApiUrl(apiUrl.trim());
  if (!ref) {
    return {
      kind: "abbruch",
      grund: "Aus VITE_SUPABASE_URL lässt sich kein Projekt-Ref ableiten.",
    };
  }

  if (ref === devRef) return { kind: "ziel", umgebung: "dev", ref };
  if (ref === prodRef) return { kind: "ziel", umgebung: "prod", ref };

  return {
    kind: "abbruch",
    grund: `Der Build spricht "${ref}" an — weder das DEV- ("${devRef}") noch das PROD-Projekt ("${prodRef}").`,
  };
}
