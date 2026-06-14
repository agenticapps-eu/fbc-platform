import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Select";
import { useToast } from "../components/ui/toast-context";
import { categoryLabel } from "../config/matching";
import {
  ROUTING_QUEUE_STATUS_LABEL,
  assignRoutingQueueItem,
  fetchRoutingQueue,
  routingQueueQueryKey,
  setRoutingQueueStatus,
  type RoutingQueueItem,
  type RoutingQueueStatus,
} from "../lib/routing-queue";
import { useAuth } from "../providers/auth-context";

const STATUS_ORDER: RoutingQueueStatus[] = ["open", "in_review", "forwarded"];

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

/**
 * Interne Routing-Queue (AGE-249, §8) — geschützte Manager-Ansicht für große
 * (DKRI-)Volumina. Nur für Rolle matching_manager/admin (Gate: RequireStaff;
 * DB-seitig erzwingt list_routing_queue/RLS is_matching_manager()).
 *
 * Phase 1 ist Queue/Sichtbarkeit: Fälle sichten, Status setzen (offen → in
 * Prüfung → weitergeleitet), sich zuweisen. Der eigentliche DKRI-Deal-Workflow
 * kommt in Phase 2.
 */
export default function InternRoutingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: routingQueueQueryKey,
    queryFn: fetchRoutingQueue,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RoutingQueueStatus }) =>
      setRoutingQueueStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routingQueueQueryKey }),
    onError: (e) =>
      toast({ title: "Status nicht gesetzt", description: errorMessage(e), variant: "error" }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string | null }) =>
      assignRoutingQueueItem(id, assignedTo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routingQueueQueryKey }),
    onError: (e) =>
      toast({ title: "Zuweisung fehlgeschlagen", description: errorMessage(e), variant: "error" }),
  });

  const items = data ?? [];
  const openCount = items.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">Routing-Queue</h1>
          <Badge variant="legacy">DKRI</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          Große Volumina (DKRI Deal-Keeping) zur Sichtung. {openCount} offen · {items.length}{" "}
          gesamt.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted">Queue wird geladen…</p>
      ) : isError ? (
        <p className="text-sm text-danger">
          Queue konnte nicht geladen werden: {errorMessage(error)}
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          title="Keine großen Volumina in der Queue"
          description="Sobald eine Kontaktanfrage auf ein DKRI-Match gestellt wird, erscheint der Fall hier."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              selfId={user?.id ?? null}
              busy={statusMutation.isPending || assignMutation.isPending}
              onStatus={(status) => statusMutation.mutate({ id: item.id, status })}
              onAssign={(assignedTo) => assignMutation.mutate({ id: item.id, assignedTo })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueRow({
  item,
  selfId,
  busy,
  onStatus,
  onAssign,
}: {
  item: RoutingQueueItem;
  selfId: string | null;
  busy: boolean;
  onStatus: (status: RoutingQueueStatus) => void;
  onAssign: (assignedTo: string | null) => void;
}) {
  const assignedToSelf = !!selfId && item.assignedTo === selfId;

  return (
    <li>
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">
              {item.memberAName ?? "—"} ↔ {item.memberBName ?? "—"}
            </span>
            <Badge variant="prime">{item.score} %</Badge>
            {item.volumeBandLabel && <Badge variant="neutral">{item.volumeBandLabel}</Badge>}
          </div>
          <p className="mt-1 truncate text-sm text-muted">
            {item.needCategory ? categoryLabel("need", item.needCategory) : "Bedarf unbekannt"}
            {item.needTitle ? ` · ${item.needTitle}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor={`status-${item.id}`}>
            Status
          </label>
          <Select
            id={`status-${item.id}`}
            className="h-9 w-40"
            value={item.status}
            disabled={busy}
            onChange={(e) => onStatus(e.target.value as RoutingQueueStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {ROUTING_QUEUE_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Button
            variant={assignedToSelf ? "ghost" : "secondary"}
            size="sm"
            disabled={busy || !selfId}
            onClick={() => onAssign(assignedToSelf ? null : selfId)}
          >
            {assignedToSelf ? "Zuweisung lösen" : "Mir zuweisen"}
          </Button>
        </div>
      </Card>
    </li>
  );
}
