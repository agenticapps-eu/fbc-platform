import { Link } from "react-router-dom";

import { Button } from "../ui/Button";
import { ThreadList } from "./ThreadList";
import { useThreadsSeite } from "./use-threads-seite";

/**
 * Der Inhalt der stehenden Nachrichten-Leiste (AGE-627).
 *
 * Dieselbe Liste wie auf `/chat`, aus derselben Query — nicht nachgebaut.
 * `ThreadList` trägt Marker, Namen und Vorschauzeile schon; hier kommt nur der
 * Rahmen dazu: die drei Zustände und der Weg zu den weiteren Gesprächen.
 *
 * **Drei Zustände, nicht einer.** `data ?? []` zeigte einen RLS-Fehler als
 * „keine Kontakte" — ein Mitglied läse dann, seine Kontakte hätten ihm nichts
 * geschrieben, während in Wahrheit gar nichts gelesen wurde.
 *
 * Die Leere hängt an **Threads**, nicht an akzeptierten Kontakten: ein Thread
 * überlebt einen späteren Statuswechsel des Kontakts, und die Liste zeigt, was
 * es an Gesprächen gibt.
 *
 * Diese Komponente wird nur MONTIERT, wenn die Leiste offen und sichtbar ist —
 * dass eine eingeklappte Leiste keine Threads holt, steht deshalb an genau
 * einer Stelle (der Hülle) und nicht als Schalter auch noch hier.
 */
export function ChatPanel({
  uid,
  activeId,
  onSelect,
  ungelesenJeThread,
}: {
  uid: string | null;
  activeId: string | null;
  onSelect: (threadId: string) => void;
  ungelesenJeThread: Map<string, number>;
}) {
  const seite = useThreadsSeite(uid);
  const threads = seite.data?.pages.flatMap((s) => s.threads) ?? [];

  if (seite.isError) {
    return (
      <p className="px-4 py-6 text-sm text-muted">
        Die Gespräche konnten nicht geladen werden. Lade die Seite neu.
      </p>
    );
  }

  if (seite.isLoading) {
    return <p className="px-4 py-6 text-sm text-muted">Gespräche werden geladen…</p>;
  }

  if (threads.length === 0) {
    return (
      <div className="space-y-3 px-4 py-6">
        <p className="text-sm text-muted">
          Noch kein Gespräch. Chats entstehen, sobald eine Kontaktanfrage angenommen wurde.
        </p>
        <Link to="/mitglieder">
          <Button variant="secondary" size="sm">
            Mitglieder entdecken
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <ThreadList
        threads={threads}
        activeId={activeId}
        onSelect={onSelect}
        ungelesenJeThread={ungelesenJeThread}
      />
      {/* Ohne diesen Knopf wäre alles jenseits der ersten Seite dauerhaft
          unerreichbar — dieselbe Zusage wie auf `/chat`. */}
      {seite.hasNextPage && (
        <div className="flex justify-center p-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void seite.fetchNextPage()}
            disabled={seite.isFetchingNextPage}
          >
            {seite.isFetchingNextPage ? "Wird geladen…" : "Weitere Gespräche"}
          </Button>
        </div>
      )}
    </>
  );
}
