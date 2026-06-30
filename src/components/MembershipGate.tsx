import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context";
import { TIER_RANK, tierLabel, type MembershipTier } from "../lib/tiers";
import { FORMAT_HERO } from "../config/formatHero";
import { FormatHero } from "./ui/FormatHero";
import { Button } from "./ui/Button";

/**
 * Gate für die `formate`-Routen. Anders als <RequireAuth>/<RequireTier> leitet
 * dieses Gate anonyme oder zu niedrig gestufte Besucher NICHT weg, sondern zeigt
 * eine „Mitglied werden"-Wand — das Format bleibt im Schaufenster sichtbar, der
 * Inhalt aber gesperrt. Die echte Zugriffskontrolle bleibt die Supabase-RLS.
 */
export default function MembershipGate({
  min,
  children,
}: {
  min?: MembershipTier;
  children: ReactNode;
}) {
  const { user, levelRank, isLoading, tierLoading } = useAuth();
  if (isLoading || (user && tierLoading)) return null; // kein Flackern
  const tierOk = !min || (levelRank ?? 0) >= TIER_RANK[min];
  if (user && tierOk) return <>{children}</>;
  // anon ODER eingeloggt-aber-Stufe-zu-niedrig → Wand
  return <MembershipWall min={min} loggedIn={!!user} />;
}

function MembershipWall({ min, loggedIn }: { min?: MembershipTier; loggedIn: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hero = FORMAT_HERO[pathname];
  return (
    <div className="flex flex-col gap-6">
      {hero && <FormatHero meta={hero} />}
      <div className="rounded-[var(--radius-card)] border border-gold/25 bg-canvas/60 p-8 text-center shadow-soft">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {min
            ? `Dieser Bereich ist ab ${tierLabel(min)} verfügbar`
            : "Dieser Bereich ist Mitgliedern vorbehalten"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          {loggedIn
            ? "Deine Mitgliedsstufe reicht für diesen Bereich noch nicht."
            : "Werde Mitglied im Fair Business Club, um Zugang zu erhalten."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!loggedIn && (
            <Button variant="primary" onClick={() => navigate("/login")}>
              Mitglied werden
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate("/")}>
            Zur Startseite
          </Button>
        </div>
      </div>
    </div>
  );
}
