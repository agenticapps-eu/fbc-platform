import { routingForBand, volumeBandLabel, type Routing, type VolumeBand } from "../config/matching";
import { supabase } from "./supabase";

/**
 * FBC/DKRI-Routing — Datenschicht der Manager-Queue (AGE-249). Spec: §8.
 *
 * Die Queue ist staff-only. Lesen läuft über die SECURITY-DEFINER-RPC
 * `list_routing_queue` (verbindet jeden Fall mit Match-Score, beiden Mitglieds-
 * namen und dem auslösenden Bedarf — paarübergreifende Daten, die die RLS einem
 * Manager außerhalb des Paars verbergen würde; die RPC gibt für Nicht-Manager
 * NICHTS zurück). Status-/Zuweisungs-Änderungen gehen direkt auf die Tabelle und
 * werden von der RLS (`routing_queue_update_staff`) erzwungen.
 */

export type RoutingQueueStatus = "open" | "in_review" | "forwarded";

export const ROUTING_QUEUE_STATUS_LABEL: Record<RoutingQueueStatus, string> = {
  open: "Offen",
  in_review: "In Prüfung",
  forwarded: "Weitergeleitet",
};

export interface RoutingQueueItem {
  id: string;
  matchId: string;
  status: RoutingQueueStatus;
  routing: Routing;
  volumeBand: VolumeBand | null;
  volumeBandLabel: string | null;
  score: number;
  memberAName: string | null;
  memberBName: string | null;
  needCategory: string | null;
  needTitle: string | null;
  assignedTo: string | null;
  createdAt: string;
}

export const routingQueueQueryKey = ["routing-queue"] as const;

/** Eine Zeile der `list_routing_queue`-RPC in das UI-Modell überführen (rein, testbar). */
type RoutingQueueRow = {
  id: string;
  match_id: string;
  status: string;
  routing: string;
  volume_band: string | null;
  score: number;
  member_a_name: string | null;
  member_b_name: string | null;
  need_category: string | null;
  need_title: string | null;
  assigned_to: string | null;
  created_at: string;
};

export function mapRoutingQueueRow(row: RoutingQueueRow): RoutingQueueItem {
  return {
    id: row.id,
    matchId: row.match_id,
    status: row.status as RoutingQueueStatus,
    routing: (row.routing as Routing) || routingForBand(row.volume_band),
    volumeBand: (row.volume_band as VolumeBand | null) ?? null,
    volumeBandLabel: volumeBandLabel(row.volume_band),
    score: row.score,
    memberAName: row.member_a_name,
    memberBName: row.member_b_name,
    needCategory: row.need_category,
    needTitle: row.need_title,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
  };
}

export async function fetchRoutingQueue(): Promise<RoutingQueueItem[]> {
  const { data, error } = await supabase.rpc("list_routing_queue");
  if (error) throw error;
  return (data ?? []).map(mapRoutingQueueRow);
}

/** Status eines Queue-Falls setzen (open → in_review → forwarded). RLS: nur Manager. */
export async function setRoutingQueueStatus(id: string, status: RoutingQueueStatus): Promise<void> {
  const { error } = await supabase.from("routing_queue").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Fall dem angemeldeten Manager zuweisen (oder Zuweisung lösen). RLS: nur Manager. */
export async function assignRoutingQueueItem(id: string, assignedTo: string | null): Promise<void> {
  const { error } = await supabase
    .from("routing_queue")
    .update({ assigned_to: assignedTo })
    .eq("id", id);
  if (error) throw error;
}
