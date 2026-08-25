import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageSkeleton } from "../components/ui/Skeleton";
import {
  adminFeedbackQueryKey,
  fetchAdminFeedback,
  FEEDBACK_SEITENGROESSE,
  type AdminFeedbackRow,
} from "../lib/feedback";

/**
 * QM-Feedback als eigene Verwaltungsfläche (AGE-358, hierher verlegt mit AGE-587).
 *
 * WARUM EINE SEITE UND NICHT WEITER EINE KARTE:
 * Die Karte auf `/admin` holte JEDE Feedback-Zeile auf einmal — sie war die
 * letzte listende Fläche ohne Blätterung. Eine Karte, die unbegrenzt wächst,
 * verdrängt ausserdem die Einstellungen, neben denen sie stand.
 *
 * Read-only, und das ist eine Zusage, keine Auslassung: der Admin liest das
 * QM-Feedback, er verwaltet es nicht. Es gibt keinen Weg, eine fremde Zeile zu
 * ändern oder zu löschen.
 *
 * Kein eigenes Rollen-Gate: die Seite hängt hinter `RequireAdmin`, und die
 * echte Grenze ist ohnehin `is_admin()` im Rumpf von `admin_list_feedback`.
 */
function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-muted">ohne Bewertung</span>;
  return (
    <span className="text-accent-strong">
      <span aria-hidden="true">
        {"★".repeat(rating)}
        {"☆".repeat(5 - rating)}
      </span>
      <span className="sr-only">{rating} von 5 Sternen</span>
    </span>
  );
}

function FeedbackItem({ row }: { row: AdminFeedbackRow }) {
  const date = new Date(row.created_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return (
    <li className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <Stars rating={row.rating} />
        <span className="text-xs text-muted">{date}</span>
      </div>
      <dl className="mt-1 space-y-0.5 text-sm">
        {row.likes && (
          <div>
            <dt className="inline text-muted">Gefällt: </dt>
            <dd className="inline text-ink">{row.likes}</dd>
          </div>
        )}
        {row.misses && (
          <div>
            <dt className="inline text-muted">Fehlt: </dt>
            <dd className="inline text-ink">{row.misses}</dd>
          </div>
        )}
        {row.idea && (
          <div>
            <dt className="inline text-muted">Idee: </dt>
            <dd className="inline text-ink">{row.idea}</dd>
          </div>
        )}
      </dl>
      <p className="mt-1 text-xs text-muted">
        {/* Der Verfasser führt auf SEINE Verwaltungsseite. Genau dafür gibt die
            RPC seit AGE-587 `profile_id` heraus: die Zeile soll verknüpfbar
            sein und nicht nur lesbar. Auf `/admin/mitglied/:id` und nicht auf
            `/p/:id` — die öffentliche Sicht verlangt ein bestätigtes
            Zielprofil, und ein unbestätigtes Mitglied kann Feedback schreiben. */}
        <Link to={`/admin/mitglied/${row.profile_id}`} className="hover:text-ink hover:underline">
          {row.author_name}
        </Link>
        {row.route ? ` · ${row.route}` : ""}
      </p>
    </li>
  );
}

export default function AdminFeedbackPage() {
  const [seite, setSeite] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: adminFeedbackQueryKey(seite),
    queryFn: () => fetchAdminFeedback(seite),
  });

  const zeilen = data?.feedbacks ?? [];
  const von = seite * FEEDBACK_SEITENGROESSE + 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">QM-Feedback</h1>
        <p className="text-sm text-muted">
          Was Mitglieder über die Plattform zurückmelden. Nur zum Lesen.
        </p>
      </header>

      <Card className="flex flex-col gap-3">
        {isLoading && <PageSkeleton />}
        {/* Ein Fehler bekommt eine EIGENE Meldung. Der Leerzustand behauptet
            „es gibt kein Feedback" — das weiss ein gescheiterter Aufruf gerade
            nicht, und „leer" hat hier ohnehin schon eine zweite Ursache (ein
            Nicht-Admin bekommt null Zeilen). Eine dritte, stumme braucht es
            nicht. */}
        {isError && <p className="text-sm text-danger">Feedback konnte nicht geladen werden.</p>}
        {!isLoading && !isError && zeilen.length === 0 && (
          <p className="text-sm text-muted">Noch kein Feedback.</p>
        )}
        {!isLoading && !isError && zeilen.length > 0 && (
          <>
            <ul className="flex flex-col gap-3">
              {zeilen.map((row) => (
                <FeedbackItem key={row.id} row={row} />
              ))}
            </ul>

            <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
              <p className="text-sm text-muted">{`Rückmeldungen ${von}–${von + zeilen.length - 1}`}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={seite === 0}
                  onClick={() => setSeite((s) => Math.max(0, s - 1))}
                >
                  Zurück
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!data?.hatWeitere}
                  onClick={() => setSeite((s) => s + 1)}
                >
                  Weiter
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
