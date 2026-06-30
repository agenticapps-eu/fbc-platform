import { useQuery } from "@tanstack/react-query";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { EventsWidget } from "../components/mein-bereich/events-widget";
import { dashboardQueryKey, fetchDashboard } from "../lib/dashboard";
import { useAuth } from "../providers/auth-context";

export default function MeineEventsPage() {
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
      <h1 className="font-display text-2xl font-semibold text-ink">Meine Events</h1>
      <EventsWidget data={data} />
    </div>
  );
}
