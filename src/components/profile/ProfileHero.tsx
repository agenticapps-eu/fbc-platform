import type { ReactNode } from "react";
import { Avatar } from "../ui/Avatar";
import { tierLabel } from "../../lib/tiers";

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 7l4 4 5-7 5 7 4-4-1.5 11h-15L3 7zm1.8 13h14.4v1.5H4.8V20z" />
    </svg>
  );
}

export interface ProfileHeroProps {
  name: string;
  avatarUrl?: string | null;
  /** Cover-Bild; ohne Wert ein dezenter Gold/Anthrazit-Verlauf (kein Vollschwarz). */
  coverUrl?: string | null;
  tier?: string | null;
  roles?: string[];
  headline?: string | null;
  region?: string | null;
  company?: string | null;
  /** Rechts oben im Body — z. B. „Profil bearbeiten" oder ein Impact-Badge. */
  action?: ReactNode;
  /** Zusätzlicher Inhalt unter dem Identitätsblock (Bio, Stat-Tiles …). */
  children?: ReactNode;
}

/**
 * Profil-Hero (AGE-237) — LinkedIn-Stil: Cover-Banner über die Breite, darauf
 * überlappend ein großes rundes Profilbild, darunter Name/Rollen/Region/Tier.
 * Helle Karte (kein Vollschwarz im Content); Marke über den Gold-Verlauf & Akzente.
 */
export function ProfileHero({
  name,
  avatarUrl,
  coverUrl,
  tier,
  roles = [],
  headline,
  region,
  company,
  action,
  children,
}: ProfileHeroProps) {
  const meta = [region, company].filter(Boolean).join(" · ");
  return (
    <header className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft">
      {/* Cover — warmer Gold-Verlauf (kein Schwarz; der Identitätsblock darunter
          ist hell, daher bleibt der Text lesbar). */}
      <div className="relative h-28 bg-[linear-gradient(120deg,#efe1bd_0%,#cdab5e_55%,#b8893b_100%)] sm:h-40">
        {coverUrl && (
          <img src={coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>

      {/* Body */}
      <div className="px-6 pb-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
            <Avatar
              name={name}
              src={avatarUrl}
              className="-mt-12 h-24 w-24 text-2xl ring-4 ring-canvas sm:-mt-14 sm:h-28 sm:w-28"
            />
            <div className="min-w-0">
              {tier && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold-soft/40 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-gold-strong uppercase">
                  <CrownIcon className="h-3.5 w-3.5" />
                  {tierLabel(tier)} Member
                </span>
              )}
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
                {name}
              </h1>
              {roles.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-sm text-gold-strong">
                  {roles.map((role, i) => (
                    <li key={role} className="flex items-center gap-2">
                      {i > 0 && <span className="text-muted">·</span>}
                      {role}
                    </li>
                  ))}
                </ul>
              ) : (
                headline && <p className="mt-1.5 text-sm text-gold-strong">{headline}</p>
              )}
              {meta && <p className="mt-1.5 text-sm text-muted">{meta}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>

        {children && <div className="mt-5">{children}</div>}
      </div>
    </header>
  );
}

/** Kleines Impact-Score-Badge für den Hero (öffentliches Profil). */
export function HeroImpactBadge({ score }: { score: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-soft px-5 py-3 text-center">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">Impact Score</div>
      <div className="mt-0.5 font-display text-3xl font-semibold text-gold-strong">{score}</div>
    </div>
  );
}
