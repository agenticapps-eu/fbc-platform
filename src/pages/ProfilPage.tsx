import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { categoryLabel, type MatchingSide } from "../config/matching";
import {
  categoryOptionsForSide,
  ConfirmationRequiredError,
  fetchCategorySelection,
  profileCategoriesQueryKey,
  saveCategorySelection,
  type CategorySelection,
} from "../lib/profile-categories";
import { AvatarCropper } from "../components/profile/AvatarCropper";
import {
  ProfileBasicsFieldset,
  ProfileDevelopmentFieldset,
  ProfileRolesFieldset,
  ProfileVideosFieldset,
  ProfileWebFieldset,
} from "../components/profile/ProfileFieldsets";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toast-context";
import { cn } from "../lib/cn";
import {
  EMPTY_PROFILE_FORM,
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
import { Link } from "react-router-dom";
import { useAuth } from "../providers/auth-context";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

/** Postgres-Unique-Verletzung (23505) — hier: der partielle Index auf
 *  (profile_id, category) where source = 'chip'. `saveCategorySelection` gleicht
 *  bewusst nicht atomar ab, dieser Index ist die Absicherung; er schlägt also im
 *  Normalbetrieb zu (zweiter Tab, veralteter Lesestand) und darf dem Mitglied
 *  nicht als Datenbank-Wortlaut begegnen. */
function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
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
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Ein Zuschnitt-Dialog für beide Bilder — er weiß über `kind`, welches
  // Seitenverhältnis gilt. Zwei parallele Dialoge wären zwei Zustände, die sich
  // gegenseitig überschreiben könnten.
  const [pending, setPending] = useState<{ file: File; kind: "avatar" | "cover" } | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
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
    defaultValues: EMPTY_PROFILE_FORM,
  });

  useEffect(() => {
    if (data && !initialized.current) {
      reset(data);
      initialized.current = true;
    }
  }, [data, reset]);

  const interests = useFieldArray({ control, name: "interests" });
  const goals = useFieldArray({ control, name: "goals" });

  // Die Feldgruppen, die auf `profiles` schreiben, teilt sich diese Seite mit
  // der Admin-Bearbeitung (AGE-498) — eine Felddefinition, zwei Rahmen.
  const felder = { register, control, errors };

  // Live-Werte für die Vollständigkeits-Anzeige (Compiler-freundliche Subscription).
  const values = useWatch({ control }) as ProfileFormValues;
  const completion = computeProfileCompletion(values);
  const complete = isProfileComplete(completion);

  const mutation = useMutation({
    mutationFn: () => saveProfile(uid, getValues(), avatarBlob, coverBlob),
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
    onSuccess: ({ avatarUrl, coverUrl, completion: saved }) => {
      setAvatarBlob(null);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
      setValue("avatar_url", avatarUrl, { shouldDirty: false });
      setCoverBlob(null);
      if (coverPreview) {
        URL.revokeObjectURL(coverPreview);
        setCoverPreview(null);
      }
      setValue("cover_url", coverUrl, { shouldDirty: false });
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

  function onFileChange(kind: "avatar" | "cover") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) setPending({ file, kind });
      event.target.value = ""; // gleiche Datei erneut wählbar machen
    };
  }

  /**
   * Entfernen heißt hier ENTKOPPELN, nicht löschen: `cover_url` wird geleert,
   * das Objekt bleibt im Bucket und über seine URL abrufbar. Genau so verhält
   * sich der Avatar seit AGE-238; die Beschriftung sagt es, statt eine Löschung
   * zu versprechen, die nicht stattfindet.
   */
  function removeCover() {
    setCoverBlob(null);
    if (coverPreview) {
      URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
    }
    setValue("cover_url", null, { shouldDirty: true });
  }

  if (isLoading) {
    return <PageSkeleton label="Profil wird geladen…" />;
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">Profil konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit(() => mutation.mutate())}
        className="flex flex-col gap-6"
        noValidate
      >
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/profil" className="text-sm font-medium text-accent-strong hover:text-accent">
              ← Zurück zum Profil
            </Link>
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
                complete ? "bg-accent-soft text-accent-strong" : "bg-soft text-muted",
              )}
            >
              {completion}% {complete ? "· vollständig" : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                complete ? "bg-accent" : "bg-accent/60",
              )}
              style={{ width: `${completion}%` }}
            />
          </div>
          {!complete && (
            <p className="text-xs text-muted">
              Ab 80 % gilt dein Profil als vollständig. Avatar, Headline, Rollen, Kompetenzen,
              Website und Social-Links zählen mit.
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
              onChange={onFileChange("avatar")}
              className="hidden"
            />
          </div>
        </Card>

        {/* Hintergrundbild (AGE-498) */}
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Hintergrundbild</CardTitle>
          <div
            className="relative h-24 w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-[linear-gradient(120deg,var(--color-accent-soft),var(--color-canvas)_55%,color-mix(in_srgb,var(--color-accent)_20%,var(--color-canvas)))] sm:h-28"
            data-testid="cover-vorschau"
          >
            {(coverPreview ?? values.cover_url) && (
              <img
                src={coverPreview ?? values.cover_url ?? undefined}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => coverInputRef.current?.click()}>
              {values.cover_url || coverPreview ? "Bild ändern" : "Bild hochladen"}
            </Button>
            {(values.cover_url || coverPreview) && (
              <Button variant="ghost" size="sm" onClick={removeCover}>
                Bild entfernen
              </Button>
            )}
            <p className="text-xs text-muted">
              JPG, PNG oder WebP, Zuschnitt 3:1. „Entfernen" löst nur die Verknüpfung — die Datei
              bleibt erreichbar, wer ihre Adresse kennt.
            </p>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange("cover")}
            className="hidden"
          />
        </Card>

        <ProfileBasicsFieldset {...felder} />

        <ProfileRolesFieldset {...felder} />

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

        <ProfileDevelopmentFieldset {...felder} />

        <ProfileWebFieldset {...felder} />

        <ProfileVideosFieldset {...felder} />

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Speichern…" : "Speichern"}
          </Button>
        </div>

        {pending && (
          <AvatarCropper
            file={pending.file}
            aspect={pending.kind === "cover" ? 3 : 1}
            outWidth={pending.kind === "cover" ? 1500 : 512}
            label={pending.kind === "cover" ? "Hintergrundbild zuschneiden" : "Avatar zuschneiden"}
            onCancel={() => setPending(null)}
            onConfirm={(blob, url) => {
              if (pending.kind === "cover") {
                setCoverBlob(blob);
                if (coverPreview) URL.revokeObjectURL(coverPreview);
                setCoverPreview(url);
              } else {
                setAvatarBlob(blob);
                if (preview) URL.revokeObjectURL(preview);
                setPreview(url);
              }
              setPending(null);
            }}
          />
        )}
      </form>
      {/* AGE-494: Der Kompass hat keine eigene Seite mehr — seine Kategorien
          leben hier und über der Mitgliederliste. */}
      <KompassKategorien uid={uid} />
    </div>
  );
}

