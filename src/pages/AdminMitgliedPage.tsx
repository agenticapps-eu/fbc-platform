import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import {
  ProfileBasicsFieldset,
  ProfileDevelopmentFieldset,
  ProfileRolesFieldset,
  ProfileVideosFieldset,
  ProfileWebFieldset,
} from "../components/profile/ProfileFieldsets";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toast-context";
import {
  adminProfileQueryKey,
  changeLoginEmail,
  fetchAdminProfile,
  saveAdminProfile,
  type AdminContact,
  type AdminLegacy,
} from "../lib/admin-profile";
import { EMPTY_PROFILE_FORM, profileFormSchema, type ProfileFormValues } from "../lib/profile";

/**
 * Admin bearbeitet ein fremdes Profil (AGE-498, C6).
 *
 * WARUM DIESE SEITE UNTER /admin LIEGT UND NICHT UNTER /p/:id/bearbeiten:
 * `/p/:id` liest `profiles_public`, und die Sicht verlangt, dass das ZIELPROFIL
 * bestätigt ist. Für ein importiertes, noch unbestätigtes Mitglied — den
 * Anlassfall — meldet sie „Profil nicht gefunden". Eine Bearbeiten-Route unter
 * einer Seite, die für den wichtigsten Fall 404 liefert, wäre eine Sackgasse.
 *
 * Die Felder auf `profiles` kommen aus denselben Feldgruppen wie die eigene
 * Profilbearbeitung. Hier NICHT dabei:
 *
 *  * Bilder — beide Bucket-Policies prüfen die `auth.uid()` des AUFRUFERS; ein
 *    Admin-Upload prallte ab. Ausblenden statt scheitern lassen.
 *  * Interessen, Ziele, Kompass-Kategorien — eigene Tabellen mit
 *    `profile_id = auth.uid()`. Wer sie fremdbearbeiten will, braucht AGE-304.
 */
function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

export default function AdminMitgliedPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <AdminProfileEditor targetId={id} />;
}

