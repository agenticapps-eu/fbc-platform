import { useState } from "react";
import { LEVELS, LEVEL_ORDER, LEVEL_RANK, type MembershipLevel } from "../config/levels";
import { useAuth } from "../providers/auth-context";
import { supabase } from "../lib/supabase";
import { useToast } from "../components/ui/toast-context";
import { cn } from "../lib/cn";
import PricingCard from "../components/membership/PricingCard";
import { MembershipSummary } from "../components/membership/MembershipSummary";

type Interval = "month" | "year";
const PAID: MembershipLevel[] = ["discover", "exchange", "focus", "impact"];
const RECOMMENDED: MembershipLevel = "discover";

export default function MitgliedschaftPage() {
  const { tier, levelRank } = useAuth();
  const { toast } = useToast();
  const [interval, setInterval] = useState<Interval>("year");
  const [busy, setBusy] = useState<MembershipLevel | null>(null);
  const currentRank = levelRank ?? 0;

  async function startUpgrade(level: MembershipLevel) {
    setBusy(level);
    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { level, interval },
    });
    setBusy(null);
    if (error || !data?.url) {
      toast({
        variant: "error",
        title: "Upgrade konnte nicht gestartet werden",
        description: "Bitte versuche es erneut oder wende dich an den Support.",
      });
      return;
    }
    window.location.assign(data.url as string);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Mitgliedschaft</h1>
        <div className="flex gap-1 rounded-full border border-line p-1">
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              interval === "year" && "bg-gold-strong text-canvas",
            )}
          >
            Jährlich
          </button>
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              interval === "month" && "bg-gold-strong text-canvas",
            )}
          >
            Monatlich
          </button>
        </div>
      </div>

      <MembershipSummary current={tier} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LEVEL_ORDER.map((key) => (
          <PricingCard
            key={key}
            level={LEVELS[key]}
            interval={interval}
            isCurrent={tier === key}
            canUpgrade={PAID.includes(key) && LEVEL_RANK[key] > currentRank}
            recommended={key === RECOMMENDED}
            busy={busy === key}
            onUpgrade={startUpgrade}
          />
        ))}
      </div>
    </div>
  );
}
