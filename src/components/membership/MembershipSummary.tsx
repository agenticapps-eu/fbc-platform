import { Link } from "react-router-dom";
import { LEVELS, LEVEL_ORDER, isMembershipLevel } from "../../config/levels";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export function MembershipSummary({
  current,
  showManageCta = false,
}: {
  current: string | null;
  showManageCta?: boolean;
}) {
  const cur = current && isMembershipLevel(current) ? LEVELS[current] : LEVELS.basic;
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
      {showManageCta && (
        <Link to="/mitgliedschaft" className="shrink-0">
          <Button variant="ghost" size="sm">
            Mitgliedschaft verwalten
          </Button>
        </Link>
      )}
    </Card>
  );
}
