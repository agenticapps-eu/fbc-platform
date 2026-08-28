import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { TierBadge } from "../components/ui/TierBadge";
import { ToggleRow } from "../components/ui/ToggleRow";
import { useToast } from "../components/ui/toast-context";
import {
  DEFAULT_MEMBER_SETTINGS,
  fetchMemberSettings,
  memberSettingsQueryKey,
  memberThemeQueryKey,
  saveMemberSettings,
  saveMemberTheme,
  type MemberSettings,
} from "../lib/member-settings";
import { levelLabel, DEFAULT_LEVEL } from "../config/levels";
import { useAuth } from "../providers/auth-context";
import { useDesignVariant } from "../providers/design-variant-context";

/**
 * Passwort ändern (AGE-450). Setzt eine aktive Session voraus (auth.updateUser) —
 * kein Re-Auth mit dem alten Passwort. Mindestlänge 8, Bestätigung muss passen;
 * beides wird clientseitig geprüft, bevor der Aufruf rausgeht.
 */
function PasswordCard() {
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (pw !== confirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setError(null);
    setPending(true);
    const { error: err } = await updatePassword(pw);
    setPending(false);
    if (err) {
      toast({
        variant: "error",
        title: "Passwort ändern fehlgeschlagen",
        description: err.message,
      });
      return;
    }
    toast({ variant: "success", title: "Passwort geändert" });
    setPw("");
    setConfirm("");
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Passwort</CardTitle>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        <Field label="Neues Passwort">
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(ev) => setPw(ev.target.value)}
            />
          )}
        </Field>
        <Field label="Neues Passwort bestätigen" error={error ?? undefined}>
          {({ id, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              invalid={invalid}
              value={confirm}
              onChange={(ev) => setConfirm(ev.target.value)}
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={pending}
        >
          Passwort ändern
        </Button>
      </form>
    </Card>
  );
}

export default function EinstellungenPage() {
  const { user, tier, signOut } = useAuth();
  const { variant, setVariant } = useDesignVariant();
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
    mutationFn: (next: MemberSettings) => saveMemberSettings(uid, next),
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

      <PasswordCard />

      <Card className="flex flex-col gap-4">
        <CardTitle>Mitgliedschaft</CardTitle>
        <div className="flex items-center gap-2">
          <TierBadge tier={tier ?? DEFAULT_LEVEL} />
          <span className="text-sm text-muted">{levelLabel(tier ?? DEFAULT_LEVEL)}-Mitglied</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => navigate("/mitgliedschaft")}
        >
          Stufe ansehen &amp; upgraden
        </Button>
      </Card>

      {/* Darstellung (AGE-492). Läuft bewusst NICHT über die `save`-Mutation
          daneben: die schreibt alle Präferenzen in einem Upsert, und ein
          veralteter Theme-Wert im Cache überschriebe dabei still die Wahl.
          Getrennte Schlüssel, getrennte Writes — dieselbe Lehre wie bei
          `visible_in_directory` (AGE-313).

          Der Schalter wirkt sofort (lokal) und schreibt danach zum Server.
          Fire-and-forget: ein fehlgeschlagener Write darf die Darstellung nicht
          zurückspringen lassen — er kostet die Geräteübergreifbarkeit, nicht die
          Einstellung selbst. */}
      <Card className="flex flex-col gap-2">
        <CardTitle>Darstellung</CardTitle>
        <ToggleRow
          label="Dunkles Design (Navy)"
          hint="Gilt auf allen deinen Geräten, sobald du angemeldet bist."
          checked={variant === "navy"}
          onChange={(v) => {
            const next = v ? "navy" : "hell";
            setVariant(next);
            // Der lokale Wechsel steht schon; scheitert der Server-Write, bleibt er
            // stehen — aber stumm darf das nicht bleiben: Server und Gerät stünden
            // dann auseinander, und der nächste Login holte den alten Wert zurück.
            void saveMemberTheme(uid, next)
              .then(() => queryClient.setQueryData(memberThemeQueryKey(uid), next))
              .catch(() =>
                toast({
                  variant: "error",
                  title: "Design nicht gespeichert",
                  description: "Die Wahl gilt auf diesem Gerät, aber nicht auf deinen anderen.",
                }),
              );
          }}
        />
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

      {/* AGE-641 (war AGE-620). Eine eigene Karte, nicht sechs weitere Zeilen in
          der obigen: die drei darüber verschicken E-Mail, diese sechs bleiben in
          der Anwendung. Eine Überschrift, die beides zusammenwirft, ließe ein
          Mitglied glauben, es schalte Post ab.

          Titel und Beschreibung sagen heute „nur hier in der Anwendung", und das
          ist WAHR, solange kein Gerät zustellen kann. Mit Phase B von AGE-641
          wird es falsch — dann steuern dieselben Schalter auch den Push, und
          beide Texte müssen mit. Nicht vorher: eine Beschreibung, die eine
          Zustellung ankündigt, die es noch nicht gibt, ist genauso falsch. */}
      <Card className="flex flex-col gap-2">
        <CardTitle>Hinweise in der Glocke</CardTitle>
        <CardDescription>
          Diese Hinweise erscheinen nur hier in der Anwendung. Es wird nichts versendet.
        </CardDescription>
        <ToggleRow
          label="Wenn jemand einen Beitrag schreibt"
          checked={settings.notify_app_post}
          onChange={(v) => toggle("notify_app_post", v)}
          disabled={save.isPending}
        />
        <ToggleRow
          label="Wenn ein Event angelegt wird"
          checked={settings.notify_app_event}
          onChange={(v) => toggle("notify_app_event", v)}
          disabled={save.isPending}
        />
        <ToggleRow
          label="Wenn jemand meinen Beitrag kommentiert"
          checked={settings.notify_app_comment}
          onChange={(v) => toggle("notify_app_comment", v)}
          disabled={save.isPending}
        />
        <ToggleRow
          label="Wenn jemandem mein Beitrag gefällt"
          checked={settings.notify_app_like}
          onChange={(v) => toggle("notify_app_like", v)}
          disabled={save.isPending}
        />
        <ToggleRow
          label="Wenn mir jemand schreibt"
          checked={settings.notify_app_message}
          onChange={(v) => toggle("notify_app_message", v)}
          disabled={save.isPending}
        />
        <ToggleRow
          label="Kontaktanfragen und Antworten darauf"
          checked={settings.notify_app_contact}
          onChange={(v) => toggle("notify_app_contact", v)}
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
          // AGE-450: „Prime" ist altes Wording (das 6-Level-Modell kennt kein
          // Prime mehr). Die DB-Spalte contactable_by_prime bleibt unberührt.
          label="Andere Mitglieder dürfen mich kontaktieren"
          checked={settings.contactable_by_prime}
          onChange={(v) => toggle("contactable_by_prime", v)}
          disabled={save.isPending}
        />
      </Card>
    </div>
  );
}
