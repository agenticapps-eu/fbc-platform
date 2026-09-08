import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { useToast } from "../ui/toast-context";
import { useAuth } from "../../providers/auth-context";
import { eventsListKey } from "../../lib/events";
import {
  serieErzeugen,
  serieSlots,
  type SerieSlot,
  type VorlageItem,
} from "../../lib/event-vorlagen";

/** Die Obergrenze steht in der RPC; hier steht sie noch einmal, damit das Feld sie kennt. */
const MAX_TERMINE = 52;

const datumFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function heute(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function errMsg(error: unknown): string {
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message: unknown }).message);
  return "Unbekannter Fehler.";
}

/**
 * Termine aus einer Vorlage erzeugen (AGE-630, 9.2).
 *
 * **Die Vorschau ruft dieselbe Funktion wie das Schreiben.**
 * `event_serie_slots()` ist `security invoker`, rechnet nur mit Kalender und
 * Zonendatenbank und trägt `execute` an `authenticated` — genau deshalb kann
 * die Liste, die hier steht, nicht von der abweichen, die gleich entsteht. Eine
 * im Client nachgebaute Datumsrechnung wäre eine zweite Wahrheit, die
 * spätestens an der nächsten Zeitumstellung auseinanderläuft.
 *
 * **Anzahl oder Enddatum**, nie beides: `event_serie_slots()` kennt nur eine
 * Anzahl, das Enddatum wird deshalb als „bis zu 52 Termine, davon die bis zum
 * Stichtag" aufgelöst. Die RPC bekommt am Ende in beiden Fällen die Anzahl der
 * wirklich gemeinten Termine.
 */
export function SerieErzeugen({ vorlage, onDone }: { vorlage: VorlageItem; onDone: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [ab, setAb] = useState(heute());
  const [begrenzung, setBegrenzung] = useState<"anzahl" | "bis">("anzahl");
  const [anzahl, setAnzahl] = useState("4");
  const [bis, setBis] = useState("");
  const [slots, setSlots] = useState<SerieSlot[] | null>(null);

  const anzahlZahl = Number(anzahl);
  const anzahlOk =
    begrenzung === "bis"
      ? bis !== "" && bis >= ab
      : Number.isFinite(anzahlZahl) && anzahlZahl >= 1 && anzahlZahl <= MAX_TERMINE;

  const vorschau = useMutation({
    mutationFn: async () => {
      // Beim Enddatum wird die volle Obergrenze geholt und danach geschnitten —
      // die Funktion kennt kein „bis", und ein zweiter Rechenweg im Client wäre
      // genau die zweite Wahrheit, die diese Vorschau vermeiden soll.
      const roh = await serieSlots(vorlage, ab, begrenzung === "bis" ? MAX_TERMINE : anzahlZahl);
      return begrenzung === "bis" ? roh.filter((s) => s.slotDatum <= bis) : roh;
    },
    onSuccess: setSlots,
    onError: (error) =>
      toast({ variant: "error", title: "Vorschau fehlgeschlagen", description: errMsg(error) }),
  });

  const erzeugen = useMutation({
    mutationFn: () => serieErzeugen(user!.id, vorlage, ab, slots ?? []),
    onSuccess: (zahl) => {
      toast({
        variant: "success",
        title: zahl === 1 ? "1 Termin erzeugt" : `${zahl} Termine erzeugt`,
      });
      queryClient.invalidateQueries({ queryKey: eventsListKey(user?.id ?? null) });
      onDone();
    },
    onError: (error) =>
      toast({ variant: "error", title: "Erzeugen fehlgeschlagen", description: errMsg(error) }),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Termine aus <span className="font-medium text-ink">{vorlage.title}</span> erzeugen. Ein
        Termin, den es schon gibt, entsteht nicht doppelt.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ab" required>
          {({ id }) => (
            <Input
              id={id}
              type="date"
              value={ab}
              onChange={(e) => {
                setAb(e.target.value);
                setSlots(null);
              }}
            />
          )}
        </Field>
        <Field label="Begrenzung">
          {({ id }) => (
            <Select
              id={id}
              value={begrenzung}
              onChange={(e) => {
                setBegrenzung(e.target.value as "anzahl" | "bis");
                setSlots(null);
              }}
            >
              <option value="anzahl">Anzahl Termine</option>
              <option value="bis">Bis Datum</option>
            </Select>
          )}
        </Field>
        {begrenzung === "anzahl" ? (
          <Field label="Anzahl" hint={`1–${MAX_TERMINE}`}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={MAX_TERMINE}
                value={anzahl}
                onChange={(e) => {
                  setAnzahl(e.target.value);
                  setSlots(null);
                }}
              />
            )}
          </Field>
        ) : (
          <Field label="Bis" hint={`Höchstens ${MAX_TERMINE} Termine`}>
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={bis}
                onChange={(e) => {
                  setBis(e.target.value);
                  setSlots(null);
                }}
              />
            )}
          </Field>
        )}
      </div>

      {slots !== null && (
        <div className="rounded-[var(--radius-card)] border border-line p-4">
          {slots.length === 0 ? (
            <p className="text-sm text-muted">
              In diesem Zeitraum fällt kein Termin auf die Regel der Vorlage.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium text-ink">
                {slots.length === 1 ? "1 Termin" : `${slots.length} Termine`}
              </p>
              <ul className="space-y-1 text-sm text-muted">
                {slots.map((s) => (
                  <li key={s.slotDatum}>{datumFmt.format(new Date(s.startsAt))}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={erzeugen.isPending}>
          Abbrechen
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!anzahlOk || vorschau.isPending}
          onClick={() => vorschau.mutate()}
        >
          {vorschau.isPending ? "Wird gerechnet…" : "Vorschau"}
        </Button>
        {/* Erzeugen erst NACH der Vorschau: 52 Termine sind ein Schreibvorgang,
            der sich nicht mit einem Klick zurücknehmen lässt. */}
        <Button
          size="sm"
          disabled={slots === null || slots.length === 0 || erzeugen.isPending}
          onClick={() => erzeugen.mutate()}
        >
          {erzeugen.isPending ? "Wird erzeugt…" : "Termine erzeugen"}
        </Button>
      </div>
    </div>
  );
}
