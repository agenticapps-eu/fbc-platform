import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TierBadge } from "../ui/TierBadge";
import { DashboardSkeleton } from "../ui/Skeleton";
import { levelLabel } from "../../config/levels";
import { dashboardQueryKey, fetchDashboard } from "../../lib/dashboard";
import { displayAuthor } from "../../lib/displayAuthor";
import { eventsListKey, fetchEvents, formatEventDate, partitionEvents } from "../../lib/events";
import { feedQueryKey, fetchFeed } from "../../lib/feed";
import {
  directoryQueryKey,
  emptyDirectoryFilters,
  fetchDirectoryBaseline,
} from "../../lib/directory";

/**
 * Persönliches Mitglieder-Dashboard (`/`, eingeloggt) — Nav-IA-Spec §3
 * („Startseite → persönliches Dashboard"). Ruhige Übersicht statt vollem Feed:
 * Willkommen, vier Kennzahlen (Compass %, Empfehlungen, nächstes Event, Plan),
 * frische Aktivität, passende Mitglieder und konkrete nächste Schritte.
 *
 * Echte, RLS-gegatete Daten (kein Dummy): Was die RLS nicht freigibt — etwa das
 * Verzeichnis unterhalb der freigeschalteten Stufe — zeigt einen Leerzustand.
 * Rein token-getrieben gestylt, trägt also jede Design-Variante (inkl. sommerfest).
 */
