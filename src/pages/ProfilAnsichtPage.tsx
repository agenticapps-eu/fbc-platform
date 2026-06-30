import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ProfileHero } from "../components/profile/ProfileHero";
import { Button } from "../components/ui/Button";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { StatTile, formatDate, monthFmt } from "../components/mein-bereich/building-blocks";
import { AktivitaetPortfolio } from "../components/mein-bereich/aktivitaet-portfolio";
import {
  AuszeichnungenWidget,
  BeitraegeWidget,
  EntwicklungWidget,
  ErfolgsradarWidget,
  ImpactWidget,
  InteressenWidget,
  ZieleWidget,
} from "../components/mein-bereich/profil-widgets";
import { dashboardQueryKey, fetchDashboard } from "../lib/dashboard";
import { useAuth } from "../providers/auth-context";

export default function ProfilAnsichtPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <ProfilView uid={user.id} />;
}

function ProfilView({ uid }: { uid: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: dashboardQueryKey(uid),
    queryFn: () => fetchDashboard(uid),
  });
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return (
      <p className="text-sm text-danger">Profil konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }
  const p = data.profile;
  return (
    <div className="flex flex-col gap-6">
      <ProfileHero
        name={p.name}
        avatarUrl={p.avatar_url}
        tier={p.tier}
        roles={p.roles}
        headline={p.headline}
        region={p.region}
        company={p.company}
        action={
          <Link to="/profil/bearbeiten">
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
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Impact Score" value={p.potential_score} />
          <StatTile label="Netzwerk" value={data.contactsCount} />
          <StatTile label="Matches" value={data.matchStats.successful} />
          <StatTile label="Events" value={data.eventsCount} />
        </div>
      </ProfileHero>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ErfolgsradarWidget data={data} />
        <AuszeichnungenWidget badges={data.badges} />
        <ImpactWidget score={p.potential_score} breakdown={data.scoreBreakdown} />
        <InteressenWidget data={data} />
        <ZieleWidget data={data} />
        <EntwicklungWidget profile={p} />
        <div className="md:col-span-2 xl:col-span-3">
          <BeitraegeWidget data={data} />
        </div>
      </div>

      <AktivitaetPortfolio />
    </div>
  );
}
