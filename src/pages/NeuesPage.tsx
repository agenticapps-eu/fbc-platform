import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { ReleaseNoteModal, formatDatum } from "../components/release/ReleaseNoteModal";
import { Card, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { fetchZugestellte, releaseNotesQueryKey } from "../lib/release-notes";

/**
 * „Neu in der App" — was wir geändert haben (AGE-631, Modal AGE-632).
 *
 * **Warum es diese Seite überhaupt gibt.** Der Hinweis in der Glocke ist
 * wegklickbar, die Glocke liest nur Ungelesenes und deckelt bei 50
 * (`hinweise.ts:31`). Ohne diese Fläche wäre eine Mitteilung nach einem Klick
 * unwiederbringlich fort — und genau das ist der Grund, warum es für diesen
 * Hinweistyp keinen Opt-out-Schalter braucht: der Ausgleich ist die
 * Auffindbarkeit, nicht die Abbestellung.
 *
 * **Kein Stufen-Gate.** Was die Anwendung kann, ist keine Frage der
 * Mitgliedsstufe. Die Grenze ist die RLS: `release_notes_read_sent` gibt
 * ausschliesslich **zugestellte** Notes frei, Entwürfe nur einem Admin.
 *
 * **Der offene Zustand steht in der Adresse, nicht im Zustand der Komponente.**
 * Die Glocke muss eine bestimmte Note öffnen können — sie verlinkte bisher nur
 * die Fläche, und das war der Mangel. Ein Suchparameter löst beides: die Glocke
 * bekommt ihr Ziel, und die Zurück-Taste schliesst das Modal, statt die Seite zu
 * verlassen.
 */
export default function NeuesPage() {
  const [params, setParams] = useSearchParams();
  const notes = useQuery({
    queryKey: releaseNotesQueryKey("sent"),
    queryFn: () => fetchZugestellte(),
  });

  // Eine Note kann gelöscht sein, während der Hinweis noch in der Glocke steht.
  // Dann steht hier `undefined` und es öffnet sich nichts — ein leeres Modal
  // wäre schlechter als keines.
  const offene = (notes.data ?? []).find((n) => n.id === params.get("note"));

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Neu in der App</h1>
        <p className="mt-1 text-sm text-muted">
          Was wir zuletzt geändert haben — das Jüngste zuerst.
        </p>
      </header>

      {/* Drei Zustände, nicht einer. `data ?? []` zeigte einen Fehler beim
          Laden als „noch nichts geändert" — und das ist eine Aussage, die wir
          nicht machen wollen, wenn wir in Wahrheit nichts gelesen haben. */}
      {notes.isError ? (
        <Card>
          <CardTitle>Konnte nicht geladen werden</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Die Änderungsliste ist gerade nicht erreichbar. Bitte lade die Seite neu.
          </p>
        </Card>
      ) : notes.isLoading ? (
        <p className="text-sm text-muted">Wird geladen…</p>
      ) : (notes.data ?? []).length === 0 ? (
        <EmptyState
          title="Noch nichts angekündigt"
          description="Sobald sich etwas an der Anwendung ändert, steht es hier."
        />
      ) : (
        <ol className="flex flex-col gap-4">
          {(notes.data ?? []).map((n) => (
            <li key={n.id}>
              {/* Die ganze Karte ist der Auslöser, nicht ein Link darin: ein
                  Ziel von der Größe einer Textzeile trifft auf dem Telefon
                  niemand zuverlässig. */}
              <button
                type="button"
                onClick={() => setParams({ note: n.id })}
                className="w-full text-left"
              >
                <Card className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <CardTitle>{n.title}</CardTitle>
                    <span className="shrink-0 text-xs text-muted">{formatDatum(n.sent_at)}</span>
                  </div>
                  {/* Der Anriss, nicht der ganze Text — sonst hätte das Modal
                      nichts hinzuzufügen. `line-clamp` kürzt optisch; der Text
                      bleibt vollständig im Dokument und damit auffindbar. */}
                  <p className="line-clamp-2 whitespace-pre-line text-sm text-ink">{n.body}</p>
                </Card>
              </button>
            </li>
          ))}
        </ol>
      )}

      {offene && (
        <ReleaseNoteModal
          note={offene}
          // `replace`: das Öffnen soll einen Eintrag im Verlauf anlegen, das
          // Schliessen keinen zweiten. Sonst führte die Zurück-Taste nach dem
          // Schliessen zurück in das gerade geschlossene Modal.
          onClose={() => setParams({}, { replace: true })}
        />
      )}
    </div>
  );
}
