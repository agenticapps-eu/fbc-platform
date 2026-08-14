import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { TagInput } from "./TagInput";
import { VideoLinksInput } from "./VideoLinksInput";
import { Card, CardDescription, CardTitle } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { THEMES, type ProfileFormValues } from "../../lib/profile";
import { BRANCHEN } from "../../config/branchen";

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

export function ProfileBasicsFieldset({ register, control, errors }: ProfileFieldsetsProps) {
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
        {/* CONTROLLER, nicht `register` — und das ist kein Geschmack.
            `register` setzt den Wert per ref, sobald `reset(data)` läuft. Ein
            Bestandswert außerhalb der Liste hat zu diesem Zeitpunkt noch KEINE
            Option (die wächst erst im Render danach nach), der Browser fällt auf
            „Keine Angabe" zurück, und das nächste Speichern löscht die Branche.
            Ein gesteuertes `value` wird dagegen im selben Commit gesetzt wie die
            Optionen. Gefunden in der Sichtprobe; jsdom bildet das nicht ab, der
            Test daneben blieb grün. */}
        <Field label="Branche" error={errors.branche?.message}>
          {({ id, invalid }) => (
            <Controller
              control={control}
              name="branche"
              render={({ field }) => (
                <Select id={id} invalid={invalid} {...field}>
                  <option value="">Keine Angabe</option>
                  {/* Die Liste steuert die Eingabe, sie räumt nicht auf: ein
                      Wert von vor AGE-537 bleibt wählbar und geht nicht
                      verloren. */}
                  {field.value && !BRANCHEN.some((b) => b.value === field.value) && (
                    <option value={field.value}>{field.value}</option>
                  )}
                  {BRANCHEN.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.value}
                    </option>
                  ))}
                </Select>
              )}
            />
          )}
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
      {/*
       * Sechs Netzwerke, nicht drei. Facebook, YouTube und X/Twitter stehen
       * hier, weil der WordPress-Import sie mitbringt (AGE-534) und
       * `saveProfile` die `socials`-Spalte vollständig ersetzt: ohne ein Feld
       * im Formular käme der Wert nie im Formularwert an und wäre nach dem
       * ersten Speichern weg. Betroffen sind 23 der 70 Altmitglieder.
       */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="LinkedIn">{({ id }) => <Input id={id} {...register("socials.linkedin")} />}</Field>
        <Field label="Instagram">
          {({ id }) => <Input id={id} {...register("socials.instagram")} />}
        </Field>
        <Field label="Xing">{({ id }) => <Input id={id} {...register("socials.xing")} />}</Field>
        <Field label="Facebook">
          {({ id }) => <Input id={id} {...register("socials.facebook")} />}
        </Field>
        <Field label="YouTube">
          {({ id }) => <Input id={id} {...register("socials.youtube")} />}
        </Field>
        <Field label="X / Twitter">
          {({ id }) => <Input id={id} {...register("socials.twitter")} />}
        </Field>
      </div>
    </Card>
  );
}

/**
 * Die Kontaktzeile (AGE-537, C6a) — die einzige Feldgruppe hier, die NICHT auf
 * `public.profiles` schreibt, sondern auf `public.profile_contacts`.
 *
 * Sie steht trotzdem in dieser Datei, weil beide Editoren sie brauchen: seit
 * C6a pflegt ein Mitglied seine Kontaktdaten selbst, und der Admin bearbeitet
 * dieselben Felder an einem fremden Profil. Bis dahin hatte die Admin-Seite
 * dafür eine eigene Struktur — die wäre jetzt eine zweite Wahrheit.
 *
 * `country` bekommt NUR einen Platzhalter. Eine Vorbelegung machte aus einer
 * bewussten Leerung beim nächsten Laden wieder „DE"; die Vorgabe setzt der
 * Import (C10), der ein Feld füllt, das WordPress nicht erhebt.
 */
export function ProfileContactFieldset({ register, errors }: ProfileFieldsetsProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle className="text-base">Kontakt und Anschrift</CardTitle>
        <CardDescription>
          Sichtbar erst nach einer angenommenen Kontaktanfrage — für alle anderen bleiben
          diese Angaben verschlossen. Nicht die Adresse, mit der du dich anmeldest.
        </CardDescription>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kontakt-E-Mail" error={errors.contact?.email?.message}>
          {({ id, invalid }) => (
            <Input
              id={id}
              type="email"
              invalid={invalid}
              autoComplete="email"
              {...register("contact.email")}
            />
          )}
        </Field>
        <Field label="Telefon" error={errors.contact?.phone?.message}>
          {({ id, invalid }) => (
            <Input id={id} invalid={invalid} autoComplete="tel" {...register("contact.phone")} />
          )}
        </Field>
      </div>
      <Field label="Straße und Hausnummer" error={errors.contact?.street?.message}>
        {({ id, invalid }) => (
          <Input
            id={id}
            invalid={invalid}
            autoComplete="street-address"
            {...register("contact.street")}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="PLZ" error={errors.contact?.postal_code?.message}>
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              autoComplete="postal-code"
              {...register("contact.postal_code")}
            />
          )}
        </Field>
        <Field label="Ort" error={errors.contact?.city?.message}>
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              autoComplete="address-level2"
              {...register("contact.city")}
            />
          )}
        </Field>
        <Field label="Bundesland" error={errors.contact?.state?.message}>
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              autoComplete="address-level1"
              {...register("contact.state")}
            />
          )}
        </Field>
        <Field label="Land" error={errors.contact?.country?.message}>
          {({ id, invalid }) => (
            <Input
              id={id}
              invalid={invalid}
              placeholder="DE"
              autoComplete="country"
              {...register("contact.country")}
            />
          )}
        </Field>
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
