import CommunityFeed from "../components/community/CommunityFeed";
import MemberDirectory from "../components/community/MemberDirectory";
import { FormatHero } from "../components/ui/FormatHero";
import { Tabs } from "../components/ui/Tabs";
import { FORMAT_HERO } from "../config/formatHero";
import { useTier } from "../hooks/useTier";
import { TIER_RANK } from "../lib/tiers";

/**
 * Community = Feed + Mitgliederverzeichnis. Der Feed ist für alle Stufen sichtbar;
 * das Verzeichnis ist ein Tab ab Prime (die RLS erzwingt es zusätzlich in der DB).
 * Discover/anon sehen keinen Verzeichnis-Tab, sondern einen dezenten „ab Prime"-Hinweis
 * (Gold-Outline) — keine Fake-Daten.
 */
export default function CommunityPage() {
  const { levelRank } = useTier();
  const canSeeDirectory = (levelRank ?? 0) >= TIER_RANK.prime;

  return (
    <section className="space-y-8">
      <FormatHero meta={FORMAT_HERO["/community"]} />

      {canSeeDirectory ? (
        <Tabs
          tabs={[
            { value: "feed", label: "Feed", content: <CommunityFeed /> },
            { value: "verzeichnis", label: "Verzeichnis", content: <MemberDirectory /> },
          ]}
        />
      ) : (
        <div className="space-y-6">
          <CommunityFeed />
          <DirectoryUpsell />
        </div>
      )}
    </section>
  );
}

/** Dezenter Gold-Outline-Hinweis für Stufen unter Prime — kein Verzeichnis-Tab, keine Daten. */
function DirectoryUpsell() {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-gold/50 bg-gold-soft/20 px-6 py-8 text-center">
      <p className="text-sm font-medium text-ink">Mitgliederverzeichnis</p>
      <p className="mt-1 text-sm text-muted">
        Das durchsuchbare Verzeichnis aller Mitglieder ist ab der Stufe{" "}
        <span className="font-medium text-gold-strong">Prime</span> verfügbar.
      </p>
    </div>
  );
}