function AdminProfileEditor({ targetId }: { targetId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = adminProfileQueryKey(targetId);
  const initialized = useRef(false);

  const [contact, setContact] = useState<AdminContact>({ email: "", phone: "" });
  const [legacy, setLegacy] = useState<AdminLegacy>({
    paid_until: "",
    legacy_tier: "",
    legacy_price: "",
    legacy_source_id: "",
  });
  const [loginEmail, setLoginEmail] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchAdminProfile(targetId),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: EMPTY_PROFILE_FORM,
  });

  // Nur EINMAL aus den Serverdaten befüllen — sonst überschriebe ein Refetch die
  // laufende Eingabe. Dieselbe Regel wie im eigenen Editor.
  useEffect(() => {
    if (data && !initialized.current) {
      reset(data.form);
      setContact(data.contact);
      setLegacy(data.legacy);
      setLoginEmail(data.loginEmail);
      initialized.current = true;
    }
  }, [data, reset]);

  const speichern = useMutation({
    mutationFn: () => saveAdminProfile(targetId, getValues(), contact, legacy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ variant: "success", title: "Profil gespeichert" });
    },
    onError: (error) =>
      toast({
        variant: "error",
        title: "Speichern fehlgeschlagen",
        description: errorMessage(error),
      }),
  });

  const adresseAendern = useMutation({
    mutationFn: () => changeLoginEmail(targetId, loginEmail.trim()),
    onSuccess: (ergebnis) => {
      queryClient.invalidateQueries({ queryKey });
      // `sessions_not_revoked` ist KEIN Fehler: die Adresse ist geändert, nur
      // die Sitzungen leben weiter. Als Fehler gemeldet, wiederholte der Admin
      // eine Änderung, die längst gilt.
      if (ergebnis.status === "sessions_not_revoked") {
        toast({
          variant: "success",
          title: "Adresse geändert",
          description:
            "Die Sitzungen des Kontos konnten nicht beendet werden — die neue Adresse gilt trotzdem.",
        });
        return;
      }
      toast({
        variant: "success",
        title: "Adresse geändert",
        description: "Das Mitglied meldet sich ab sofort mit der neuen Adresse an.",
      });
    },
    onError: (error) =>
      toast({
        variant: "error",
        title: "Änderung fehlgeschlagen",
        description: errorMessage(error),
      }),
  });

  if (isLoading) return <PageSkeleton label="Profil wird geladen…" />;
  if (isError || !data) {
    return (
      <p className="text-sm text-danger">Profil konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }

  const felder = { register, control, errors };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link to="/admin" className="text-sm font-medium text-accent-strong hover:text-accent">
          ← Zurück zur Verwaltung
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Mitglied bearbeiten
        </h1>
        <p className="mt-1 text-sm text-muted">
          {data.form.name || "Ohne Namen"} ·{" "}
          {data.activated ? (
            <span>bestätigt</span>
          ) : (
            <span className="font-medium text-ink">
              nicht bestätigt — dieses Profil ist für kein anderes Mitglied sichtbar
            </span>
          )}
        </p>
      </header>

      <form onSubmit={handleSubmit(() => speichern.mutate())} className="flex flex-col gap-6" noValidate>
        <ProfileBasicsFieldset {...felder} />
        <ProfileRolesFieldset {...felder} />
        <ProfileDevelopmentFieldset {...felder} />
        <ProfileWebFieldset {...felder} />
        <ProfileVideosFieldset {...felder} />

        {/* Kontaktdaten — NICHT die Login-Adresse. Das ist die Adresse, an die
            notify-contact-request schickt; wird nur die Login-Adresse geändert,
            gehen die Benachrichtigungen weiter ans alte Postfach. */}
        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle className="text-base">Kontaktdaten</CardTitle>
            <CardDescription>
              Wird nach einer angenommenen Kontaktanfrage freigegeben und trägt die
              Benachrichtigungen. Nicht die Adresse, mit der sich das Mitglied anmeldet.
            </CardDescription>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kontakt-E-Mail">
              {({ id }) => (
                <Input
                  id={id}
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                />
              )}
            </Field>
            <Field label="Telefon">
              {({ id }) => (
                <Input
                  id={id}
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Card>

        {/* Altmitgliedschaft (profile_legacy) */}
        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle className="text-base">Altmitgliedschaft</CardTitle>
            <CardDescription>
              Trägt den Bestandsschutz: die höchste Stufe gilt bis zum genannten Tag
              einschließlich. Leer heißt „unbekannt", nicht „unbefristet". Für Mitglieder
              unsichtbar.
            </CardDescription>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bezahlt bis">
              {({ id }) => (
                <Input
                  id={id}
                  type="date"
                  value={legacy.paid_until}
                  onChange={(e) => setLegacy({ ...legacy, paid_until: e.target.value })}
                />
              )}
            </Field>
            <Field label="Alte Stufe">
              {({ id }) => (
                <Input
                  id={id}
                  value={legacy.legacy_tier}
                  onChange={(e) => setLegacy({ ...legacy, legacy_tier: e.target.value })}
                />
              )}
            </Field>
            <Field label="Gezahlter Betrag (€)">
              {({ id }) => (
                <Input
                  id={id}
                  inputMode="decimal"
                  value={legacy.legacy_price}
                  onChange={(e) => setLegacy({ ...legacy, legacy_price: e.target.value })}
                />
              )}
            </Field>
            <Field label="Quell-Kennung" hint="WordPress-User-ID; macht den Import wiederholbar.">
              {({ id }) => (
                <Input
                  id={id}
                  value={legacy.legacy_source_id}
                  onChange={(e) => setLegacy({ ...legacy, legacy_source_id: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={speichern.isPending}>
            {speichern.isPending ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </form>

      {/* Login-Adresse: eigener Weg, eigener Knopf — sie liegt in auth.users und
          geht über die Edge Function, nicht über admin_update_profile. Ein
          gemeinsames Absenden fasste zwei Fehlerfälle in einem Button zusammen. */}
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle className="text-base">Login-Adresse</CardTitle>
          <CardDescription>
            Der Fallback, wenn jemand nicht mehr an sein altes Postfach kommt. Die neue
            Adresse gilt sofort, ohne Bestätigungsmail; bestehende Sitzungen werden
            beendet. Ein bereits ausgegebener Zugriffstoken bleibt bis zu einer Stunde
            gültig.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 flex-1">
            <Field label="E-Mail für die Anmeldung">
              {({ id }) => (
                <Input
                  id={id}
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Button
            variant="ghost"
            onClick={() => adresseAendern.mutate()}
            disabled={adresseAendern.isPending || loginEmail.trim() === ""}
          >
            {adresseAendern.isPending ? "Wird geändert…" : "Login-Adresse ändern"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
