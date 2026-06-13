import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { useToast } from "../components/ui/toast-context";
import {
  fetchPublicProfile,
  publicProfileQueryKey,
  type ExtendedProfile,
  type PublicProfile,
} from "../lib/public-profile";
import { TIER_RANK, tierLabel } from "../lib/tiers";
import { useAuth } from "../providers/auth-context";

// Themen-Reihenfolge & Labels für Erfolgsradar/Interessen (Sein·Tun·Haben·Wirken).
const THEME_ORDER = ["sein", "tun", "haben", "wirken"] as const;
const THEME_LABEL: Record<string, string> = {
  sein: "Sein",
  tun: "Tun",
  haben: "Haben",
  wirken: "Wirken",
};

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 7l4 4 5-7 5 7 4-4-1.5 11h-15L3 7zm1.8 13h14.4v1.5H4.8V20z" />
    </svg>
  );
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user, levelRank } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: publicProfileQueryKey(id ?? ""),
    queryFn: () => fetchPublicProfile(id ?? ""),
    enabled: !!id,
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Profil wird geladen…</p>;
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">Profil konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }
  if (!data?.publicProfile) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink">Profil nicht gefunden</h1>
        <p className="text-sm text-muted">
          Dieses Profil existiert nicht oder ist nicht öffentlich sichtbar.
        </p>
      </div>
    );
  }

  const profile = data.publicProfile;
  const extended = data.extended;
  const isOwn = !!user && user.id === profile.id;
  const isPrimePlus = (levelRank ?? 0) >= TIER_RANK.prime;

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader profile={profile} impactScore={extended?.potential_score ?? null} />

      {extended ? (
        <ExtendedSections extended={extended} />
      ) : (
        <Card className="border-dashed">
          <CardTitle className="text-base">Erweiterte Profilangaben</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Erfolgsradar, Interessen, Kompetenzen und das Such-/Bieteprofil sind ab der
            Mitgliedsstufe <span className="font-medium text-ink">Prime</span> sichtbar.
          </p>
        </Card>
      )}

      <ContactArea
        isOwn={isOwn}
        isPrimePlus={isPrimePlus}
        name={profile.name}
        onRequest={() =>
          toast({
            variant: "success",
            title: "Kontaktanfragen folgen",
            description: "Der Kontakt-Flow wird in Woche 3 (W3) freigeschaltet.",
          })
        }
      />
    </div>
  );
}

function ProfileHeader({
  profile,
  impactScore,
}: {
  profile: PublicProfile;
  impactScore: number | null;
}) {
  return (
    <header className="overflow-hidden rounded-[var(--radius-card)] border border-night-border bg-night text-on-night shadow-soft">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-8">
        <Avatar
          name={profile.name}
          src={profile.avatar_url}
          size="lg"
          className="h-20 w-20 text-xl ring-2 ring-gold/60"
        />
        <div className="min-w-0 flex-1">
          {profile.tier && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-gold uppercase">
              <CrownIcon className="h-3.5 w-3.5" />
              {tierLabel(profile.tier)} Member
            </span>
          )}
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-on-night">
            {profile.name}
          </h1>
          {profile.roles.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-gold">
              {profile.roles.map((role, i) => (
                <li key={role} className="flex items-center gap-2">
                  {i > 0 && <span className="text-on-night-muted">·</span>}
                  {role}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-on-night-muted">
            {[profile.region, profile.company].filter(Boolean).join(" · ") || "—"}
          </p>
          {profile.short_bio && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-night/90">
              {profile.short_bio}
            </p>
          )}
        </div>

        {impactScore !== null && (
          <div className="shrink-0 rounded-[var(--radius-card)] bg-night-elevated px-5 py-4 text-center">
            <div className="text-xs font-medium tracking-wide text-on-night-muted uppercase">
              Impact Score
            </div>
            <div className="mt-1 font-display text-3xl font-semibold text-gold">{impactScore}</div>
          </div>
        )}
      </div>
    </header>
  );
}

function ExtendedSections({ extended }: { extended: ExtendedProfile }) {
  const interestsByTheme = THEME_ORDER.map((theme) => ({
    theme,
    items: extended.interests.filter((i) => i.theme === theme),
  })).filter((g) => g.items.length > 0);
  const untheured = extended.interests.filter((i) => !i.theme);
  const hasRadar = extended.themeScores.length > 0;
  const hasMatching = extended.offers.length > 0 || extended.needs.length > 0;

  return (
    <>
      {hasRadar && (
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Erfolgsradar</CardTitle>
          <ul className="flex flex-col gap-3">
            {THEME_ORDER.map((theme) => {
              const score = extended.themeScores.find((s) => s.theme === theme)?.score;
              if (score == null) return null;
              return (
                <li key={theme} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm text-muted">{THEME_LABEL[theme]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-soft">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${(score / 10) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-medium text-ink">
                    {score.toFixed(1)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {(interestsByTheme.length > 0 || untheured.length > 0) && (
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Interessen</CardTitle>
          <div className="flex flex-col gap-3">
            {interestsByTheme.map((group) => (
              <div key={group.theme}>
                <div className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {THEME_LABEL[group.theme]}
                </div>
                <ChipList items={group.items.map((i) => i.label)} />
              </div>
            ))}
            {untheured.length > 0 && <ChipList items={untheured.map((i) => i.label)} />}
          </div>
        </Card>
      )}

      {extended.competencies.length > 0 && (
        <Card className="flex flex-col gap-3">
          <CardTitle className="text-base">Kompetenzen</CardTitle>
          <ChipList items={extended.competencies} />
        </Card>
      )}

      {hasMatching && (
        <Card className="flex flex-col gap-5">
          <CardTitle className="text-base">Such- & Bieteprofil</CardTitle>
          <div className="grid gap-6 sm:grid-cols-2">
            <MatchingColumn
              title="Ich suche"
              empty="Keine Gesuche hinterlegt."
              items={extended.needs}
            />
            <MatchingColumn
              title="Ich biete"
              empty="Keine Angebote hinterlegt."
              items={extended.offers}
            />
          </div>
        </Card>
      )}
    </>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Badge variant="neutral">{item}</Badge>
        </li>
      ))}
    </ul>
  );
}

function MatchingColumn({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { id: string; title: string; description: string | null; category: string | null }[];
}) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-gold-strong uppercase">{title}</div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-card)] border border-line bg-soft p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{item.title}</span>
                {item.category && <Badge variant="prime">{item.category}</Badge>}
              </div>
              {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactArea({
  isOwn,
  isPrimePlus,
  name,
  onRequest,
}: {
  isOwn: boolean;
  isPrimePlus: boolean;
  name: string;
  onRequest: () => void;
}) {
  if (isOwn) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Das ist dein öffentliches Profil.</p>
        <Link to="/profil">
          <Button variant="secondary" size="sm">
            Profil bearbeiten
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      <CardTitle className="text-base">Kontakt</CardTitle>
      {isPrimePlus ? (
        <>
          <p className="text-sm text-muted">
            Sende {name} eine Kontaktanfrage. Erst nach Annahme werden Kontaktdaten geteilt.
          </p>
          <div>
            <Button variant="primary" size="sm" onClick={onRequest}>
              Kontaktanfrage senden
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">
          Kontaktanfragen sind ab der Mitgliedsstufe{" "}
          <span className="font-medium text-ink">Prime</span> möglich.
        </p>
      )}
      <p className="text-xs text-muted">E-Mail und Telefon werden nie automatisch angezeigt.</p>
    </Card>
  );
}
