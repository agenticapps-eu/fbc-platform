import { useQuery } from "@tanstack/react-query";

import { Card, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { fetchZugestellte, releaseNotesQueryKey } from "../lib/release-notes";

/**
 * „Neu in der App" — was wir geändert haben (AGE-631).
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
 */
function formatDatum(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function NeuesPage() {
  const notes = useQuery({
    queryKey: releaseNotesQueryKey("sent"),
    queryFn: () => fetchZugestellte(),
  });

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
              <Card className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <CardTitle>{n.title}</CardTitle>
                  <span className="shrink-0 text-xs text-muted">{formatDatum(n.sent_at)}</span>
                </div>
                {/* Der Text stammt aus der Redaktion eines Admins und wird als
                    Text gerendert, nicht als Markup. Ein `dangerouslySetInnerHTML`
                    hier wäre eine Einladung, die niemand braucht. */}
                <p className="whitespace-pre-line text-sm text-ink">{n.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
