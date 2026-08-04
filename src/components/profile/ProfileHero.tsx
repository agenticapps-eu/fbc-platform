import type { ReactNode } from "react";
import { Avatar } from "../ui/Avatar";
import { CountUp } from "../ui/Motion";
import { levelLabel } from "../../config/levels";

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
  /**
   * Banner-Bild (pro Mitglied anpassbar — Upload vorbereitet, noch kein Storage-Backend).
   * Ohne Wert ein heller Akzent-Verlauf; mit Wert als Cover-Hintergrund. `coverUrl` bleibt
   * als Alias bestehen.
   */
  bannerUrl?: string | null;
  /** Alias für `bannerUrl` (Altbestand). */
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
 * Profil-Hero (AGE-237) — ruhiges Layout: heller Banner über die Breite, darunter
 * (im normalen Fluss, KEINE Überlappung) das Profilbild neben Name/Rollen/Region/Tier.
 * Das Avatar ragt nie in den Banner — das vermeidet Größen-/Mobile-Probleme. Der
 * Banner ist pro Mitglied anpassbar (Upload vorbereitet); ohne Bild ein heller
 * Akzent-Verlauf (kein Vollschwarz). Helle Karte; Marke über Akzente.
 */
export function ProfileHero({
  name,
  avatarUrl,
  bannerUrl,
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
  const banner = bannerUrl ?? coverUrl;
  return (
    <header className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft">
      {/* Banner — heller Akzent-Verlauf aus Tokens (folgt dem Theme).
          Das Avatar überlappt diesen Block NICHT. */}
      <div className="relative h-24 bg-[linear-gradient(120deg,var(--color-accent-soft),var(--color-canvas)_55%,color-mix(in_srgb,var(--color-accent)_20%,var(--color-canvas)))] sm:h-32">
        {banner && (
          <img
            src={banner}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>

      {/* Body — Avatar + Identität im normalen Fluss UNTER dem Banner (kein -mt). */}
      <div className="px-6 pb-6 pt-5 sm:px-8 sm:pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Avatar
              name={name}
              src={avatarUrl}
              className="h-24 w-24 text-2xl ring-4 ring-canvas sm:h-28 sm:w-28"
            />
            <div className="min-w-0">
              {tier && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent-soft/40 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-accent-strong uppercase">
                  <CrownIcon className="h-3.5 w-3.5" />
                  {levelLabel(tier)} Member
                </span>
              )}
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
                {name}
              </h1>
              {roles.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-sm text-accent-strong">
                  {roles.map((role, i) => (
                    <li key={role} className="flex items-center gap-2">
                      {i > 0 && <span className="text-muted">·</span>}
                      {role}
                    </li>
                  ))}
                </ul>
              ) : (
                headline && <p className="mt-1.5 text-sm text-accent-strong">{headline}</p>
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
      <CountUp
        value={score}
        className="mt-0.5 block font-display text-3xl font-semibold text-accent-strong"
      />
    </div>
  );
}