/**
 * Kompass-Kategorien im Profil (AGE-494).
 *
 * Bewusst NEBEN dem Profil-Formular und mit eigenem Speichern: die Chips schreiben
 * `offers`/`needs`, das Formular schreibt `profiles`. Ein gemeinsames Absenden
 * müsste zwei Fehlerfälle in einem Button zusammenfassen und beim Rückfrage-Dialog
 * das ganze Profil blockieren.
 */
function KompassKategorien({ uid }: { uid: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Der Serverstand ist die Quelle; `edited` ist nur die noch ungespeicherte
  // Abweichung davon. Kein Effect, der den Serverstand in einen zweiten Zustand
  // spiegelt — das wären zwei Wahrheiten und eine Kaskade beim ersten Rendern.
  const [edited, setEdited] = useState<CategorySelection | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<
    { side: MatchingSide; category: string }[] | null
  >(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: profileCategoriesQueryKey(uid),
    queryFn: () => fetchCategorySelection(uid),
  });

  const selection = edited ?? data ?? null;

  const mutation = useMutation({
    mutationFn: (opts: { confirmed?: boolean }) =>
      saveCategorySelection(uid, selection ?? { offers: [], needs: [] }, opts),
    onSuccess: () => {
      setPendingConfirm(null);
      // Zurück auf den Serverstand: die Abweichung ist geschrieben.
      setEdited(null);
      queryClient.invalidateQueries({ queryKey: profileCategoriesQueryKey(uid) });
      toast({ variant: "success", title: "Kategorien gespeichert" });
    },
    onError: (error) => {
      if (error instanceof ConfirmationRequiredError) {
        setPendingConfirm(error.categories);
        return;
      }
      if (isUniqueViolation(error)) {
        // Der Serverstand ist nachweislich neuer als der gelesene. Neu laden
        // statt „nochmal versuchen“ — ein zweiter Versuch mit demselben
        // veralteten Plan liefe in denselben Index.
        queryClient.invalidateQueries({ queryKey: profileCategoriesQueryKey(uid) });
        setEdited(null);
        toast({
          variant: "error",
          title: "Speichern fehlgeschlagen",
          description:
            "Eine dieser Kategorien war bereits gespeichert — vermutlich in einem zweiten Tab. Wir haben deine Auswahl neu geladen; bitte prüfe sie und speichere erneut.",
        });
        return;
      }
      toast({
        variant: "error",
        title: "Speichern fehlgeschlagen",
        description: errorMessage(error),
      });
    },
  });

  // isError ZUERST: im Fehlerfall ist `data` undefined und damit `selection` null —
  // stünde die `!selection`-Prüfung davor, verschwände der ganze Block wortlos.
  if (isError) {
    return <p className="text-sm text-danger">Kategorien konnten nicht geladen werden.</p>;
  }
  if (isLoading || !selection) return null;

  function toggle(side: "offers" | "needs", value: string) {
    setPendingConfirm(null);
    setEdited((prev) => {
      const base = prev ?? data;
      if (!base) return prev;
      const current = base[side];
      return {
        ...base,
        [side]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-canvas p-5 shadow-soft">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Ich biete &amp; ich suche</h2>
        <p className="mt-1 text-sm text-muted">
          Wähle die Kategorien, die auf dich passen. Sie erscheinen auf deiner Karte im
          Mitgliederverzeichnis und lassen dich über die Filter finden.
        </p>
      </div>

      <ChipGroup
        label="Ich biete"
        options={categoryOptionsForSide("offer")}
        selected={selection.offers}
        onToggle={(v) => toggle("offers", v)}
      />
      <ChipGroup
        label="Ich suche"
        options={categoryOptionsForSide("need")}
        selected={selection.needs}
        onToggle={(v) => toggle("needs", v)}
      />

      {pendingConfirm && (
        <div
          role="alertdialog"
          aria-label="Ausführliche Einträge verwerfen?"
          className="rounded-[var(--radius-card)] border border-danger/40 bg-danger/5 p-4"
        >
          <p className="text-sm font-semibold text-ink">
            Diese Kategorien enthalten ausführliche Einträge
          </p>
          <p className="mt-1 text-sm text-muted">
            In {pendingConfirm.map((c) => categoryLabel(c.side, c.category)).join(", ")} hast du
            unter „Suche &amp; Biete“ etwas ausformuliert — mit Beschreibung, Schlagworten oder
            Volumen. Beim Entfernen der Kategorie geht das mit verloren.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => mutation.mutate({ confirmed: true })}
              disabled={mutation.isPending}
            >
              Trotzdem entfernen
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPendingConfirm(null);
                setEdited(null);
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => mutation.mutate({})}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Wird gespeichert…" : "Kategorien speichern"}
        </Button>
      </div>
    </section>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none",
                on
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line text-muted hover:border-accent/60 hover:text-ink",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
