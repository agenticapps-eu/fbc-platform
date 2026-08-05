import { useQuery } from "@tanstack/react-query";
import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { MeineAnfragenWidget, NetzwerkWidget } from "../components/mein-bereich/kontakte-widgets";
import { dashboardQueryKey, fetchDashboard } from "../lib/dashboard";
import { useAuth } from "../providers/auth-context";

export default function KontaktePage() {
  const { user } = useAuth();
  if (!user) return null;
  return <Inner uid={user.id} />;
}

function Inner({ uid }: { uid: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: dashboardQueryKey(uid),
    queryFn: () => fetchDashboard(uid),
  });
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return <p className="text-sm text-danger">Konnte nicht geladen werden. Bitte neu laden.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/kontakte"]} className="" />
      <MeineAnfragenWidget uid={uid} />
      {/* Kein Grid mehr: „Meine Communities" ist ersatzlos entfernt (erfundene
          Zahlen über das Mitglied, AGE-494 Task 7.6), und ein zweispaltiges
          Raster mit einem Kind ließe rechts ein Loch stehen. */}
      <NetzwerkWidget contactsCount={data.contactsCount} />
      {/* AGE-450: „Mein Matching"-Widget entfernt — Matching ist fürs Sommerfest raus. */}
    </div>
  );
}
