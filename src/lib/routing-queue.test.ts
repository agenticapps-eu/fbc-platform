import { describe, expect, it } from "vitest";
import { ROUTING_QUEUE_STATUS_LABEL, mapRoutingQueueRow } from "./routing-queue";

const row = {
  id: "q1",
  match_id: "m1",
  status: "open",
  routing: "dkri",
  volume_band: "gt_10m",
  score: 82,
  member_a_name: "Alice",
  member_b_name: "Bob",
  need_category: "investoren",
  need_title: "Suche Großinvestor",
  assigned_to: null,
  created_at: "2026-06-14T10:00:00Z",
};

describe("mapRoutingQueueRow (§8 Manager-Queue)", () => {
  it("überführt eine RPC-Zeile inkl. lesbarem Volumen-Label", () => {
    const item = mapRoutingQueueRow(row);
    expect(item).toMatchObject({
      id: "q1",
      matchId: "m1",
      status: "open",
      routing: "dkri",
      volumeBand: "gt_10m",
      volumeBandLabel: "> 10 Mio. €",
      score: 82,
      memberAName: "Alice",
      memberBName: "Bob",
      needCategory: "investoren",
      assignedTo: null,
    });
  });

  it("leitet routing aus dem Band ab, wenn die RPC keins liefert", () => {
    // Defensiver Fallback: ohne explizites routing entscheidet das Volumen-Band.
    const item = mapRoutingQueueRow({ ...row, routing: "", volume_band: "100k_1m" });
    expect(item.routing).toBe("fbc");
  });

  it("verträgt fehlende optionale Felder", () => {
    const item = mapRoutingQueueRow({
      ...row,
      volume_band: null,
      need_category: null,
      need_title: null,
      member_a_name: null,
    });
    expect(item.volumeBand).toBeNull();
    expect(item.volumeBandLabel).toBeNull();
    expect(item.needCategory).toBeNull();
  });

  it("deckt alle Status-Labels ab", () => {
    expect(ROUTING_QUEUE_STATUS_LABEL.open).toBe("Offen");
    expect(ROUTING_QUEUE_STATUS_LABEL.in_review).toBe("In Prüfung");
    expect(ROUTING_QUEUE_STATUS_LABEL.forwarded).toBe("Weitergeleitet");
  });
});
