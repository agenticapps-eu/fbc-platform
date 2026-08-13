import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ProfileHero } from "../components/profile/ProfileHero";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { MembershipSummary } from "../components/membership/MembershipSummary";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { StatTile, formatDate, monthFmt } from "../components/mein-bereich/building-blocks";
import {
  BeitraegeWidget,
  InteressenWidget,
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
      {/* `coverUrl` muss hier stehen: die EIGENE Ansicht liest den
          Dashboard-Weg, nicht profiles_public. Fehlt es, lädt ein Mitglied sein
          Hintergrundbild hoch und sieht es genau dort nicht, wo es danach
          sucht (AGE-498). */}
      <ProfileHero
        name={p.name}
        avatarUrl={p.avatar_url}
        coverUrl={p.cover_url}
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
        {/* AGE-539: Beide Angaben stehen EINZELN unter Bedingung. Den ganzen
            Absatz an `member_since` zu hängen wäre der kürzere Griff und
            verschluckte die Mitgliedsnummer — nach dem Import bei 18 von 70
            Konten, und für einen Verein ist die Nummer die härtere Angabe. */}
        {(p.member_since || p.member_number) && (
          <p className="text-xs text-muted">
            {p.member_since && <>Mitglied seit: {formatDate(p.member_since, monthFmt)}</>}
            {p.member_since && p.member_number && <> · </>}
            {p.member_number && <>Mitgliedsnummer: {p.member_number}</>}
          </p>
        )}
        {/* Impact Score bewusst ausgeblendet (Nav-IA §3, MVP „Mein Profil vereinfachen").
            AGE-539: „Matches" ist hier raus — Matching ist unerreichbar (AGE-450),
            der Zähler verwies also auf eine Oberfläche, die niemand öffnen kann.
            Nicht der Wert war das Problem, sondern das Ziel. */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatTile label="Netzwerk" value={data.contactsCount} />
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

      {/* AGE-539: Erfolgsradar, Auszeichnungen, Ziele und Entwicklung sind hier
          ausgebaut — die Kompass-Oberfläche ist für den Go-Live vertagt (AGE-494),
          ihre Widgets standen aber weiter auf dem Profil. Die Komponenten bleiben
          in `profil-widgets.tsx`, wie bei Matching (AGE-450): Zurückholen ist eine
          Zeile. Statt eines Rasters mit zwei Kacheln eine Spalte — ein Raster mit
          einer Spalte kündigt eine zweite an, die nicht kommt. */}
      <div className="flex flex-col gap-5">
        <InteressenWidget data={data} />
        <BeitraegeWidget data={data} />
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
