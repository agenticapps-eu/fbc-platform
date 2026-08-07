/**
 * Leitet aus geaenderten Dateipfaden ab, welche Edge Functions ausgeliefert
 * werden muessen (AGE-506).
 *
 * WARUM ALS REINE FUNKTION UND NICHT ALS SHELL-ZEILE IM YAML. Diese Ableitung
 * entscheidet, was CI auf DEV und PROD schreibt. Ein Fehler darin heisst
 * entweder „eine Function wurde still nicht ausgeliefert" — der Zustand, der
 * AGE-506 ueberhaupt ausgeloest hat — oder „eine Function wurde still
 * ueberschrieben, auf der bewusst ein aelterer Stand lag" (11.4,
 * `notify-contact-request` auf PROD). Eine Shell-Zeile im YAML testet niemand;
 * diese Datei hat einen Test daneben.
 *
 * WARUM NUR GEAENDERTE. `supabase functions deploy` ohne Namen deployt alle
 * sechs und zoege den bewusst abweichenden Stand mit.
 */

/** Alles unterhalb dieses Praefixes gehoert zu genau einer Function. */
const FUNKTIONS_WURZEL = "supabase/functions/";

/** Traegt `verify_jwt` je Function — und damit einen Deploy-Eingang, den Dateipfade nicht zeigen. */
const KONFIG = "supabase/config.toml";

/**
 * Supabase-Function-Namen sind Slugs. Diese Schranke ist zugleich die Haertung:
 * der Name landet in einer Shell-Schleife und danach in `supabase functions
 * deploy`. Ein Name mit Glob- oder Trennzeichen waere dort ein Eingang — und was
 * kein Slug ist, ist ohnehin keine Function.
 */
const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

export interface Ableitung {
  /** Namen der betroffenen Functions, sortiert und ohne Dubletten. */
  functions: string[];
  /**
   * Verzeichnisnamen, die kein Slug sind. Sie werden NICHT ausgeliefert — aber
   * genannt, statt still zu verschwinden: eine Function, die niemand deployt
   * und niemand erwaehnt, ist genau der Zustand, den AGE-506 abstellt.
   */
  verworfen: string[];
  /**
   * Lag `supabase/config.toml` im Merge? Dann KANN sich ein `[functions.X]`-Block
   * geaendert haben (etwa `verify_jwt`), ohne dass eine Datei der Function
   * angefasst wurde. Diese Ableitung sieht das nicht — der Aufrufer soll es
   * sagen, statt vollstaendig auszusehen.
   */
  configBeruehrt: boolean;
}

export function abgeleiteteFunctions(pfade: string[]): Ableitung {
  const namen = new Set<string>();

  for (const pfad of pfade) {
    if (!pfad.startsWith(FUNKTIONS_WURZEL)) continue;

    const rest = pfad.slice(FUNKTIONS_WURZEL.length);
    const schraegstrich = rest.indexOf("/");

    // Ohne Schraegstrich ist `rest` der Verzeichnisname selbst und keine Datei
    // darin. Das tritt beim Loeschen eines Verzeichnisses auf — dann gibt es
    // nichts mehr auszuliefern.
    if (schraegstrich <= 0) continue;

    namen.add(rest.slice(0, schraegstrich));
  }

  const sortiert = [...namen].sort();

  return {
    // Sortiert, damit sich zwei Protokolle vergleichen lassen.
    functions: sortiert.filter((n) => SLUG.test(n)),
    verworfen: sortiert.filter((n) => !SLUG.test(n)),
    configBeruehrt: pfade.includes(KONFIG),
  };
}
