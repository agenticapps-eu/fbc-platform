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
  type EventType,
  type EventVisibility,
} from "../../lib/events";
import {
  POSITION_OPTIONS,
  WIEDERHOLUNG_OPTIONS,
  WOCHENTAG_OPTIONS,
  regelVollstaendig,
  type VorlageInput,
  type VorlageItem,
  type Wiederholung,
} from "../../lib/event-vorlagen";

/** „18:30:00" aus Postgres → „18:30" für <input type="time">. */
function toTimeInput(wert: string | null): string {
  if (!wert) return "";
  return wert.slice(0, 5);
}

/** „18:30" → „18:30:00". Postgres nimmt beides; die lange Form ist eindeutig. */
function fromTimeInput(wert: string): string {
  return wert.length === 5 ? `${wert}:00` : wert;
}

/**
 * Anlegen und Bearbeiten einer Event-Vorlage (AGE-630, 9.1).
 *
 * Bewusst ein Zwilling von `EventForm` und kein Umbau davon: die beiden teilen
 * die Beschreibungsfelder, unterscheiden sich aber genau dort, wo es zählt.
 * Ein Event hat einen **Zeitpunkt** (`starts_at`, `ends_at`); eine Vorlage hat
 * eine **Uhrzeit plus Regel** (`ortszeit`, `dauer`, `wiederholung`) und gar
 * kein Datum — das Datum entsteht erst beim Erzeugen. Ein gemeinsames Formular
 * müsste die halbe Feldliste ein- und ausblenden und wäre an beiden Enden
 * schlechter zu lesen als zwei.
 *
 * Wiederverwendet wird, was wiederverwendbar ist: dieselben Feld-Bausteine und
 * derselbe `EventCoverPicker` samt Cropper — es gibt keinen zweiten Zuschnitt
 * für Vorlagenbilder.
 */
export function VorlageForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: VorlageItem;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: VorlageInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<EventType>((initial?.type as EventType) ?? "online");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [topics, setTopics] = useState((initial?.topics ?? []).join("\n"));
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : "",
  );
  const [visibility, setVisibility] = useState<EventVisibility>(
    (initial?.visibility as EventVisibility) ?? "members",
  );
  const [ortszeit, setOrtszeit] = useState(toTimeInput(initial?.ortszeit ?? "18:30:00"));
  const [dauer, setDauer] = useState(toTimeInput(initial?.dauer ?? null));
  const [wiederholung, setWiederholung] = useState<Wiederholung | "">(initial?.wiederholung ?? "");
  const [wochentag, setWochentag] = useState(
    initial?.wochentag != null ? String(initial.wochentag) : "",
  );
  const [tagImMonat, setTagImMonat] = useState(
    initial?.tagImMonat != null ? String(initial.tagImMonat) : "",
  );
  const [wochentagPosition, setWochentagPosition] = useState(
    initial?.wochentagPosition != null ? String(initial.wochentagPosition) : "",
  );
  // Wie in `EventForm`: `undefined` = unangetastet, damit ein Speichern ohne
  // neue Bildauswahl das Titelbild nicht löscht.
  const [coverPath, setCoverPath] = useState<string | null | undefined>(undefined);
  const [bildLaedt, setBildLaedt] = useState(false);

  // Welche der drei Regelfelder überhaupt zur gewählten Form gehören. Die
  // anderen werden nicht nur ausgeblendet, sondern beim Absenden auf null
  // gesetzt — `event_vorlagen_regelform` verlangt das, und ein Feld, das nur
  // unsichtbar ist, trägt seinen alten Wert weiter in die Datenbank.
  const zeigtWochentag =
    wiederholung === "woechentlich" || wiederholung === "monatlich_n_ter_wochentag";
  const zeigtTagImMonat = wiederholung === "monatlich_tag";
  const zeigtPosition = wiederholung === "monatlich_n_ter_wochentag";

  const regel = {
    wiederholung: wiederholung === "" ? null : wiederholung,
    wochentag: zeigtWochentag && wochentag !== "" ? Number(wochentag) : null,
    tagImMonat: zeigtTagImMonat && tagImMonat !== "" ? Number(tagImMonat) : null,
    wochentagPosition: zeigtPosition && wochentagPosition !== "" ? Number(wochentagPosition) : null,
  };
  const regelOk = regelVollstaendig(regel);

  const canSubmit =
    title.trim() !== "" && ortszeit !== "" && regelOk && !pending && !bildLaedt;

  function submit() {
    const capNum = capacity.trim() === "" ? null : Number(capacity);
    const topicList = topics
      .split("\n")
      .map((z) => z.trim())
      .filter((z) => z !== "");
    onSubmit({
      title: title.trim(),
      type,
      location: location.trim() || null,
      description: description.trim() || null,
      topics: topicList.length > 0 ? topicList : null,
      capacity: capNum != null && Number.isFinite(capNum) && capNum > 0 ? Math.floor(capNum) : null,
      visibility,
      ortszeit: fromTimeInput(ortszeit),
      // Die Zeitzone steht nicht im Formular: alle Termine des Clubs liegen in
      // derselben, und ein Auswahlfeld mit einem sinnvollen Wert ist keine
      // Auswahl. Die Spalte trägt `Europe/Berlin` als Vorgabe und einen
      // Trigger, der unbekannte Zonen abweist — der Weg dorthin bleibt offen,
      // ohne hier eine Frage zu stellen, die niemand hat.
      zeitzone: initial?.zeitzone ?? "Europe/Berlin",
      dauer: dauer === "" ? null : fromTimeInput(dauer),
      ...regel,
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
            placeholder="z. B. Stammtisch Stuttgart"
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Uhrzeit" required hint="Ortszeit — gilt für jeden erzeugten Termin">
          {({ id }) => (
            <Input
              id={id}
              type="time"
              value={ortszeit}
              onChange={(e) => setOrtszeit(e.target.value)}
            />
          )}
        </Field>
        <Field label="Dauer" hint="Optional — leer heißt: kein Ende eintragen">
          {({ id }) => (
            <Input id={id} type="time" value={dauer} onChange={(e) => setDauer(e.target.value)} />
          )}
        </Field>

        <Field label="Wiederholung" hint="Ohne Regel bleibt es eine Vorlage zum Einzelanlegen">
          {({ id }) => (
            <Select
              id={id}
              value={wiederholung}
              onChange={(e) => setWiederholung(e.target.value as Wiederholung | "")}
            >
              <option value="">Keine</option>
              {WIEDERHOLUNG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {zeigtPosition && (
          <Field label="Position im Monat">
            {({ id }) => (
              <Select
                id={id}
                value={wochentagPosition}
                onChange={(e) => setWochentagPosition(e.target.value)}
              >
                <option value="">Bitte wählen</option>
                {POSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {zeigtWochentag && (
          <Field label="Wochentag">
            {({ id }) => (
              <Select id={id} value={wochentag} onChange={(e) => setWochentag(e.target.value)}>
                <option value="">Bitte wählen</option>
                {WOCHENTAG_OPTIONS.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {zeigtTagImMonat && (
          <Field label="Tag im Monat" hint="1–31; Monate ohne diesen Tag werden übersprungen">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={31}
                value={tagImMonat}
                onChange={(e) => setTagImMonat(e.target.value)}
              />
            )}
          </Field>
        )}

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
