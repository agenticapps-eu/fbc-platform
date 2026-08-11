import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { TagInput } from "./TagInput";
import { VideoLinksInput } from "./VideoLinksInput";
import { Card, CardDescription, CardTitle } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { THEMES, type ProfileFormValues } from "../../lib/profile";

/**
 * Die Feldgruppen, die auf `public.profiles` schreiben — von der eigenen
 * Profilbearbeitung UND von der Admin-Bearbeitung eines fremden Profils
 * (AGE-498) benutzt.
 *
 * WARUM HIER UND NICHT ZWEIMAL: ein zweites Formular für den Admin müsste jedes
 * Feld ein zweites Mal kennen und veraltete beim nächsten neuen Profilfeld
 * still. Genau davor warnte der Plan zu C6.
 *
 * WARUM NICHT ALS MODUS IM EIGENEN EDITOR: die beiden Seiten unterscheiden sich
 * nicht in den Feldern, sondern im RAHMEN. Die eigene Seite trägt Bilder,
 * Interessen, Ziele und die Kompass-Kategorien; die Admin-Seite trägt
 * Kontaktzeile, Altdaten und die Login-Adresse — und KEINE Bilder, weil beide
 * Bucket-Policies die `auth.uid()` des Aufrufers prüfen und ein Admin dort
 * abprallte. Ein gemeinsamer Editor mit `mode`-Schaltern hätte acht
 * Verzweigungen für zwei Seiten, die sich in den Feldern gar nicht widersprechen.
 */
export interface ProfileFieldsetsProps {
  register: UseFormRegister<ProfileFormValues>;
  control: Control<ProfileFormValues>;
  errors: FieldErrors<ProfileFormValues>;
}

export function ProfileBasicsFieldset({ register, errors }: ProfileFieldsetsProps) {
  return (
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
  );
}

export function ProfileRolesFieldset({ control }: ProfileFieldsetsProps) {
  return (
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
  );
}

export function ProfileDevelopmentFieldset({ register }: ProfileFieldsetsProps) {
  return (
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
  );
}

export function ProfileWebFieldset({ register, errors }: ProfileFieldsetsProps) {
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle className="text-base">Web & Social</CardTitle>
      <Field label="Website" error={errors.website?.message}>
        {({ id, invalid }) => (
          <Input id={id} invalid={invalid} placeholder="https://…" {...register("website")} />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="LinkedIn">{({ id }) => <Input id={id} {...register("socials.linkedin")} />}</Field>
        <Field label="Instagram">
          {({ id }) => <Input id={id} {...register("socials.instagram")} />}
        </Field>
        <Field label="Xing">{({ id }) => <Input id={id} {...register("socials.xing")} />}</Field>
      </div>
    </Card>
  );
}

export function ProfileVideosFieldset({ control }: ProfileFieldsetsProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle className="text-base">Videos</CardTitle>
        <CardDescription>
          YouTube- oder Vimeo-Links. Sie erscheinen auf dem öffentlichen Profil.
        </CardDescription>
      </div>
      <Controller
        control={control}
        name="videos"
        render={({ field }) => <VideoLinksInput value={field.value} onChange={field.onChange} />}
      />
    </Card>
  );
}
