import type { ReactNode } from "react";
import { bildUrl } from "../../lib/bild-url";
import { Avatar } from "../ui/Avatar";
import { CountUp } from "../ui/Motion";
import { levelLabel } from "../../config/levels";
import { Icon } from "../ui/icons";

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
 * überlappt weniger (-mt-12 statt -mt-16). Der alte Kommentar ist ersetzt und
 * nicht stehen gelassen — er beschriebe sonst Code, den es nicht mehr gibt.
 *
 * NACHTRAG 25.08.: Die Überlappung gab es bis dahin nur auf dem Papier. Siehe
 * die Begründung an `sm:items-start` weiter unten — gemessen ragte der Avatar
 * 12 px von 112 in den Banner, und auch das nur als Nebenprodukt der
 * Textblockhöhe.
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

          DIE BAHN IST 3:1 UND HAT KEINEN HÖHENDECKEL (AGE-596). Vorher standen
          hier feste Stufen (h-32/sm:h-44/lg:h-56/xl:h-64) mit der Begründung
          aus AGE-566, eine mitwachsende Bahn schiebe den Namen unter die Falz.
          Die Begründung bleibt richtig und ist der bewusst gezahlte Preis:
          gemessen war die Bahn bei 1370 px Fensterbreite 1217 x 256 px, also
          selbst 4,75:1 — und in einem 4,75:1-Feld kann ein 2,70:1-Bild nur
          beschnitten (43,2 % der Höhe fielen weg) oder von breiten Balken
          umgeben sein. Deckel und „ganzes Bild ohne Balken" schließen einander
          aus; entschieden wurde am 25.08. für das ganze Bild.

          3:1 ist kein gewählter Geschmack, sondern das Verhältnis, auf das
          `ProfilPage` bereits zuschneidet.

          Der Verlauf bleibt als Untergrund der Bahn stehen, auch mit Bild: er
          trägt die Fläche, die das eingepasste Bild frei lässt. */}
      <div className="relative aspect-[3/1] bg-[linear-gradient(120deg,var(--color-accent-soft),var(--color-canvas)_55%,color-mix(in_srgb,var(--color-accent)_20%,var(--color-canvas)))]">
        {banner && (
          // `object-contain`, nicht `-cover`: die gespeicherten Bilder liegen
          // zwischen 1,33:1 und 3,00:1 (55 gemessen, Median 2,70:1), keines ist
          // breiter als das Feld. Sie bekommen damit schmale Ränder statt
          // Verluste an den Kanten.
          <img
            src={banner}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </div>

      {/* Body — der Avatar-Block trägt den negativen Rand, nicht der ganze
          Body: so überlappt nur das Bild, und Name/Rollen bleiben im Fluss. */}
      <div className="px-6 pb-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {/* `sm:items-start`, NICHT `items-end` (Befund vom 25.08., gemessen).
              Mit `items-end` richtet Flexbox die Unterkanten aus, und ein
              `margin-top` verschiebt die Marginbox-UNTERKANTE nicht — der
              negative Rand am Avatar war damit wirkungslos. Die Überlappung, die
              trotzdem entstand, war ein Nebenprodukt: Der Avatar ist höher als
              der Textblock und ragte um genau diese Differenz heraus, gemessen
              12 px von 112 (10 %). Sie hing also an der Zeilenzahl des Textes —
              ein Mitglied mit Rollenzeile hätte gar keine gehabt.

              Oben ausgerichtet greift der negative Rand wie beabsichtigt, und
              die Überlappung ist ein fester Wert statt eines Zufalls. */}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
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
              className="relative z-10 -mt-12 h-24 w-24 shrink-0 text-2xl ring-4 ring-canvas sm:-mt-16 sm:h-28 sm:w-28"
            />
            {/* `pt` setzt den Textblock knapp unter die Bannerkante, also neben
                die untere Hälfte des Avatars. Vorher stand hier `pb-1` für die
                Ausrichtung an der Grundlinie — die gibt es mit `items-start`
                nicht mehr. */}
            <div className="min-w-0 pt-2 sm:pt-3">
              {tier && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent-soft/40 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-accent-strong uppercase">
                  <Icon name="crown" className="h-3.5 w-3.5" />
                  {levelLabel(tier)} Member
                </span>
              )}
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
                {name}
              </h1>
              {roles.length > 0 ? (
                <ul className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1 text-sm text-accent-strong">
                  {roles.map((role, i) => (
                    <li key={role} className="flex items-center gap-2">
                      {i > 0 && <span className="text-muted">·</span>}
                      {role}
                    </li>
                  ))}
                </ul>
              ) : (
                headline && <p className="mt-2.5 text-sm text-accent-strong">{headline}</p>
              )}
              {meta && <p className="mt-2 text-sm text-muted">{meta}</p>}
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
