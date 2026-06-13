import { Link } from "react-router-dom";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { useTier } from "../hooks/useTier";
import { TIER_RANK } from "../lib/tiers";

/**
 * Community = Feed + Mitgliederverzeichnis. Der Feed ist für alle Stufen sichtbar;
 * das Verzeichnis ist ein Unterbereich ab Prime (RLS erzwingt es zusätzlich in der DB).
 * Gesperrte Bereiche werden als dezenter „ab Prime"-Hinweis gezeigt, nicht hart versteckt.
 */
export default function CommunityPage() {
  const { levelRank } = useTier();
  const canSeeDirectory = (levelRank ?? 0) >= TIER_RANK.prime;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Community</h1>
        <p className="mt-2 text-sm text-muted">
          Aktivitäten, Beiträge und das Mitgliederverzeichnis.
        </p>
      </header>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted/80">Feed</p>
        <Card>
          <CardTitle>Noch keine Beiträge</CardTitle>
          <CardDescription>
            Sobald Mitglieder etwas teilen, erscheinen ihre Beiträge hier.
          </CardDescription>
        </Card>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted/80">Verzeichnis</p>
        {canSeeDirectory ? (
          <Link
            to="/verzeichnis"
            className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-soft"
          >
            <Card className="transition-shadow hover:shadow-[0_1px_2px_rgba(20,21,26,0.06),0_20px_48px_-24px_rgba(20,21,26,0.35)]">
              <CardTitle>Mitgliederverzeichnis</CardTitle>
              <CardDescription>
                Mitglieder durchsuchen, Profile ansehen und Kontakt anfragen.
              </CardDescription>
            </Card>
          </Link>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-dashed border-gold/50 bg-gold-soft/20 px-6 py-8 text-center">
            <p className="text-sm font-medium text-ink">Mitgliederverzeichnis</p>
            <p className="mt-1 text-sm text-muted">
              Das vollständige Verzeichnis ist ab der Stufe{" "}
              <span className="font-medium text-gold-strong">Prime</span> verfügbar.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
