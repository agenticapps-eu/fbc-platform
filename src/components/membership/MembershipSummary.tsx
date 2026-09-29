import {
  DEFAULT_LEVEL,
  GENANNTE_STUFEN,
  KEIN_CLUBZUGANG_SATZ,
  LEVELS,
  genannterName,
  isMembershipLevel,
} from "../../config/levels";
import { Card } from "../ui/Card";

/**
 * AGE-907: Hier gab es eine Eigenschaft `showManageCta`, die einen Knopf
 * „Mitgliedschaft verwalten" nach `/mitgliedschaft` einblendete. Der Kaufweg
 * ruht (Apple 3.1.1), und sie ist mit dem Knopf entfernt worden — nicht bloß
 * ungenutzt gelassen.
 *
 * Das war eine Korrektur am eigenen Entwurf: geplant war, sie als Rückweg für
 * AGE-908 stehen zu lassen. Dann wäre der Link auf die Route weiter im Baum
 * gestanden, eine Eigenschaft von der Rückkehr entfernt — und
 * `redirect-targets.test.ts` hätte ihn zu Recht als toten Link gemeldet. Eine
 * Ausnahme für diese Datei wäre die schlechtere Hälfte des Tauschs: sie
 * versteckt den nächsten Verstoß. Der Rückweg ist jetzt, den Knopf wieder zu
 * schreiben — vier Zeilen, und sie stehen in der Historie dieses Commits.
 *
 * AGE-969: Unterhalb des Clubs nennt die Karte keine Stufe mehr, sondern sagt,
 * woran man ist. Das ist der einzige sichtbare Inhalt jenes Change — und er
 * trifft die einzige Gruppe, die WÄCHST: Selbstregistrierungen landen dort,
 * der Kaufweg ruht, von dort führt kein Weg nach oben. Ein Satz, der nur sagt,
 * wo der Club beginnt, verschwiege das eine, was das Mitglied wissen muss.
 */
export function MembershipSummary({ current }: { current: string | null }) {
  // Rückfall über `DEFAULT_LEVEL` statt über einen Schlüssel: der Name der
  // untersten Stufe hat mit AGE-903 gewechselt (`basic` → `active`), und ein
  // fest geschriebener Schlüssel wäre beim nächsten Wechsel wieder falsch.
  const cur = current && isMembershipLevel(current) ? LEVELS[current] : LEVELS[DEFAULT_LEVEL];
  const name = genannterName(cur.key);

  // Die nächste Stufe wird aus den GENANNTEN gesucht, nicht aus der ganzen
  // Leiter: von ACTIVE wäre der nächste Rang BOOST, und ein Vorschlag darauf
  // wäre ein Verweis ins Leere.
  const naechste = GENANNTE_STUFEN.find((k) => LEVELS[k].rank > cur.rank);

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          Deine Mitgliedschaft
        </p>
        {name === null ? (
          <p className="mt-1 text-sm text-muted">{KEIN_CLUBZUGANG_SATZ}</p>
        ) : (
          <>
            <p className="mt-1 font-display text-xl font-semibold text-ink">{name}</p>
            <p className="mt-0.5 text-sm text-muted">{cur.summary}</p>
            {naechste && (
              <p className="mt-1 text-sm text-accent-strong">
                Nächster Schritt: {LEVELS[naechste].label}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
