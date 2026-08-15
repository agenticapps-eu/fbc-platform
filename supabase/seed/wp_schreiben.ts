/**
 * Der schreibende Teil des WordPress-Imports (AGE-534, Gruppe 7).
 *
 * Hier entstehen die Anweisungen — ausgeführt werden sie vom Aufrufer, in einer
 * Transaktion je Datensatz. Rein: kein `pg`, kein Netz.
 *
 * ── ZWEI DINGE, DIE HIER NICHT VERWECHSELT WERDEN DÜRFEN ────────────────────
 * SPALTENNAMEN gehen unparametrisiert in den Text, WERTE niemals. Die Werte
 * kommen aus einer fremden CSV — ein Name mit einem Apostroph zerlegte ein
 * zusammengesetztes Statement, und Schlimmeres ist leicht vorstellbar. Deshalb
 * sind die Spalten eine feste Liste im Code und die Werte immer `$n`.
 *
 * Eine Spalte, die nicht auf der Liste steht, ist ein Fehler im Code und keine
 * Eingabe, die man abweist: sie käme aus der Abbildung, nicht aus der Datei.
 * Darum wirft es hier, statt still auszulassen.
 */

/**
 * Was nur beim ANLEGEN gilt (Aufgabe 7.3). Steht in den Einfügespalten, aber
 * nicht im `do update set`.
 *
 * Das ist der Kern der Regel aus 4.2: ein bestehendes Konto darf der Import
 * NICHT auf die höchste Stufe heben. Stünde `tier` im `do update set`, genügte
 * eine Selbstregistrierung unter einer bekannten Mitgliedsadresse, um `impact`
 * geschenkt zu bekommen.
 *
 * `activated_at` bleibt `null`: der Zugang entsteht dadurch, dass ein Mitglied
 * seine Adresse selbst auf der Plattform eingibt. Das Aktivierungs-Gate ist bei
 * importierten Konten die einzige Hürde — der Import darf sie nicht wegnehmen.
 */
export const NEUES_KONTO = { tier: "impact", activated_at: null } as const;

/**
 * Jede Spalte, die dieser Import je schreibt. Die Liste ist die Grenze zwischen
 * „Text, den wir geschrieben haben" und „Wert, der aus der Quelle kommt".
 */
const SPALTEN = new Set([
  // Schlüssel
  "id",
  "profile_id",
  // profiles
  "name",
  "headline",
  "short_bio",
  "region",
  "website",
  "member_since",
  "socials",
  "videos",
  "avatar_url",
  "cover_url",
  "tier",
  "activated_at",
  // profile_contacts
  "email",
  "phone",
  "street",
  "postal_code",
  "city",
  "state",
  "country",
  // profile_legacy
  "legacy_source_id",
  "legacy_tier",
]);

/** Ein Bezeichner, der in den Text darf — geprüft, nicht geglaubt. */
function spalte(name: string): string {
  if (!SPALTEN.has(name)) {
    throw new Error(
      `Unbekannte Spalte "${name}" — Spaltennamen stammen aus dem Code, nie aus der Quelle.`,
    );
  }
  return `"${name}"`;
}

export type Anweisung = { sql: string; werte: unknown[] };

/**
 * Baut ein Upsert für eine Zieltabelle. `null`, wenn nichts zu schreiben ist —
 * ein leeres `set` wäre ein Syntaxfehler, und ein Statement, das nichts tut,
 * zählte im Bericht trotzdem als Schreibvorgang.
 *
 * Ein Feld, das NICHT im Auftrag steht, kommt auch nicht ins Statement. Das ist
 * die Merge-Regel aus 3.7, bis hierher durchgehalten: was sie stehen liess,
 * darf hier nicht als `null` wieder auftauchen und wegräumen, was ein Mitglied
 * gepflegt hat.
 */
export function schreibsatz(input: {
  tabelle: string;
  schluessel: { spalte: string; wert: string };
  felder: Record<string, unknown>;
  /** Werte, die nur beim Anlegen gesetzt werden — siehe `NEUES_KONTO`. */
  nurBeimAnlegen?: Record<string, unknown>;
}): Anweisung | null {
  const felder = Object.entries(input.felder);
  if (felder.length === 0) return null;

  const anlegen = Object.entries(input.nurBeimAnlegen ?? {});
  const alle = [...felder, ...anlegen];

  const namen = [spalte(input.schluessel.spalte), ...alle.map(([n]) => spalte(n))];
  const platzhalter = namen.map((_, i) => `$${i + 1}`);
  // Nur die Felder aus dem Auftrag werden beim zweiten Lauf überschrieben —
  // `nurBeimAnlegen` bleibt hier bewusst aussen vor.
  const gesetzt = felder.map(([n]) => `${spalte(n)} = excluded.${spalte(n)}`);

  return {
    sql:
      `insert into ${input.tabelle} (${namen.join(", ")}) ` +
      `values (${platzhalter.join(", ")}) ` +
      `on conflict (${spalte(input.schluessel.spalte)}) do update set ${gesetzt.join(", ")}`,
    werte: [input.schluessel.wert, ...alle.map(([, w]) => w)],
  };
}
