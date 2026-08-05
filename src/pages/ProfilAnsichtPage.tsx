import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ProfileHero } from "../components/profile/ProfileHero";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { MembershipSummary } from "../components/membership/MembershipSummary";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { StatTile, formatDate, monthFmt } from "../components/mein-bereich/building-blocks";
import {
  AuszeichnungenWidget,
  BeitraegeWidget,
  EntwicklungWidget,
  ErfolgsradarWidget,
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
        {/* Impact Score bewusst ausgeblendet (Nav-IA §3, MVP „Mein Profil vereinfachen"). */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Netzwerk" value={data.contactsCount} />
          <StatTile label="Matches" value={data.matchStats.successful} />
          <StatTile label="Events" value={data.eventsCount} />
        </div>
      </ProfileHero>

      {/* AGE-494: Ein frisches Konto trägt nur Name und E-Mail. Statt es zwischen
          leeren Karten stehen zu lassen, steht der nächste Schritt ganz oben —
          und zwar nur dann. Die Schwelle ist bewusst grob: fehlen Kurzvorstellung
          UND Schlagzeile, hat noch niemand angefangen. (Branche wäre das bessere
          zweite Signal, gehört aber nicht zur Dashboard-Abfrage — dafür sie zu
          erweitern wäre mehr Diff als Nutzen.) */}
      {!p.short_bio && !p.headline && (
        <EmptyState
          title="Dein Profil ist noch ein leeres Blatt"
          description="Ein paar Sätze über dich, deine Branche und was du bietest oder suchst — mehr braucht es nicht, damit die anderen dich finden und einordnen können."
          action={
            <Link to="/profil/bearbeiten">
              <Button variant="primary" size="sm">
                Profil ausfüllen
              </Button>
            </Link>
          }
        />
      )}

      <MembershipSummary current={p.tier} showManageCta />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ErfolgsradarWidget data={data} />
        <AuszeichnungenWidget badges={data.badges} />
        <InteressenWidget data={data} />
        <ZieleWidget data={data} />
        <EntwicklungWidget profile={p} />
        <div className="md:col-span-2 xl:col-span-3">
          <BeitraegeWidget data={data} />
        </div>
      </div>

      {/* AGE-494 (Donald, 04.08.): „Aktivität & Portfolio" ist hier ersatzlos raus.
          Der Block trug vier Karten mit frei erfundenen Zahlen ÜBER DAS MITGLIED
          SELBST — Profilaufrufe, Projektfortschritte, „Immobilienportfolio Süd
          +6,1 %". Dieselbe Entscheidung wie bei den zwei erfundenen Terminen in
          „Meine Events": erfundene Daten sind ein schlechterer erster Eindruck als
          eine ehrliche Leere, und eine Demo-Marke macht sie nicht wahr.

          BEWUSST kein Leerzustand als Ersatz: Statistik, Projekte, Investments und
          KI-Assistent gibt es in Phase 1 überhaupt nicht. Ein „Noch keine
          Investments" verspräche eine Funktion, die niemand gebaut hat — der
          Leerzustand bei „Meine Events" ging nur deshalb, weil es Events gibt. */}
    </div>
  );
}
