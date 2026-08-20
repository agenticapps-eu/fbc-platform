import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MemberLookup } from "../components/admin/MemberLookup";
import { AdminFeedbackCard } from "../components/feedback/AdminFeedbackCard";
import { Card, CardTitle } from "../components/ui/Card";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { ToggleRow } from "../components/ui/ToggleRow";
import { useToast } from "../components/ui/toast-context";
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
  platformSettingsQueryKey,
  updateOpenContact,
} from "../lib/platform-settings";

/**
 * Admin-Einstellungen (AGE-455). Nur über /admin (RequireAdmin) erreichbar; die
 * echte Schreibgrenze ist die RLS (platform_settings_update_admin → is_admin()).
 * Erste und vorerst einzige Einstellung: der open_contact-Toggle.
 */
export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: platformSettingsQueryKey,
    queryFn: fetchPlatformSettings,
  });

  const save = useMutation({
    mutationFn: (next: boolean) => updateOpenContact(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformSettingsQueryKey });
      toast({ variant: "success", title: "Einstellung gespeichert" });
    },
    onError: (error) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unbekannter Fehler.";
      toast({ variant: "error", title: "Speichern fehlgeschlagen", description: message });
    },
  });

  if (isLoading) return <DashboardSkeleton />;

  const settings = data ?? DEFAULT_PLATFORM_SETTINGS;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Administration</h1>
      <MemberLookup />
      <Card className="flex flex-col gap-2">
        <CardTitle>Kontaktanfragen</CardTitle>
        <ToggleRow
          label="Kontaktanfragen für alle freischalten"
          hint="Für Events: jedes eingeloggte Mitglied darf jedem eine Kontaktanfrage senden — die Stufen-Hürde und der 30-Tage-Welpenschutz sind aus. Das Opt-out des Empfängers bleibt aktiv."
          checked={settings.openContact}
          onChange={(v) => save.mutate(v)}
          disabled={save.isPending}
        />
      </Card>

      {/* QM-Feedback (AGE-358, hierher verlegt mit AGE-578). Ohne Rollenabfrage:
          diese Seite hängt hinter RequireAdmin, das staffRole !== "admin" auf "/"
          umleitet. Die echte Grenze ist ohnehin is_admin() im Rumpf von
          admin_list_feedback — das UI-Gating war immer nur Komfort. */}
      <AdminFeedbackCard />
    </div>
  );
}
