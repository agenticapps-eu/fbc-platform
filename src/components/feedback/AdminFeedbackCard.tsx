import { useQuery } from "@tanstack/react-query";

import { fetchAdminFeedback, type AdminFeedbackRow } from "../../lib/feedback";
import { Card, CardTitle } from "../ui/Card";

/**
 * Admin-Sicht auf das QM-Feedback (AGE-358). Read-only. Wird von EinstellungenPage
 * NUR gerendert, wenn staffRole === 'admin' — die RPC `admin_list_feedback` gäbe einem
 * Nicht-Admin ohnehin leer zurück (Rolle server-seitig geprüft), das UI-Gating ist Komfort.
 */
const ADMIN_FEEDBACK_QUERY_KEY = ["admin-feedback"] as const;

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
        {row.author_name}
        {row.route ? ` · ${row.route}` : ""}
      </p>
    </li>
  );
}

export function AdminFeedbackCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ADMIN_FEEDBACK_QUERY_KEY,
    queryFn: fetchAdminFeedback,
  });

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>QM-Feedback</CardTitle>
      {isLoading && <p className="text-sm text-muted">Wird geladen…</p>}
      {isError && <p className="text-sm text-danger">Feedback konnte nicht geladen werden.</p>}
      {data && data.length === 0 && <p className="text-sm text-muted">Noch kein Feedback.</p>}
      {data && data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.map((row) => (
            <FeedbackItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </Card>
  );
}
