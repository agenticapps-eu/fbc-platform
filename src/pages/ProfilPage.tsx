import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { AvatarCropper } from "../components/profile/AvatarCropper";
import { TagInput } from "../components/profile/TagInput";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { useToast } from "../components/ui/toast-context";
import { cn } from "../lib/cn";
import {
  GOAL_CATEGORIES,
  THEMES,
  computeProfileCompletion,
  fetchProfileEditorData,
  isProfileComplete,
  profileEditorQueryKey,
  profileFormSchema,
  saveProfile,
  type ProfileFormValues,
} from "../lib/profile";
import { useAuth } from "../providers/auth-context";

const EMPTY_VALUES: ProfileFormValues = {
  name: "",
  region: "",
  company: "",
  short_bio: "",
  avatar_url: null,
  branche: "",
  headline: "",
  roles: [],
  competencies: [],
  website: "",
  dev_focus: "",
  socials: { linkedin: "", instagram: "", xing: "" },
  interests: [],
  goals: [],
};

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

export default function ProfilPage() {
  const { user } = useAuth();
  // /profil ist requiresAuth — user ist hier vorhanden; defensiver Fallback.
  if (!user) return null;
  return <ProfileEditor uid={user.id} />;
}

function ProfileEditor({ uid }: { uid: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = profileEditorQueryKey(uid);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Formular nur EINMAL aus den Serverdaten befüllen — ein optimistisches
  // Rollback (Speicher-Fehler) darf die Eingaben des Nutzers nicht überschreiben.
  const initialized = useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchProfileEditorData(uid),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (data && !initialized.current) {
      reset(data);
      initialized.current = true;
    }
  }, [data, reset]);

  const interests = useFieldArray({ control, name: "interests" });
  const goals = useFieldArray({ control, name: "goals" });

  // Live-Werte für die Vollständigkeits-Anzeige (Compiler-freundliche Subscription).
  const values = useWatch({ control }) as ProfileFormValues;
  const completion = computeProfileCompletion(values);
  const complete = isProfileComplete(completion);

  const mutation = useMutation({
    mutationFn: () => saveProfile(uid, getValues(), avatarBlob),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProfileFormValues>(queryKey);
      queryClient.setQueryData<ProfileFormValues>(queryKey, getValues());
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({
        variant: "error",
        title: "Speichern fehlgeschlagen",
        description: errorMessage(error),
      });
    },
    onSuccess: ({ avatarUrl, completion: saved }) => {
      setAvatarBlob(null);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
      setValue("avatar_url", avatarUrl, { shouldDirty: false });
      toast({
        variant: "success",
        title: "Profil gespeichert",
        description: isProfileComplete(saved)
          ? "Dein Profil ist vollständig."
          : `Vollständigkeit: ${saved}%`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setPendingFile(file);
    event.target.value = ""; // gleiche Datei erneut wählbar machen
  }

  if (isLoading) {
    return <p className="text-sm text-muted">Profil wird geladen…</p>;
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">Profil konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(() => mutation.mutate())}
      className="flex flex-col gap-6"
      noValidate
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Profil bearbeiten
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pflege deine Angaben — sie speisen dein öffentliches Profil und das Matching.
          </p>
        </div>
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Speichern…" : "Speichern"}
        </Button>
      </header>

      {/* Vollständigkeit (live) */}
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Profil-Vollständigkeit</CardTitle>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              complete ? "bg-gold-soft text-gold-strong" : "bg-soft text-muted",
            )}
          >
            {completion}% {complete ? "· vollständig" : ""}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              complete ? "bg-gold" : "bg-gold/60",
            )}
            style={{ width: `${completion}%` }}
          />
        </div>
        {!complete && (
          <p className="text-xs text-muted">
            Ab 80 % gilt dein Profil als vollständig. Avatar, Headline, Rollen, Kompetenzen, Website
            und Social-Links zählen mit.
          </p>
        )}
      </Card>

      {/* Profilbild */}
      <Card className="flex flex-col gap-4">
        <CardTitle className="text-base">Profilbild</CardTitle>
        <div className="flex items-center gap-5">
          <Avatar name={values.name || "?"} src={preview ?? values.avatar_url} size="lg" />
          <div className="flex flex-col gap-2">
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
              {values.avatar_url || preview ? "Bild ändern" : "Bild hochladen"}
            </Button>
            <p className="text-xs text-muted">JPG, PNG oder WebP. Quadratischer Zuschnitt.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      </Card>

      {/* Basisangaben */}
      <Card className="flex flex-col gap-4">
        <CardTitle className="text-base">Basisangaben</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.message}>
            {({ id, invalid }) => (
              <Input id={id} invalid={invalid} {...register("name")} autoComplete="name" />
            )}
          </Field>
          <Field label="Region" required error={errors.region?.message}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} {...register("region")} />}
          </Field>
          <Field label="Unternehmen" required error={errors.company?.message}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} {...register("company")} />}
          </Field>
          <Field label="Branche" error={errors.branche?.message}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} {...register("branche")} />}
          </Field>
        </div>
        <Field
          label="Headline"
          hint="z. B. „Unternehmer · Investor · Deal Keeper“"
          error={errors.headline?.message}
        >
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register("headline")} />}
        </Field>
        <Field label="Kurzbeschreibung" required error={errors.short_bio?.message}>
          {({ id, invalid }) => <Textarea id={id} invalid={invalid} {...register("short_bio")} />}
        </Field>
      </Card>

      {/* Rollen & Kompetenzen */}
      <Card className="flex flex-col gap-4">
        <CardTitle className="text-base">Rollen & Kompetenzen</CardTitle>
        <Field label="Rollen" hint="Enter oder Komma fügt hinzu.">
          {({ id }) => (
            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <TagInput
                  id={id}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Rolle hinzufügen…"
                />
              )}
            />
          )}
        </Field>
        <Field label="Kompetenzen" hint="Enter oder Komma fügt hinzu.">
          {({ id }) => (
            <Controller
              control={control}
              name="competencies"
              render={({ field }) => (
                <TagInput
                  id={id}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Kompetenz hinzufügen…"
                />
              )}
            />
          )}
        </Field>
      </Card>

      {/* Interessen */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Interessen</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => interests.append({ theme: "", label: "" })}
          >
            + Interesse
          </Button>
        </div>
        {interests.fields.length === 0 ? (
          <CardDescription>Noch keine Interessen hinterlegt.</CardDescription>
        ) : (
          <ul className="flex flex-col gap-3">
            {interests.fields.map((row, index) => (
              <li key={row.id} className="grid grid-cols-[10rem_1fr_auto] gap-2">
                <Select {...register(`interests.${index}.theme`)} aria-label="Thema">
                  <option value="">Ohne Thema</option>
                  {THEMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Bezeichnung"
                  invalid={!!errors.interests?.[index]?.label}
                  {...register(`interests.${index}.label`)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => interests.remove(index)}
                  aria-label="Interesse entfernen"
                >
                  Entfernen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Ziele */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Ziele</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goals.append({ category: "persoenlich", title: "", progress: 0 })}
          >
            + Ziel
          </Button>
        </div>
        {goals.fields.length === 0 ? (
          <CardDescription>Noch keine Ziele hinterlegt.</CardDescription>
        ) : (
          <ul className="flex flex-col gap-3">
            {goals.fields.map((row, index) => (
              <li key={row.id} className="grid grid-cols-[10rem_1fr_5rem_auto] gap-2">
                <Select {...register(`goals.${index}.category`)} aria-label="Kategorie">
                  {GOAL_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Titel"
                  invalid={!!errors.goals?.[index]?.title}
                  {...register(`goals.${index}.title`)}
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  aria-label="Fortschritt in Prozent"
                  {...register(`goals.${index}.progress`, { valueAsNumber: true })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goals.remove(index)}
                  aria-label="Ziel entfernen"
                >
                  Entfernen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Entwicklung */}
      <Card className="flex flex-col gap-4">
        <CardTitle className="text-base">Entwicklung</CardTitle>
        <Field label="Aktueller Fokus" hint="Sein · Tun · Haben · Wirken">
          {({ id }) => (
            <Select id={id} {...register("dev_focus")}>
              <option value="">Kein Fokus</option>
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>

      {/* Web & Social */}
      <Card className="flex flex-col gap-4">
        <CardTitle className="text-base">Web & Social</CardTitle>
        <Field label="Website" error={errors.website?.message}>
          {({ id, invalid }) => (
            <Input id={id} invalid={invalid} placeholder="https://…" {...register("website")} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="LinkedIn">
            {({ id }) => <Input id={id} {...register("socials.linkedin")} />}
          </Field>
          <Field label="Instagram">
            {({ id }) => <Input id={id} {...register("socials.instagram")} />}
          </Field>
          <Field label="Xing">{({ id }) => <Input id={id} {...register("socials.xing")} />}</Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Speichern…" : "Speichern"}
        </Button>
      </div>

      {pendingFile && (
        <AvatarCropper
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={(blob, url) => {
            setAvatarBlob(blob);
            if (preview) URL.revokeObjectURL(preview);
            setPreview(url);
            setPendingFile(null);
          }}
        />
      )}
    </form>
  );
}
