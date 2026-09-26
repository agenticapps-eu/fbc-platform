import { DEFAULT_LEVEL, LEVELS, LEVEL_ORDER, isMembershipLevel } from "../../config/levels";
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
 */
export function MembershipSummary({ current }: { current: string | null }) {
  // Rückfall über `DEFAULT_LEVEL` statt über einen Schlüssel: der Name der
  // untersten Stufe hat mit AGE-903 gewechselt (`basic` → `active`), und ein
  // fest geschriebener Schlüssel wäre beim nächsten Wechsel wieder falsch.
  const cur = current && isMembershipLevel(current) ? LEVELS[current] : LEVELS[DEFAULT_LEVEL];
  const nextKey = LEVEL_ORDER.find((k) => LEVELS[k].rank === cur.rank + 1);
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          Deine Mitgliedschaft
        </p>
        <p className="mt-1 font-display text-xl font-semibold text-ink">{cur.label}</p>
        <p className="mt-0.5 text-sm text-muted">{cur.summary}</p>
        {nextKey && (
          <p className="mt-1 text-sm text-accent-strong">
            Nächster Schritt: {LEVELS[nextKey].label}
          </p>
        )}
      </div>
    </Card>
  );
}
