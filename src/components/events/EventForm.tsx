import { useState } from "react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import {
  EVENT_TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
  type EventInput,
  type EventListItem,
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
 * Anlegen/Bearbeiten eines Events. `initial` füllt die Felder beim Bearbeiten; ohne
 * `initial` ist es ein leeres Anlege-Formular. Speichert nur die echten Event-Spalten
 * (kein Beschreibungsfeld — die Tabelle hat keine description-Spalte).
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
  const [type, setType] = useState(initial?.type ?? "online");
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? null));
  const [location, setLocation] = useState(initial?.location ?? "");
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : "",
  );
  const [visibility, setVisibility] = useState(initial?.visibility ?? "members");

  const canSubmit = title.trim() !== "" && !pending;

  function submit() {
    const capNum = capacity.trim() === "" ? null : Number(capacity);
    onSubmit({
      title: title.trim(),
      type: type as EventInput["type"],
      // datetime-local ist lokale Zeit ohne Zone → in ISO (UTC) wandeln.
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      location: location.trim() || null,
      capacity: capNum != null && Number.isFinite(capNum) && capNum > 0 ? Math.floor(capNum) : null,
      visibility: visibility as EventInput["visibility"],
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
        <Field label="Typ">
          {({ id }) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Datum & Uhrzeit">
          {({ id }) => (
            <Input
              id={id}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
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
      </div>
      <Field label="Sichtbarkeit">
        {({ id }) => (
          <Select id={id} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Abbrechen
        </Button>
        <Button size="sm" disabled={!canSubmit} onClick={submit}>
          {pending ? "Wird gespeichert…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