export function MemberDashboard({ uid }: { uid: string }) {
  const dashQuery = useQuery({
    queryKey: dashboardQueryKey(uid),
    queryFn: () => fetchDashboard(uid),
  });
  const eventsQuery = useQuery({
    queryKey: eventsListKey(uid),
    queryFn: () => fetchEvents(uid),
  });
  const feedQuery = useQuery({
    queryKey: feedQueryKey(uid, null),
    queryFn: () => fetchFeed({ uid }),
  });
  const membersQuery = useQuery({
    queryKey: directoryQueryKey(emptyDirectoryFilters),
    queryFn: fetchDirectoryBaseline,
  });

  if (dashQuery.isLoading) return <DashboardSkeleton />;
  if (dashQuery.isError || !dashQuery.data) {
    return (
      <p className="text-sm text-danger">Dashboard konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }

  const { profile } = dashQuery.data;
  const firstName = profile.name.split(" ")[0];
  const nextEvent = eventsQuery.data
    ? (partitionEvents(eventsQuery.data, new Date()).upcoming[0] ?? null)
    : null;
  const posts = (feedQuery.data ?? []).slice(0, 2);
  const members = (membersQuery.data ?? []).filter((m) => m.id !== uid).slice(0, 3);
  const steps = buildNextSteps(profile.profile_completion, nextEvent);

  return (
    <div className="space-y-10">
      <section className="rounded-[var(--radius-card)] border border-gold/30 bg-gold-soft/25 px-6 py-9 sm:px-10 sm:py-11">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Willkommen zurück, {firstName}! <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted">
          Schön, dass du da bist. Entdecke neue Chancen, spannende Menschen und wertvolle Impulse.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashTile
          label="Mein Compass"
          value={`${profile.profile_completion}%`}
          sub="Profilvollständigkeit"
          to="/profil/bearbeiten"
          cta="Weiter bearbeiten"
        />
        {/* AGE-450: „Neue Empfehlungen" (→ /meine-chancen) entfernt — Chancen sind
            fürs Sommerfest raus. */}
        <DashTile
          label="Nächstes Event"
          value={nextEvent ? nextEvent.title : "—"}
          valueClassName="text-xl"
          sub={
            nextEvent
              ? [formatEventDate(nextEvent.startsAt), nextEvent.location]
                  .filter(Boolean)
                  .join(" · ")
              : "Aktuell kein Event geplant"
          }
          to={nextEvent ? `/events/${nextEvent.id}` : undefined}
          cta="Zum Event"
        />
        <DashTile
          label="Mein Plan"
          value={levelLabel(profile.tier)}
          valueClassName="text-2xl"
          sub="Deine aktuelle Mitgliedschaft"
          to="/mitgliedschaft"
          cta="Plan verwalten"
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <SectionHeader title="Neu in der Aktivität" to="/aktivitaet" cta="Zur Aktivität" />
          {feedQuery.isLoading ? (
            <p className="text-sm text-muted">Beiträge werden geladen…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Beiträge.</p>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => {
                const author = displayAuthor(post.author, true);
                return (
                  <li key={post.id}>
                    <Card className="space-y-3">
                      <header className="flex items-center gap-3">
                        <Avatar
                          name={author.name}
                          src={author.avatarUrl}
                          masked={author.masked}
                          size="sm"
                          className="ring-1 ring-gold/40"
                        />
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="font-display text-sm font-semibold text-ink">
                            {author.name}
                          </span>
                          {post.author.tier && <TierBadge tier={post.author.tier} />}
                        </div>
                      </header>
                      <p className="line-clamp-2 text-sm text-ink/90">{post.body}</p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader title="Neue Mitglieder für dich" to="/mitglieder" cta="Alle Mitglieder" />
          {membersQuery.isLoading ? (
            <p className="text-sm text-muted">Mitglieder werden geladen…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted">
              Sobald mehr Mitglieder für dich sichtbar sind, erscheinen hier Empfehlungen.
            </p>
          ) : (
            <ul className="space-y-3">
              {members.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/p/${m.id}`}
                    className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-canvas px-3 py-2.5 transition-colors hover:border-gold/50"
                  >
                    <Avatar
                      name={m.name ?? "Mitglied"}
                      src={m.avatar_url}
                      size="sm"
                      className="ring-1 ring-gold/40"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold text-ink">
                        {m.name ?? "Mitglied"}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[m.region, m.company].filter(Boolean).join(" · ") || levelLabel(m.tier)}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-gold-strong">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Deine nächsten Schritte
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.label}>
              <Link
                to={step.to}
                className="flex h-full flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-canvas p-4 transition-colors hover:border-gold/50"
              >
                <span className="font-display text-base font-semibold text-ink">{step.label}</span>
                <span className="text-sm text-muted">{step.detail}</span>
                <span className="mt-auto pt-2 text-sm font-medium text-gold-strong">
                  Los geht's →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-gold/30 bg-gold-soft/25 px-6 py-6 sm:px-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-semibold text-ink">Gemeinsam mehr bewegen.</p>
            <p className="text-sm text-muted">Fair. Wertebasiert. Nachhaltig.</p>
          </div>
          <Link to="/mitglieder">
            <Button variant="primary">Mitglieder entdecken</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

interface NextStep {
  label: string;
  detail: string;
  to: string;
}

/** Konkrete nächste Schritte aus echtem Zustand (Compass-Lücke, nächstes Event). */
function buildNextSteps(
  completion: number,
  nextEvent: { id: string; title: string } | null,
): NextStep[] {
  const steps: NextStep[] = [];
  if (completion < 80) {
    steps.push({
      label: "Compass vervollständigen",
      detail: `Noch ${80 - completion}% bis zu besseren Empfehlungen`,
      to: "/profil/bearbeiten",
    });
  }
  if (nextEvent) {
    steps.push({
      label: "Beim nächsten Event dabei sein",
      detail: nextEvent.title,
      to: `/events/${nextEvent.id}`,
    });
  }
  steps.push({
    label: "Neue Kontakte knüpfen",
    detail: "Lerne passende Mitglieder kennen",
    to: "/mitglieder",
  });
  return steps.slice(0, 3);
}

function DashTile({
  label,
  value,
  sub,
  to,
  cta,
  valueClassName = "text-3xl",
}: {
  label: string;
  value: ReactNode;
  sub: string;
  to?: string;
  cta: string;
  valueClassName?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <p className={`font-display font-semibold text-ink ${valueClassName}`}>{value}</p>
      <p className="truncate text-sm text-muted">{sub}</p>
      {to && (
        <Link to={to} className="mt-auto pt-3 text-sm font-medium text-gold-strong hover:underline">
          {cta} →
        </Link>
      )}
    </Card>
  );
}

function SectionHeader({ title, to, cta }: { title: string; to: string; cta: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <Link to={to} className="shrink-0 text-sm font-medium text-gold-strong hover:underline">
        {cta} →
      </Link>
    </div>
  );
}
