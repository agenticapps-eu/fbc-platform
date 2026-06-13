import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MeinBereichSidebar } from "../components/dashboard/MeinBereichSidebar";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { cn } from "../lib/cn";
import {
  dashboardQueryKey,
  fetchDashboard,
  THEME_LABEL,
  THEME_ORDER,
  type DashboardBadge,
  type DashboardData,
  type DashboardEvent,
  type DashboardProfile,
} from "../lib/dashboard";
import { GOAL_CATEGORIES } from "../lib/profile";
import { tierLabel } from "../lib/tiers";
import { useAuth } from "../providers/auth-context";

// Recharts nur für diese Route laden — hält die schwere Lib aus dem Haupt-Bundle.
const ErfolgsradarChart = lazy(() =>
  import("../components/dashboard/ErfolgsradarChart").then((m) => ({
    default: m.ErfolgsradarChart,
  })),
);

// ── Demo-Daten (profile-spec §5: DEMO-Widgets, in Phase 2 durch echte Daten ersetzt) ──
const DEMO_COMMUNITIES = [
  { name: "Unternehmer-Kreis Süd", members: 142 },
  { name: "Immobilien & Beteiligungen", members: 87 },
  { name: "Legacy Mastermind", members: 24 },
];
const DEMO_NETWORK = [
  { label: "Freunde", count: 24 },
  { label: "Preferred Partner", count: 8 },
  { label: "Mentoren", count: 3 },
  { label: "Mentees", count: 5 },
];
const DEMO_STATS = [
  { label: "Neue Kontakte", value: 12, trend: "+4" },
  { label: "Profilaufrufe", value: 148, trend: "+22" },
  { label: "Nachrichten", value: 36, trend: "+9" },
  { label: "Match-Anfragen", value: 7, trend: "+2" },
  { label: "Event-Teilnahmen", value: 3, trend: "+1" },
];
const DEMO_PROJECTS = [
  { title: "Quartiersentwicklung Stuttgart-West", progress: 64 },
  { title: "FBC Impact Fonds I", progress: 38 },
];
const DEMO_INVESTMENTS = [
  { title: "Beteiligung TechVentures GmbH", perf: 18.4 },
  { title: "Immobilienportfolio Süd", perf: 6.1 },
  { title: "Green Energy SPV", perf: -2.3 },
];
const DEMO_KI_CHIPS = [
  "Wer passt zu meinem aktuellen Gesuch?",
  "Welche Events lohnen sich diese Woche?",
  "Zeig mir passende Mentoren",
];
const DEMO_EVENTS: DashboardEvent[] = [
  {
    status: "registered",
    checked_in: false,
    event: {
      id: "demo-1",
      title: "Legacy Dinner Stuttgart",
      type: "dinner",
      starts_at: "2026-07-02T18:00:00Z",
      location: "Stuttgart",
    },
  },
  {
    status: "registered",
    checked_in: false,
    event: {
      id: "demo-2",
      title: "Mastermind: Nachfolge & Beteiligung",
      type: "mastermind",
      starts_at: "2026-07-14T16:00:00Z",
      location: "Online",
    },
  },
];
const DEMO_POSTS = [
  {
    title: "Warum Ökosysteme die Zukunft des Mittelstands sind",
    kind: "Artikel",
    meta: "1,2k Views · 84 Likes",
  },
  {
    title: "Deal-Keeping im Family Office (Podcast)",
    kind: "Podcast",
    meta: "640 Views · 51 Likes",
  },
];

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

function formatDate(value: string | null, fmt: Intl.DateTimeFormat): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : fmt.format(d);
}

export default function MeinBereichPage() {
  const { user } = useAuth();
  // /mein-bereich ist requiresAuth — user ist hier vorhanden; defensiver Fallback.
  if (!user) return null;
  return <Dashboard uid={user.id} />;
}

