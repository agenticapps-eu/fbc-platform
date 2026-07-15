import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { TierBadge } from "../components/ui/TierBadge";
import { useToast } from "../components/ui/toast-context";
import { cn } from "../lib/cn";
import {
  DEFAULT_MEMBER_SETTINGS,
  fetchMemberSettings,
  memberSettingsQueryKey,
  saveMemberSettings,
  setProfileVisibility,
  type MemberSettings,
} from "../lib/member-settings";
import { levelLabel, DEFAULT_LEVEL } from "../config/levels";
import { useAuth } from "../providers/auth-context";

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-gold-strong" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

export default function EinstellungenPage() {
  const { user, tier, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uid = user?.id ?? "";

  const { data, isLoading } = useQuery({
    queryKey: memberSettingsQueryKey(uid),
    queryFn: () => fetchMemberSettings(uid),
    enabled: !!user,
  });

  const save = useMutation({
    mutationFn: async (next: MemberSettings) => {
      await saveMemberSettings(uid, next);
      await setProfileVisibility(uid, next.visible_in_directory);
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: memberSettingsQueryKey(uid) });
      const previous = queryClient.getQueryData<MemberSettings>(memberSettingsQueryKey(uid));
      queryClient.setQueryData(memberSettingsQueryKey(uid), next);
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberSettingsQueryKey(uid) });
      toast({ variant: "success", title: "Einstellungen gespeichert" });
    },
    onError: (error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(memberSettingsQueryKey(uid), context.previous);
      }
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unbekannter Fehler.";
      toast({ variant: "error", title: "Speichern fehlgeschlagen", description: message });
    },
  });

  if (!user) return null;

  if (isLoading) return <DashboardSkeleton />;

  const settings = data ?? DEFAULT_MEMBER_SETTINGS;

  function toggle(key: keyof MemberSettings, value: boolean) {
    save.mutate({ ...settings, [key]: value });
  }

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Einstellungen</h1>

      <Card className="flex flex-col gap-4">
        <CardTitle>Konto</CardTitle>
        <p className="text-sm text-muted">{user.email}</p>
        <Button variant="secondary" size="sm" className="self-start" onClick={handleLogout}>
          Abmelden
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Mitgliedschaft</CardTitle>
        <div className="flex items-center gap-2">
          <TierBadge tier={tier ?? DEFAULT_LEVEL} />
          <span className="text-sm text-muted">{levelLabel(tier ?? DEFAULT_LEVEL)}-Mitglied</span>
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>Benachrichtigungen</CardTitle>
        <ToggleRow
          label="E-Mail bei neuer Kontaktanfrage"
          checked={settings.notify_email_requests}
          onChange={(v) => toggle("notify_email_requests", v)}
          disabled={save.isPending}
        />
        <ToggleRow
          label="E-Mail zu Event-Erinnerungen"
          checked={settings.notify_email_events}
          onChange={(v) => toggle("notify_email_events", v)}
          disabled={save.isPending}
        />
        <ToggleRow
          label="Wöchentlicher Digest"
          checked={settings.notify_email_digest}
          onChange={(v) => toggle("notify_email_digest", v)}
          disabled={save.isPending}
        />
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>Sichtbarkeit</CardTitle>
        <ToggleRow
          label="Im Verzeichnis sichtbar"
          checked={settings.visible_in_directory}
          onChange={(v) => toggle("visible_in_directory", v)}
          disabled={save.isPending}
        />
        <ToggleRow
          label="Prime-Mitglieder dürfen mich kontaktieren"
          checked={settings.contactable_by_prime}
          onChange={(v) => toggle("contactable_by_prime", v)}
          disabled={save.isPending}
        />
      </Card>
    </div>
  );
}
