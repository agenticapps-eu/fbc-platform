import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context";
import { LEVEL_RANK, levelLabel, type MembershipLevel } from "../config/levels";
import { FORMAT_HERO } from "../config/formatHero";
import { FormatHero } from "./ui/FormatHero";
import { Button } from "./ui/Button";

/**
 * Gate für Routen mit `minTier` sowie für auth-pflichtige `entdecken`-Routen
 * (siehe `gatedElement` in App.tsx). Anders als <RequireAuth> leitet dieses Gate
 * anonyme oder zu niedrig gestufte Besucher NICHT weg, sondern zeigt eine
 * „Mitglied werden"-Wand — der Bereich bleibt im Schaufenster sichtbar, der Inhalt
 * aber gesperrt (Spec §1). Die echte Zugriffskontrolle bleibt die Supabase-RLS.
 */
export default function MembershipGate({
  min,
  children,
}: {
  min?: MembershipLevel;
  children: ReactNode;
}) {
  const { user, levelRank, isLoading, tierLoading } = useAuth();
  if (isLoading || (user && tierLoading)) return null; // kein Flackern
  const tierOk = !min || (levelRank ?? 0) >= LEVEL_RANK[min];
  if (user && tierOk) return <>{children}</>;
  // anon ODER eingeloggt-aber-Stufe-zu-niedrig → Wand
  return <MembershipWall min={min} loggedIn={!!user} />;
}

function MembershipWall({ min, loggedIn }: { min?: MembershipLevel; loggedIn: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hero = FORMAT_HERO[pathname];
  return (
    <div className="flex flex-col gap-6">
      {hero && <FormatHero meta={hero} />}
      <div className="rounded-[var(--radius-card)] border border-accent/25 bg-canvas/60 p-8 text-center shadow-soft">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {min
            ? `Dieser Bereich ist ab ${levelLabel(min)} verfügbar`
            : "Dieser Bereich ist Mitgliedern vorbehalten"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          {loggedIn
            ? "Deine Mitgliedsstufe reicht für diesen Bereich noch nicht."
            : "Werde Mitglied im Fair Business Club, um Zugang zu erhalten."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {loggedIn ? (
            <Button variant="primary" onClick={() => navigate("/mitgliedschaft")}>
              Upgrade
            </Button>
          ) : (
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
