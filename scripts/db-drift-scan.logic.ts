/**
 * Objekt-Drift zwischen Datenbank und `supabase/migrations/` (AGE-496 Task 12).
 *
 * Zwei Fragen, und die zweite ist die wichtigere:
 *
 *  1. Steht in der Datenbank etwas, das in keiner Migration steht? → jemand war
 *     am Dashboard.
 *  2. Fehlt in der Datenbank etwas, das dort stehen muss, obwohl es
 *     absichtlich in keiner Migration steht? → das Webhook-Paar. Verschwindet
 *     es, stirbt der Mailversand **still**.
 *
 * Wie beim Migrations-Gate gilt: ein leeres Messergebnis ist ein Fehler, keine
 * Feststellung.
 *
 * ── WAS DIESER SCAN NICHT FINDET ────────────────────────────────────────────
 * Ein unabhängiges Review hat die Grenzen am 2026-08-05 benannt. Sie stehen
 * hier, damit ein grüner Lauf nicht als Aussage gelesen wird, die er nicht
 * trägt. Die Erkennung ist eine **Namens-Heuristik**: bekannt ist, wessen Name
 * wörtlich im Text irgendeiner Migration vorkommt.
 *
 *  1. **Angelegt und später verworfen.** `public.is_prime_plus()` entsteht in
 *     `20260612082726` und wird in `20260715150000` verworfen — der Name steht
 *     danach noch 26 mal im Migrationstext. Läge die Funktion trotzdem auf dem
 *     Ziel, hielte der Scan sie für bekannt. Das ist der teuerste blinde Fleck,
 *     weil `is_prime_plus` eine Zugriffsentscheidung war.
 *  2. **Name kommt nur als Fremdreferenz vor.** `auth.users` enthält `users`;
 *     eine von Hand angelegte `public.users` wäre damit „bekannt".
 *  3. **Typübergreifende Namensgleichheit.** Die Menge ist flach: ein Trigger,
 *     der wie eine vorhandene Funktion heißt, fällt nicht auf.
 *  4. **Gelöschtes.** Nur die Ausnahmeliste unten wird auf Fehlen geprüft. Eine
 *     entfernte oder gelockerte RLS-Policy findet dieser Scan **nicht** — dafür
 *     sind `grants_test.sql` und `rls_test.sql` da, die in CI gegen eine frisch
 *     aufgebaute Datenbank laufen.
 *  5. **Geänderte Funktionsrümpfe.** Verglichen wird der Name, nicht `prosrc`.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type Bestand = {
  funktionen: string[];
  trigger: string[];
  tabellen: string[];
  views: string[];
  policies: string[];
};
export type ObjektDrift = {
  art: "unbekannt" | "fehlt";
  typ: "funktion" | "trigger" | "tabelle" | "view" | "policy" | "erwartet";
  name: string;
};

export function findeObjektDrift(
  bestand: Bestand,
  inMigrationen: string[],
  ausnahmen: string[],
): ObjektDrift[] {
  const gesamt =
    bestand.funktionen.length +
    bestand.trigger.length +
    bestand.tabellen.length +
    bestand.views.length +
    bestand.policies.length;
  if (gesamt === 0) {
    throw new Error(
      "Der Bestand ist leer. Eine Datenbank mit angewendeten Migrationen hat " +
        "Funktionen und Tabellen — die Abfrage hat nichts gemessen.",
    );
  }

  const bekannt = new Set([...inMigrationen, ...ausnahmen]);
  const drift: ObjektDrift[] = [];

  const gruppen = [
    ["funktion", bestand.funktionen],
    ["trigger", bestand.trigger],
    ["tabelle", bestand.tabellen],
    ["view", bestand.views],
    ["policy", bestand.policies],
  ] as const;

  for (const [typ, namen] of gruppen) {
    for (const name of namen) {
      if (!bekannt.has(name)) drift.push({ art: "unbekannt", typ, name });
    }
  }

  const vorhanden = new Set([
    ...bestand.funktionen,
    ...bestand.trigger,
    ...bestand.tabellen,
    ...bestand.views,
    ...bestand.policies,
  ]);
  for (const name of ausnahmen) {
    if (!vorhanden.has(name)) drift.push({ art: "fehlt", typ: "erwartet", name });
  }

  return drift;
}
