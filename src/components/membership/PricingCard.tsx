import type { LevelConfig, MembershipLevel } from "../../config/levels";
import { accentBandStyle, monogram } from "../../config/membershipVisuals";
import { Card, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

export interface PricingCardProps {
  level: LevelConfig;
  interval: "month" | "year";
  isCurrent: boolean;
  canUpgrade: boolean;
  recommended?: boolean;
  busy: boolean;
  onUpgrade: (key: MembershipLevel) => void;
}

export default function PricingCard({
  level,
  interval,
  isCurrent,
  canUpgrade,
  recommended = false,
  busy,
  onUpgrade,
}: PricingCardProps) {
  const price = interval === "year" ? level.priceYear : level.priceMonth;
  return (
    <Card
      data-testid={`level-${level.key}`}
      data-current={isCurrent}
      padded={false}
      className={cn(
        "flex flex-col gap-0 overflow-hidden",
        recommended && "ring-2 ring-gold-strong",
      )}
    >
      {/* Akzent-Band mit Rang-Siegel — Verlauf + gravierte Naht nach rank (token-getrieben). */}
      <div
        className="flex items-center justify-between px-6 pb-4 pt-5"
        style={accentBandStyle(level.rank)}
      >
        {recommended ? <Badge variant="strong">Empfohlen</Badge> : <span />}
        {/* Siegel: Gold-Ring (inset) + Emboss-Kante, Serifen-Römerzahl. */}
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full font-display text-base font-semibold tracking-tight leading-none text-gold-strong"
          style={{
            background: "color-mix(in oklab, var(--color-canvas) 72%, transparent)",
            boxShadow:
              "inset 0 0 0 1px color-mix(in oklab, var(--color-gold) 55%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
          }}
        >
          {monogram(level.rank)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <CardTitle>{level.label}</CardTitle>
          {isCurrent && <Badge variant="strong">Aktuell</Badge>}
        </div>
        {/* Feste Höhe (3 Zeilen) → Preis + CTA fluchten über alle Karten. */}
        <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted">{level.summary}</p>
        <p className="text-lg font-semibold text-ink">
          {price === 0 ? "Gratis" : `${price} € / ${interval === "year" ? "Jahr" : "Monat"}`}
        </p>
        {canUpgrade && (
          <div className="mt-auto flex flex-col gap-1">
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => onUpgrade(level.key)}
            >
              Upgrade
            </Button>
            <span className="text-center text-xs text-muted">Testzahlung · Demo</span>
          </div>
        )}
      </div>
    </Card>
  );
}