function Dashboard({ uid }: { uid: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: dashboardQueryKey(uid),
    queryFn: () => fetchDashboard(uid),
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Dashboard wird geladen…</p>;
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-danger">Dashboard konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <MeinBereichSidebar />

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <DashboardHeader data={data} />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ErfolgsradarWidget data={data} />
          <EntwicklungWidget profile={data.profile} />
          <InteressenWidget data={data} />
          <EventsWidget events={data.events} />
          <CommunitiesWidget />
          <NetzwerkWidget contactsCount={data.contactsCount} />
          <MatchingWidget data={data} />
          <StatistikWidget />
          <ImpactWidget score={data.profile.potential_score} />
          <ProjekteWidget />
          <InvestmentsWidget />
          <BeitraegeWidget data={data} />
          <AuszeichnungenWidget badges={data.badges} />
          <ZieleWidget data={data} />
          <KIAssistentWidget />
        </div>
      </div>
    </div>
  );
}

// ── Bausteine ─────────────────────────────────────────────────────────────────
function DemoBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-gold-soft/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gold-strong uppercase"
      title="Demo-Daten — wird in Phase 2 mit echten Daten gefüllt."
    >
      Demo
    </span>
  );
}

function DashboardCard({
  id,
  title,
  demo,
  action,
  className,
  children,
}: {
  id?: string;
  title: string;
  demo?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className={cn("flex scroll-mt-24 flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {demo && <DemoBadge />}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-xs font-medium text-gold-strong hover:text-gold">
      {children}
    </Link>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 7l4 4 5-7 5 7 4-4-1.5 11h-15L3 7zm1.8 13h14.4v1.5H4.8V20z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Header (CORE, §3) ─────────────────────────────────────────────────────────
function DashboardHeader({ data }: { data: DashboardData }) {
  const p = data.profile;
  return (
    <header
      id="uebersicht"
      className="scroll-mt-24 overflow-hidden rounded-[var(--radius-card)] border border-night-border bg-night text-on-night shadow-soft"
    >
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-8">
        <Avatar
          name={p.name}
          src={p.avatar_url}
          size="lg"
          className="h-20 w-20 text-xl ring-2 ring-gold/60"
        />
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-gold uppercase">
            <CrownIcon className="h-3.5 w-3.5" />
            {tierLabel(p.tier)} Member
          </span>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-on-night">
            {p.name}
          </h1>
          {p.roles.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-gold">
              {p.roles.map((role, i) => (
                <li key={role} className="flex items-center gap-2">
                  {i > 0 && <span className="text-on-night-muted">·</span>}
                  {role}
                </li>
              ))}
            </ul>
          ) : (
            p.headline && <p className="mt-2 text-sm text-gold">{p.headline}</p>
          )}
          <p className="mt-2 text-sm text-on-night-muted">
            {[p.region, p.company].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="mt-3 text-xs text-on-night-muted">
            Mitglied seit: {formatDate(p.member_since, monthFmt)}
            {p.member_number && <> · Mitgliedsnummer: {p.member_number}</>}
          </p>
        </div>
        <Link to="/profil" className="shrink-0">
          <Button variant="ghost" size="sm">
            Profil bearbeiten
          </Button>
        </Link>
      </div>

      {/* Stat-Tiles (§3) — Impact CORE, Netzwerk/Matches/Events CORE-Counts, Projekte DEMO. */}
      <div className="grid grid-cols-2 gap-px border-t border-night-border bg-night-border sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Impact Score" value={p.potential_score} trend="+12" />
        <StatTile label="Netzwerk" value={data.contactsCount} />
        <StatTile label="Matches" value={data.matchStats.successful} />
        <StatTile label="Projekte" value={DEMO_PROJECTS.length} demo />
        <StatTile label="Events" value={data.eventsCount} />
      </div>
    </header>
  );
}

function StatTile({
  label,
  value,
  trend,
  demo,
}: {
  label: string;
  value: number;
  trend?: string;
  demo?: boolean;
}) {
  return (
    <div className="bg-night px-4 py-4">
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-on-night-muted uppercase">
        {label}
        {demo && <DemoBadge />}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold text-on-night">{value}</span>
        {trend && <span className="text-xs font-medium text-positive">↑ {trend}</span>}
      </div>
    </div>
  );
}

// 1 ── Erfolgsradar (CORE) ─────────────────────────────────────────────────────
function ErfolgsradarWidget({ data }: { data: DashboardData }) {
  return (
    <DashboardCard id="erfolgsradar" title="Mein Erfolgsradar">
      {data.themeScores.length > 0 ? (
        <Suspense fallback={<div className="h-56 w-full" />}>
          <ErfolgsradarChart scores={data.themeScores} />
        </Suspense>
      ) : (
        <EmptyHint>Noch keine Themen-Scores. Sie entstehen aus deinem Compass.</EmptyHint>
      )}
    </DashboardCard>
  );
}

// 2 ── Meine Entwicklung (CORE) ────────────────────────────────────────────────
function EntwicklungWidget({ profile }: { profile: DashboardProfile }) {
  const hasContent = profile.dev_focus || profile.next_steps.length > 0 || profile.dev_progress > 0;
  return (
    <DashboardCard id="entwicklung" title="Meine Entwicklung">
      {hasContent ? (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Aktueller Fokus</span>
              <span className="font-medium text-ink">
                {profile.dev_focus ? THEME_LABEL[profile.dev_focus] : "—"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar value={profile.dev_progress} />
              <span className="w-10 shrink-0 text-right text-sm font-medium text-ink">
                {profile.dev_progress}%
              </span>
            </div>
          </div>
          {profile.next_steps.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Nächste Schritte
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {profile.next_steps.map((step) => (
                  <li key={step} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gold text-gold">
                      <CheckIcon className="h-2.5 w-2.5" />
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <EmptyHint>Lege deinen Entwicklungs-Fokus im Profil-Editor fest.</EmptyHint>
      )}
      <Link to="/compass" className="mt-auto">
        <Button variant="ghost" size="sm" className="w-full">
          Zur persönlichen Roadmap
        </Button>
      </Link>
    </DashboardCard>
  );
}

// 3 ── Meine Interessen (CORE) ─────────────────────────────────────────────────
function InteressenWidget({ data }: { data: DashboardData }) {
  const groups = THEME_ORDER.map((theme) => ({
    theme,
    items: data.interests.filter((i) => i.theme === theme),
  })).filter((g) => g.items.length > 0);
  const untheured = data.interests.filter((i) => !i.theme);

  return (
    <DashboardCard
      id="interessen"
      title="Meine Interessen"
      action={<CardLink to="/profil">Bearbeiten</CardLink>}
    >
      {data.interests.length > 0 ? (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.theme}>
              <div className="text-xs font-semibold tracking-wide text-muted uppercase">
                {THEME_LABEL[group.theme]}
              </div>
              <ChipList items={group.items.map((i) => i.label)} />
            </div>
          ))}
          {untheured.length > 0 && <ChipList items={untheured.map((i) => i.label)} />}
        </div>
      ) : (
        <EmptyHint>Noch keine Interessen hinterlegt.</EmptyHint>
      )}
    </DashboardCard>
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

// 4 ── Meine gebuchten Events (CORE soweit Daten, sonst DEMO) ──────────────────
function EventsWidget({ events }: { events: DashboardEvent[] }) {
  const isDemo = events.length === 0;
  const rows = isDemo ? DEMO_EVENTS : events;
  return (
    <DashboardCard
      id="events"
      title="Meine gebuchten Events"
      demo={isDemo}
      action={<CardLink to="/events">Alle anzeigen</CardLink>}
    >
      <ul className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <li key={row.event?.id ?? i} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{row.event?.title ?? "Event"}</p>
              <p className="text-xs text-muted">
                {formatDate(row.event?.starts_at ?? null, dateFmt)}
                {row.event?.location && <> · {row.event.location}</>}
              </p>
            </div>
            {row.event?.type && <Badge variant="prime">{row.event.type}</Badge>}
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 5 ── Meine Communities (DEMO) ────────────────────────────────────────────────
function CommunitiesWidget() {
  return (
    <DashboardCard id="communities" title="Meine Communities" demo>
      <ul className="flex flex-col gap-3">
        {DEMO_COMMUNITIES.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium text-ink">{c.name}</span>
            <span className="shrink-0 text-xs text-muted">{c.members} Mitglieder</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 6 ── Mein Netzwerk (CORE-Count, DEMO-Listen) ─────────────────────────────────
function NetzwerkWidget({ contactsCount }: { contactsCount: number }) {
  return (
    <DashboardCard id="netzwerk" title="Mein Netzwerk">
      <div>
        <div className="font-display text-3xl font-semibold text-ink">{contactsCount}</div>
        <div className="text-xs tracking-wide text-muted uppercase">Bestätigte Kontakte</div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Aufschlüsselung
          </p>
          <DemoBadge />
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {DEMO_NETWORK.map((n) => (
            <li
              key={n.label}
              className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-sm"
            >
              <span className="text-muted">{n.label}</span>
              <span className="font-medium text-ink">{n.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
}

// 7 ── Mein Matching (CORE) ────────────────────────────────────────────────────
function MatchingWidget({ data }: { data: DashboardData }) {
  return (
    <DashboardCard
      id="matching"
      title="Mein Matching"
      className="md:col-span-2"
      action={<CardLink to="/matching">Zum Matching</CardLink>}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <MatchingColumn title="Ich suche" items={data.needs} empty="Keine Gesuche hinterlegt." />
        <MatchingColumn title="Ich biete" items={data.offers} empty="Keine Angebote hinterlegt." />
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-line pt-4">
        <MatchStat label="Aktive Matches" value={data.matchStats.active} />
        <MatchStat label="Erfolgreiche" value={data.matchStats.successful} />
        <MatchStat label="Ø-Score" value={data.matchStats.avgScore} />
      </div>
    </DashboardCard>
  );
}

function MatchingColumn({
  title,
  items,
  empty,
}: {
  title: string;
  items: { id: string; title: string; category: string | null }[];
  empty: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-gold-strong uppercase">{title}</div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2.5 rounded-lg border border-line bg-soft p-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gold-soft text-sm font-semibold text-gold-strong">
                {(item.category ?? item.title).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                {item.category && (
                  <p className="truncate text-xs text-muted capitalize">{item.category}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-display text-xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

// 8 ── Meine Statistik (30 Tage) (DEMO) ────────────────────────────────────────
function StatistikWidget() {
  return (
    <DashboardCard id="statistik" title="Meine Statistik (30 Tage)" demo>
      <ul className="flex flex-col gap-2.5">
        {DEMO_STATS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{s.label}</span>
            <span className="flex items-baseline gap-2">
              <span className="font-medium text-ink">{s.value}</span>
              <span className="text-xs font-medium text-positive">↑ {s.trend}</span>
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 9 ── Mein Impact (CORE-Zahl, dunkle Gold-Card) ───────────────────────────────
function ImpactWidget({ score }: { score: number }) {
  return (
    <Card
      id="impact"
      className="flex scroll-mt-24 flex-col gap-4 border-night-border bg-night text-on-night"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-on-night">Mein Impact</h3>
      </div>
      <div>
        <div className="font-display text-5xl font-semibold text-gold">{score}</div>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="font-medium text-positive">+12 Punkte diesen Monat</span>
          <DemoBadge />
        </div>
      </div>
      {/* Sparkline (DEMO). */}
      <svg
        viewBox="0 0 200 48"
        className="h-12 w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points="0,40 25,36 50,38 75,28 100,30 125,20 150,22 175,12 200,8"
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Card>
  );
}

// 10 ── Meine Projekte (DEMO) ──────────────────────────────────────────────────
function ProjekteWidget() {
  return (
    <DashboardCard id="projekte" title="Meine Projekte" demo>
      <ul className="flex flex-col gap-3">
        {DEMO_PROJECTS.map((p) => (
          <li key={p.title}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-ink">{p.title}</span>
              <span className="shrink-0 text-muted">{p.progress}%</span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={p.progress} />
            </div>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 11 ── Meine Investments (DEMO) ───────────────────────────────────────────────
function InvestmentsWidget() {
  return (
    <DashboardCard id="investments" title="Meine Investments" demo>
      <ul className="flex flex-col gap-3">
        {DEMO_INVESTMENTS.map((inv) => (
          <li key={inv.title} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink">{inv.title}</span>
            <span
              className={cn(
                "shrink-0 font-medium",
                inv.perf >= 0 ? "text-positive" : "text-danger",
              )}
            >
              {inv.perf >= 0 ? "+" : ""}
              {inv.perf.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 12 ── Meine Beiträge (CORE soweit posts, sonst DEMO) ─────────────────────────
function BeitraegeWidget({ data }: { data: DashboardData }) {
  const isDemo = data.posts.length === 0;
  return (
    <DashboardCard
      id="beitraege"
      title="Meine Beiträge"
      demo={isDemo}
      action={<CardLink to="/community">Alle anzeigen</CardLink>}
    >
      {isDemo ? (
        <ul className="flex flex-col gap-3">
          {DEMO_POSTS.map((p) => (
            <li key={p.title}>
              <p className="text-sm font-medium text-ink">{p.title}</p>
              <p className="text-xs text-muted">
                {p.kind} · {p.meta}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.posts.map((post) => (
            <li key={post.id}>
              <p className="line-clamp-2 text-sm font-medium text-ink">{post.body}</p>
              <p className="text-xs text-muted">{formatDate(post.created_at, dateFmt)}</p>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

// 13 ── Meine Auszeichnungen (CORE) ────────────────────────────────────────────
function AuszeichnungenWidget({ badges }: { badges: DashboardBadge[] }) {
  return (
    <DashboardCard id="auszeichnungen" title="Meine Auszeichnungen">
      {badges.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {badges.map((badge) => (
            <li key={badge.key} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-strong">
                <CrownIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{badge.label}</p>
                <p className="text-xs text-muted">seit {formatDate(badge.awarded_at, monthFmt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyHint>Noch keine Zertifikate oder Badges erhalten.</EmptyHint>
      )}
    </DashboardCard>
  );
}

// 14 ── Meine Ziele (CORE) ─────────────────────────────────────────────────────
function ZieleWidget({ data }: { data: DashboardData }) {
  return (
    <DashboardCard
      id="ziele"
      title="Meine Ziele"
      action={<CardLink to="/profil">Bearbeiten</CardLink>}
    >
      {data.goals.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {GOAL_CATEGORIES.map((cat) => {
            const goals = data.goals.filter((g) => g.category === cat.value);
            if (goals.length === 0) return null;
            return (
              <li key={cat.value}>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {cat.label}
                </p>
                <ul className="mt-1.5 flex flex-col gap-2">
                  {goals.map((g) => (
                    <li key={g.title}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-ink">{g.title}</span>
                        <span className="shrink-0 text-muted">{g.progress ?? 0}%</span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar value={g.progress ?? 0} />
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyHint>Noch keine Ziele definiert.</EmptyHint>
      )}
    </DashboardCard>
  );
}

// 15 ── FBC KI Assistent (DEMO / Platzhalter) ──────────────────────────────────
function KIAssistentWidget() {
  return (
    <DashboardCard id="ki" title="FBC KI Assistent" demo className="md:col-span-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-full border border-line bg-soft px-4 py-2.5">
          <input
            type="text"
            disabled
            placeholder="Frag den FBC Assistenten… (in Phase 1 noch ohne KI)"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
          />
          <Button variant="primary" size="sm" disabled>
            Senden
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {DEMO_KI_CHIPS.map((chip) => (
            <li key={chip}>
              <span className="inline-flex cursor-default items-center rounded-full border border-line bg-canvas px-3 py-1 text-xs text-muted">
                {chip}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
}
