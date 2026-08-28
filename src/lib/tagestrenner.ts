/** Tagesmarker über der Blasenfolge, wie in gängigen Messengern (AGE-645).
 *
 *  **Warum das die Datumsangabe an der Blase ERSETZT.** Eine frühere Fassung
 *  dieses Vorgangs schrieb `TT.MM., HH:MM` in jede ältere Blase — aber nur,
 *  weil es keine Trenner geben sollte und eine Nachricht von letztem Dienstag
 *  sonst als blosses „14:03" dagestanden hätte. Mit einem Trenner steht der Tag
 *  einmal über der Gruppe, und die Wiederholung in jeder Blase wäre Lärm.
 */

const WOCHENTAG = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const DATUM = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Kalendertag als `YYYY-M-D` in der Zone des Betrachters.
 *
 *  Bewusst NICHT über eine Differenz in Millisekunden: 23:30 und 00:30 liegen
 *  eine Stunde auseinander und sind trotzdem verschiedene Tage. Und bewusst
 *  nicht über `toISOString()`, das auf UTC umrechnet — damit fiele ein
 *  deutscher Abend auf den Folgetag. */
function tagesSchluessel(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function tageDazwischen(a: Date, b: Date): number {
  const aTag = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bTag = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bTag.getTime() - aTag.getTime()) / 86_400_000);
}

/** „Heute", „Gestern", der Wochentag innerhalb der letzten Woche, sonst das
 *  Datum. */
export function tagesTrennerLabel(createdAt: string, jetzt: Date): string {
  const d = new Date(createdAt);
  const abstand = tageDazwischen(d, jetzt);
  if (abstand === 0) return "Heute";
  if (abstand === 1) return "Gestern";
  if (abstand > 1 && abstand < 7) return WOCHENTAG.format(d);
  return DATUM.format(d);
}

/** Zerlegt eine chronologische Liste in Gruppen je Kalendertag. Reihenfolge
 *  bleibt erhalten — sowohl der Gruppen als auch innerhalb einer Gruppe. */
export function gruppiereNachTag<T extends { createdAt: string }>(
  nachrichten: readonly T[],
): { schluessel: string; nachrichten: T[] }[] {
  const gruppen: { schluessel: string; nachrichten: T[] }[] = [];
  for (const n of nachrichten) {
    const schluessel = tagesSchluessel(new Date(n.createdAt));
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte.schluessel === schluessel) letzte.nachrichten.push(n);
    else gruppen.push({ schluessel, nachrichten: [n] });
  }
  return gruppen;
}
