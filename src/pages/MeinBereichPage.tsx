import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ProfileHero } from "../components/profile/ProfileHero";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/cn";
import { dashboardQueryKey, fetchDashboard, type DashboardData } from "../lib/dashboard";
import { useAuth } from "../providers/auth-context";
import {
  DashboardCard,
  formatDate,
  monthFmt,
  ProgressBar,
  StatTile,
} from "../components/mein-bereich/building-blocks";
import {
  AuszeichnungenWidget,
  BeitraegeWidget,
  EntwicklungWidget,
  ErfolgsradarWidget,
  ImpactWidget,
  InteressenWidget,
  ZieleWidget,
} from "../components/mein-bereich/profil-widgets";
import { EventsWidget } from "../components/mein-bereich/events-widget";
import {
  CommunitiesWidget,
  MeineAnfragenWidget,
  MatchingWidget,
  NetzwerkWidget,
} from "../components/mein-bereich/kontakte-widgets";

// ── Demo-Daten (profile-spec §5: DEMO-Widgets, in Phase 2 durch echte Daten ersetzt) ──
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
    return <DashboardSkeleton />;
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-danger">Dashboard konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader data={data} />

      <MeineAnfragenWidget uid={uid} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ErfolgsradarWidget data={data} />
        <EntwicklungWidget profile={data.profile} />
        <InteressenWidget data={data} />
        <EventsWidget data={data} />
        <CommunitiesWidget />
        <NetzwerkWidget contactsCount={data.contactsCount} />
        <MatchingWidget data={data} />
        <StatistikWidget />
        <ImpactWidget score={data.profile.potential_score} breakdown={data.scoreBreakdown} />
        <ProjekteWidget />
        <InvestmentsWidget />
        <BeitraegeWidget data={data} />
        <AuszeichnungenWidget badges={data.badges} />
        <ZieleWidget data={data} />
        <KIAssistentWidget />
      </div>
    </div>
  );
}

// ── Header (CORE, §3) ─────────────────────────────────────────────────────────
function DashboardHeader({ data }: { data: DashboardData }) {
  const p = data.profile;
  return (
    <div id="uebersicht" className="scroll-mt-24">
      <ProfileHero
        name={p.name}
        avatarUrl={p.avatar_url}
        tier={p.tier}
        roles={p.roles}
        headline={p.headline}
        region={p.region}
        company={p.company}
        action={
          <Link to="/profil">
            <Button variant="ghost" size="sm">
              Profil bearbeiten
            </Button>
          </Link>
        }
      >
        <p className="text-xs text-muted">
          Mitglied seit: {formatDate(p.member_since, monthFmt)}
          {p.member_number && <> · Mitgliedsnummer: {p.member_number}</>}
        </p>

        {/* Stat-Tiles (§3) — Impact CORE, Netzwerk/Matches/Events CORE-Counts, Projekte DEMO. */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Impact Score" value={p.potential_score} />
          <StatTile label="Netzwerk" value={data.contactsCount} />
          <StatTile label="Matches" value={data.matchStats.successful} />
          <StatTile label="Projekte" value={DEMO_PROJECTS.length} demo />
          <StatTile label="Events" value={data.eventsCount} />
        </div>
      </ProfileHero>
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
