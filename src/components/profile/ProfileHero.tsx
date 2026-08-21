import type { ReactNode } from "react";
import { bildUrl } from "../../lib/bild-url";
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
 * Profil-Hero (AGE-237, Aufbau nach dem Mockup vom 29.07. — AGE-498).
 *
 * Hintergrundbild über die volle Breite, davor ÜBERLAPPEND das Profilbild,
 * daneben Name, Stufen-Badge, Rollen und Region. Ohne Bild springt ein heller
 * Akzent-Verlauf ein (kein Vollschwarz) — die Ansicht hängt nie an einem
 * gesetzten Bild.
 *
 * Bis AGE-498 stand hier ausdrücklich das Gegenteil: „KEINE Überlappung … das
 * Avatar ragt nie in den Banner", mit der Begründung, das vermeide
 * Größen-/Mobile-Probleme. Das Mockup verlangt die Überlappung, und sie ist
 * hier auf den negativen Rand am Avatar-Block beschränkt: der Banner behält
 * seine Höhe, der Textblock bleibt im Fluss, und auf schmalen Schirmen
 * überlappt weniger (-mt-10 statt -mt-14). Der alte Kommentar ist ersetzt und
 * nicht stehen gelassen — er beschriebe sonst Code, den es nicht mehr gibt.
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
  // `bannerUrl` und `coverUrl` sind zwei Namen für dasselbe Hintergrundbild;
  // aufgelöst wird gegen den Bucket `covers` (AGE-580).
  const banner = bildUrl("covers", bannerUrl ?? coverUrl ?? null);
  return (
    <header className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft">
      {/* Hintergrundbild — ohne Bild ein heller Akzent-Verlauf aus Tokens, der
          dem Theme folgt. Das Profilbild ragt hinein (siehe unten).

          DIE HÖHE WÄCHST MIT DER BREITE (AGE-566). Vorher stand sie fest auf
          h-28/sm:h-40 — auf einem 1150 px breiten Schirm ergab das ein
          Seitenverhältnis von rund 7:1, und `object-cover` schnitt aus jedem
          normalen Foto einen waagerechten Splitter heraus. Gemeldet als „zu
          klein, skaliert nicht gut".

          Feste Stufen statt `aspect-[…]`: die Bahn soll auf grossen Schirmen
          NICHT unbegrenzt mitwachsen, sonst schiebt sie den Namen unter die
          Falz. 256 px bei 1150 px Breite sind rund 4,5:1 — genug, dass ein
          Motiv erkennbar bleibt, ohne den Kopfbereich zu einer Bildseite zu
          machen. */}
      <div className="relative h-32 bg-[linear-gradient(120deg,var(--color-accent-soft),var(--color-canvas)_55%,color-mix(in_srgb,var(--color-accent)_20%,var(--color-canvas)))] sm:h-44 lg:h-56 xl:h-64">
        {banner && (
          <img
            src={banner}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>

      {/* Body — der Avatar-Block trägt den negativen Rand, nicht der ganze
          Body: so überlappt nur das Bild, und Name/Rollen bleiben im Fluss. */}
      <div className="px-6 pb-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
            {/* `relative z-10` ist NICHT Kosmetik, sondern trägt die Überlappung.
                Der Banner oben ist `relative`, also POSITIONIERT — und
                positionierte Elemente werden über statischem Inhalt gemalt,
                unabhängig von der Reihenfolge im DOM. Ohne diese Klassen liegt
                der Avatar deshalb IMMER unter dem Banner; `elementFromPoint` auf
                der Überlappung traf das Banner-`img` statt den Avatar. Sichtbar
                wurde es erst mit AGE-534, als die ersten Mitglieder ein
                Headerbild bekamen — davor verdeckte ein heller Verlauf, was
                genauso falsch stand. */}
            <Avatar
              name={name}
              src={avatarUrl}
              className="relative z-10 -mt-10 h-24 w-24 shrink-0 text-2xl ring-4 ring-canvas sm:-mt-14 sm:h-28 sm:w-28"
            />
            {/* pb bringt den Textblock auf die Grundlinie des überlappenden
                Avatars — ohne ihn steht der Name am oberen Bildrand. */}
            <div className="min-w-0 pb-1">
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
