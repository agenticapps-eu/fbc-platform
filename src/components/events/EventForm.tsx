import { useState } from "react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { EventCoverPicker } from "./EventCoverPicker";
import {
  EVENT_TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
  type EventInput,
  type EventListItem,
  type EventType,
  type EventVisibility,
} from "../../lib/events";

/** ISO → Wert für <input type="datetime-local"> (lokale Zeit, ohne Sekunden). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Anlegen/Bearbeiten eines Events. `initial` füllt die Felder beim Bearbeiten;
 * ohne `initial` ist es ein leeres Anlege-Formular.
 *
 * ZWEI Pflichtfelder, und dabei bleibt es (AGE-531): Titel und Beginn. Der
 * Beginn ist neu Pflicht, weil `events.starts_at` `not null` geworden ist —
 * ein Formular, das ihn leer ließe, scheiterte erst am `insert`, also weit weg
 * von dem Feld, das schuld ist. Beschreibung, Ende, Titelbild und Themen sind
 * alle optional; ein Mitglied, das abends schnell einen Termin einstellt, soll
 * nicht durch zwölf Felder.
 */
export function EventForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: EventListItem;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: EventInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<EventType>((initial?.type as EventType) ?? "online");
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt ?? null));
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [topics, setTopics] = useState((initial?.topics ?? []).join("\n"));
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : "",
  );
  // `undefined` = unangetastet. Genau diese dritte Möglichkeit verhindert, dass
  // ein Speichern ohne Bildauswahl das bestehende Titelbild löscht.
  const [coverPath, setCoverPath] = useState<string | null | undefined>(undefined);
  // Solange ein Titelbild hochlädt, darf nicht gespeichert werden — sonst
  // entsteht ein Event ohne das Bild, das man gerade gewählt hat.
  const [bildLaedt, setBildLaedt] = useState(false);
  // `initial` ist das Lese-Modell (EventListItem: `string`, wie die DB es liefert), der
  // State das Schreib-Modell. Die Verengung passiert hier sichtbar an EINER Stelle,
  // statt am Ende von submit() unbemerkt behauptet zu werden (AGE-356).
  const [visibility, setVisibility] = useState<EventVisibility>(
    (initial?.visibility as EventVisibility) ?? "members",
  );

  // Das Ende liegt vor dem Beginn: die Constraint fängt das ohnehin, aber als
  // roher Datenbankfehler in einem Toast. Hier steht es am Feld.
  const endeVorBeginn = startsAt !== "" && endsAt !== "" && endsAt <= startsAt;
  const canSubmit =
    title.trim() !== "" && startsAt !== "" && !endeVorBeginn && !pending && !bildLaedt;

  function submit() {
    const capNum = capacity.trim() === "" ? null : Number(capacity);
    const topicList = topics
      .split("\n")
      .map((z) => z.trim())
      .filter((z) => z !== "");
    onSubmit({
      title: title.trim(),
      type,
      // datetime-local ist lokale Zeit ohne Zone → in ISO (UTC) wandeln.
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      location: location.trim() || null,
      description: description.trim() || null,
      topics: topicList.length > 0 ? topicList : null,
      capacity: capNum != null && Number.isFinite(capNum) && capNum > 0 ? Math.floor(capNum) : null,
      visibility,
      ...(coverPath !== undefined ? { coverPath } : {}),
    });
  }

  return (
    <div className="space-y-4">
      <Field label="Titel" required>
        {({ id, invalid }) => (
          <Input
            id={id}
            invalid={invalid}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Legacy Dinner Stuttgart"
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Beginn" required>
          {({ id }) => (
            <Input
              id={id}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Ende"
          hint="Optional"
          error={endeVorBeginn ? "Das Ende muss nach dem Beginn liegen." : undefined}
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              type="datetime-local"
              invalid={invalid}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          )}
        </Field>
        <Field label="Typ">
          {({ id }) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as EventType)}>
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ort">
          {({ id }) => (
            <Input
              id={id}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Stuttgart / Online"
            />
          )}
        </Field>
        <Field label="Kapazität" hint="Leer = unbegrenzt">
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="z. B. 20"
            />
          )}
        </Field>
        <Field label="Sichtbarkeit">
          {({ id }) => (
            <Select
              id={id}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as EventVisibility)}
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Beschreibung" hint="Optional — worum geht es, und für wen?">
        {({ id }) => (
          <Textarea
            id={id}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ein bis zwei Absätze reichen."
          />
        )}
      </Field>
      <Field label="Themen" hint="Optional — ein Programmpunkt je Zeile">
        {({ id }) => (
          <Textarea
            id={id}
            rows={3}
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder={"Aktuelle Club-News\nNeue Mitglieder begrüßen"}
          />
        )}
      </Field>
      <EventCoverPicker
        initialPath={initial?.coverPath ?? null}
        value={coverPath}
        onChange={setCoverPath}
        onBusy={setBildLaedt}
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Abbrechen
        </Button>
        <Button size="sm" disabled={!canSubmit} onClick={submit}>
          {pending ? "Wird gespeichert…" : bildLaedt ? "Bild lädt…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
