import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CategoryIcon } from "../components/matching/CategoryIcon";
import { ProfileHero } from "../components/profile/ProfileHero";
import { Avatar } from "../components/ui/Avatar";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { useToast } from "../components/ui/toast-context";
import { cn } from "../lib/cn";
import {
  fetchIncomingRequests,
  incomingRequestsQueryKey,
  respondToContactRequest,
  type IncomingRequest,
} from "../lib/contact-requests";
import { matchingHubQueryKey } from "../lib/matching-hub";
import {
  dashboardQueryKey,
  fetchDashboard,
  THEME_LABEL,
  THEME_ORDER,
  type DashboardBadge,
  type DashboardData,
  type DashboardEvent,
  type DashboardProfile,
  type ScoreBreakdown,
} from "../lib/dashboard";
import { categoryLabel, findCategory, type MatchingSide } from "../config/matching";
import { isPastEvent } from "../lib/events";
import { GOAL_CATEGORIES } from "../lib/profile";
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
    <div className="rounded-[var(--radius-card)] border border-line bg-soft px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
        {demo && <DemoBadge />}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold text-ink">{value}</span>
        {trend && <span className="text-xs font-medium text-positive">↑ {trend}</span>}
      </div>
    </div>
  );
}

// ── Meine Anfragen (CORE, §6.2) — eingehende Kontaktanfragen mit Annehmen/Ablehnen ──
// Erscheint nur, wenn offene Anfragen vorliegen (ein Posteingang zeigt sich, wenn Post
// da ist). Annehmen/Ablehnen setzt nur `status` (RLS `cr_update_recipient`); alle
// Folgewirkungen (Match-Status, Thread, Benachrichtigung, Kontaktdaten-Freigabe)
// laufen serverseitig. Kontaktdaten werden hier NIEMALS angezeigt — erst nach Annahme
// auf der Profilseite des Gegenübers (RLS-gegated).
function MeineAnfragenWidget({ uid }: { uid: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: incomingRequestsQueryKey(uid),
    queryFn: () => fetchIncomingRequests(uid),
  });

  // Leise sein, solange nichts anliegt — kein Leerzustand, der das Dashboard zumüllt.
  if (isLoading || isError || !data || data.length === 0) return null;

  return (
    <Card id="meine-anfragen" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex items-center gap-2">
        <CardTitle className="text-base">Meine Anfragen</CardTitle>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-semibold text-night">
          {data.length}
        </span>
      </div>
      <p className="text-sm text-muted">
        Erst nach deiner Annahme werden Kontaktdaten geteilt und der Chat freigeschaltet.
      </p>
      <ul className="flex flex-col gap-3">
        {data.map((request) => (
          <li key={request.id}>
            <AnfrageRow uid={uid} request={request} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AnfrageRow({ uid, request }: { uid: string; request: IncomingRequest }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  // Welche Aktion gerade läuft — sperrt beide Buttons, ohne sie zu vermischen.
  const [pending, setPending] = useState<null | "accept" | "decline">(null);

  const respond = useMutation({
    mutationFn: (accept: boolean) => respondToContactRequest({ requestId: request.id, accept }),
    onMutate: (accept) => setPending(accept ? "accept" : "decline"),
    onSuccess: (_data, accept) => {
      toast(
        accept
          ? {
              variant: "success",
              title: "Anfrage angenommen",
              description: `Kontaktdaten von ${request.from.name} sind sichtbar — der Chat ist offen.`,
            }
          : {
              variant: "success",
              title: "Anfrage abgelehnt",
              description: `${request.from.name} erhält keine Kontaktdaten.`,
            },
      );
      queryClient.invalidateQueries({ queryKey: incomingRequestsQueryKey(uid) });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(uid) });
      queryClient.invalidateQueries({ queryKey: matchingHubQueryKey(uid) });
      // §9: Einstieg aus der angenommenen Anfrage — Annehmen öffnet direkt den Chat.
      if (accept) navigate("/chat");
    },
    onError: (error) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unbekannter Fehler.";
      toast({ variant: "error", title: "Aktion fehlgeschlagen", description: message });
    },
    onSettled: () => setPending(null),
  });

  const busy = respond.isPending;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-soft p-3 sm:flex-row sm:items-center">
      <Link to={`/p/${request.from.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={request.from.name} src={request.from.avatar_url} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{request.from.name}</p>
          <p className="truncate text-xs text-muted">
            {[request.from.company, request.from.region].filter(Boolean).join(" · ") || "—"}
          </p>
          {request.message && (
            <p className="mt-1 line-clamp-2 text-sm text-muted italic">„{request.message}"</p>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
        <Button variant="primary" size="sm" onClick={() => respond.mutate(true)} disabled={busy}>
          {pending === "accept" ? "Annehmen…" : "Annehmen"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => respond.mutate(false)} disabled={busy}>
          {pending === "decline" ? "Ablehnen…" : "Ablehnen"}
        </Button>
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

// 4 ── Meine Events (CORE soweit Daten, sonst DEMO) ────────────────────────────
// Echte Buchungen (gebucht/vergangen) und selbst gehostete Events. DEMO nur, wenn
// das Mitglied noch gar keine Events hat (profile-spec §5: Leerzustand zeigt Demo).
function EventsWidget({ data }: { data: DashboardData }) {
  const now = new Date();
  const booked = data.events.filter((e) => e.event && e.status !== "cancelled");
  const upcoming = booked.filter((e) => !isPastEvent(e.event!.starts_at, now));
  const past = booked.filter((e) => isPastEvent(e.event!.starts_at, now));
  const hosted = data.hostedEvents;
  const isDemo = booked.length === 0 && hosted.length === 0;

  if (isDemo) {
    return (
      <DashboardCard
        id="events"
        title="Meine Events"
        demo
        action={<CardLink to="/events">Alle anzeigen</CardLink>}
      >
        <ul className="flex flex-col gap-3">
          {DEMO_EVENTS.map((row, i) => (
            <li key={row.event?.id ?? i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {row.event?.title ?? "Event"}
                </p>
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

  return (
    <DashboardCard
      id="events"
      title="Meine Events"
      action={<CardLink to="/events">Alle anzeigen</CardLink>}
    >
      <div className="flex flex-col gap-4">
        <EventGroup
          title="Gebucht"
          rows={upcoming.map((e) => e.event!)}
          empty="Keine kommenden Buchungen."
        />
        {past.length > 0 && (
          <EventGroup title="Vergangen" rows={past.map((e) => e.event!)} empty="" />
        )}
        {hosted.length > 0 && <EventGroup title="Eigene Events" rows={hosted} empty="" />}
      </div>
    </DashboardCard>
  );
}

function EventGroup({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: {
    id: string;
    title: string;
    type: string | null;
    starts_at: string | null;
    location: string | null;
  }[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/events/${r.id}`}
                className="flex items-start justify-between gap-3 hover:text-gold-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-muted">
                    {formatDate(r.starts_at, dateFmt)}
                    {r.location && <> · {r.location}</>}
                  </p>
                </div>
                {r.type && <Badge variant="prime">{r.type}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <DashboardCard
      id="netzwerk"
      title="Mein Netzwerk"
      action={<CardLink to="/chat">Zum Chat</CardLink>}
    >
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
      action={
        <div className="flex items-center gap-3">
          <CardLink to="/angebote-gesuche">Bearbeiten</CardLink>
          <CardLink to="/matching">Zum Matching</CardLink>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <MatchingColumn
          title="Ich suche"
          side="need"
          items={data.needs}
          empty="Keine Gesuche hinterlegt."
        />
        <MatchingColumn
          title="Ich biete"
          side="offer"
          items={data.offers}
          empty="Keine Angebote hinterlegt."
        />
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
  side,
  items,
  empty,
}: {
  title: string;
  side: MatchingSide;
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
          {items.map((item) => {
            const cat = findCategory(side, item.category);
            return (
              <li
                key={item.id}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-soft p-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong">
                  {cat ? (
                    <CategoryIcon icon={cat.icon} className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-semibold">
                      {item.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                  {item.category && (
                    <p className="truncate text-xs text-muted">
                      {categoryLabel(side, item.category)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
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
// Regelbasierter Impact Score (AGE-242) mit transparenter Aufschlüsselung der
// fünf gewichteten Komponenten — der Wert ist nachvollziehbar, kein Demo-Delta.
function ImpactWidget({ score, breakdown }: { score: number; breakdown: ScoreBreakdown | null }) {
  return (
    <Card
      id="impact"
      className="flex scroll-mt-24 flex-col gap-4 border-gold/30 bg-[linear-gradient(120deg,#faf4e6_0%,#f2e6c9_100%)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">Mein Impact</h3>
        <span className="text-xs text-muted">regelbasiert</span>
      </div>
      <div>
        <div className="font-display text-5xl font-semibold text-gold-strong">{score}</div>
        <div className="mt-1 text-sm text-muted">von 100 · Impact Score</div>
      </div>

      {breakdown ? (
        <ScoreBreakdownList breakdown={breakdown} />
      ) : (
        <p className="text-xs text-muted">
          Die Aufschlüsselung wird beim nächsten Laden berechnet.
        </p>
      )}

      {/* Verlauf — DEMO (Tracking liefert Phase 2). */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          Verlauf <DemoBadge />
        </div>
        <svg
          viewBox="0 0 200 48"
          className="h-12 w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points="0,40 25,36 50,38 75,28 100,30 125,20 150,22 175,12 200,8"
            fill="none"
            stroke="var(--color-gold-strong)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Card>
  );
}

// Transparente Score-Aufschlüsselung: pro Komponente erreichte Punkte / Gewicht,
// als Mini-Balken; der Detailtext (z. B. „3/4 Themen“) hängt als Tooltip am Eintrag.
function ScoreBreakdownList({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <ul className="flex flex-col gap-2.5" aria-label="Aufschlüsselung des Impact Scores">
      {breakdown.components.map((c) => {
        const pct = c.weight > 0 ? Math.min(100, Math.round((c.points / c.weight) * 100)) : 0;
        return (
          <li key={c.key} title={c.detail}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted">{c.label}</span>
              <span className="font-medium text-ink tabular-nums">
                {c.points}
                <span className="text-muted">/{c.weight}</span>
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-gold-strong" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
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
