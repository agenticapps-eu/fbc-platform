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
 */

export type Bestand = { funktionen: string[]; trigger: string[]; tabellen: string[] };
export type ObjektDrift = {
  art: "unbekannt" | "fehlt";
  typ: "funktion" | "trigger" | "tabelle" | "erwartet";
  name: string;
};

export function findeObjektDrift(
  bestand: Bestand,
  inMigrationen: string[],
  ausnahmen: string[],
): ObjektDrift[] {
  const gesamt = bestand.funktionen.length + bestand.trigger.length + bestand.tabellen.length;
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
  ] as const;

  for (const [typ, namen] of gruppen) {
    for (const name of namen) {
      if (!bekannt.has(name)) drift.push({ art: "unbekannt", typ, name });
    }
  }

  const vorhanden = new Set([...bestand.funktionen, ...bestand.trigger, ...bestand.tabellen]);
  for (const name of ausnahmen) {
    if (!vorhanden.has(name)) drift.push({ art: "fehlt", typ: "erwartet", name });
  }

  return drift;
}
