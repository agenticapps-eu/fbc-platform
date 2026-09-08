import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useToast } from "../ui/toast-context";
import { SerieErzeugen } from "./SerieErzeugen";
import { VorlageForm } from "./VorlageForm";
import {
  WIEDERHOLUNG_OPTIONS,
  createVorlage,
  deleteVorlage,
  updateVorlage,
  vorlagenListKey,
  type VorlageInput,
  type VorlageItem,
} from "../../lib/event-vorlagen";

/**
 * Der Inhalt des vierten Reiters unter `/events` (AGE-630, 9.1).
 *
 * Kein eigener Seitenzuschnitt und keine Route: Donald am 07.09., in der Linie
 * von AGE-442 („keine weitere Unterseite") und AGE-494 („ein dritter Weg zum
 * selben Ort"). Die Liste ist deshalb bewusst schmal gehalten — Titel, Regel in
 * Worten, und die zwei Handlungen, die es gibt.
 */

/** Die Regel in einem Satz, aus denselben Listen, die das Formular anbietet. */
function regelText(v: VorlageItem): string {
  const uhr = v.ortszeit.slice(0, 5);
  if (v.wiederholung === null) return `Einzeltermin, ${uhr} Uhr`;
  const form = WIEDERHOLUNG_OPTIONS.find((o) => o.value === v.wiederholung)?.label ?? "";
  return `${form}, ${uhr} Uhr`;
}

function errMsg(error: unknown): string {
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message: unknown }).message);
  return "Unbekannter Fehler.";
}

export function VorlagenPanel({
  hostId,
  vorlagen,
  fehler,
}: {
  hostId: string;
  vorlagen: VorlageItem[];
  fehler: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // `null` = geschlossen, `"neu"` = Anlegen, sonst die id der bearbeiteten
  // Vorlage. Ein einzelner Zustand statt zweier Flags: „anlegen UND bearbeiten
  // gleichzeitig offen" ist kein Zustand, den es geben soll.
  const [offen, setOffen] = useState<string | null>(null);
  /** Die Vorlage, deren Erzeugen-Dialog offen ist — getrennt von `offen`, weil
   *  Erzeugen und Bearbeiten verschiedene Fragen an dieselbe Zeile sind. */
  const [serie, setSerie] = useState<string | null>(null);

  const invalidieren = () =>
    queryClient.invalidateQueries({ queryKey: vorlagenListKey(hostId) });

  const anlegen = useMutation({
    mutationFn: (input: VorlageInput) => createVorlage(hostId, input),
    onSuccess: () => {
      toast({ variant: "success", title: "Vorlage angelegt" });
      invalidieren();
      setOffen(null);
    },
    onError: (error) =>
      toast({ variant: "error", title: "Anlegen fehlgeschlagen", description: errMsg(error) }),
  });

  const speichern = useMutation({
    mutationFn: ({ id, input }: { id: string; input: VorlageInput }) => updateVorlage(id, input),
    onSuccess: () => {
      toast({ variant: "success", title: "Vorlage gespeichert" });
      invalidieren();
      setOffen(null);
    },
    onError: (error) =>
      toast({ variant: "error", title: "Speichern fehlgeschlagen", description: errMsg(error) }),
  });

  const loeschen = useMutation({
    mutationFn: (id: string) => deleteVorlage(id),
    onSuccess: () => {
      // Ausdrücklich benannt, weil es sonst wie Datenverlust aussieht: der
      // Fremdschlüssel trägt `on delete set null`, bereits erzeugte Termine
      // bleiben also stehen und verlieren nur ihre Herkunft.
      toast({
        variant: "success",
        title: "Vorlage gelöscht",
        description: "Bereits erzeugte Termine bleiben bestehen.",
      });
      invalidieren();
    },
    onError: (error) =>
      toast({ variant: "error", title: "Löschen fehlgeschlagen", description: errMsg(error) }),
  });

  return (
    <div className="space-y-4">
      {offen === null && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOffen("neu")}>
            Vorlage anlegen
          </Button>
        </div>
      )}

      {offen === "neu" && (
        <Card>
          <VorlageForm
            submitLabel="Vorlage anlegen"
            pending={anlegen.isPending}
            onSubmit={(i) => anlegen.mutate(i)}
            onCancel={() => setOffen(null)}
          />
        </Card>
      )}

      {/* Eine gescheiterte Abfrage ist keine leere Liste. Ohne diesen Zweig
          stünde hier „Du hast noch keine Vorlage", während welche existieren —
          der Fehler fiele erst beim nächsten Anlegen auf. Wortlaut und Ton wie
          im Fehlerzweig der Events-Abfrage nebenan. */}
      {fehler && offen === null && (
        <p className="text-sm text-danger">
          Vorlagen konnten nicht geladen werden. Bitte neu laden.
        </p>
      )}

      {!fehler && vorlagen.length === 0 && offen === null && (
        <p className="text-sm text-muted">
          Du hast noch keine Vorlage. Eine Vorlage hält Titel, Ort und Uhrzeit eines Formats fest —
          und erzeugt daraus auf einen Schlag alle Termine einer Serie.
        </p>
      )}

      <ul className="space-y-3">
        {vorlagen.map((v) =>
          serie === v.id ? (
            <li key={v.id}>
              <Card>
                <SerieErzeugen vorlage={v} onDone={() => setSerie(null)} />
              </Card>
            </li>
          ) : offen === v.id ? (
            <li key={v.id}>
              <Card>
                <VorlageForm
                  initial={v}
                  submitLabel="Speichern"
                  pending={speichern.isPending}
                  onSubmit={(input) => speichern.mutate({ id: v.id, input })}
                  onCancel={() => setOffen(null)}
                />
              </Card>
            </li>
          ) : (
            <li key={v.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-ink">{v.title}</p>
                    <p className="text-sm text-muted">{regelText(v)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Nur mit Regel: ohne `wiederholung` gibt es keine Serie,
                        und `event_serie_slots()` hätte nichts zu rechnen. Der
                        Knopf fehlt dann, statt in einen leeren Dialog zu führen. */}
                    {v.wiederholung !== null && (
                      <Button variant="ghost" size="sm" onClick={() => setSerie(v.id)}>
                        Termine erzeugen
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setOffen(v.id)}>
                      Bearbeiten
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loeschen.isPending}
                      onClick={() => loeschen.mutate(v.id)}
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
